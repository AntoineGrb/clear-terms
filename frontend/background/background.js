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

/**
 * Récupère ou crée un deviceId UUID
 */
async function getOrCreateDeviceId() {
  try {
    const { deviceId } = await chrome.storage.sync.get(['deviceId']);
    if (deviceId) {
      console.log('✅ [AUTO] DeviceId existant trouvé:', deviceId);
      return deviceId;
    }

    // Générer un nouveau UUID
    const newDeviceId = crypto.randomUUID();
    await chrome.storage.sync.set({ deviceId: newDeviceId });
    console.log('🆕 [AUTO] Nouveau deviceId généré:', newDeviceId);
    return newDeviceId;
  } catch (error) {
    console.error('❌ [AUTO] Erreur lors de la génération du deviceId:', error);
    return null;
  }
}

/**
 * Enregistre un utilisateur en arrière-plan
 */
async function registerUserInBackground(deviceId) {
  const backendUrl = getBackendURL();
  console.log('🔐 [AUTO] Enregistrement de l\'utilisateur avec deviceId:', deviceId);

  const response = await fetch(`${backendUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId })
  });

  if (!response.ok) {
    throw new Error(`Erreur d'enregistrement: ${response.status}`);
  }

  const { jwt, remainingScans } = await response.json();
  await chrome.storage.sync.set({ jwt, remainingScans });
  console.log('✅ [AUTO] Utilisateur enregistré. JWT obtenu, crédits:', remainingScans);

  return { jwt, remainingScans };
}

/**
 * Gère l'analyse automatique en arrière-plan
 */
async function handleAutoAnalysis(url, content, tabId) {
  try {
    console.log('🔍 Analyse automatique lancée pour:', url);
    console.log('📏 [AUTO] Longueur du contenu:', content.length, 'caractères');

    // 1. Vérifier/Générer deviceId
    let deviceId = await getOrCreateDeviceId();

    // CONTRÔLE CRITIQUE : Si pas de deviceId après tentative, on abandonne
    if (!deviceId) {
      console.error('❌ [AUTO] Impossible de générer un deviceId, abandon de l\'analyse auto');
      return;
    }

    // 2. Récupérer JWT et crédits
    let { jwt, remainingScans } = await chrome.storage.sync.get(['jwt', 'remainingScans']);

    // Vérifier les crédits avant de lancer l'analyse
    if (remainingScans !== undefined && remainingScans <= 0) {
      console.warn('⚠️ [AUTO] Quota épuisé, analyse automatique annulée');
      return;
    }

    // 3. Si pas de JWT, enregistrer l'utilisateur automatiquement
    if (!jwt) {
      console.log('🔐 [AUTO] Pas de JWT, enregistrement automatique...');
      try {
        const authData = await registerUserInBackground(deviceId);
        jwt = authData.jwt;
        remainingScans = authData.remainingScans;
        console.log('✅ [AUTO] Enregistrement réussi, crédits:', remainingScans);
      } catch (error) {
        console.error('❌ [AUTO] Échec de l\'enregistrement automatique:', error);
        return;
      }
    }

    // Toujours détecter automatiquement la langue du navigateur
    const lang = detectBrowserLanguage();

    // 4. CHERCHER D'ABORD DANS L'HISTORIQUE LOCAL
    const contentHash = await hashUtils.generateContentHash(content);
    const historyReport = await hashUtils.findReportInHistory(contentHash, lang);

    if (historyReport) {
      console.log('✅ [AUTO] Rapport trouvé dans l\'historique local');
      console.log('📊 [AUTO] Source: history - Pas de débit de crédits');

      // Pas de débit de crédits
      // Toast déjà affiché par detection.js
      return;
    }

    console.log('❌ [AUTO] Pas de rapport dans l\'historique, appel backend...');

    // 5. SI PAS DANS L'HISTORIQUE, LANCER L'ANALYSE (cache ou IA)
    const backendUrl = getBackendURL();
    console.log('🌐 [AUTO] Backend URL utilisée:', backendUrl);

    const response = await fetch(`${backendUrl}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({
        url,
        content,
        user_language_preference: lang,
        deviceId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Gestion quota épuisé
      if (errorData.error === 'QUOTA_EXCEEDED') {
        console.warn('⚠️ [AUTO] Quota épuisé');
        await chrome.storage.sync.set({ remainingScans: 0 });
        return;
      }

      // Gestion token expiré : on réessaye avec un nouveau token
      if (errorData.error === 'TOKEN_EXPIRED' || errorData.error === 'NO_TOKEN') {
        console.warn('⚠️ [AUTO] Token expiré, rafraîchissement...');
        try {
          const authData = await registerUserInBackground(deviceId);
          jwt = authData.jwt;
          // Réessayer l'analyse avec le nouveau token
          return await handleAutoAnalysis(url, content, tabId);
        } catch (error) {
          console.error('❌ [AUTO] Échec du rafraîchissement du token:', error);
          return;
        }
      }

      // Gestion token invalide ou device mismatch : BLOQUER (suspect)
      if (errorData.error === 'INVALID_TOKEN' || errorData.error === 'DEVICE_MISMATCH') {
        console.error('🚫 [AUTO] Token invalide ou device mismatch - analyse bloquée');
        return;
      }

      throw new Error('Erreur lors du lancement de l\'analyse');
    }

    const data = await response.json();
    const { job_id, remainingScans: newCredits } = data;
    console.log('📊 Job ID créé:', job_id);

    // Mettre à jour les crédits localement
    if (newCredits !== undefined) {
      await chrome.storage.sync.set({ remainingScans: newCredits });
      console.log('💳 Crédits mis à jour:', newCredits);
    }

    // Stocker le job pour cet onglet
    await chrome.storage.local.set({
      [`autoJob_${tabId}`]: {
        jobId: job_id,
        url,
        status: 'running',
        startedAt: Date.now()
      }
    });

    // Lancer le polling
    pollAutoJob(job_id, tabId);

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse auto:', error);
  }
}

/**
 * Poll un job automatique jusqu'à ce qu'il soit terminé
 */
async function pollAutoJob(jobId, tabId) {
  console.log('⏳ Polling du job:', jobId);

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

    try {
      const response = await fetch(`${getBackendURL()}/jobs/${jobId}`);

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération du job');
      }

      const job = await response.json();

      if (job.status === 'done') {
        console.log('✅ Analyse auto terminée pour l\'onglet', tabId);

        // Créer une copie profonde pour éviter les mutations par référence
        const report = JSON.parse(JSON.stringify(job.result));

        // Mettre à jour le timestamp pour refléter le moment de cette analyse
        // (même si le rapport vient du cache, pour l'utilisateur c'est une nouvelle analyse)
        const now = new Date().toISOString();
        if (report.metadata) {
          report.metadata.analyzed_at = now;
        }

        console.log('📅 Timestamp mis à jour:', now);

        // Ajouter au reportsHistory
        await addToReportsHistory(report);

        // Sauvegarder le rapport
        await chrome.storage.local.set({
          lastReport: report,
          [`autoJob_${tabId}`]: {
            jobId,
            status: 'done',
            result: report,
            completedAt: Date.now()
          }
        });

        // Toast déjà affiché par detection.js
        break;
      }

      if (job.status === 'error') {
        console.error('❌ Erreur lors de l\'analyse auto:', job.error);

        await chrome.storage.local.set({
          [`autoJob_${tabId}`]: {
            jobId,
            status: 'error',
            error: job.error
          }
        });

        break;
      }

    } catch (error) {
      console.error('❌ Erreur lors du polling:', error);
      break;
    }
  }
}

// Écouter les messages depuis le popup ou content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message reçu:', message);

  // Analyse manuelle (depuis le popup)
  if (message.type === 'ANALYSIS_STARTED') {
    console.log('🔍 Analyse manuelle démarrée pour:', message.url);
    console.log('📊 Job ID:', message.jobId);
  }

  if (message.type === 'ANALYSIS_COMPLETE') {
    console.log('✅ Analyse manuelle terminée pour:', message.url);
    console.log('📋 Rapport complet:');
    console.log(JSON.stringify(message.report, null, 2));
  }

  if (message.type === 'ANALYSIS_ERROR') {
    console.error('❌ Erreur d\'analyse manuelle:', message.error);
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
    console.log('🚀 Demande d\'analyse depuis le toast');
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

/**
 * Ajoute un rapport à l'historique (max 20 rapports)
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

    // Ajouter au début du tableau (plus récent en premier)
    reportsHistory.unshift(historyEntry);

    // Limiter à 100 rapports max (FIFO)
    if (reportsHistory.length > 100) {
      reportsHistory.splice(100);
    }

    // Sauvegarder
    await chrome.storage.local.set({ reportsHistory });
    console.log('📚 Rapport ajouté à l\'historique. Total:', reportsHistory.length);

  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout au reportsHistory:', error);
  }
}
