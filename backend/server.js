const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
require('dotenv').config();

const { processJob } = require('./services/job-processor');
const authRoutes = require('./routes/auth-routes');
const paymentRoutes = require('./routes/payment-routes');
const userService = require('./services/user-service');
const { verifyJWT } = require('./middleware/auth-middleware');
const JobManager = require('./utils/job-manager');
const {
  MIN_CONTENT_LENGTH,
  MAX_CONTENT_LENGTH,
  CACHE_EXPIRATION_MS,
  JOB_MAX_AGE_MS,
  MAX_CACHE_ENTRIES,
  MAX_JOBS_IN_MEMORY,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_SCAN_MAX,
  RATE_LIMIT_JOBS_MAX,
  CACHE_CLEANUP_INTERVAL_MS
} = require('./config/constants');

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------
// Configuration
// -----------------------------
const PRIMARY_MODEL = process.env.GEMINI_MODEL;
const FALLBACK_MODELS = [
  PRIMARY_MODEL,
  'gemini-2.0-flash-exp',
  'gemini-2.5-flash',
  'gemini-flash-latest'
].filter(Boolean);

// Stockage en mémoire avec protection contre les fuites mémoire
const jobManager = new JobManager(MAX_JOBS_IN_MEMORY, JOB_MAX_AGE_MS);
const cache = new Map(); // url_hash -> { url, domain, reports: { fr: {}, en: {} }, createdAt, lastAccessedAt }

// Trust proxy (nécessaire pour Render et express-rate-limit)
app.set('trust proxy', 1); // Trust first proxy

// Headers de sécurité
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors());

// IMPORTANT: Le webhook Stripe doit recevoir le raw body
// On utilise express.raw() UNIQUEMENT pour cette route
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Toutes les autres routes utilisent express.json()
app.use(express.json({ limit: '10mb' }));

// Rate limiting pour /scan
const scanLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_SCAN_MAX,
  message: { error: 'Trop de requêtes. Veuillez réessayer dans 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting pour /jobs et autres endpoints
const jobsLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_JOBS_MAX,
  message: { error: 'Trop de requêtes. Veuillez réessayer dans 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// -----------------------------
// Fonctions utilitaires de validation
// -----------------------------

/**
 * Valide et sanitize une URL
 * @param {string} url - URL à valider
 * @returns {string} - URL validée
 * @throws {Error} - Si URL invalide ou dangereuse
 */
function sanitizeAndValidateUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required');
  }

  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    throw new Error('URL cannot be empty');
  }

  // Validation basique avec validator
  if (!validator.isURL(trimmedUrl, { require_protocol: true, protocols: ['http', 'https'] })) {
    throw new Error('Invalid URL format');
  }

  // Parse l'URL pour validation supplémentaire
  let parsedUrl;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch (err) {
    throw new Error('Invalid URL format');
  }

  // Bloquer les schemes dangereux (double vérification)
  const dangerousSchemes = ['file:', 'javascript:', 'data:', 'ftp:', 'ftps:'];
  if (dangerousSchemes.includes(parsedUrl.protocol)) {
    throw new Error('URL scheme not allowed');
  }

  // Bloquer les URLs localhost/internal en production
  if (process.env.NODE_ENV === 'production') {
    const hostname = parsedUrl.hostname.toLowerCase();
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blockedHosts.includes(hostname) || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
      throw new Error('Internal URLs not allowed');
    }
  }

  return trimmedUrl;
}

// -----------------------------
// Fonctions utilitaires du cache
// -----------------------------

/**
 * Vérifie et applique la limite du cache (LRU)
 * Si le cache atteint ou dépasse MAX_CACHE_ENTRIES, supprime les entrées les moins récemment utilisées
 */
function enforceCacheLimit() {
  if (cache.size < MAX_CACHE_ENTRIES) {
    return; // Pas besoin de nettoyer
  }

  const entriesToDelete = cache.size - MAX_CACHE_ENTRIES + 1; // +1 pour faire de la place pour la nouvelle entrée
  console.log(`⚠️  Limite du cache atteinte (${cache.size}/${MAX_CACHE_ENTRIES}). Suppression de ${entriesToDelete} entrée(s) les plus anciennes...`);

  // Trier les entrées par lastAccessedAt (les plus anciennes en premier)
  const sortedEntries = Array.from(cache.entries())
    .sort((a, b) => {
      const timeA = new Date(a[1].lastAccessedAt || a[1].createdAt);
      const timeB = new Date(b[1].lastAccessedAt || b[1].createdAt);
      return timeA - timeB;
    });

  // Supprimer les plus anciennes
  for (let i = 0; i < entriesToDelete; i++) {
    const [urlHash, entry] = sortedEntries[i];
    cache.delete(urlHash);
    console.log(`🗑️  Cache LRU supprimé: ${entry.url}`);
  }

  console.log(`✅ Cache réduit à ${cache.size} entrées`);
}

// -----------------------------
// Routes API
// -----------------------------

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Routes de paiement
app.use('/api/payments', paymentRoutes);

/**
 * POST /scan
 * Lance une analyse de CGU
 * Body: { url: string, content: string, user_language_preference: string, deviceId: string }
 * Headers: Authorization: Bearer <jwt>
 * Response: { job_id: string, remainingScans: number }
 */
app.post('/scan', scanLimiter, verifyJWT, async (req, res) => {
  try {
    console.log('\n==================== SCAN REQUEST ====================');
    const { url, content, user_language_preference, deviceId } = req.body;

    // Vérifier les crédits de l'utilisateur
    if (!deviceId) {
      return res.status(400).json({ error: 'Le champ "deviceId" est requis' });
    }

    console.log(`🔑 [SCAN] DeviceId reçu: ${deviceId}`);

    let user = await userService.getUser(deviceId);

    // Si l'utilisateur n'existe pas, le créer automatiquement
    if (!user) {
      console.log(`✨ [SCAN] Utilisateur inexistant, création automatique pour: ${deviceId}`);
      user = await userService.createUser(deviceId);
    }

    if (user.remainingScans <= 0) {
      return res.status(403).json({
        error: 'QUOTA_EXCEEDED',
        message: 'Quota de scans épuisé',
        remainingScans: 0
      });
    }

    // Validation du contenu
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Le champ "content" est requis et doit être une chaîne de caractères' });
    }

    if (content.length < MIN_CONTENT_LENGTH) {
      return res.status(400).json({ error: `Le contenu est trop court pour être analysé (minimum ${MIN_CONTENT_LENGTH} caractères)` });
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return res.status(413).json({ error: `Contenu trop long (maximum ${MAX_CONTENT_LENGTH} caractères)` });
    }

    // Validation et sanitization de l'URL si fournie
    let validatedUrl = url || 'unknown';
    if (url && typeof url === 'string' && url.trim().length > 0) {
      try {
        validatedUrl = sanitizeAndValidateUrl(url);
      } catch (error) {
        return res.status(400).json({ error: `Invalid URL: ${error.message}` });
      }
    }

    // Valider et définir la langue par défaut
    const userLanguage = ['fr', 'en'].includes(user_language_preference) ? user_language_preference : 'en';

    // Créer le job SANS décrémenter (décrémentation dans job-processor)
    const jobId = crypto.randomUUID();
    jobManager.addJob(jobId, {
      status: 'queued',
      url: validatedUrl,
      content,
      userLanguage,
      deviceId, // Stocker deviceId pour décrémenter dans le processor
      result: null,
      error: null
    });

    // Lancer le traitement en arrière-plan
    // La décrémentation se fera SEULEMENT si cache miss ou nouvelle analyse IA
    processJob(jobId, jobManager, cache, PRIMARY_MODEL, FALLBACK_MODELS, process.env.GEMINI_API_KEY, enforceCacheLimit, userService);

    res.json({
      job_id: jobId,
      remainingScans: user.remainingScans // Retourner les crédits actuels
    });

  } catch (error) {
    console.error('Erreur /scan:', error.message, error.stack);
    res.status(500).json({ error: 'Une erreur est survenue lors du traitement de la requête' });
  }
});

/**
 * GET /jobs/:id
 * Récupère l'état d'un job
 * Response: { status: 'queued'|'running'|'done'|'error', result?: object, error?: string }
 */
app.get('/jobs/:id', jobsLimiter, async (req, res) => {
  const { id } = req.params;

  // Validation du format UUID
  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'ID de job invalide' });
  }

  const job = jobManager.getJob(id);

  if (!job) {
    return res.status(404).json({ error: 'Job introuvable' });
  }

  const response = {
    status: job.status,
    url: job.url
  };

  if (job.status === 'done' && job.result) {
    response.result = job.result;

    // Ajouter les crédits restants si deviceId disponible
    if (job.deviceId) {
      try {
        const user = await userService.getUser(job.deviceId);
        if (user) {
          response.remainingScans = user.remainingScans;
        }
      } catch (error) {
        console.error('[JOBS] Erreur récupération crédits:', error.message);
      }
    }
  }

  if (job.status === 'error' && job.error) {
    response.error = job.error;

    // Ajouter les crédits restants même en cas d'erreur (pour refund)
    if (job.deviceId) {
      try {
        const user = await userService.getUser(job.deviceId);
        if (user) {
          response.remainingScans = user.remainingScans;
        }
      } catch (error) {
        console.error('[JOBS] Erreur récupération crédits:', error.message);
      }
    }
  }

  res.json(response);
});

/**
 * GET /report
 * Recherche dans le cache par hash d'URL
 * Query: ?url_hash=xxx&lang=fr|en
 */
app.get('/report', jobsLimiter, (req, res) => {
  const { url_hash, lang } = req.query;

  if (!url_hash) {
    return res.status(400).json({ error: 'Le paramètre "url_hash" est requis' });
  }

  // Validation du format hash (alphanumérique uniquement)
  if (!/^[a-f0-9]+$/i.test(url_hash)) {
    return res.status(400).json({ error: 'Format de hash invalide' });
  }

  const cachedEntry = cache.get(url_hash);

  if (!cachedEntry) {
    return res.status(404).json({ error: 'Rapport non trouvé en cache' });
  }

  // Si une langue est spécifiée, retourner uniquement cette version
  const language = ['fr', 'en'].includes(lang) ? lang : 'en';

  if (cachedEntry.reports && cachedEntry.reports[language]) {
    res.json(cachedEntry.reports[language]);
  } else {
    return res.status(404).json({
      error: `Rapport non disponible en ${language}`,
      available_languages: Object.keys(cachedEntry.reports || {})
    });
  }
});

/**
 * GET /health
 * Healthcheck basique
 */
app.get('/health', (req, res) => {
  const jobStats = jobManager.getStats();
  res.json({
    status: 'ok',
    jobs: jobStats,
    cache_count: cache.size,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /payment-success
 * Page de confirmation de paiement
 */
app.get('/payment-success', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Paiement réussi - Clear Terms</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 20px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .success-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          background: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: scaleIn 0.5s ease-out;
        }
        .checkmark {
          width: 40px;
          height: 40px;
          border: 4px solid white;
          border-left: none;
          border-top: none;
          transform: rotate(45deg);
          margin-top: -10px;
        }
        h1 {
          color: #1f2937;
          font-size: 28px;
          margin-bottom: 10px;
        }
        p {
          color: #6b7280;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .message {
          background: #f3f4f6;
          padding: 15px;
          border-radius: 10px;
          margin-bottom: 20px;
        }
        .message p {
          margin: 0;
          color: #374151;
          font-weight: 500;
        }
        @keyframes scaleIn {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="success-icon">
          <div class="checkmark"></div>
        </div>
        <h1>Paiement réussi !</h1>
        <p>Merci pour votre achat. Vos crédits ont été ajoutés à votre compte.</p>
        <div class="message">
          <p>Vous pouvez maintenant fermer cette page et retourner à l'extension.</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

/**
 * GET /payment-cancel
 * Page d'annulation de paiement
 */
app.get('/payment-cancel', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Paiement annulé - Clear Terms</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 20px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .error-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          background: #ef4444;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: scaleIn 0.5s ease-out;
        }
        .cross {
          width: 40px;
          height: 40px;
          position: relative;
        }
        .cross::before,
        .cross::after {
          content: '';
          position: absolute;
          width: 4px;
          height: 40px;
          background: white;
          left: 50%;
          top: 50%;
        }
        .cross::before {
          transform: translate(-50%, -50%) rotate(45deg);
        }
        .cross::after {
          transform: translate(-50%, -50%) rotate(-45deg);
        }
        h1 {
          color: #1f2937;
          font-size: 28px;
          margin-bottom: 10px;
        }
        p {
          color: #6b7280;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .message {
          background: #fef2f2;
          padding: 15px;
          border-radius: 10px;
          margin-bottom: 20px;
        }
        .message p {
          margin: 0;
          color: #991b1b;
          font-weight: 500;
        }
        @keyframes scaleIn {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-icon">
          <div class="cross"></div>
        </div>
        <h1>Paiement annulé</h1>
        <p>Votre paiement a été annulé. Aucun montant n'a été débité.</p>
        <div class="message">
          <p>Vous pouvez fermer cette page et réessayer plus tard.</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Le nettoyage des jobs est maintenant géré automatiquement par JobManager

// -----------------------------
// Nettoyage périodique du cache (24h d'expiration)
// -----------------------------
setInterval(() => {
  const now = new Date();
  const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 heures
  let deletedCount = 0;

  for (const [urlHash, cachedEntry] of cache.entries()) {
    const cacheAge = now - new Date(cachedEntry.createdAt);

    if (cacheAge > MAX_CACHE_AGE) {
      cache.delete(urlHash);
      deletedCount++;
      console.log(`🗑️  Cache expiré supprimé: ${cachedEntry.url} (âge: ${Math.round(cacheAge / 1000 / 60 / 60)}h)`);
    }
  }

  if (deletedCount > 0) {
    console.log(`🧹 Nettoyage du cache terminé: ${deletedCount} entrée(s) supprimée(s). Cache restant: ${cache.size}`);
  }
}, 60 * 60 * 1000); // Toutes les heures

// -----------------------------
// Lancement du serveur
// -----------------------------
app.listen(PORT, () => {
  console.log(`✅ Clear Terms Backend démarré sur le port ${PORT}`);
  console.log(`📊 Modèle IA: ${PRIMARY_MODEL}`);
});
