const crypto = require('crypto');

/**
 * Calcule un hash SHA-256 basé sur l'URL normalisée
 */
function calculateUrlHash(url) {
  try {
    const urlObj = new URL(url);

    // Normaliser l'URL : protocole + hostname + pathname (sans query params ni fragment)
    // Garder certains params importants si présents (country, lang, region)
    const importantParams = ['country', 'lang', 'region', 'locale'];
    const searchParams = new URLSearchParams(urlObj.search);
    const keptParams = [];

    for (const param of importantParams) {
      if (searchParams.has(param)) {
        keptParams.push(`${param}=${searchParams.get(param)}`);
      }
    }

    // Construire l'URL normalisée
    let normalizedUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;

    // Retirer le trailing slash sauf pour la racine
    if (normalizedUrl.endsWith('/') && urlObj.pathname !== '/') {
      normalizedUrl = normalizedUrl.slice(0, -1);
    }

    // Ajouter les params importants s'il y en a
    if (keptParams.length > 0) {
      normalizedUrl += '?' + keptParams.sort().join('&');
    }

    return crypto.createHash('sha256').update(normalizedUrl.toLowerCase()).digest('hex');
  } catch (error) {
    // Si l'URL est invalide, hasher l'URL brute
    return crypto.createHash('sha256').update(url.toLowerCase()).digest('hex');
  }
}

/**
 * Nettoie le texte extrait (supprime espaces multiples, lignes vides, etc.)
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  calculateUrlHash,
  cleanText
};
