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
 * Recherche un rapport dans l'historique local par URL
 * @param {string} url - URL de la page analysée
 * @param {string} language - Langue du rapport (fr, en)
 * @returns {Object|null} - Rapport trouvé ou null
 */
async function findReportInHistory(url, language) {
  try {
    const { reportsHistory = [] } = await chrome.storage.local.get(['reportsHistory']);

    // Normaliser l'URL recherchée (retirer les paramètres de query non essentiels)
    const normalizedSearchUrl = normalizeUrl(url);

    // Chercher un rapport avec la même URL et la même langue
    for (let i = 0; i < reportsHistory.length; i++) {
      const entry = reportsHistory[i];
      const reportUrl = entry.report?.metadata?.analyzed_url;
      const reportLanguage = entry.report?.language || entry.report?.metadata?.output_language;
      const siteName = entry.report?.metadata?.site_name;

      // Normaliser l'URL du rapport
      const normalizedReportUrl = normalizeUrl(reportUrl);

      if (entry.report && normalizedReportUrl === normalizedSearchUrl) {
        // Vérifier si le rapport a la langue demandée
        if (reportLanguage === language) {
          console.log('✅ [HISTORY] Rapport trouvé dans l\'historique local par URL');
          return entry.report;
        } else {
          console.log('⚠️ [HISTORY] URL correspond mais pas la langue');
        }
      }
    }
    return null;
  } catch (error) {
    console.error('❌ [HISTORY] Erreur lors de la recherche dans l\'historique:', error);
    return null;
  }
}

/**
 * Normalise une URL pour la comparaison (retire les paramètres non essentiels)
 * @param {string} url - URL à normaliser
 * @returns {string} - URL normalisée
 */
function normalizeUrl(url) {
  if (!url) return '';

  try {
    const urlObj = new URL(url);
    // Garder uniquement le protocole, le domaine et le chemin
    // Retirer les paramètres de query et les fragments
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch (error) {
    // Si l'URL est invalide, retourner telle quelle
    return url;
  }
}

/**
 * Supprime tous les rapports de l'historique correspondant à une URL donnée
 * @param {string} url - URL de la page à nettoyer
 * @returns {Promise<number>} - Nombre de rapports supprimés
 */
async function removeReportsByUrl(url) {
  try {
    const { reportsHistory = [] } = await chrome.storage.local.get(['reportsHistory']);
    const normalizedUrl = normalizeUrl(url);

    // Filtrer les rapports qui ne correspondent pas à l'URL
    const filteredHistory = reportsHistory.filter(entry => {
      const reportUrl = entry.report?.metadata?.analyzed_url;
      const normalizedReportUrl = normalizeUrl(reportUrl);
      return normalizedReportUrl !== normalizedUrl;
    });

    const removedCount = reportsHistory.length - filteredHistory.length;

    if (removedCount > 0) {
      await chrome.storage.local.set({ reportsHistory: filteredHistory });
      console.log(`🗑️ [HISTORY] ${removedCount} rapport(s) supprimé(s) pour l'URL: ${normalizedUrl}`);
    }

    return removedCount;
  } catch (error) {
    console.error('❌ [HISTORY] Erreur lors de la suppression des rapports:', error);
    return 0;
  }
}

// Export global (compatible service worker et page HTML)
if (typeof window !== 'undefined') {
  window.hashUtils = {
    generateContentHash,
    findReportInHistory,
    removeReportsByUrl
  };
} else if (typeof self !== 'undefined') {
  // Pour les service workers
  self.hashUtils = {
    generateContentHash,
    findReportInHistory,
    removeReportsByUrl
  };
}
