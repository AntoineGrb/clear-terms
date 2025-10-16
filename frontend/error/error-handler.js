/**
 * Système centralisé de gestion d'erreur
 * Classifie les erreurs et fournit des messages clairs pour l'utilisateur
 */

const ERROR_TYPES = {
  NETWORK_ERROR: {
    code: 'ERR_NETWORK',
    message: {
      fr: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
      en: 'Cannot connect to server. Check your internet connection.'
    }
  },
  BACKEND_UNAVAILABLE: {
    code: 'ERR_BACKEND',
    message: {
      fr: 'Le service d\'analyse est temporairement indisponible.',
      en: 'Analysis service is temporarily unavailable.'
    }
  },
  CONTENT_SCRIPT_ERROR: {
    code: 'ERR_CONTENT_SCRIPT',
    message: {
      fr: 'Impossible d\'accéder au contenu de la page. Rechargez la page et réessayez.',
      en: 'Cannot access page content. Reload the page and try again.'
    }
  },
  CONTENT_TOO_LARGE: {
    code: 'ERR_TOO_LARGE',
    message: {
      fr: 'Le contenu de la page est trop volumineux pour être analysé.',
      en: 'Page content is too large to analyze.'
    }
  },
  TIMEOUT: {
    code: 'ERR_TIMEOUT',
    message: {
      fr: 'L\'analyse prend trop de temps. Le serveur est peut-être surchargé.',
      en: 'Analysis is taking too long. Server may be overloaded.'
    }
  },
  PROTECTED_PAGE: {
    code: 'ERR_PROTECTED',
    message: {
      fr: 'Cette page est protégée et ne peut pas être analysée.',
      en: 'This page is protected and cannot be analyzed.'
    }
  },
  INVALID_RESPONSE: {
    code: 'ERR_INVALID_RESPONSE',
    message: {
      fr: 'La réponse du serveur est invalide.',
      en: 'Server response is invalid.'
    }
  },
  CONTENT_TOO_SHORT: {
    code: 'ERR_TOO_SHORT',
    message: {
      fr: 'Le contenu de la page est trop court pour être analysé.',
      en: 'Page content is too short to analyze.'
    }
  },
  GENERIC: {
    code: 'ERR_GENERIC',
    message: {
      fr: 'Une erreur inattendue est survenue.',
      en: 'An unexpected error occurred.'
    }
  }
};

/**
 * Classifie une erreur selon son type
 */
function classifyError(error) {
  // Erreurs réseau (pas de réponse du serveur)
  if (error.isNetworkError ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('net::ERR')) {
    return ERROR_TYPES.NETWORK_ERROR;
  }

  // Backend indisponible (localhost:3000 down)
  if (error.message.includes('ECONNREFUSED') ||
      error.status === 503 ||
      error.status === 502) {
    return ERROR_TYPES.BACKEND_UNAVAILABLE;
  }

  // Content script non chargé ou inaccessible
  if (error.message.includes('Could not establish connection') ||
      error.message.includes('Receiving end does not exist') ||
      error.message.includes('Cannot access')) {
    return ERROR_TYPES.CONTENT_SCRIPT_ERROR;
  }

  // Contenu trop large
  if (error.status === 413 ||
      error.message.includes('Contenu trop long') ||
      error.message.includes('too large')) {
    return ERROR_TYPES.CONTENT_TOO_LARGE;
  }

  // Timeout
  if (error.message.includes('Timeout') ||
      error.message.includes('trop de temps') ||
      error.message.includes('taking too long')) {
    return ERROR_TYPES.TIMEOUT;
  }

  // Page protégée
  if (error.isProtectedPage ||
      error.message.includes('Page protégée') ||
      error.message.includes('chrome://') ||
      error.message.includes('about:')) {
    return ERROR_TYPES.PROTECTED_PAGE;
  }

  // Réponse invalide du serveur
  if (error instanceof SyntaxError ||
      error.message.includes('JSON') ||
      error.message.includes('Unexpected token')) {
    return ERROR_TYPES.INVALID_RESPONSE;
  }

  // Contenu trop court
  if (error.message.includes('trop court') ||
      error.message.includes('too short')) {
    return ERROR_TYPES.CONTENT_TOO_SHORT;
  }

  return ERROR_TYPES.GENERIC;
}

/**
 * Formate une erreur pour l'affichage utilisateur
 * @param {Error} error - L'erreur à formater
 * @param {string} lang - Langue ('fr' ou 'en')
 * @returns {Object} { message, code }
 */
function formatErrorForUser(error, lang = 'fr') {
  const errorType = classifyError(error);
  return {
    message: errorType.message[lang],
    code: errorType.code
  };
}
