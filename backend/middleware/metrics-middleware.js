const metricsStore = require('../utils/metrics-store');

/**
 * Middleware pour tracker les métriques de toutes les requêtes
 */
function metricsMiddleware(req, res, next) {
  const startTime = Date.now();

  // Hook sur la fin de la réponse
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Incrémenter le compteur total
    metricsStore.incrementRequest('total');

    // Incrémenter les compteurs par type de route
    const path = req.path;

    if (path.startsWith('/scan')) {
      metricsStore.incrementRequest('scan');
    } else if (path.startsWith('/jobs')) {
      metricsStore.incrementRequest('jobs');
    } else if (path.startsWith('/health')) {
      metricsStore.incrementRequest('health');
    } else if (path.startsWith('/api/auth')) {
      metricsStore.incrementRequest('auth');
    } else if (path.startsWith('/api/payments')) {
      metricsStore.incrementRequest('payments');
    } else if (path.startsWith('/metrics')) {
      metricsStore.incrementRequest('metrics');
    } else {
      metricsStore.incrementRequest('other');
    }

    // Enregistrer le temps de réponse
    metricsStore.recordResponseTime(duration);

    // Compter les erreurs serveur (5xx)
    if (res.statusCode >= 500) {
      metricsStore.incrementError();
    }
  });

  next();
}

module.exports = metricsMiddleware;
