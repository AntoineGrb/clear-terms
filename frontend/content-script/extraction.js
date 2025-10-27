// ========================================
// EXTRACTION DE CONTENU (partagée auto + manuel)
// ========================================

/**
 * Extrait le contenu nettoyé de la page
 * Utilisé pour scan auto ET manuel (garantit le même hash)
 * IMPORTANT: Utilise textContent (pas innerText) pour cohérence
 */
function extractCleanContent() {
  try {
    console.log('🔍 [CONTENT-SCRIPT] Début extraction du contenu');
    console.log('  - Document visible:', document.visibilityState);
    console.log('  - Body présent:', !!document.body);

    // Détecter les modales AVANT extraction
    const modals = document.querySelectorAll('[role="dialog"], .modal, [class*="modal"], [class*="Modal"]');
    console.log('  - Modales détectées:', modals.length);
    if (modals.length > 0) {
      modals.forEach((modal, index) => {
        const modalText = modal.innerText || modal.textContent || '';
        console.log(`    Modal ${index + 1}:`, {
          visible: modal.offsetParent !== null,
          display: window.getComputedStyle(modal).display,
          longueurTexte: modalText.length,
          aperçu: modalText.substring(0, 100)
        });
      });
    }

    // Clone le document
    const clone = document.cloneNode(true);

    // Vérifier que le clone a un body
    if (!clone.body) {
      return {
        text: document.body ? (document.body.textContent || '') : '',
        url: window.location.href
      };
    }

    // Supprimer les éléments inutiles SAUF les modales qui peuvent contenir des CGU
    const elementsToRemove = clone.querySelectorAll(`
      script,
      style,
      nav:not([role="dialog"]),
      header:not([role="dialog"]),
      footer:not([role="dialog"]),
      aside:not([role="dialog"]),
      [role="banner"]
    `);
    elementsToRemove.forEach(el => el.remove());

    // Supprimer UNIQUEMENT les bannières de cookies/consent (pas les modales de CGU)
    const cookieBanners = clone.querySelectorAll(`
      [class*="cookie"]:not([role="dialog"]),
      [class*="Cookie"]:not([role="dialog"]),
      [id*="cookie"]:not([role="dialog"]),
      [id*="Cookie"]:not([role="dialog"]),
      [class*="consent"]:not([role="dialog"]),
      [class*="Consent"]:not([role="dialog"]),
      [id*="consent"]:not([role="dialog"]),
      [class*="banner"]:not([role="dialog"]),
      [class*="Banner"]:not([role="dialog"]),
      [aria-label*="cookie" i]:not([role="dialog"]),
      [aria-label*="consent" i]:not([role="dialog"])
    `);
    cookieBanners.forEach(el => el.remove());

    // Vérifier à nouveau que clone.body existe après les suppressions
    if (!clone.body) {
      return {
        text: document.body ? (document.body.textContent || '').replace(/\s+/g, ' ').trim() : '',
        url: window.location.href
      };
    }

    // Extraire le texte avec textContent
    const text = clone.body.textContent || '';

    // Nettoyer les espaces multiples et sauts de ligne excessifs
    let cleanedText = text.replace(/\s+/g, ' ').trim();

    // Limiter la taille du contenu pour éviter les erreurs backend (max 100KB)
    const MAX_CONTENT_LENGTH = 95000;
    if (cleanedText.length > MAX_CONTENT_LENGTH) {
      cleanedText = cleanedText.substring(0, MAX_CONTENT_LENGTH);
    }

    console.log('📝 [CONTENT-SCRIPT] Texte extrait:');
    console.log('  - Longueur totale:', cleanedText.length);
    console.log('  - Nombre de mots:', cleanedText.split(/\s+/).length);
    console.log('  - Aperçu (300 premiers caractères):', cleanedText.substring(0, 300));

    return {
      text: cleanedText,
      url: window.location.href
    };
  } catch (error) {
    return {
      text: document.body ? (document.body.textContent || '').replace(/\s+/g, ' ').trim() : '',
      url: window.location.href
    };
  }
}
