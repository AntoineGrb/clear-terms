// ========================================
// DÉTECTION - Logique de détection et validation de CGU
// ========================================

/**
 * Fonction principale de détection, lancée au chargement de la page
 * Détecte les CGU et affiche un toast approprié (avec ou sans rapport dans l'historique)
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

    // ---- Étape 3: Vérifier l'historique utilisateur -----
    const userLanguage = await chrome.storage.local.get(['userLanguage']).then(d => d.userLanguage || 'fr');

    // Demander au background script de vérifier l'historique par URL
    chrome.runtime.sendMessage({
      type: 'CHECK_HISTORY',
      url: url,
      language: userLanguage
    }, (response) => {
      if (response && response.found) {
        // Rapport trouvé dans l'historique
        createToast('found', url, response.report);
      } else {
        // Pas de rapport dans l'historique;
        createToast('detected', url, content);
      }
    });

  } catch (error) {
    console.error('[Clear Terms] Erreur détection:', error);
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
  console.log('🔍 [VALIDATION] Début de la validation');
  console.log('  - Longueur du contenu à valider:', content?.length || 0);

  // Critère 1: Longueur minimale
  if (content.length < VALIDATION_CRITERIA.minLength) {
    console.log('  ❌ VALIDATION ÉCHOUÉE: Contenu trop court');
    console.log('    - Longueur:', content.length);
    console.log('    - Minimum requis:', VALIDATION_CRITERIA.minLength);
    return {
      valid: false,
      reason: 'content_too_short',
      length: content.length
    };
  }

  // Critère 2: Titre fort dans le champ lexical
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const allKeywords = [...KEYWORDS_LIGHT.fr, ...KEYWORDS_LIGHT.en];

  console.log('  - Titres détectés:', headings.length);
  headings.forEach((h, i) => {
    const tagName = h.tagName;
    console.log(`    ${tagName}: "${h.textContent.substring(0, 50)}..."`);
  });

  const hasStrongTitle = headings.some(h => {
    const text = h.textContent.toLowerCase();
    return allKeywords.some(kw => text.includes(kw));
  });

  if (!hasStrongTitle) {
    console.log('  ❌ VALIDATION ÉCHOUÉE: Pas de titre fort');
    return { valid: false, reason: 'no_strong_title' };
  }
  console.log('  ✅ Titre fort détecté');

  // Critère 3: Occurrences de mots-clés contractuels
  const contentLower = content.toLowerCase();
  const allContractualKeywords = [
    ...VALIDATION_CRITERIA.contractualKeywords.fr,
    ...VALIDATION_CRITERIA.contractualKeywords.en
  ];

  console.log('  - Recherche de mots-clés contractuels...');
  let keywordCount = 0;
  const foundKeywords = [];

  allContractualKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword.replace(/'/g, "['']?")}\\b`, 'gi');
    const matches = contentLower.match(regex);
    if (matches) {
      keywordCount += matches.length;
      foundKeywords.push(`"${keyword}": ${matches.length}x`);
    }
  });

  console.log('  - Mots-clés trouvés:', foundKeywords.join(', '));
  console.log('  - Total occurrences:', keywordCount);
  console.log('  - Minimum requis:', VALIDATION_CRITERIA.minKeywordOccurrences);

  if (keywordCount < VALIDATION_CRITERIA.minKeywordOccurrences) {
    console.log('  ❌ VALIDATION ÉCHOUÉE: Pas assez de mots-clés contractuels');
    return {
      valid: false,
      reason: 'insufficient_contractual_keywords',
      count: keywordCount
    };
  }

  console.log('  ✅ VALIDATION RÉUSSIE');
  return { valid: true, keywordCount };
}
