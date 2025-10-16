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
    const response = await fetch(`${getBackendURL()}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, content, user_language_preference: userLanguage })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'Erreur lors du lancement de l\'analyse');
      err.status = response.status;
      throw err;
    }

    return await response.json();
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
