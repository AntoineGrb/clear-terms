const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt-config');

/**
 * Middleware pour vérifier le JWT et valider l'utilisateur
 */
function verifyJWT(req, res, next) {
  // Récupérer le token depuis le header Authorization
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    console.log('❌ [AUTH] Erreur: Aucun token fourni');
    console.log('   IP:', req.ip || req.connection.remoteAddress);
    console.log('   URL:', req.originalUrl);
    return res.status(401).json({
      error: 'NO_TOKEN',
      message: 'Authorization token is required'
    });
  }

  // Format attendu: "Bearer <token>"
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log('❌ [AUTH] Erreur: Format de token invalide');
    console.log('   Header reçu:', authHeader.substring(0, 50) + '...');
    return res.status(401).json({
      error: 'INVALID_TOKEN_FORMAT',
      message: 'Authorization header must be in format: Bearer <token>'
    });
  }

  const token = parts[1];

  // Récupérer le deviceId AVANT le try/catch pour qu'il soit accessible partout
  const requestDeviceId = req.body.deviceId || req.query.deviceId;

  try {
    // Vérifier et décoder le JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    // Vérifier que le deviceId est présent dans la requête
    if (!requestDeviceId) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_ID',
        message: 'deviceId is required in request'
      });
    }

    if (decoded.deviceId !== requestDeviceId) {
      console.log('❌ [AUTH] Erreur: DeviceId ne correspond pas');
      console.log('   Token deviceId:', decoded.deviceId);
      console.log('   Request deviceId:', requestDeviceId);
      return res.status(403).json({
        error: 'DEVICE_MISMATCH',
        message: 'Token deviceId does not match request deviceId'
      });
    }

    // Ajouter les informations décodées à la requête
    req.user = decoded;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('❌ [AUTH] Erreur: Token expiré');
      console.log('   DeviceId de la requête:', requestDeviceId);
      return res.status(403).json({
        error: 'TOKEN_EXPIRED',
        message: 'Token has expired. Please re-register.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      console.log('❌ [AUTH] Erreur: Token invalide');
      console.log('   DeviceId de la requête:', requestDeviceId);
      return res.status(403).json({
        error: 'INVALID_TOKEN',
        message: 'Token is invalid'
      });
    }

    // Autre erreur
    console.error('❌ [AUTH] Erreur de vérification du token:', error);
    return res.status(500).json({
      error: 'TOKEN_VERIFICATION_ERROR',
      message: 'Error verifying token'
    });
  }
}

module.exports = {
  verifyJWT,
};
