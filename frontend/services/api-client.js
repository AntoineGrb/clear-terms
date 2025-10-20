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
 * Récupère un rapport depuis l'historique utilisateur uniquement (GRATUIT)
 * @returns {Promise<Object|null>} Le rapport ou null si non trouvé
 */
async function getReportFromHistory(url, userLanguage) {
  try {
    console.log('🔍 [API] Recherche dans l\'historique local...');
    const historyReport = await hashUtils.findReportInHistory(url, userLanguage);

    if (historyReport) {
      console.log('✅ [API] Rapport trouvé dans l\'historique local');
      return historyReport;
    }

    console.log('❌ [API] Rapport non trouvé dans l\'historique');
    return null;
  } catch (error) {
    console.error('[API] Erreur lors de la recherche dans l\'historique:', error);
    return null;
  }
}

/**
 * Lance une nouvelle analyse (cache backend ou IA) - CONSOMME 1 CRÉDIT
 * @returns {Promise<Object>} Le rapport d'analyse
 */
async function performAnalysis(url, content, userLanguage, retryCount = 0) {
  try {
    console.log('🚀 [API] Lancement d\'une nouvelle analyse (cache ou IA)...');

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

      // ========================================
      // GESTION DES ERREURS D'AUTHENTIFICATION
      // Règle : deviceId = source de vérité, JWT = cache jetable
      // ========================================

      const authErrors = ['TOKEN_EXPIRED', 'INVALID_TOKEN', 'NO_TOKEN', 'DEVICE_MISMATCH'];

      if (authErrors.includes(error.error) && retryCount === 0) {
        // Premier essai échoué → Renouveler le token automatiquement
        console.warn('[API] 🔑 Erreur auth:', error.error);
        console.warn('[API] → Le token est invalide/expiré, mais deviceId fait foi');
        console.warn('[API] → Renouvellement automatique du token via /register...');

        // Cas DEVICE_MISMATCH : Supprimer le token local corrompu
        if (error.error === 'DEVICE_MISMATCH') {
          console.warn('[API] ⚠️  Token contient un autre deviceId, suppression...');
          await chrome.storage.sync.remove(['jwt']);
        }

        // Renouveler le token (appelle /register avec deviceId)
        // Backend vérifie deviceId → retrouve le compte existant → génère nouveau token
        const refreshed = await authService.handleExpiredToken();

        if (refreshed) {
          console.log('[API] ✅ Nouveau token obtenu, retry de la requête...');
          return await performAnalysis(url, content, userLanguage, retryCount + 1);
        } else {
          const refreshErr = new Error('Impossible de renouveler le token');
          refreshErr.isAuthError = true;
          throw refreshErr;
        }
      }

      // Si retry a déjà été fait et ça échoue encore → Erreur définitive
      if (authErrors.includes(error.error) && retryCount > 0) {
        console.error('[API] ❌ Échec après renouvellement - Problème persistant');
        const authErr = new Error('Erreur d\'authentification persistante. Utilisez "Rafraîchir l\'authentification" dans les paramètres.');
        authErr.isAuthError = true;
        throw authErr;
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
