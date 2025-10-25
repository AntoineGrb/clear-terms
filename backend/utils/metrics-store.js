const fs = require('fs').promises;
const path = require('path');

// Chemin du fichier de persistance
const METRICS_FILE_PATH = path.join(__dirname, '..', 'data', 'metrics.json');
const SAVE_INTERVAL = 30000; // 30 secondes

// Données en mémoire
let metricsData = {
  startTime: new Date().toISOString(),
  lastResetTime: new Date().toISOString(),
  requests: {
    total: 0,
    scan: 0,
    jobs: 0,
    health: 0,
    auth: 0,
    payments: 0,
    metrics: 0,
    other: 0
  },
  database: {
    queries: 0,
    usersCreated: 0,
    reads: 0,
    writes: 0
  },
  scans: {
    consumed: 0,
    fromCache: 0,
    total: 0
  },
  performance: {
    totalResponseTime: 0,
    requestCount: 0,
    errors: 0
  }
};

let isDirty = false; // Flag pour savoir si des modifications ont eu lieu

/**
 * Crée le dossier data/ s'il n'existe pas
 */
async function ensureDataDir() {
  const dataDir = path.dirname(METRICS_FILE_PATH);
  try {
    await fs.access(dataDir);
  } catch (error) {
    await fs.mkdir(dataDir, { recursive: true });
    console.log('📁 Dossier backend/data/ créé');
  }
}

/**
 * Charge les métriques depuis le fichier JSON
 */
async function loadFromFile() {
  try {
    await ensureDataDir();
    const fileContent = await fs.readFile(METRICS_FILE_PATH, 'utf-8');
    const loadedData = JSON.parse(fileContent);

    // Merger les données chargées avec la structure par défaut (pour compatibilité)
    metricsData = { ...metricsData, ...loadedData };

    console.log('📊 Métriques chargées depuis metrics.json');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Fichier n'existe pas, on le crée
      console.log('📊 Fichier metrics.json introuvable, initialisation...');
      await saveToFile();
    } else {
      console.error('❌ Erreur lors du chargement des métriques:', error.message);
    }
  }
}

/**
 * Sauvegarde les métriques dans le fichier JSON
 */
async function saveToFile() {
  try {
    await ensureDataDir();
    await fs.writeFile(
      METRICS_FILE_PATH,
      JSON.stringify(metricsData, null, 2),
      'utf-8'
    );
    console.log('💾 Métriques sauvegardées dans metrics.json');
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde des métriques:', error.message);
  }
}

/**
 * Sauvegarde périodique automatique (toutes les 30s si modifié)
 */
setInterval(async () => {
  if (isDirty) {
    await saveToFile();
    isDirty = false;
  }
}, SAVE_INTERVAL);

/**
 * Incrémente le compteur de requêtes
 * @param {string} type - Type de requête ('total', 'scan', 'jobs', etc.)
 */
function incrementRequest(type) {
  if (metricsData.requests[type] !== undefined) {
    metricsData.requests[type]++;
    isDirty = true;
  }
}

/**
 * Incrémente le compteur de requêtes DB
 * @param {string} type - Type de requête ('read' ou 'write')
 */
function incrementDbQuery(type) {
  metricsData.database.queries++;
  if (type === 'read') {
    metricsData.database.reads++;
  } else if (type === 'write') {
    metricsData.database.writes++;
  }
  isDirty = true;
}

/**
 * Incrémente le compteur d'utilisateurs créés
 */
function incrementUserCreated() {
  metricsData.database.usersCreated++;
  isDirty = true;
}

/**
 * Incrémente le compteur de scans consommés (payants)
 */
function incrementScanConsumed() {
  metricsData.scans.consumed++;
  metricsData.scans.total++;
  isDirty = true;
}

/**
 * Incrémente le compteur de cache hits (scans gratuits)
 */
function incrementCacheHit() {
  metricsData.scans.fromCache++;
  metricsData.scans.total++;
  isDirty = true;
}

/**
 * Enregistre le temps de réponse d'une requête
 * @param {number} ms - Temps de réponse en millisecondes
 */
function recordResponseTime(ms) {
  metricsData.performance.totalResponseTime += ms;
  metricsData.performance.requestCount++;
  isDirty = true;
}

/**
 * Incrémente le compteur d'erreurs
 */
function incrementError() {
  metricsData.performance.errors++;
  isDirty = true;
}

/**
 * Calcule l'uptime depuis le démarrage
 * @returns {string} Uptime formaté (ex: "2d 5h 30m")
 */
function getUptime() {
  const startTime = new Date(metricsData.startTime);
  const now = new Date();
  const uptimeMs = now - startTime;

  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

/**
 * Retourne toutes les métriques avec calculs
 * @returns {object} Objet contenant toutes les métriques
 */
function getMetrics() {
  const avgResponseTime = metricsData.performance.requestCount > 0
    ? Math.round(metricsData.performance.totalResponseTime / metricsData.performance.requestCount)
    : 0;

  return {
    uptime: getUptime(),
    startTime: metricsData.startTime,
    lastResetTime: metricsData.lastResetTime,
    requests: metricsData.requests,
    database: metricsData.database,
    scans: metricsData.scans,
    performance: {
      avgResponseTime: `${avgResponseTime}ms`,
      errors: metricsData.performance.errors,
      totalRequests: metricsData.performance.requestCount
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Réinitialise toutes les métriques
 */
async function resetMetrics() {
  const now = new Date().toISOString();
  metricsData = {
    startTime: now,
    lastResetTime: now,
    requests: {
      total: 0,
      scan: 0,
      jobs: 0,
      health: 0,
      auth: 0,
      payments: 0,
      metrics: 0,
      other: 0
    },
    database: {
      queries: 0,
      usersCreated: 0,
      reads: 0,
      writes: 0
    },
    scans: {
      consumed: 0,
      fromCache: 0,
      total: 0
    },
    performance: {
      totalResponseTime: 0,
      requestCount: 0,
      errors: 0
    }
  };
  isDirty = true;
  await saveToFile();
  console.log('🔄 Métriques réinitialisées');
}

/**
 * Force la sauvegarde immédiate
 */
async function forceSave() {
  await saveToFile();
  isDirty = false;
}

// Charger les métriques au démarrage
loadFromFile();

module.exports = {
  incrementRequest,
  incrementDbQuery,
  incrementUserCreated,
  incrementScanConsumed,
  incrementCacheHit,
  recordResponseTime,
  incrementError,
  getMetrics,
  resetMetrics,
  forceSave
};
