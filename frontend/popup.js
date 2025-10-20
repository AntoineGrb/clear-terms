// ========================================
// IMPORTS (via script tags dans popup.html)
// i18n.js, utils/*.js, services/*.js sont chargés avant ce fichier
// ========================================

// ========================================
// Event Handlers
// ========================================

// ========================================
// Vérifier les actions en attente depuis le toast
// ========================================
(async () => {
  const { pendingToastAction } = await chrome.storage.local.get(['pendingToastAction']);

  if (pendingToastAction) {
    // Vérifier que l'action n'est pas trop vieille (max 5 secondes)
    const age = Date.now() - pendingToastAction.timestamp;
    if (age < 5000) {
      console.log('📋 [POPUP] Action en attente depuis le toast:', pendingToastAction.type);

      if (pendingToastAction.type === 'DISPLAY_REPORT') {
        // Afficher le rapport
        console.log('📊 [POPUP] Affichage du rapport depuis l\'historique');
        console.log('📊 [POPUP] Hash du rapport:', pendingToastAction.report?.metadata?.content_hash);
        console.log('📊 [POPUP] Site:', pendingToastAction.report?.metadata?.site_name);
        displayReport(pendingToastAction.report);
      } else if (pendingToastAction.type === 'PERFORM_ANALYSIS') {
        // Lancer l'analyse
        console.log('🚀 [POPUP] Lancement de l\'analyse depuis le toast');
        console.log('🔗 [POPUP] URL:', pendingToastAction.url);
        await handleToastAnalysisRequest(pendingToastAction.url, pendingToastAction.content);
      }
    } else {
      console.warn('⚠️ [POPUP] Action trop vieille, ignorée (age: ' + age + 'ms)');
    }

    // Nettoyer l'action en attente
    await chrome.storage.local.remove(['pendingToastAction']);
  }
})();

// Handler pour le bouton d'analyse
document.getElementById('scanButton').addEventListener('click', async () => {
  await handleManualAnalysis();
});

/**
 * Gère l'analyse manuelle depuis le bouton
 */
async function handleManualAnalysis(forceNew = false) {
  const button = document.getElementById('scanButton');
  button.disabled = true;
  button.classList.add('opacity-50', 'cursor-not-allowed');

  let currentUrl = 'unknown';

  try {
    updateStatus('statusExtracting', 'loading');

    // Extraire le contenu
    const { content: text, url } = await extractPageContent();
    currentUrl = url;

    if (!text || text.length < 100) {
      throw new Error('Le contenu de la page est trop court pour être analysé');
    }

    // VALIDATION : Vérifier que c'est bien des CGU
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const validation = await chrome.tabs.sendMessage(tab.id, {
        type: 'VALIDATE_CONTENT',
        content: text
      });

      if (!validation.valid) {
        // Message d'erreur simplifié pour l'utilisateur
        const lang = await loadLanguagePreference();
        const message = i18n.t('notCGUPage', lang);
        updateStatus(`ERROR:${message}`, 'error');
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
        return;
      }

    } catch (validationError) {
      // Continuer quand même l'analyse en cas d'erreur de validation
    }

    // Récupérer la préférence de langue
    const userLanguage = await loadLanguagePreference();

    console.log('🌐 [POPUP MANUAL] URL:', url);
    console.log('🗣️ [POPUP MANUAL] Langue:', userLanguage);

    // Vérifier d'abord l'historique par URL (sauf si forceNew = true)
    if (!forceNew) {
      updateStatus('statusSending', 'loading');
      const historyReport = await getReportFromHistory(url, userLanguage);

      if (historyReport) {
        console.log('✅ [POPUP MANUAL] Rapport trouvé dans l\'historique');
        console.log('📊 [POPUP MANUAL] Site du rapport:', historyReport.metadata?.site_name);
        console.log('📊 [POPUP MANUAL] URL du rapport:', historyReport.metadata?.analyzed_url);

        // Afficher le rapport
        displayReport(historyReport);

        // Afficher le message spécial avec lien de relance
        showHistoryFoundStatus(url, text, userLanguage);

        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
        return;
      } else {
        console.log('❌ [POPUP MANUAL] Aucun rapport trouvé dans l\'historique');
      }
    }

    // Pas de rapport dans l'historique OU relance forcée : lancer une analyse
    console.log('🚀 [POPUP] Lancement d\'une nouvelle analyse');

    // Vérifier les crédits AVANT de lancer l'analyse
    const hasCredits = await authService.hasCredits();

    if (!hasCredits) {
      const lang = await loadLanguagePreference();
      const message = i18n.t('errorNoCredits', lang);
      updateStatus(`ERROR:${message}`, 'warning');
      button.disabled = false;
      button.classList.remove('opacity-50', 'cursor-not-allowed');
      return;
    }

    updateStatus('statusAnalyzing', 'loading');

    // Lancer l'analyse (cache ou IA)
    const scanResult = await performAnalysis(url, text, userLanguage);
    const { job_id } = scanResult;

    chrome.runtime.sendMessage({
      type: 'ANALYSIS_STARTED',
      url,
      jobId: job_id
    });

    // Attendre le résultat via polling
    const report = await pollJob(job_id);

    updateStatus('statusComplete', 'success');

    // Ajouter au reportsHistory
    await addToReportsHistory(report);

    // Logger le rapport complet dans le service worker
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_COMPLETE',
      url,
      report
    });

    // Afficher le rapport
    displayReport(report);

  } catch (error) {
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_ERROR',
      url: currentUrl,
      error: error.message,
      errorCode: error.code
    });

    // Gestion spécifique de l'erreur quota
    if (error.message === 'QUOTA_EXCEEDED' || error.isQuotaError) {
      const lang = await loadLanguagePreference();
      const message = i18n.t('errorNoCredits', lang);
      updateStatus(`ERROR:${message}`, 'warning');
    } else {
      // Classifier et formater l'erreur pour l'utilisateur
      const lang = await loadLanguagePreference();
      const formattedError = formatErrorForUser(error, lang);
      updateStatus(`ERROR:${formattedError.message}`, 'error');
    }
  } finally {
    button.disabled = false;
    button.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

/**
 * Affiche un message spécial quand un rapport est trouvé dans l'historique
 */
function showHistoryFoundStatus(url, content, userLanguage) {
  const statusDiv = document.getElementById('status');
  const lang = document.documentElement.lang || 'fr';

  const message = i18n.t('analysisFoundInHistory', lang);
  const linkText = i18n.t('relaunCharelinkAnalysis', lang);

  statusDiv.innerHTML = `
    <div class="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
      <p class="text-xs text-blue-800 mb-2">${message}</p>
      <a href="#" id="relaunchAnalysisLink" class="text-xs font-medium text-primary-600 hover:text-primary-700 underline">
        ${linkText}
      </a>
    </div>
  `;

  // Attacher l'événement au lien
  document.getElementById('relaunchAnalysisLink').addEventListener('click', async (e) => {
    e.preventDefault();
    statusDiv.innerHTML = ''; // Nettoyer le message
    await handleManualAnalysis(true); // Forcer une nouvelle analyse
  });
}

// ========================================
// Navigation
// ========================================

/**
 * Cache toutes les pages
 */
function hideAllPages() {
  document.getElementById('mainPage').classList.add('hidden');
  document.getElementById('settingsPage').classList.add('hidden');
  document.getElementById('aboutPage').classList.add('hidden');
  document.getElementById('termsPage').classList.add('hidden');
}

/**
 * Afficher les différentes pages du popup
 */
function showSettingsPage() {
  hideAllPages();
  document.getElementById('settingsPage').classList.remove('hidden');
}

function showMainPage() {
  hideAllPages();
  document.getElementById('mainPage').classList.remove('hidden');
}

function showAboutPage() {
  hideAllPages();
  document.getElementById('aboutPage').classList.remove('hidden');
}

function showTermsPage() {
  hideAllPages();
  document.getElementById('termsPage').classList.remove('hidden');
}

// Event listeners pour la navigation
document.getElementById('settingsButton').addEventListener('click', () => {
  showSettingsPage();
});

document.getElementById('backButton').addEventListener('click', () => {
  showMainPage();
});

// Navigation vers À propos
document.getElementById('aboutButton').addEventListener('click', () => {
  showAboutPage();
});

document.getElementById('backFromAbout').addEventListener('click', () => {
  showMainPage();
});

// Navigation vers Terms
document.getElementById('termsButton').addEventListener('click', () => {
  showTermsPage();
});

document.getElementById('backFromTerms').addEventListener('click', () => {
  showMainPage();
});

// Navigation vers l'historique
document.getElementById('historyLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/history/history.html') });
});

// Navigation vers la page de paiement
document.getElementById('buyCreditsButton').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/billing/billing.html') });
});

// ========================================
// Paramètres
// ========================================

// Event listener pour l'activation/désactivation du toast
document.getElementById('toastEnabled').addEventListener('change', (e) => {
  chrome.storage.local.set({ toastEnabled: e.target.checked });
});

// Event listener pour la position du toast
document.getElementById('toastPosition').addEventListener('change', (e) => {
  chrome.storage.local.set({ toastPosition: e.target.value });
});

// Event listener pour la durée du toast
document.getElementById('toastDuration').addEventListener('change', (e) => {
  chrome.storage.local.set({ toastDuration: parseInt(e.target.value) });
});

// Event listener pour copier l'URL
document.getElementById('copyUrlButton').addEventListener('click', async (e) => {
  e.stopPropagation(); // Ne pas déclencher l'accordéon

  const urlElement = document.getElementById('analyzedUrl');
  const fullUrl = urlElement.dataset.fullUrl;

  try {
    await navigator.clipboard.writeText(fullUrl);

    // Feedback visuel
    e.currentTarget.classList.remove('text-gray-400');
    e.currentTarget.classList.add('text-green-500');

    setTimeout(() => {
      e.currentTarget.classList.remove('text-green-500');
      e.currentTarget.classList.add('text-gray-400');
    }, 1000);
  } catch (error) {
    // Erreur silencieuse
  }
});

// ========================================
// Initialisation
// ========================================

// Charger le dernier rapport et la langue au démarrage
chrome.storage.local.get(['lastReport', 'pendingToastAction'], async (result) => {
  // Toujours détecter automatiquement la langue du navigateur
  const lang = detectBrowserLanguage();

  // Appliquer les traductions
  applyTranslations(lang);

  // Charger l'état de la détection automatique et les préférences du toast
  chrome.storage.local.get(['toastEnabled', 'toastPosition', 'toastDuration'], (toastResult) => {
    const toastEnabled = toastResult.toastEnabled !== false; // Activé par défaut
    document.getElementById('toastEnabled').checked = toastEnabled;

    const toastPosition = toastResult.toastPosition || 'bottom-right';
    document.getElementById('toastPosition').value = toastPosition;

    const toastDuration = toastResult.toastDuration !== undefined ? toastResult.toastDuration : 30000;
    document.getElementById('toastDuration').value = toastDuration.toString();
  });

  // Charger et afficher les crédits restants
  chrome.storage.sync.get(['remainingScans'], (scanResult) => {
    const remaining = scanResult.remainingScans !== undefined ? scanResult.remainingScans : 20;
    document.getElementById('remainingScans').textContent = remaining;
  });

  // Initialiser l'authentification (génère deviceId + JWT si première fois)
  authService.getJWT().catch((error) => {
    console.error('[POPUP] Erreur initialisation auth:', error);
  });

  // Si une action depuis le toast est en attente, ne pas charger le lastReport
  // (le rapport sera affiché par le code de gestion de pendingToastAction)
  if (result.pendingToastAction) {
    console.log('[POPUP] Action toast en attente, skip du chargement automatique du lastReport');
    return;
  }

  // Vérifier si une analyse auto est en cours pour l'onglet actif
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const autoJobKey = `autoJob_${tab.id}`;

    chrome.storage.local.get([autoJobKey], (jobResult) => {
      const autoJob = jobResult[autoJobKey];

      if (autoJob && autoJob.status === 'running') {
        // Analyse auto en cours : afficher le loader et griser le bouton
        const button = document.getElementById('scanButton');
        button.disabled = true;
        button.classList.add('opacity-50', 'cursor-not-allowed');
        updateStatus('statusAnalyzing', 'loading');
        continuePollingFromPopup(autoJob.jobId);
      } else {
        // Pas d'analyse en cours : afficher le dernier rapport global
        if (result.lastReport) {
          displayReport(result.lastReport);
        }
      }
    });
  } catch (error) {
    // Fallback: afficher le dernier rapport si disponible
    if (result.lastReport) {
      displayReport(result.lastReport);
    }
  }
});

/**
 * Continue le polling d'un job depuis la popup
 */
async function continuePollingFromPopup(jobId) {
  const button = document.getElementById('scanButton');
  try {
    const report = await pollJob(jobId);
    updateStatus('statusComplete', 'success');
    displayReport(report);
  } catch (error) {
    const lang = await loadLanguagePreference();
    const formattedError = formatErrorForUser(error, lang);
    updateStatus(`ERROR:${formattedError.message}`, 'error');
  } finally {
    // Réactiver le bouton une fois l'analyse terminée
    button.disabled = false;
    button.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

/**
 * Ajoute un rapport à l'historique
 */
async function addToReportsHistory(report) {
  try {
    const { reportsHistory = [] } = await chrome.storage.local.get(['reportsHistory']);

    // Vérifier si le rapport existe déjà (via contentHash)
    const contentHash = report.metadata?.content_hash;
    if (contentHash) {
      const exists = reportsHistory.some(entry =>
        entry.report?.metadata?.content_hash === contentHash &&
        entry.report?.language === report.language
      );

      if (exists) {
        console.log('📚 [HISTORY] Rapport déjà présent dans l\'historique, ignoré');
        return;
      }
    }

    // S'assurer que le rapport a un contentHash et une langue
    if (!report.language && report.metadata?.output_language) {
      report.language = report.metadata.output_language;
    }

    // Créer l'entrée d'historique
    const historyEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      report: report
    };

    reportsHistory.unshift(historyEntry);

    // Limiter à 100 rapports max (FIFO)
    if (reportsHistory.length > 100) {
      reportsHistory.splice(100);
    }

    await chrome.storage.local.set({ reportsHistory });

  } catch (error) {
    // Erreur silencieuse
  }
}

// ========================================
// Message Handlers - Réception depuis content-script/background
// ========================================

/**
 * Écouter les messages depuis le content-script (toast) et background
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DISPLAY_REPORT') {
    // Afficher un rapport depuis l'historique (déclenché par le toast "Voir")
    displayReport(message.report);
    sendResponse({ success: true });
  } else if (message.type === 'PERFORM_ANALYSIS') {
    // Lancer une analyse depuis le toast "Analyser"
    handleToastAnalysisRequest(message.url, message.content).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Async response
  }
});

/**
 * Gère une demande d'analyse depuis le toast
 */
async function handleToastAnalysisRequest(url, content) {
  const button = document.getElementById('scanButton');

  try {
    // Désactiver le bouton pendant l'analyse
    button.disabled = true;
    button.classList.add('opacity-50', 'cursor-not-allowed');

    const userLanguage = await loadLanguagePreference();

    // Vérifier les crédits
    const hasCredits = await authService.hasCredits();

    if (!hasCredits) {
      const lang = await loadLanguagePreference();
      const message = i18n.t('errorNoCredits', lang);
      updateStatus(`ERROR:${message}`, 'warning');
      button.disabled = false;
      button.classList.remove('opacity-50', 'cursor-not-allowed');
      return;
    }

    updateStatus('statusAnalyzing', 'loading');

    // Lancer l'analyse (cache ou IA)
    const scanResult = await performAnalysis(url, content, userLanguage);
    const { job_id } = scanResult;

    chrome.runtime.sendMessage({
      type: 'ANALYSIS_STARTED',
      url,
      jobId: job_id
    });

    // Attendre le résultat via polling
    const report = await pollJob(job_id);

    updateStatus('statusComplete', 'success');

    // Ajouter au reportsHistory
    await addToReportsHistory(report);

    // Logger le rapport complet dans le service worker
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_COMPLETE',
      url,
      report
    });

    // Afficher le rapport
    displayReport(report);

  } catch (error) {
    const lang = await loadLanguagePreference();

    if (error.message === 'QUOTA_EXCEEDED' || error.isQuotaError) {
      const message = i18n.t('errorNoCredits', lang);
      updateStatus(`ERROR:${message}`, 'warning');
    } else {
      const formattedError = formatErrorForUser(error, lang);
      updateStatus(`ERROR:${formattedError.message}`, 'error');
    }
  } finally {
    // Réactiver le bouton
    button.disabled = false;
    button.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}
