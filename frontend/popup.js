// ========================================
// IMPORTS (via script tags dans popup.html)
// i18n.js, utils/*.js, services/*.js sont chargés avant ce fichier
// ========================================

// ========================================
// Fonctions d'analyse et d'affichage
// ========================================

/**
 * Gère l'analyse manuelle depuis le bouton
 */
async function handleAnalysis(forceNew = false) {
  const button = document.getElementById('scanButton');
  button.disabled = true;
  button.classList.add('opacity-50', 'cursor-not-allowed');

  let currentUrl = 'unknown';

  try {
    console.log('🚀 ==================== Demande d\'analyse depuis le popup ====================')
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

    // --- Recherche dans l'historique ---
    console.log('\n[HISTORIQUE] Recherche...');
    console.log('  URL:', url);
    console.log('  Langue:', userLanguage);

    // Vérifier d'abord l'historique par URL (sauf si forceNew = true)
    if (!forceNew) {
      updateStatus('statusSending', 'loading');
      const historyReport = await getReportFromHistory(url, userLanguage);

      if (historyReport) {
        console.log('  ✅ Rapport trouvé');
        console.log('  Métadonnées:', {
          site: historyReport.metadata?.site_name,
          url: historyReport.metadata?.analyzed_url,
          date: historyReport.metadata?.analyzed_at
        });

        // Afficher le rapport
        displayReport(historyReport);

        // Afficher le message spécial avec lien de relance
        showHistoryFoundStatus(url, text, userLanguage);

        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
        return;
      } else {
        console.log('  ❌ Aucun rapport trouvé');
      }
    } else {
      console.log('  ⏭️ Recherche ignorée (relance forcée)');
    }

    // Pas de rapport dans l'historique OU relance forcée : lancer une analyse
    console.log('\n[ANALYSE] Démarrage...');
    console.log('  Source: POPUP');
    console.log('  URL:', url);

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
    console.log('  Job ID:', job_id);

    chrome.runtime.sendMessage({
      type: 'ANALYSIS_STARTED',
      url,
      jobId: job_id
    });

    // Attendre le résultat via polling
    const report = await pollJob(job_id);

    console.log('  ✅ Analyse terminée');
    console.log('  Métadonnées:', {
      site: report.metadata?.site_name,
      url: report.metadata?.analyzed_url,
      date: report.metadata?.analyzed_at,
      source: report.metadata?.source
    });

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
 * Gère une demande d'analyse depuis le toast
 */
async function handleToastAnalysisRequest(url, content) {
  const button = document.getElementById('scanButton');

  try {
    console.log('\n==================== ANALYSE DEPUIS TOAST ====================');
    console.log('URL:', url);

    // Désactiver le bouton pendant l'analyse
    button.disabled = true;
    button.classList.add('opacity-50', 'cursor-not-allowed');

    const userLanguage = await loadLanguagePreference();

    // S'assurer que le token existe avant de vérifier les crédits
    await authService.getJWT();

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
    console.log('Job ID:', job_id);

    chrome.runtime.sendMessage({
      type: 'ANALYSIS_STARTED',
      source: 'TOAST',
      url,
      jobId: job_id
    });

    // Attendre le résultat via polling
    const report = await pollJob(job_id);

    console.log('✅ Analyse terminée');
    console.log('Métadonnées:', {
      site: report.metadata?.site_name,
      url: report.metadata?.analyzed_url,
      date: report.metadata?.analyzed_at,
      source: report.metadata?.source
    });

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
    await handleAnalysis(true); // Forcer une nouvelle analyse
  });
}

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
// Initialisation du popup
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

  // Vérifier s'il y a un statut de paiement à afficher
  chrome.storage.local.get(['paymentStatus'], (paymentResult) => {
    if (paymentResult.paymentStatus) {
      const { status, scansAdded, timestamp } = paymentResult.paymentStatus;

      // Vérifier que le message n'est pas trop vieux (max 2 min)
      if (Date.now() - timestamp < 2 * 60 * 1000) {
        // Afficher automatiquement la page Paramètres
        showSettingsPage();

        // Afficher le message sous les crédits
        displayPaymentStatusMessage(status, scansAdded);
      }

      // Nettoyer le statut après affichage
      chrome.storage.local.remove(['paymentStatus']);
    }
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

// ========================================
// Event handlers
// ========================================

// Vérifier les actions en attente depuis le toast
(async () => {
  const { pendingToastAction } = await chrome.storage.local.get(['pendingToastAction']);

  if (pendingToastAction) {
    // Vérifier que l'action n'est pas trop vieille (max 5 secondes)
    const age = Date.now() - pendingToastAction.timestamp;
    if (age < 5000) {
      console.log('📋 [POPUP] Action en attente depuis le toast:', pendingToastAction.type);

      if (pendingToastAction.type === 'DISPLAY_REPORT') {
        displayReport(pendingToastAction.report);
      } else if (pendingToastAction.type === 'PERFORM_ANALYSIS') {
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
  await handleAnalysis();
});

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

// ========================================
// Navigation sur le popup
// ========================================

/**
 * Cache toutes les pages
 */
function hideAllPages() {
  document.getElementById('mainPage').classList.add('hidden');
  document.getElementById('settingsPage').classList.add('hidden');
  document.getElementById('aboutPage').classList.add('hidden');
  document.getElementById('termsPage').classList.add('hidden');
  document.getElementById('contactPage').classList.add('hidden');
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

function showContactPage() {
  hideAllPages();
  document.getElementById('contactPage').classList.remove('hidden');
  // Charger la support key
  loadSupportKey();
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

// Navigation vers Contact
document.getElementById('contactButton').addEventListener('click', () => {
  showContactPage();
});

document.getElementById('backFromContact').addEventListener('click', () => {
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

// Event listener pour rafraîchir le token
document.getElementById('refreshTokenButton').addEventListener('click', async () => {
  const button = document.getElementById('refreshTokenButton');
  const statusDiv = document.getElementById('refreshTokenStatus');
  const lang = document.documentElement.lang || 'fr';

  try {
    button.disabled = true;
    statusDiv.textContent = '⏳ Rafraîchissement...';
    statusDiv.className = 'mt-2 text-xs text-blue-600';

    // Supprimer le JWT actuel et forcer un nouveau register
    await chrome.storage.sync.remove(['jwt']);

    // Appeler registerUser qui va retrouver le compte existant via deviceId
    const result = await authService.registerUser();

    statusDiv.textContent = i18n.t('refreshTokenSuccess', lang) + ` (${result.remainingScans} crédits)`;
    statusDiv.className = 'mt-2 text-xs text-green-600';

    // Mettre à jour l'affichage des crédits
    await authService.updateCredits(result.remainingScans);

    setTimeout(() => {
      statusDiv.textContent = '';
    }, 3000);

  } catch (error) {
    console.error('[SETTINGS] Erreur refresh token:', error);
    statusDiv.textContent = i18n.t('refreshTokenError', lang);
    statusDiv.className = 'mt-2 text-xs text-red-600';
  } finally {
    button.disabled = false;
  }
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
// Contact page - Support Key
// ========================================

/**
 * Charger et afficher la support key
 */
async function loadSupportKey() {
  try {
    const supportKeyInput = document.getElementById('supportKeyInput');

    // Récupérer depuis le storage (sauvegardé lors du register)
    const result = await chrome.storage.sync.get(['supportKey']);

    if (result.supportKey) {
      supportKeyInput.value = result.supportKey;
    } else {
      // Fallback: récupérer depuis l'API
      const jwt = await authService.getJWT();
      const deviceId = await authService.getDeviceId();

      if (!jwt || !deviceId) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${CONFIG.API_URL}/api/auth/credits?deviceId=${deviceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch support key');
      }

      const data = await response.json();

      if (data.supportKey) {
        supportKeyInput.value = data.supportKey;
        // Sauvegarder pour la prochaine fois
        await chrome.storage.sync.set({ supportKey: data.supportKey });
      } else {
        throw new Error('Support key not available');
      }
    }
  } catch (error) {
    console.error('[CONTACT] Error loading support key:', error);
    document.getElementById('supportKeyInput').value = 'Erreur de chargement';
  }
}

/**
 * Copier la support key dans le presse-papiers
 */
document.getElementById('copySupportKeyButton').addEventListener('click', async () => {
  const supportKey = document.getElementById('supportKeyInput').value;

  if (supportKey && supportKey !== 'Chargement...' && supportKey !== 'Erreur de chargement') {
    try {
      await navigator.clipboard.writeText(supportKey);

      // Afficher le message de succès
      const successMessage = document.getElementById('copySuccessMessage');
      successMessage.classList.remove('hidden');

      setTimeout(() => {
        successMessage.classList.add('hidden');
      }, 3000);
    } catch (error) {
      console.error('[CONTACT] Error copying to clipboard:', error);
      // Fallback: sélectionner le texte
      document.getElementById('supportKeyInput').select();
    }
  }
});

/**
 * Sélectionner tout le texte au clic sur l'input
 */
document.getElementById('supportKeyInput').addEventListener('click', (e) => {
  e.target.select();
});

/**
 * Afficher un message de statut de paiement sous les crédits
 */
function displayPaymentStatusMessage(status, scansAdded) {
  const creditsDiv = document.getElementById('remainingScans').parentElement;

  // Créer le div de message s'il n'existe pas
  let messageDiv = document.getElementById('paymentStatusMessage');
  if (!messageDiv) {
    messageDiv = document.createElement('div');
    messageDiv.id = 'paymentStatusMessage';
    creditsDiv.appendChild(messageDiv);
  }

  if (status === 'success') {
    messageDiv.innerHTML = `
      <div class="mt-3 p-3 bg-green-50 rounded-md border border-green-200">
        <p class="text-xs text-green-800 font-medium">
          ✅ Crédits ajoutés${scansAdded ? ` (+${scansAdded} scans)` : ''}
        </p>
      </div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="mt-3 p-3 bg-red-50 rounded-md border border-red-200">
        <p class="text-xs text-red-800 font-medium">
          ❌ Paiement refusé
        </p>
      </div>
    `;
  }

  // Auto-suppression après 5 secondes
  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}
