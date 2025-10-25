// Service Worker pour Clear Terms
// Permet de gérer les événements en arrière-plan (comme l'analyse auto)
// et de gérer le système de log coté frontend

importScripts('../config/api-config.js');
importScripts('../utils/hash.js');
importScripts('../utils/fetch-with-timeout.js');

console.log('🚀 Clear Terms Service Worker démarré');

// Map pour suivre les jobs en cours (les constantes POLL_INTERVAL et MAX_POLL_ATTEMPTS viennent de api-config.js)
const activeJobs = new Map();

/**
 * Détecte la langue du navigateur
 */
function detectBrowserLanguage() {
  const browserLang = navigator.language || 'en';
  const langCode = browserLang.split('-')[0].toLowerCase();
  return ['fr', 'en'].includes(langCode) ? langCode : 'en';
}

/**
 * Poll un job en arrière-plan jusqu'à ce qu'il soit terminé
 * CRITIQUE : Persiste même si la popup est fermée
 */
async function pollJobInBackground(jobId, url) {
  console.log(`🔄 [BACKGROUND] Démarrage du polling pour job ${jobId}`);

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    try {
      const response = await fetchWithTimeout(`${getBackendURL()}/jobs/${jobId}`, {}, 30000);

      if (!response.ok) {
        console.error(`[BACKGROUND] Erreur HTTP ${response.status} lors du polling`);
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        continue;
      }

      const job = await response.json();
      console.log(`📊 [BACKGROUND] Job ${jobId} status: ${job.status} (tentative ${i + 1}/${MAX_POLL_ATTEMPTS})`);

      if (job.status === 'done') {
        console.log(`✅ [BACKGROUND] Job ${jobId} terminé avec succès`);

        // Mettre à jour les crédits
        if (job.remainingScans !== undefined) {
          await chrome.storage.sync.set({ remainingScans: job.remainingScans });
          console.log(`💳 [BACKGROUND] Crédits mis à jour: ${job.remainingScans}`);
        }

        // Créer une copie du rapport
        const report = JSON.parse(JSON.stringify(job.result));

        // Mettre à jour le timestamp
        const now = new Date().toISOString();
        if (report.metadata) {
          report.metadata.analyzed_at = now;
        }

        // Sauvegarder dans lastReport
        await chrome.storage.local.set({ lastReport: report });
        console.log(`💾 [BACKGROUND] Rapport sauvegardé dans lastReport`);

        // Ajouter à l'historique
        await addToReportsHistory(report);
        console.log(`📚 [BACKGROUND] Rapport ajouté à l'historique`);

        // Retirer du tracking
        activeJobs.delete(jobId);

        // Notifier la popup si elle est ouverte
        try {
          await chrome.runtime.sendMessage({
            type: 'JOB_COMPLETE',
            jobId,
            report,
            remainingScans: job.remainingScans
          });
        } catch (e) {
          // Popup fermée, normal
        }

        return report;
      }

      if (job.status === 'error') {
        console.error(`❌ [BACKGROUND] Job ${jobId} en erreur:`, job.error);

        // Mettre à jour les crédits (refund)
        if (job.remainingScans !== undefined) {
          await chrome.storage.sync.set({ remainingScans: job.remainingScans });
          console.log(`💳 [BACKGROUND] Crédits mis à jour après erreur: ${job.remainingScans}`);
        }

        // Retirer du tracking
        activeJobs.delete(jobId);

        // Notifier la popup si elle est ouverte
        try {
          await chrome.runtime.sendMessage({
            type: 'JOB_ERROR',
            jobId,
            error: job.error,
            remainingScans: job.remainingScans
          });
        } catch (e) {
          // Popup fermée, normal
        }

        throw new Error(job.error || 'Erreur lors de l\'analyse');
      }

      // Status queued/running : attendre et réessayer
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

    } catch (error) {
      // En cas d'erreur réseau, retry
      if (error.isTimeout || error instanceof TypeError) {
        console.warn(`⚠️  [BACKGROUND] Erreur réseau sur polling, retry...`);
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        continue;
      }

      // Erreur définitive
      console.error(`❌ [BACKGROUND] Erreur fatale sur job ${jobId}:`, error.message);
      activeJobs.delete(jobId);
      throw error;
    }
  }

  // Timeout
  console.error(`⏱️  [BACKGROUND] Timeout sur job ${jobId} après ${MAX_POLL_ATTEMPTS} tentatives`);
  activeJobs.delete(jobId);
  throw new Error('Timeout : l\'analyse a pris trop de temps');
}

/**
 * Ajoute un rapport à l'historique (copie de la fonction du popup)
 */
async function addToReportsHistory(report) {
  try {
    const { reportsHistory = [] } = await chrome.storage.local.get(['reportsHistory']);

    // Vérifier si le rapport existe déjà
    const contentHash = report.metadata?.content_hash;
    if (contentHash) {
      const exists = reportsHistory.some(entry =>
        entry.report?.metadata?.content_hash === contentHash &&
        entry.report?.language === report.language
      );

      if (exists) {
        console.log('📚 [BACKGROUND] Rapport déjà dans l\'historique, ignoré');
        return;
      }
    }

    // S'assurer que le rapport a une langue
    if (!report.language && report.metadata?.output_language) {
      report.language = report.metadata.output_language;
    }

    // Créer l'entrée
    const historyEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      report: report
    };

    reportsHistory.unshift(historyEntry);

    // Limiter à 100 rapports
    if (reportsHistory.length > 100) {
      reportsHistory.splice(100);
    }

    await chrome.storage.local.set({ reportsHistory });
    console.log(`📚 [BACKGROUND] Historique mis à jour (${reportsHistory.length} rapports)`);

  } catch (error) {
    console.error('[BACKGROUND] Erreur lors de l\'ajout à l\'historique:', error);
  }
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

    // Démarrer le polling en arrière-plan
    const jobId = message.jobId;
    const url = message.url;

    if (!activeJobs.has(jobId)) {
      activeJobs.set(jobId, { url, startedAt: Date.now() });
      console.log(`🚀 [BACKGROUND] Lancement du polling pour job ${jobId}`);

      // Polling asynchrone (ne bloque pas le message handler)
      pollJobInBackground(jobId, url).catch(error => {
        console.error(`❌ [BACKGROUND] Erreur polling job ${jobId}:`, error.message);
      });
    }

    sendResponse({ received: true });
    return true;
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
