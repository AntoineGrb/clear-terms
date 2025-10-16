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

/**
 * Vérifie si la page a un ratio liens/contenu anormal
 * (indicateur de page de navigation/recherche)
 */
function hasExcessiveLinks(content) {
  const links = document.querySelectorAll('a[href]');
  const linkCount = links.length;
  const wordCount = content.split(/\s+/).length;

  if (wordCount === 0) return true;

  const ratio = linkCount / wordCount;

  // Seuil permissif : 1 lien pour 15 mots (6.7%)
  const hasExcessive = ratio > 0.067;

  console.log('[Clear Terms] Analyse liens - Count:', linkCount, '| Mots:', wordCount, '| Ratio:', ratio.toFixed(3), hasExcessive ? '⚠️ EXCESSIF' : '✓');

  return hasExcessive;
}

/**
 * Détecte si la page ressemble à des résultats de recherche
 * Basé sur des patterns DOM typiques
 */
function looksLikeSearchResults() {
  const searchPatterns = [
    'input[name="q"]',              // Barre de recherche Google/Bing
    'input[name="search"]',         // Barre de recherche générique
    'form[role="search"]',          // Formulaire de recherche
    '[data-sokoban-container]',     // Google SERP
    '.search-result',               // Résultats génériques
    '#search',                      // Container de résultats
    '[id*="search-results"]',       // IDs contenant search-results
    '[class*="search-results"]'     // Classes contenant search-results
  ];

  const foundPattern = searchPatterns.find(selector => document.querySelector(selector));

  if (foundPattern) {
    console.log('[Clear Terms] Structure de résultats de recherche détectée:', foundPattern);
    return true;
  }

  return false;
}
