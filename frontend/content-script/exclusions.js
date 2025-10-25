// ========================================
// EXCLUSIONS : Moteurs de recherche et pages navigables
// ========================================

/**
 * Liste des patterns d'URLs de moteurs de recherche
 */
const SEARCH_ENGINE_PATTERNS = [
  'google.com/search',
  'google.fr/search',
  'google.co.uk/search',
  'google.de/search',
  'google.es/search',
  'google.it/search',
  'bing.com/search',
  'duckduckgo.com/?',
  'yahoo.com/search',
  'yahoo.fr/search',
  'ecosia.org/search',
  'qwant.com/',
  'yandex.com/search',
  'yandex.ru/search',
  'baidu.com/s'
];

/**
 * Vérifie si la page est un moteur de recherche
 */
function isSearchEnginePage() {
  const url = window.location.href.toLowerCase();
  const isSearchEngine = SEARCH_ENGINE_PATTERNS.some(pattern => url.includes(pattern));

  if (isSearchEngine) {
    console.log('[Clear Terms] Moteur de recherche détecté');
  }

  return isSearchEngine;
}
