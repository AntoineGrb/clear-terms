// ========================================
// API CONFIGURATION - Gestion centralisée des URLs backend
// ========================================

// ⚙️ CONFIGURATION - Modifiez ces valeurs selon vos besoins
const CONFIG = {
  // URLs backend
  LOCAL_URL: 'http://localhost:3000',
  STAGING_URL: 'https://clear-terms-staging.onrender.com', // À modifier si vous avez un staging
  PROD_URL: 'https://clear-terms.onrender.com',

  // Mode de fonctionnement (une seule des options à true)
  FORCE_LOCAL: false, 
  FORCE_STAGING: false,
  FORCE_PROD: true,  
  // Si les 3 sont false = auto-détection (dev/prod)

  // Paramètres polling
  POLL_INTERVAL: 2000,        // 2 secondes
  MAX_POLL_ATTEMPTS: 60       // 2 minutes max
};

// Rétrocompatibilité
const POLL_INTERVAL = CONFIG.POLL_INTERVAL;
const MAX_POLL_ATTEMPTS = CONFIG.MAX_POLL_ATTEMPTS;

// Cache de l'URL backend (évalué une seule fois)
let _backendUrlCache = null;

/**
 * Détecte automatiquement l'environnement (sauf si forcé)
 * - En développement : utilise localhost
 * - En production : utilise l'URL Render
 *
 * Note: Résultat mis en cache après la première exécution
 */
function getBackendURL() {
  // Retourner le cache si déjà évalué
  if (_backendUrlCache !== null) {
    return _backendUrlCache;
  }

  // Déterminer l'URL
  let url;
  let mode;

  if (CONFIG.FORCE_LOCAL) {
    mode = 'LOCAL (forcé)';
    url = CONFIG.LOCAL_URL;
  } else if (CONFIG.FORCE_STAGING) {
    mode = 'STAGING (forcé)';
    url = CONFIG.STAGING_URL;
  } else if (CONFIG.FORCE_PROD) {
    mode = 'PRODUCTION (forcé)';
    url = CONFIG.PROD_URL;
  } else {
    // Auto-détection
    try {
      const manifest = chrome.runtime.getManifest();
      const hasUpdateUrl = 'update_url' in manifest;
      const isDevelopment = !hasUpdateUrl;

      if (isDevelopment) {
        mode = 'LOCAL (auto-détecté)';
        url = CONFIG.LOCAL_URL;
      } else {
        mode = 'PRODUCTION (auto-détecté)';
        url = CONFIG.PROD_URL;
      }
    } catch (error) {
      mode = 'LOCAL (fallback)';
      url = CONFIG.LOCAL_URL;
    }
  }

  // Mettre en cache et logger une seule fois
  _backendUrlCache = url;
  console.log(`✅ [CONFIG] Backend sélectionné: ${url} [${mode}]`);

  return _backendUrlCache;
}
