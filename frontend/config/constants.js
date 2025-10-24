/**
 * Constantes frontend centralisées
 */

// Limites API
const MAX_POLL_ATTEMPTS = 60; // 60 tentatives max
const POLL_INTERVAL = 2000; // 2 secondes entre chaque poll

// Timeouts
const DEFAULT_FETCH_TIMEOUT = 30000; // 30 secondes
const LONG_FETCH_TIMEOUT = 60000; // 60 secondes pour analyses

// Historique
const MAX_REPORTS_HISTORY = 100; // Nombre max de rapports en historique

// Toast
const DEFAULT_TOAST_DURATION = 30000; // 30 secondes
const TOAST_ACTION_MAX_AGE = 5000; // 5 secondes max pour action pending

// Crédits par défaut
const DEFAULT_CREDITS = 20;

// Export global (compatible avec script tags)
if (typeof window !== 'undefined') {
  window.CONSTANTS = {
    MAX_POLL_ATTEMPTS,
    POLL_INTERVAL,
    DEFAULT_FETCH_TIMEOUT,
    LONG_FETCH_TIMEOUT,
    MAX_REPORTS_HISTORY,
    DEFAULT_TOAST_DURATION,
    TOAST_ACTION_MAX_AGE,
    DEFAULT_CREDITS
  };
}
