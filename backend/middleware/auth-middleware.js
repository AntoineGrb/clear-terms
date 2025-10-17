const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt-config');

/**
 * Middleware pour vérifier le JWT et valider l'utilisateur
 */
function verifyJWT(req, res, next) {
  // Récupérer le token depuis le header Authorization
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      error: 'NO_TOKEN',
      message: 'Authorization token is required'
    });
  }

  // Format attendu: "Bearer <token>"
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: 'INVALID_TOKEN_FORMAT',
      message: 'Authorization header must be in format: Bearer <token>'
    });
  }

  const token = parts[1];

  try {
    // Vérifier et décoder le JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    // Vérifier que le deviceId du JWT correspond au deviceId de la requête
    const requestDeviceId = req.body.deviceId || req.query.deviceId;

    if (!requestDeviceId) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_ID',
        message: 'deviceId is required in request'
      });
    }

    if (decoded.deviceId !== requestDeviceId) {
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
      return res.status(403).json({
        error: 'TOKEN_EXPIRED',
        message: 'Token has expired. Please re-register.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        error: 'INVALID_TOKEN',
        message: 'Token is invalid'
      });
    }

    // Autre erreur
    return res.status(500).json({
      error: 'TOKEN_VERIFICATION_ERROR',
      message: 'Error verifying token'
    });
  }
}

/**
 * Middleware optionnel pour vérifier le JWT sans bloquer
 * Utile pour des routes qui peuvent fonctionner avec ou sans auth
 */
function optionalJWT(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    req.user = null;
    return next();
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    req.user = null;
    return next();
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

module.exports = {
  verifyJWT,
  optionalJWT
};
