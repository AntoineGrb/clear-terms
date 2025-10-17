/**
 * Génère un hash SHA-256 à partir d'une chaîne de caractères
 * Compatible avec le hash utilisé côté backend
 */
async function generateContentHash(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Recherche un rapport dans l'historique local par hash de contenu
 * @param {string} contentHash - Hash SHA-256 du contenu
 * @param {string} language - Langue du rapport (fr, en)
 * @returns {Object|null} - Rapport trouvé ou null
 */
async function findReportInHistory(contentHash, language) {
  try {
    const { reportsHistory = [] } = await chrome.storage.local.get(['reportsHistory']);

    // Chercher un rapport avec le même hash de contenu et la même langue
    for (const entry of reportsHistory) {
      if (entry.report && entry.report.metadata?.content_hash === contentHash) {
        // Vérifier si le rapport a la langue demandée
        const reportLanguage = entry.report.language || entry.report.metadata?.output_language;
        if (reportLanguage === language) {
          console.log('✅ [HISTORY] Rapport trouvé dans l\'historique local');
          return entry.report;
        }
      }
    }

    console.log('❌ [HISTORY] Aucun rapport trouvé dans l\'historique local');
    return null;
  } catch (error) {
    console.error('❌ [HISTORY] Erreur lors de la recherche dans l\'historique:', error);
    return null;
  }
}

// Export global (compatible service worker et page HTML)
if (typeof window !== 'undefined') {
  window.hashUtils = {
    generateContentHash,
    findReportInHistory
  };
} else if (typeof self !== 'undefined') {
  // Pour les service workers
  self.hashUtils = {
    generateContentHash,
    findReportInHistory
  };
}
