// ========================================
// Billing Page - Gestion de l'achat de crédits
// ========================================

// Configuration des plans avec leurs Price IDs Stripe
const PRICING_CONFIG = {
  standard: {
    priceId: 'prod_THb6dURyJ4RGHk', // À remplacer par votre Price ID Stripe
    amount: 2,
    scans: 20
  },
  comfort: {
    priceId: 'prod_THbiUvFCWCXXdr', // À remplacer par votre Price ID Stripe
    amount: 5,
    scans: 100
  },
  pro: {
    priceId: 'prod_THbiR3uxBsSDlQ', // À remplacer par votre Price ID Stripe
    amount: 20,
    scans: 1000
  }
};

/**
 * Initialisation
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Détecter la langue du navigateur
  const lang = detectBrowserLanguage();
  applyTranslations(lang);

  // Charger et afficher les crédits restants
  await loadRemainingScans();

  // Event listeners pour les boutons d'achat
  const buyButtons = document.querySelectorAll('.buy-button');
  buyButtons.forEach(button => {
    button.addEventListener('click', handlePurchase);
  });

  // Event listener pour le bouton retour
  document.getElementById('backButton').addEventListener('click', () => {
    window.close();
  });
});

/**
 * Charge et affiche les crédits restants
 */
async function loadRemainingScans() {
  try {
    // Utiliser storage.sync pour être cohérent avec le reste de l'app
    const result = await chrome.storage.sync.get(['remainingScans']);
    const remaining = result.remainingScans !== undefined ? result.remainingScans : 20;

    document.getElementById('remainingScans').textContent = remaining;

    // Écouter les changements de crédits en temps réel
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes.remainingScans) {
        const newValue = changes.remainingScans.newValue;
        if (newValue !== undefined) {
          document.getElementById('remainingScans').textContent = newValue;
          console.log('[BILLING] Crédits mis à jour:', newValue);
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors du chargement des crédits:', error);
  }
}

/**
 * Gère l'achat d'un pack via Stripe
 */
async function handlePurchase(event) {
  const plan = event.currentTarget.dataset.plan;
  const button = event.currentTarget;

  // Vérifier que le plan existe
  if (!PRICING_CONFIG[plan]) {
    console.error(`Plan inconnu: ${plan}`);
    alert('Une erreur est survenue. Plan invalide.');
    return;
  }

  const { priceId, amount, scans } = PRICING_CONFIG[plan];

  // Vérifier que le Price ID a été configuré
  if (!priceId || priceId === 'price_XXXXXXXXXX') {
    console.error('Price ID Stripe non configuré');
    alert('Le système de paiement n\'est pas encore configuré. Veuillez contacter le support.');
    return;
  }

  // Désactiver le bouton pendant le traitement
  button.disabled = true;
  button.classList.add('opacity-50', 'cursor-not-allowed');

  const originalText = button.textContent;
  button.textContent = 'Chargement...';

  try {
    console.log(`💳 [BILLING] Initiation achat: ${plan} (${amount}€, ${scans} scans)`);

    // Créer la session Stripe Checkout et ouvrir dans un nouvel onglet
    await openCheckout(priceId, amount);

    // Afficher un message de confirmation
    button.textContent = '✓ Ouvert';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);

  } catch (error) {
    console.error('❌ [BILLING] Erreur lors de l\'achat:', error);

    // Message d'erreur selon le type
    let errorMessage = 'Une erreur est survenue lors du paiement.';

    if (error.message.includes('not configured')) {
      errorMessage = 'Le système de paiement n\'est pas disponible pour le moment.';
    } else if (error.message.includes('USER_NOT_FOUND')) {
      errorMessage = 'Utilisateur non trouvé. Veuillez réessayer ou contacter le support.';
    } else if (error.message.includes('network')) {
      errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.';
    }

    alert(errorMessage);
    button.textContent = originalText;

  } finally {
    // Réactiver le bouton
    button.disabled = false;
    button.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}
