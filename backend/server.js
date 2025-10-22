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

const MAX_CACHE_ENTRIES = 1000; // Limite du cache : 1000 URLs max (avec FR + EN)

// Stockage en mémoire
const jobs = new Map(); // job_id -> { status, url, result, error, createdAt }
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

// Rate limiting pour /scan (10 requêtes par minute par IP)
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Trop de requêtes. Veuillez réessayer dans 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting pour /jobs (60 requêtes par minute par IP)
const jobsLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 60,
  message: { error: 'Trop de requêtes. Veuillez réessayer dans 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

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

    if (content.length < 300) {
      return res.status(400).json({ error: 'Le contenu est trop court pour être analysé (minimum 300 caractères)' });
    }

    if (content.length > 500000) {
      return res.status(413).json({ error: 'Contenu trop long, plus de 500 000 caractères' });
    }

    // Validation de l'URL si fournie
    if (url && typeof url === 'string') {
      const sanitizedUrl = url.trim();
      if (sanitizedUrl.length > 0 && !validator.isURL(sanitizedUrl, { require_protocol: true, protocols: ['http', 'https'] })) {
        return res.status(400).json({ error: 'URL invalide' });
      }
    }

    // Valider et définir la langue par défaut
    const userLanguage = ['fr', 'en'].includes(user_language_preference) ? user_language_preference : 'en';

    // Créer le job SANS décrémenter (décrémentation dans job-processor)
    const jobId = crypto.randomUUID();
    jobs.set(jobId, {
      status: 'queued',
      url: url || 'unknown',
      content,
      userLanguage,
      deviceId, // Stocker deviceId pour décrémenter dans le processor
      result: null,
      error: null,
      createdAt: Date.now()
    });

    // Lancer le traitement en arrière-plan
    // La décrémentation se fera SEULEMENT si cache miss ou nouvelle analyse IA
    processJob(jobId, jobs, cache, PRIMARY_MODEL, FALLBACK_MODELS, process.env.GEMINI_API_KEY, enforceCacheLimit, userService);

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

  const job = jobs.get(id);

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
app.get('/report', (req, res) => {
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
  res.json({
    status: 'ok',
    jobs_count: jobs.size,
    cache_count: cache.size,
    timestamp: new Date().toISOString()
  });
});

// -----------------------------
// Nettoyage périodique des vieux jobs (MVP)
// -----------------------------
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 heure

  for (const [jobId, job] of jobs.entries()) {
    if (now - job.createdAt > maxAge) {
      jobs.delete(jobId);
      console.log(`🗑️  Job ${jobId} supprimé (trop ancien)`);
    }
  }
}, 10 * 60 * 1000); // Toutes les 10 minutes

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
