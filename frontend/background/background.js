// Service Worker pour Clear Terms
// Permet de gérer les événements en arrière-plan (comme l'analyse auto)
// et de gérer le système de log coté frontend

importScripts('../config/api-config.js');
importScripts('../utils/hash.js');

console.log('🚀 Clear Terms Service Worker démarré');

/**
 * Détecte la langue du navigateur
 */
function detectBrowserLanguage() {
  const browserLang = navigator.language || 'en';
  const langCode = browserLang.split('-')[0].toLowerCase();
  return ['fr', 'en'].includes(langCode) ? langCode : 'en';
}

// Écouter les messages depuis le popup ou content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message reçu:', message);

  // Analyse (depuis le popup ou toast)
  if (message.type === 'ANALYSIS_STARTED') {
    const source = message.source === 'TOAST' ? '🎯 TOAST' : '🖱️ POPUP';
    console.log(`🔍 Analyse démarrée depuis ${source}`);
    console.log('📊 URL:', message.url);
    console.log('📊 Job ID:', message.jobId);
  }

  if (message.type === 'ANALYSIS_COMPLETE') {
    console.log('✅ Analyse terminée pour:', message.url);
    console.log('📊==================== Fin de l\'analyse ====================== ');
  }

  if (message.type === 'ANALYSIS_ERROR') {
    console.error('❌ Erreur d\'analyse:', message.error);
    console.error('🔗 URL:', message.url);
  }

  // Vérifier l'historique (depuis le content script / detection.js)
  if (message.type === 'CHECK_HISTORY') {
    console.log('🔍 Vérification de l\'historique pour URL:', message.url);
    (async () => {
      const report = await hashUtils.findReportInHistory(message.url, message.language);
      if (report) {
        console.log('✅ Rapport trouvé dans l\'historique');
        sendResponse({ found: true, report: report });
      } else {
        console.log('❌ Rapport non trouvé dans l\'historique');
        sendResponse({ found: false });
      }
    })();
    return true; // Async response
  }

  // Afficher un rapport depuis l'historique (depuis le toast)
  if (message.type === 'DISPLAY_REPORT') {
    console.log('📋 Demande d\'affichage d\'un rapport depuis l\'historique');
    // Stocker le rapport temporairement
    (async () => {
      await chrome.storage.local.set({
        pendingToastAction: {
          type: 'DISPLAY_REPORT',
          report: message.report,
          timestamp: Date.now()
        }
      });
      chrome.action.openPopup();
      sendResponse({ received: true });
    })();
    return true;
  }

  // Lancer une analyse depuis le toast
  if (message.type === 'PERFORM_ANALYSIS') {
    // Stocker les données d'analyse temporairement
    (async () => {
      await chrome.storage.local.set({
        pendingToastAction: {
          type: 'PERFORM_ANALYSIS',
          url: message.url,
          content: message.content,
          timestamp: Date.now()
        }
      });
      chrome.action.openPopup();
      sendResponse({ received: true });
    })();
    return true;
  }

  // Ouvrir la popup (depuis le toast)
  if (message.type === 'OPEN_POPUP') {
    console.log('📂 Ouverture de la popup demandée');
    chrome.action.openPopup();
  }

  sendResponse({ received: true });
  return true;
});

// Écouter l'installation de l'extension
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 Clear Terms installé pour la première fois');
  } else if (details.reason === 'update') {
    console.log('🔄 Clear Terms mis à jour vers la version', chrome.runtime.getManifest().version);
  }
});

// Logger les erreurs non gérées
self.addEventListener('error', (event) => {
  console.error('💥 Erreur non gérée dans le service worker:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('💥 Promise rejetée non gérée:', event.reason);
});
