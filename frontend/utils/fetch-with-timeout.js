/**
 * Fetch avec timeout automatique pour éviter les requêtes bloquées
 * @param {string} url - URL à requêter
 * @param {object} options - Options fetch standard
 * @param {number} timeout - Timeout en ms (défaut: 30s)
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    return response;

  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Request timeout after ${timeout}ms`);
      timeoutError.isTimeout = true;
      throw timeoutError;
    }
    throw error;

  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch avec timeout et parsing JSON automatique
 * @param {string} url - URL à requêter
 * @param {object} options - Options fetch standard
 * @param {number} timeout - Timeout en ms (défaut: 30s)
 * @returns {Promise<any>} - Réponse JSON parsée
 */
async function fetchJSON(url, options = {}, timeout = 30000) {
  const response = await fetchWithTimeout(url, options, timeout);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    const err = new Error(error.error || error.message || `HTTP ${response.status}`);
    err.status = response.status;
    err.response = error;
    throw err;
  }

  return response.json();
}
