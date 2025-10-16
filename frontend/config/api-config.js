// ========================================
// API CONFIGURATION - Gestion centralisée des URLs backend
// ========================================

// CONFIG : Forcer l'utilisation du backend (prod ou local)
// Les deux false = auto-détection
const FORCE_PROD = false; // true = forcer PROD
const FORCE_LOCAL = false; // true = forcer LOCAL (override tout)

const POLL_INTERVAL = 2000;
const MAX_POLL_ATTEMPTS = 60;

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

  if (FORCE_LOCAL) {
    console.log('🔧 [CONFIG] Mode forcé : Backend LOCAL');
    url = 'http://localhost:3000';
  } else if (FORCE_PROD) {
    console.log('🚀 [CONFIG] Mode forcé : Backend PRODUCTION');
    url = 'https://clear-terms.onrender.com';
  } else {
    // Auto-détection
    try {
      const manifest = chrome.runtime.getManifest();
      const hasUpdateUrl = 'update_url' in manifest;
      const isDevelopment = !hasUpdateUrl;

      console.log('🔍 [CONFIG] Détection environnement:', {
        hasUpdateUrl,
        isDevelopment,
        manifestKeys: Object.keys(manifest)
      });

      url = isDevelopment ? 'http://localhost:3000' : 'https://clear-terms.onrender.com';
    } catch (error) {
      console.log('⚠️ [CONFIG] Erreur détection, fallback LOCAL:', error.message);
      url = 'http://localhost:3000';
    }
  }

  // Mettre en cache et logger une seule fois
  _backendUrlCache = url;
  console.log(`✅ [CONFIG] Backend sélectionné: ${url} (mis en cache)`);

  return _backendUrlCache;
}
