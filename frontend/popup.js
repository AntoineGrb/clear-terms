// ========================================
// IMPORTS (via script tags dans popup.html)
// i18n.js, utils/*.js, services/*.js sont chargés avant ce fichier
// ========================================

// ========================================
// Event Handlers
// ========================================

// Handler pour le bouton d'analyse
document.getElementById('scanButton').addEventListener('click', async () => {
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

    updateStatus('statusSending', 'loading');

    // Récupérer la préférence de langue
    const userLanguage = await loadLanguagePreference();

    // Lancer l'analyse
    const { job_id } = await startScan(url, text, userLanguage);

    chrome.runtime.sendMessage({
      type: 'ANALYSIS_STARTED',
      url,
      jobId: job_id
    });

    updateStatus('statusAnalyzing', 'loading');

    // Attendre le résultat
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

    // Classifier et formater l'erreur pour l'utilisateur
    const lang = await loadLanguagePreference();
    const formattedError = formatErrorForUser(error, lang);
    updateStatus(`ERROR:${formattedError.message}`, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('opacity-50', 'cursor-not-allowed');
  }
});

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
chrome.storage.local.get(['lastReport'], async (result) => {
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

    const toastDuration = toastResult.toastDuration !== undefined ? toastResult.toastDuration : 5000;
    document.getElementById('toastDuration').value = toastDuration.toString();
  });

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
