/**
 * Extrait le texte de la page active
 */
async function extractPageContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error('Impossible de récupérer l\'onglet actif');
  }

  // Vérifier si c'est une page protégée
  const protectedSchemes = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'brave://', 'file://'];
  if (protectedSchemes.some(scheme => tab.url?.startsWith(scheme))) {
    const err = new Error('Page protégée');
    err.isProtectedPage = true;
    throw err;
  }

  // Demander au content script d'extraire le contenu
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT_CONTENT'
    });
    return response;
  } catch (error) {
    // Si le content script n'est pas chargé
    if (error.message.includes('Could not establish connection') ||
        error.message.includes('Receiving end does not exist')) {
      const err = new Error('Content script non chargé');
      err.isContentScriptError = true;
      throw err;
    }
    throw error;
  }
}

/**
 * Lance une analyse
 */
async function startScan(url, content, userLanguage) {
  try {
    // 1. CHERCHER D'ABORD DANS L'HISTORIQUE LOCAL
    const contentHash = await hashUtils.generateContentHash(content);
    const historyReport = await hashUtils.findReportInHistory(contentHash, userLanguage);

    if (historyReport) {
      console.log('✅ [API] Rapport trouvé dans l\'historique local, pas d\'appel backend');
      // Retourner un objet simulant la réponse backend avec job_id fictif
      // et indiquer qu'il vient de l'historique
      return {
        job_id: 'history_' + Date.now(),
        remainingScans: await authService.getRemainingCredits(), // Pas de débit
        fromHistory: true,
        report: historyReport
      };
    }

    console.log('❌ [API] Rapport non trouvé dans l\'historique, appel backend...');

    // 2. SI PAS DANS L'HISTORIQUE, APPELER LE BACKEND (cache ou IA)
    // Récupérer deviceId et JWT
    const deviceId = await authService.getDeviceId();
    const jwt = await authService.getJWT();

    const response = await fetch(`${getBackendURL()}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({
        url,
        content,
        user_language_preference: userLanguage,
        deviceId
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));

      // Gestion spécifique de l'erreur quota
      if (error.error === 'QUOTA_EXCEEDED') {
        const quotaErr = new Error('QUOTA_EXCEEDED');
        quotaErr.isQuotaError = true;
        quotaErr.remainingScans = 0;
        throw quotaErr;
      }

      // Gestion du token expiré : on rafraîchit automatiquement
      if (error.error === 'TOKEN_EXPIRED' || error.error === 'NO_TOKEN') {
        console.warn('[API] Token expiré/manquant, tentative de refresh...');
        const refreshed = await authService.handleExpiredToken();
        if (refreshed) {
          console.log('[API] Token rafraîchi, nouvelle tentative...');
          return await startScan(url, content, userLanguage);
        } else {
          const refreshErr = new Error('Impossible de rafraîchir le token. Veuillez recharger l\'extension.');
          refreshErr.isAuthError = true;
          throw refreshErr;
        }
      }

      // Gestion du token invalide/corrompu : NE PAS rafraîchir automatiquement
      // C'est suspect (token modifié manuellement), on bloque
      if (error.error === 'INVALID_TOKEN' || error.error === 'DEVICE_MISMATCH') {
        console.error('[API] Token invalide ou deviceId mismatch - blocage');
        const invalidErr = new Error('Token invalide. Veuillez supprimer et réinstaller l\'extension.');
        invalidErr.isAuthError = true;
        throw invalidErr;
      }

      const err = new Error(error.error || 'Erreur lors du lancement de l\'analyse');
      err.status = response.status;
      throw err;
    }

    const data = await response.json();

    // Mettre à jour les crédits localement
    if (data.remainingScans !== undefined) {
      await authService.updateCredits(data.remainingScans);
    }

    return data;

  } catch (error) {
    // Si c'est une erreur réseau (pas de réponse du serveur)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      const netError = new Error('Erreur réseau');
      netError.isNetworkError = true;
      throw netError;
    }
    throw error;
  }
}

/**
 * Poll un job jusqu'à ce qu'il soit terminé
 */
async function pollJob(jobId) {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    try {
      const response = await fetch(`${getBackendURL()}/jobs/${jobId}`);

      if (!response.ok) {
        const err = new Error('Erreur lors de la récupération du statut du job');
        err.status = response.status;
        throw err;
      }

      const job = await response.json();

      if (job.status === 'done') {
        // Mettre à jour les crédits si disponibles
        if (job.remainingScans !== undefined) {
          await authService.updateCredits(job.remainingScans);
          console.log('💳 [POLL] Crédits mis à jour:', job.remainingScans);
        }

        // Créer une copie profonde pour éviter les mutations par référence
        const report = JSON.parse(JSON.stringify(job.result));

        // Mettre à jour le timestamp pour refléter le moment de cette analyse
        const now = new Date().toISOString();
        if (report.metadata) {
          report.metadata.analyzed_at = now;
        }

        return report;
      }

      if (job.status === 'error') {
        // Mettre à jour les crédits même en cas d'erreur (refund)
        if (job.remainingScans !== undefined) {
          await authService.updateCredits(job.remainingScans);
          console.log('💳 [POLL ERROR] Crédits mis à jour après erreur:', job.remainingScans);
        }

        throw new Error(job.error || 'Erreur lors de l\'analyse');
      }

      // Attendre avant le prochain poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    } catch (error) {
      // Si c'est une erreur réseau
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const netError = new Error('Erreur réseau pendant le polling');
        netError.isNetworkError = true;
        throw netError;
      }
      throw error;
    }
  }

  throw new Error('Timeout : l\'analyse a pris trop de temps');
}
