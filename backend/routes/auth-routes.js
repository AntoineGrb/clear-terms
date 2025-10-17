const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRATION } = require('../config/jwt-config');
const userService = require('../services/user-service');
const { verifyJWT } = require('../middleware/auth-middleware');

const router = express.Router();

/**
 * Validation d'un UUID v4
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * POST /api/auth/register
 * Enregistrer un nouvel utilisateur ou récupérer un utilisateur existant
 *
 * Body: { deviceId: "uuid-v4" }
 * Response: { jwt: "token", remainingScans: 20, createdAt: "date" }
 */
router.post('/register', async (req, res) => {
  try {
    const { deviceId } = req.body;

    // Validation du deviceId
    if (!deviceId) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_ID',
        message: 'deviceId is required'
      });
    }

    if (!isValidUUID(deviceId)) {
      return res.status(400).json({
        error: 'INVALID_DEVICE_ID',
        message: 'deviceId must be a valid UUID v4'
      });
    }

    // Vérifier si l'utilisateur existe déjà
    let user = await userService.getUser(deviceId);

    if (!user) {
      // Créer un nouvel utilisateur avec 20 crédits gratuits
      user = await userService.createUser(deviceId);
      console.log(`[AUTH] New user registered: ${deviceId}`);
    } else {
      console.log(`[AUTH] Existing user logged in: ${deviceId}`);
    }

    // Générer le JWT
    const token = jwt.sign(
      {
        deviceId: user.deviceId,
        remainingScans: user.remainingScans
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    res.json({
      jwt: token,
      remainingScans: user.remainingScans,
      createdAt: user.createdAt
    });

  } catch (error) {
    console.error('[AUTH] Registration error:', error);
    res.status(500).json({
      error: 'REGISTRATION_ERROR',
      message: 'Failed to register user'
    });
  }
});

/**
 * GET /api/auth/credits
 * Récupérer les crédits actuels d'un utilisateur
 *
 * Headers: Authorization: Bearer <jwt>
 * Query/Body: { deviceId: "uuid-v4" }
 * Response: { remainingScans: 15, totalScansUsed: 5 }
 */
router.get('/credits', verifyJWT, async (req, res) => {
  try {
    const deviceId = req.body.deviceId || req.query.deviceId;

    if (!deviceId) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_ID',
        message: 'deviceId is required'
      });
    }

    const user = await userService.getUser(deviceId);

    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    res.json({
      remainingScans: user.remainingScans,
      totalScansUsed: user.totalScansUsed,
      plan: user.plan
    });

  } catch (error) {
    console.error('[AUTH] Credits fetch error:', error);
    res.status(500).json({
      error: 'FETCH_CREDITS_ERROR',
      message: 'Failed to fetch credits'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Rafraîchir le JWT avec les crédits à jour
 *
 * Headers: Authorization: Bearer <jwt>
 * Body: { deviceId: "uuid-v4" }
 * Response: { jwt: "new-token", remainingScans: 15 }
 */
router.post('/refresh', verifyJWT, async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_ID',
        message: 'deviceId is required'
      });
    }

    const user = await userService.getUser(deviceId);

    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Générer un nouveau JWT avec les crédits à jour
    const token = jwt.sign(
      {
        deviceId: user.deviceId,
        remainingScans: user.remainingScans
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    res.json({
      jwt: token,
      remainingScans: user.remainingScans
    });

  } catch (error) {
    console.error('[AUTH] Refresh token error:', error);
    res.status(500).json({
      error: 'REFRESH_TOKEN_ERROR',
      message: 'Failed to refresh token'
    });
  }
});

module.exports = router;
