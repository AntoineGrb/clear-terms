// ========================================
// Auth Service - Gestion de l'authentification et des crédits
// ========================================

/**
 * Récupère ou génère le deviceId basé sur le fingerprint du navigateur
 */
async function getDeviceId() {
  try {
    // Utiliser le fingerprinting pour un ID stable
    if (typeof fingerprintService !== 'undefined' && fingerprintService.getStableDeviceId) {
      const deviceId = await fingerprintService.getStableDeviceId();
      console.log('[AUTH] DeviceId récupéré:', deviceId);
      return deviceId;
    }

    // Fallback si le service de fingerprinting n'est pas chargé
    console.warn('[AUTH] Service de fingerprinting non disponible, fallback sur storage');
    const result = await chrome.storage.sync.get(['deviceId']);

    if (result.deviceId) {
      return result.deviceId;
    }

    // Générer nouveau UUID en dernier recours
    const newDeviceId = crypto.randomUUID();
    await chrome.storage.sync.set({ deviceId: newDeviceId });

    console.log('[AUTH] Nouveau deviceId généré (fallback):', newDeviceId);
    return newDeviceId;

  } catch (error) {
    console.error('[AUTH] Erreur getDeviceId:', error);
    throw error;
  }
}

/**
 * Enregistre l'utilisateur et récupère le JWT
 */
async function registerUser() {
  try {
    const deviceId = await getDeviceId();
    const apiBaseUrl = getApiBaseUrl();

    const response = await fetchWithTimeout(`${apiBaseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId })
    }, 30000);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Registration failed');
    }

    const { jwt, remainingScans, supportKey, createdAt } = await response.json();

    // Stocker JWT, crédits et support key localement
    await chrome.storage.sync.set({
      jwt,
      remainingScans,
      supportKey,
      registeredAt: createdAt
    });

    console.log('[AUTH] Utilisateur enregistré avec succès. Crédits:', remainingScans);

    return { jwt, remainingScans };

  } catch (error) {
    console.error('[AUTH] Erreur registerUser:', error);
    throw error;
  }
}

/**
 * Récupère le JWT (ou enregistre si absent ou expiré)
 */
async function getJWT() {
  try {
    const result = await chrome.storage.sync.get(['jwt']);

    if (result.jwt) {
      // Vérifier si le JWT est expiré (basique, sans décoder)
      // Si expiré, le backend renverra une erreur et on redemandera un register
      return result.jwt;
    }

    // Première utilisation → enregistrer
    const { jwt } = await registerUser();
    return jwt;

  } catch (error) {
    console.error('[AUTH] Erreur getJWT:', error);
    throw error;
  }
}

/**
 * Vérifie si l'utilisateur a des crédits
 */
async function hasCredits() {
  try {
    const result = await chrome.storage.sync.get(['remainingScans']);
    const credits = result.remainingScans || 0;
    return credits > 0;
  } catch (error) {
    console.error('[AUTH] Erreur hasCredits:', error);
    return false;
  }
}

/**
 * Récupère le nombre de crédits restants
 */
async function getRemainingCredits() {
  try {
    const result = await chrome.storage.sync.get(['remainingScans']);
    return result.remainingScans || 0;
  } catch (error) {
    console.error('[AUTH] Erreur getRemainingCredits:', error);
    return 0;
  }
}

/**
 * Met à jour les crédits localement
 */
async function updateCredits(newCredits) {
  try {
    await chrome.storage.sync.set({ remainingScans: newCredits });
    console.log('[AUTH] Crédits mis à jour:', newCredits);

    // Mettre à jour l'affichage si l'élément existe
    const remainingScansElement = document.getElementById('remainingScans');
    if (remainingScansElement) {
      remainingScansElement.textContent = newCredits;
    }

  } catch (error) {
    console.error('[AUTH] Erreur updateCredits:', error);
  }
}

/**
 * Récupère l'API base URL depuis la config
 */
function getApiBaseUrl() {
  // Utiliser la fonction getBackendURL() définie dans api-config.js
  if (typeof getBackendURL === 'function') {
    return getBackendURL();
  }

  // Fallback
  console.warn('[AUTH] getBackendURL non trouvé, utilisation du fallback localhost');
  return 'http://localhost:3000';
}

/**
 * Rafraîchir le JWT si expiré
 */
async function refreshJWT() {
  try {
    // Simplement réenregistrer l'utilisateur
    const { jwt, remainingScans } = await registerUser();
    return { jwt, remainingScans };
  } catch (error) {
    console.error('[AUTH] Erreur refreshJWT:', error);
    throw error;
  }
}

/**
 * Gérer l'erreur TOKEN_EXPIRED
 */
async function handleExpiredToken() {
  console.log('[AUTH] Token expiré, rafraîchissement...');
  try {
    await refreshJWT();
    console.log('[AUTH] Token rafraîchi avec succès');
    return true;
  } catch (error) {
    console.error('[AUTH] Échec du rafraîchissement du token:', error);
    return false;
  }
}

// Export global
window.authService = {
  getDeviceId,
  registerUser,
  getJWT,
  hasCredits,
  getRemainingCredits,
  updateCredits,
  refreshJWT,
  handleExpiredToken
};
