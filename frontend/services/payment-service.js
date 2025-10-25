/**
 * Service de gestion des paiements Stripe
 */

// Import du service d'authentification

/**
 * Mapping des packs de crédits avec leurs prix Stripe
 */
const PRICING_PLANS = {
  standard: {
    name: 'Pack Standard',
    amount: 2,
    scans: 20,
    priceId: 'prod_TInIFx7sfK2Olz'
  },
  comfort: {
    name: 'Pack Confort',
    amount: 5,
    scans: 100,
    priceId: 'prod_TInILz7xwO1M3R'
  },
  pro: {
    name: 'Pack Pro',
    amount: 20,
    scans: 1000,
    priceId: 'prod_TInJHmzR1lpo06'
  }
};

/**
 * Obtenir les informations d'un pack de pricing
 * @param {string} planKey - La clé du plan (standard, confort, pro)
 */
function getPricingPlan(planKey) {
  return PRICING_PLANS[planKey] || null;
}

/**
 * Créer une session de paiement Stripe Checkout
 * @param {string} priceId - L'ID du prix Stripe
 * @param {number} amount - Le montant en euros
 * @returns {Promise<{sessionId: string, url: string}>}
 */
async function createCheckoutSession(priceId, amount) {
  try {
    console.log(`💳 [PAYMENT] Creating checkout session for ${amount}€`);

    // Récupérer le deviceId et JWT
    const deviceId = await authService.getDeviceId();
    const jwt = await authService.getJWT();
    const backendUrl = getBackendURL();

    const response = await fetch(`${backendUrl}/api/payments/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({
        deviceId,
        priceId,
        amount
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to create checkout session');
    }

    const data = await response.json();
    console.log('✅ [PAYMENT] Checkout session created:', data.sessionId);

    return data;

  } catch (error) {
    console.error('❌ [PAYMENT] Error creating checkout session:', error);
    throw error;
  }
}

/**
 * Ouvrir la page de paiement Stripe
 * @param {string} priceId - L'ID du prix Stripe
 * @param {number} amount - Le montant en euros
 */
async function openCheckout(priceId, amount) {
  try {
    const session = await createCheckoutSession(priceId, amount);

    // Ouvrir l'URL Stripe Checkout dans un nouvel onglet
    chrome.tabs.create({
      url: session.url,
      active: true
    });

    console.log('✅ [PAYMENT] Checkout opened in new tab');

  } catch (error) {
    console.error('❌ [PAYMENT] Error opening checkout:', error);
    throw error;
  }
}

/**
 * Récupérer l'historique des achats
 * @returns {Promise<Array>}
 */
async function getPurchaseHistory() {
  try {
    const deviceId = await authService.getDeviceId();
    const jwt = await authService.getJWT();
    const backendUrl = getBackendURL();

    const response = await fetch(`${backendUrl}/api/payments/history?deviceId=${deviceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to get purchase history');
    }

    const data = await response.json();
    console.log('✅ [PAYMENT] Purchase history retrieved');

    return data.purchases || [];

  } catch (error) {
    console.error('❌ [PAYMENT] Error getting purchase history:', error);
    return [];
  }
}
