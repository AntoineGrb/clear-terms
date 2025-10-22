// ========================================
// Browser Fingerprinting Service
// Génère un identifiant unique stable basé sur les caractéristiques du navigateur
// ========================================

/**
 * Génère un fingerprint du navigateur
 * UNIQUEMENT basé sur des caractéristiques HARDWARE qui ne changent jamais
 *
 * @returns {Promise<string>} Un UUID v4 déterministe basé sur le fingerprint
 */
async function generateBrowserFingerprint() {
  const components = [];

  // 1. ✅ Canvas fingerprinting
  // La façon dont le GPU rend le canvas est unique et ne change pas
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Clear Terms 🔐', 2, 15);
    components.push(canvas.toDataURL());
  } catch (e) {
    components.push('canvas-error');
  }

  // 2. ✅ WebGL fingerprinting (GPU vendor/renderer - HARDWARE)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      } else {
        // Fallback si debug_renderer_info non disponible
        components.push(gl.getParameter(gl.RENDERER));
        components.push(gl.getParameter(gl.VENDOR));
      }
    } else {
      components.push('webgl-not-supported');
    }
  } catch (e) {
    components.push('webgl-error');
  }

  // 3. ✅ CPU cores (HARDWARE - ne change jamais)
  components.push(navigator.hardwareConcurrency || 'unknown');

  // 4. ✅ Device memory (RAM - HARDWARE - ne change jamais)
  components.push(navigator.deviceMemory || 'unknown');

  // 5. ✅ Platform (OS base - rarement change)
  components.push(navigator.platform);

  // 6. ✅ Max touch points (HARDWARE - écran tactile)
  components.push(navigator.maxTouchPoints || 0);

  // Combiner tous les composants
  const fingerprintString = components.join('|||');

  // Générer un hash SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprintString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Convertir le hash en UUID v4 format (déterministe)
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuid = [
    hashHex.substr(0, 8),
    hashHex.substr(8, 4),
    '4' + hashHex.substr(13, 3), // Version 4
    ((parseInt(hashHex.substr(16, 1), 16) & 0x3) | 0x8).toString(16) + hashHex.substr(17, 3), // Variant
    hashHex.substr(20, 12)
  ].join('-');

  console.log('[FINGERPRINT] Généré (ultra-stable hardware-only):', uuid.substring(0, 8) + '...');
  return uuid;
}

/**
 * Génère une support_key courte et lisible à partir du device_id
 * Format: CT-XXXX-YYYY (ex: CT-8F2A-119B)
 *
 * @param {string} deviceId - L'UUID complet du device
 * @returns {string} Support key au format CT-XXXX-YYYY
 */
function generateSupportKey(deviceId) {
  // Prendre les 8 premiers caractères du device_id (avant le premier tiret)
  // et les 4 caractères après le premier tiret
  const parts = deviceId.split('-');
  const part1 = parts[0].substring(0, 4).toUpperCase();
  const part2 = parts[1].substring(0, 4).toUpperCase();

  return `CT-${part1}-${part2}`;
}

/**
 * Récupère le deviceId basé sur le fingerprint (avec fallback sur storage)
 *
 * STRATÉGIE:
 * - Version 3 = fingerprint ultra-stable (hardware-only)
 * - Regénère le fingerprint à chaque appel pour vérifier la stabilité
 * - Si différent de la version stockée, on met à jour (pour migration v1/v2 → v3)
 *
 * @returns {Promise<string>} Le deviceId
 */
async function getStableDeviceId() {
  try {
    // 1. Toujours générer le fingerprint actuel
    const currentFingerprint = await generateBrowserFingerprint();

    // 2. Vérifier si on a un deviceId stocké
    const stored = await chrome.storage.sync.get(['deviceId', 'fingerprintVersion']);

    // Si on a déjà un deviceId en version 3, le comparer
    if (stored.deviceId && stored.fingerprintVersion === 3) {
      if (stored.deviceId === currentFingerprint) {
        console.log('[FINGERPRINT] DeviceId v3 identique (stable ✅)');
        return stored.deviceId;
      } else {
        console.warn('[FINGERPRINT] DeviceId v3 différent (instabilité détectée ⚠️)');
        console.warn('[FINGERPRINT] Ancien:', stored.deviceId.substring(0, 8) + '...');
        console.warn('[FINGERPRINT] Nouveau:', currentFingerprint.substring(0, 8) + '...');
        // On utilise quand même l'ancien pour éviter de perdre les crédits
        return stored.deviceId;
      }
    }

    // Migration depuis v1/v2 ou première utilisation
    console.log('[FINGERPRINT] Migration vers v3 ultra-stable ou première utilisation');
    await chrome.storage.sync.set({
      deviceId: currentFingerprint,
      fingerprintVersion: 3
    });

    console.log('[FINGERPRINT] DeviceId v3 créé et stocké');
    return currentFingerprint;

  } catch (error) {
    console.error('[FINGERPRINT] Erreur:', error);

    const fallbackId = crypto.randomUUID();
    await chrome.storage.sync.set({
      deviceId: fallbackId,
      fingerprintVersion: 0 // Version 0 = fallback aléatoire
    });

    console.warn('[FINGERPRINT] Fallback UUID aléatoire utilisé');
    return fallbackId;
  }
}

// Export global
window.fingerprintService = {
  generateBrowserFingerprint,
  getStableDeviceId,
  generateSupportKey
};
