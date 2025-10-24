// Service Worker pour Clear Terms
// Permet de gérer les événements en arrière-plan (comme l'analyse auto)
// et de gérer le système de log coté frontend

importScripts('../config/api-config.js');
importScripts('../utils/hash.js');

console.log('🚀 Clear Terms Service Worker démarré');

// ========================================
// Système de vérification des paiements en attente
// ========================================

/**
 * Vérifier périodiquement si un paiement est en attente
 */
async function checkPendingPayment() {
  try {
    const result = await chrome.storage.local.get(['paymentPending']);

    if (!result.paymentPending) {
      return; // Pas de paiement en attente
    }

    // Vérifier que le paiement n'est pas trop vieux (max 10 min)
    if (Date.now() - result.paymentPending.timestamp > 10 * 60 * 1000) {
      console.log('⏰ [PAYMENT] Paiement en attente expiré, nettoyage');
      await chrome.storage.local.remove(['paymentPending']);
      return;
    }

    console.log('🔍 [PAYMENT] Vérification paiement en attente...');

    // Récupérer les infos d'authentification depuis le storage
    const authData = await chrome.storage.sync.get(['deviceId', 'jwt']);
    const deviceId = authData.deviceId;
    const jwt = authData.jwt;

    if (!deviceId || !jwt) {
      console.warn('⚠️ [PAYMENT] Pas de deviceId ou JWT');
      return;
    }

    const backendUrl = getBackendURL();

    const response = await fetch(`${backendUrl}/api/payments/check-pending?deviceId=${deviceId}`, {
      headers: { 'Authorization': `Bearer ${jwt}` }
    });

    if (!response.ok) {
      console.warn('⚠️ [PAYMENT] Erreur API check-pending:', response.status);
      return;
    }

    const data = await response.json();

    if (data.hasPendingPayment && data.status === 'completed') {
      console.log('✅ [PAYMENT] Paiement validé!', data);

      // Rafraîchir les crédits depuis le backend
      const creditsResponse = await fetch(`${backendUrl}/api/auth/credits?deviceId=${deviceId}`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });

      if (creditsResponse.ok) {
        const creditsData = await creditsResponse.json();
        await chrome.storage.sync.set({ remainingScans: creditsData.remainingScans });
        console.log('💰 [PAYMENT] Crédits mis à jour:', creditsData.remainingScans);
      }

      // Stocker le statut du paiement
      await chrome.storage.local.set({
        paymentStatus: {
          status: 'success',
          scansAdded: data.scansAdded,
          timestamp: Date.now()
        }
      });

      // Supprimer le paiement en attente
      await chrome.storage.local.remove(['paymentPending']);

      // Ouvrir la popup automatiquement sur la page Paramètres
      chrome.action.openPopup();

    } else if (data.hasPendingPayment && data.status === 'failed') {
      console.log('❌ [PAYMENT] Paiement échoué', data);

      await chrome.storage.local.set({
        paymentStatus: {
          status: 'failed',
          timestamp: Date.now()
        }
      });

      await chrome.storage.local.remove(['paymentPending']);

      // Ouvrir la popup
      chrome.action.openPopup();
    }

  } catch (error) {
    console.error('❌ [PAYMENT] Erreur vérification paiement:', error);
  }
}

// Vérifier toutes les 3 secondes
setInterval(checkPendingPayment, 3000);

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
