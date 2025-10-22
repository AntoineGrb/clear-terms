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
   */
  async getOrCreateCustomer(deviceId, email = null) {
    if (!this.isConfigured()) {
      throw new Error('Stripe not configured');
    }

    try {
      // Chercher si un client existe déjà avec ce deviceId
      const existingCustomers = await this.stripe.customers.list({
        limit: 1,
        metadata: { deviceId }
      });

      if (existingCustomers.data.length > 0) {
        console.log(`♻️  [STRIPE] Client existant trouvé: ${existingCustomers.data[0].id}`);
        return existingCustomers.data[0];
      }

      // Créer un nouveau client
      const customer = await this.stripe.customers.create({
        email,
        metadata: { deviceId }
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
  async createCheckoutSession({ deviceId, priceId, amount, successUrl, cancelUrl }) {
    if (!this.isConfigured()) {
      throw new Error('Stripe not configured');
    }

    try {
      // Récupérer ou créer le client Stripe
      const customer = await this.getOrCreateCustomer(deviceId);

      // Créer la session Checkout
      const session = await this.stripe.checkout.sessions.create({
        customer: customer.id,
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
