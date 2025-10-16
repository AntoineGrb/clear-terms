// Service Worker pour Clear Terms
// Permet de consulter les logs et gérer les événements en arrière-plan

importScripts('../config/api-config.js');

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
 * Gère l'analyse automatique en arrière-plan
 */
async function handleAutoAnalysis(url, content, tabId) {
  try {
    console.log('🔍 Analyse automatique lancée pour:', url);
    console.log('📏 [AUTO] Longueur du contenu:', content.length, 'caractères');

    // Toujours détecter automatiquement la langue du navigateur
    const lang = detectBrowserLanguage();

    // Lancer l'analyse
    const backendUrl = getBackendURL();
    console.log('🌐 [AUTO] Backend URL utilisée:', backendUrl);

    const response = await fetch(`${backendUrl}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        content,
        user_language_preference: lang
      })
    });

    if (!response.ok) {
      throw new Error('Erreur lors du lancement de l\'analyse');
    }

    const { job_id } = await response.json();
    console.log('📊 Job ID créé:', job_id);

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

  // Analyse automatique (depuis le content script)
  if (message.type === 'AUTO_ANALYZE') {
    console.log('🤖 Demande d\'analyse automatique reçue');
    const tabId = sender.tab?.id;
    if (tabId) {
      handleAutoAnalysis(message.url, message.content, tabId);
    }
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
