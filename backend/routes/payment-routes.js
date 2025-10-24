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

    // URLs de redirection vers le backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const successUrl = `${backendUrl}/api/payments/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${backendUrl}/api/payments/cancel`;

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
-         const paymentIntent = event.data.object;
-         console.log(`❌ [WEBHOOK] Payment failed: ${paymentIntent.id}`);
- 
-         // Optionnel: enregistrer l'échec
-         const deviceId = paymentIntent.metadata?.deviceId;
-         if (deviceId) {
-           await userService.recordPurchase(deviceId, {
-             stripePaymentIntentId: paymentIntent.id,
-             amount: paymentIntent.amount / 100, // Stripe envoie en centimes
-             status: 'failed'
-           });
-         }
-         break;
-       }

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

/**
 * GET /api/payments/success
 * Page de redirection après paiement réussi
 */
router.get('/success', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Paiement réussi</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center;
            padding: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
          }
          h1 { color: #10b981; margin-bottom: 20px; }
          p { color: #6b7280; margin: 10px 0; }
          .countdown { font-size: 14px; color: #9ca3af; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Paiement réussi !</h1>
          <p>Vos crédits sont en cours d'ajout...</p>
          <p>Retournez à l'extension pour voir vos crédits mis à jour.</p>
          <p class="countdown">Cette page se fermera automatiquement dans <span id="counter">5</span> secondes...</p>
        </div>
        <script>
          let count = 5;
          const counterEl = document.getElementById('counter');
          const interval = setInterval(() => {
            count--;
            counterEl.textContent = count;
            if (count <= 0) {
              clearInterval(interval);
              window.close();
            }
          }, 1000);
        </script>
      </body>
    </html>
  `);
});

/**
 * GET /api/payments/cancel
 * Page de redirection après annulation
 */
router.get('/cancel', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Paiement annulé</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center;
            padding: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
          }
          h1 { color: #ef4444; margin-bottom: 20px; }
          p { color: #6b7280; margin: 10px 0; }
          .countdown { font-size: 14px; color: #9ca3af; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Paiement annulé</h1>
          <p>Votre paiement a été annulé.</p>
          <p>Vous pouvez réessayer depuis l'extension.</p>
          <p class="countdown">Cette page se fermera automatiquement dans <span id="counter">5</span> secondes...</p>
        </div>
        <script>
          let count = 5;
          const counterEl = document.getElementById('counter');
          const interval = setInterval(() => {
            count--;
            counterEl.textContent = count;
            if (count <= 0) {
              clearInterval(interval);
              window.close();
            }
          }, 1000);
        </script>
      </body>
    </html>
  `);
});

/**
 * GET /api/payments/check-pending
 * Vérifier si un paiement est en attente/validé
 *
 * Query: { deviceId: string }
 * Response: { hasPendingPayment: boolean, status?: string, amount?: number, scansAdded?: number }
 */
router.get('/check-pending', verifyJWT, async (req, res) => {
  try {
    const { deviceId } = req.query;

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

    // Récupérer le dernier achat et vérifier son statut
    const purchases = user.purchaseHistory || [];
    const lastPurchase = purchases[purchases.length - 1];

    // Vérifier si l'achat est récent (moins de 5 minutes)
    if (lastPurchase && lastPurchase.timestamp > Date.now() - 5 * 60 * 1000) {
      res.json({
        hasPendingPayment: true,
        status: lastPurchase.status, // 'completed' ou 'failed'
        amount: lastPurchase.amount,
        scansAdded: lastPurchase.scansAdded
      });
    } else {
      res.json({ hasPendingPayment: false });
    }

  } catch (error) {
    console.error('[PAYMENT] Check pending error:', error);
    res.status(500).json({
      error: 'CHECK_PENDING_ERROR',
      message: 'Failed to check pending payment'
    });
  }
});

module.exports = router;
