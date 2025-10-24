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

    // Pas de redirection - Stripe fermera automatiquement la page
    const successUrl = 'https://stripe.com/success';
    const cancelUrl = 'https://stripe.com/cancel';

    // Utiliser le stripeCustomerId existant ou en créer un nouveau
    let stripeCustomerId = user.stripeCustomerId;

    // Créer la session Checkout
    const session = await stripeService.createCheckoutSession({
      deviceId,
      priceId,
      amount,
      successUrl,
      cancelUrl,
      stripeCustomerId // Passer le customerId existant s'il y en a un
    });

    // Sauvegarder le stripeCustomerId si c'est la première fois
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
    console.error('[PAYMENT] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      error: 'CREATE_SESSION_ERROR',
      message: error.message || 'Failed to create checkout session'
    });
  }
});

/**
 * POST /api/payments/webhook
 * Webhook Stripe pour traiter les événements de paiement
 *
 * Important: Ce endpoint doit être accessible sans JWT
 * Le raw body est déjà géré dans server.js
 */
router.post('/webhook', async (req, res) => {
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
      if (!event || !event.type) {
        throw new Error('Invalid webhook event structure');
      } 
    } catch (err) {
      console.error('🚨 SECURITY ALERT - Webhook signature verification failed:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      error: err.message
      });
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
