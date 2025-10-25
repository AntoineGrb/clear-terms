/**
 * Constantes applicatives centralisées
 */

// Limites de contenu
const MIN_CONTENT_LENGTH = 300; // Longueur minimale pour un contenu CGU valide
const MAX_CONTENT_LENGTH = 500000; // Limite API (500 KB de texte)

// Durées de cache
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 heures
const JOB_MAX_AGE_MS = 60 * 60 * 1000; // 1 heure

// Limites de stockage
const MAX_CACHE_ENTRIES = 1000; // Nombre max d'entrées en cache
const MAX_JOBS_IN_MEMORY = 1000; // Nombre max de jobs en mémoire

// Rate limiting
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_SCAN_MAX = 10; // Max 10 scans par minute
const RATE_LIMIT_JOBS_MAX = 60; // Max 60 requêtes jobs par minute

// Délais et timeouts
const JOB_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Nettoyage toutes les 5 minutes
const CACHE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Nettoyage cache toutes les heures

module.exports = {
  MIN_CONTENT_LENGTH,
  MAX_CONTENT_LENGTH,
  CACHE_EXPIRATION_MS,
  JOB_MAX_AGE_MS,
  MAX_CACHE_ENTRIES,
  MAX_JOBS_IN_MEMORY,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_SCAN_MAX,
  RATE_LIMIT_JOBS_MAX,
  JOB_CLEANUP_INTERVAL_MS,
  CACHE_CLEANUP_INTERVAL_MS
};
