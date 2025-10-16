// ========================================
// DÉTECTION - Logique de détection et validation de CGU
// ========================================

/**
 * Fonction principale de détection, lancée au chargement de la page
 * Détecte et lance l'analyse automatique si CGU détectées
 */
async function detectAndAnalyze() {
  try {
    // Vérifier si la détection auto est activée
    const settings = await chrome.storage.local.get(['toastEnabled']);
    if (settings.toastEnabled === false) {
      return;
    }

    // ---- Étape 1: Filtre léger -----
    // Vérifier si c'est un moteur de recherche
    if (isSearchEnginePage()) {
      return;
    }

    // Vérifier si la page est probablement une page de CGU
    if (!isLikelyTermsPage()) {
      return;
    }

    // Utiliser extractCleanContent()
    const { text: content, url } = extractCleanContent();

    // ---- Étape 2: Validation approfondie -----
    const validation = validateTermsPage(content);
    if (!validation.valid) {
      return;
    }

    console.log('[Clear Terms] ✅ CGU détectée');

    // Afficher le toast
    createToast();

    // Lancer l'analyse en arrière-plan
    chrome.runtime.sendMessage({
      type: 'AUTO_ANALYZE',
      url: url,
      content: content
    });
  } catch (error) {
    // Erreur silencieuse pour l'utilisateur
  }
}

/**
 * Vérifie si la page est probablement une page de CGU (étape 1)
 * Basé sur l'URL et le titre de la page
 */
function isLikelyTermsPage() {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  const mainTitle = document.querySelector('h1') ? document.querySelector('h1').textContent.toLowerCase() : '';

  // Vérifier URL et pathname
  const allKeywords = [...KEYWORDS_LIGHT.fr, ...KEYWORDS_LIGHT.en];

  for (const keyword of allKeywords) {
    // Chercher le mot-clé avec tirets, underscores ou sans espaces
    const variations = [
      keyword.replace(/\s/g, '-'),
      keyword.replace(/\s/g, '_'),
      keyword.replace(/\s/g, ''),
      keyword.replace(/'/g, '')
    ];

    for (const variant of variations) {
      if (url.includes(variant) || pathname.includes(variant)) {
        return true;
      }
    }

    // Vérifier le titre
    if (title.includes(keyword)) {
      return true;
    }

    // Vérifier le h1 principal
    if (mainTitle.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Valide qu'une page est bien une page de CGU (lancée en étape 2)
 * @param {string} content - Le contenu textuel de la page
 * @returns {Object} { valid: boolean, reason?: string, count?: number }
 */
function validateTermsPage(content) {
  // Critère 1: Longueur minimale
  if (content.length < VALIDATION_CRITERIA.minLength) {
    return {
      valid: false,
      reason: 'content_too_short',
      length: content.length
    };
  }

  // Critère 2: Titre fort dans le champ lexical
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
  const allKeywords = [...KEYWORDS_LIGHT.fr, ...KEYWORDS_LIGHT.en];

  const hasStrongTitle = headings.some(h => {
    const text = h.textContent.toLowerCase();
    return allKeywords.some(kw => text.includes(kw));
  });

  if (!hasStrongTitle) {
    return { valid: false, reason: 'no_strong_title' };
  }

  // Critère 3: Occurrences de mots-clés contractuels
  const contentLower = content.toLowerCase();
  const allContractualKeywords = [
    ...VALIDATION_CRITERIA.contractualKeywords.fr,
    ...VALIDATION_CRITERIA.contractualKeywords.en
  ];

  let keywordCount = 0;
  allContractualKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword.replace(/'/g, "['']?")}\\b`, 'gi');
    const matches = contentLower.match(regex);
    if (matches) {
      keywordCount += matches.length;
    }
  });

  if (keywordCount < VALIDATION_CRITERIA.minKeywordOccurrences) {
    return {
      valid: false,
      reason: 'insufficient_contractual_keywords',
      count: keywordCount
    };
  }

  return { valid: true, keywordCount };
}
