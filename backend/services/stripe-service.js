const Stripe = require('stripe');

/**
 * Service de gestion des paiements Stripe
 */
class StripeService {
  constructor() {
    this.stripe = null;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Initialiser Stripe seulement si la clé est présente
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      console.log('✅ [STRIPE] Service initialisé');
    } else {
      console.warn('⚠️  [STRIPE] Pas de clé API configurée');
    }
  }

  /**
   * Vérifier si Stripe est configuré
   */
  isConfigured() {
    return !!this.stripe;
  }

  /**
   * Créer ou récupérer un client Stripe
   * Note: On crée un nouveau client à chaque fois car on ne peut pas chercher par metadata
   * Le deviceId sera stocké côté backend dans users.json avec le stripeCustomerId
   */
  async getOrCreateCustomer(deviceId, email = null) {
    if (!this.isConfigured()) {
      throw new Error('Stripe not configured');
    }

    try {
      // Créer un nouveau client avec le deviceId en description
      const customer = await this.stripe.customers.create({
        email,
        description: `Clear Terms User - DeviceID: ${deviceId.substring(0, 8)}...`
      });

      console.log(`✨ [STRIPE] Nouveau client créé: ${customer.id}`);
      return customer;

    } catch (error) {
      console.error('❌ [STRIPE] Erreur création client:', error);
      throw error;
    }
  }

  /**
   * Créer une session Checkout
   */
  async createCheckoutSession({ deviceId, priceId, amount, successUrl, cancelUrl, stripeCustomerId = null }) {
    if (!this.isConfigured()) {
      throw new Error('Stripe not configured');
    }

    try {
      let customerId = stripeCustomerId;

      // Créer un nouveau client seulement si on n'en a pas déjà un
      if (!customerId) {
        const customer = await this.getOrCreateCustomer(deviceId);
        customerId = customer.id;
      } else {
        console.log(`♻️  [STRIPE] Utilisation du client existant: ${customerId}`);
      }

      // Créer la session Checkout
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          deviceId,
          amount: amount.toString() // Montant en euros
        }
      });

      console.log(`✅ [STRIPE] Session créée: ${session.id}`);
      return session;

    } catch (error) {
      console.error('❌ [STRIPE] Erreur création session:', error);
      throw error;
    }
  }

  /**
   * Vérifier la signature du webhook
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.isConfigured()) {
      throw new Error('Stripe not configured');
    }

    if (!this.webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
      return event;
    } catch (error) {
      console.error('❌ [STRIPE] Signature webhook invalide:', error.message);
      throw error;
    }
  }

  /**
   * Récupérer une session Checkout
   */
  async getCheckoutSession(sessionId) {
    if (!this.isConfigured()) {
      throw new Error('Stripe not configured');
    }

    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent']
      });
      return session;
    } catch (error) {
      console.error('❌ [STRIPE] Erreur récupération session:', error);
      throw error;
    }
  }
}

module.exports = new StripeService();
