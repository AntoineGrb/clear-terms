const express = require('express');
const stripeService = require('../services/stripe-service');
const userService = require('../services/user-service');
const { verifyJWT } = require('../middleware/auth-middleware');

const router = express.Router();

/**
 * POST /api/payments/create-checkout-session
 * Créer une session Stripe Checkout
 *
 * Body: { deviceId: string, priceId: string, amount: number }
 * Response: { sessionId: string, url: string }
 */
router.post('/create-checkout-session', verifyJWT, async (req, res) => {
  try {
    console.log('\n==================== CREATE CHECKOUT SESSION ====================');
    const { deviceId, priceId, amount } = req.body;

    console.log(`🔑 [PAYMENT] Session request for deviceId: ${deviceId}, amount: ${amount}€`);

    // Validation
    if (!deviceId || !priceId || !amount) {
      return res.status(400).json({
        error: 'MISSING_PARAMETERS',
        message: 'deviceId, priceId and amount are required'
      });
    }

    // Vérifier que l'utilisateur existe
    const user = await userService.getUser(deviceId);
    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Vérifier que Stripe est configuré
    if (!stripeService.isConfigured()) {
      return res.status(503).json({
        error: 'STRIPE_NOT_CONFIGURED',
        message: 'Payment service not available'
      });
    }

    // URLs de redirection (à adapter selon votre configuration)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const successUrl = `${baseUrl}/pages/payment-success.html?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/pages/payment-error.html`;

    // Créer la session Checkout
    const session = await stripeService.createCheckoutSession({
      deviceId,
      priceId,
      amount,
      successUrl,
      cancelUrl
    });

    // Mettre à jour le stripeCustomerId si ce n'est pas déjà fait
    if (!user.stripeCustomerId && session.customer) {
      await userService.updateStripeCustomerId(deviceId, session.customer);
    }

    console.log(`✅ [PAYMENT] Session créée: ${session.id}`);

    res.json({
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('[PAYMENT] Create checkout session error:', error);
    res.status(500).json({
      error: 'CREATE_SESSION_ERROR',
      message: 'Failed to create checkout session'
    });
  }
});

/**
 * POST /api/payments/webhook
 * Webhook Stripe pour traiter les événements de paiement
 *
 * Important: Ce endpoint doit être accessible sans JWT
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('\n==================== STRIPE WEBHOOK ====================');

    const signature = req.headers['stripe-signature'];

    if (!signature) {
      console.error('❌ [WEBHOOK] Pas de signature');
      return res.status(400).json({ error: 'No signature provided' });
    }

    // Vérifier la signature du webhook
    let event;
    try {
      event = stripeService.verifyWebhookSignature(req.body, signature);
    } catch (err) {
      console.error('❌ [WEBHOOK] Signature invalide:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log(`📨 [WEBHOOK] Event type: ${event.type}`);

    // Traiter l'événement
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log(`✅ [WEBHOOK] Checkout completed: ${session.id}`);

        const { deviceId, amount } = session.metadata;
        const paymentIntentId = session.payment_intent;

        if (!deviceId || !amount) {
          console.error('❌ [WEBHOOK] Metadata manquante');
          return res.status(400).json({ error: 'Missing metadata' });
        }

        // Enregistrer l'achat et ajouter les crédits
        const result = await userService.recordPurchase(deviceId, {
          stripePaymentIntentId: paymentIntentId,
          amount: parseFloat(amount),
          status: 'completed'
        });

        console.log(`💳 [WEBHOOK] ${result.scansAdded} scans ajoutés à ${deviceId}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log(`❌ [WEBHOOK] Payment failed: ${paymentIntent.id}`);

        // Optionnel: enregistrer l'échec
        const deviceId = paymentIntent.metadata?.deviceId;
        if (deviceId) {
          await userService.recordPurchase(deviceId, {
            stripePaymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount / 100, // Stripe envoie en centimes
            status: 'failed'
          });
        }
        break;
      }

      default:
        console.log(`ℹ️  [WEBHOOK] Event non traité: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * GET /api/payments/history
 * Récupérer l'historique des achats d'un utilisateur
 *
 * Query: { deviceId: string }
 * Response: { purchases: [...] }
 */
router.get('/history', verifyJWT, async (req, res) => {
  try {
    console.log('\n==================== GET PURCHASE HISTORY ====================');
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_ID',
        message: 'deviceId is required'
      });
    }

    const purchases = await userService.getPurchaseHistory(deviceId);

    res.json({
      purchases
    });

  } catch (error) {
    console.error('[PAYMENT] Get history error:', error);

    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    res.status(500).json({
      error: 'GET_HISTORY_ERROR',
      message: 'Failed to get purchase history'
    });
  }
});

module.exports = router;
