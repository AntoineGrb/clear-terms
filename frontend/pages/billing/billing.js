// ========================================
// Billing Page - Gestion de l'achat de crédits
// ========================================

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
    const result = await chrome.storage.local.get(['remainingScans']);
    const remaining = result.remainingScans !== undefined ? result.remainingScans : 20;

    document.getElementById('remainingScans').textContent = remaining;
  } catch (error) {
    console.error('Erreur lors du chargement des crédits:', error);
  }
}

/**
 * Gère l'achat d'un pack
 */
async function handlePurchase(event) {
  const plan = event.currentTarget.dataset.plan;
  const button = event.currentTarget;

  // Désactiver le bouton pendant le traitement
  button.disabled = true;
  button.classList.add('opacity-50', 'cursor-not-allowed');

  const originalText = button.textContent;
  button.textContent = '...';

  try {
    // TODO V4: Intégration Stripe
    // Pour l'instant, on simule juste l'action
    console.log(`Achat du pack: ${plan}`);

    // Simuler un délai
    await new Promise(resolve => setTimeout(resolve, 1000));

    alert(`Fonction de paiement à implémenter pour le pack ${plan}`);

  } catch (error) {
    console.error('Erreur lors de l\'achat:', error);
    alert('Une erreur est survenue lors du paiement.');
  } finally {
    // Réactiver le bouton
    button.disabled = false;
    button.classList.remove('opacity-50', 'cursor-not-allowed');
    button.textContent = originalText;
  }
}
