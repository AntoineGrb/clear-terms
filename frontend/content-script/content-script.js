/**
 * Content Script - Détection automatique des CGU
 * Injecté sur toutes les pages pour détecter et analyser les CGU
 *
 * Architecture modulaire :
 * - config.js : Constantes et critères de détection
 * - exclusions.js : Filtrage des moteurs de recherche
 * - extraction.js : Extraction du contenu de page
 * - detection.js : Logique de détection et validation
 * - toast.js : Interface utilisateur (notifications)
 */

// ========================================
// LISTENERS
// ========================================

/**
 * Écouter les messages de la popup (pour validation manuelle)
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VALIDATE_CONTENT') {
    const validation = validateTermsPage(message.content);
    sendResponse(validation);
  }

  // Extraction de contenu pour scan manuel (même logique que scan auto)
  if (message.type === 'EXTRACT_CONTENT') {
    const { text, url } = extractCleanContent();
    sendResponse({ content: text, url: url });
  }

  return true; // Réponse asynchrone
});

// ========================================
// INITIALISATION
// ========================================

// Lancer la détection au chargement de la page
if (document.readyState === 'loading') {
  // Attendre que la page soit complètement chargée (y compris images, iframes, etc.)
  window.addEventListener('load', () => {
    // Attendre encore un peu pour le contenu lazy-loaded
    setTimeout(detectAndAnalyze, 1000);
  });
} else if (document.readyState === 'interactive') {
  // Page en cours de chargement
  window.addEventListener('load', () => {
    setTimeout(detectAndAnalyze, 1000);
  });
} else {
  // Si la page est déjà complètement chargée (complete)
  // Attendre quand même pour les SPAs et lazy loading
  setTimeout(detectAndAnalyze, 1000);
}
