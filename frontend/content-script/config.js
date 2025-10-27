// ========================================
// CONFIGURATION - Constantes pour la détection de CGU
// ========================================

/**
 * Mots-clés pour la détection légère (Niveau 1)
 */
const KEYWORDS_LIGHT = {
  fr: [
    'conditions',
    'politique de confidentialité',
    'mentions légales',
    'cgu',
    'cgv',
    'données personnelles',
    'vie privée',
    'termes et conditions',
    'accord utilisateur',
    'contrat de service',
  ],
  en: [
    'terms',
    'privacy policy',
    'terms and conditions',
    'user agreement',
    'legal notice',
    'terms & conditions',
    'privacy notice',
    'service agreement',
    'user terms',
    'data policy',
    'legal'
  ]
};

/**
 * Critères de validation approfondie (Niveau 2)
 */
const VALIDATION_CRITERIA = {
  minLength: 1500, // Longueur minimale en caractères
  contractualKeywords: {
    fr: [
      'acceptez',
      'consentement',
      'responsabilité',
      'droits',
      'obligations',
      'article',
      'clause',
      'utilisateur',
      'service',
      'contrat',
      'propriété intellectuelle',
      'résiliation',
      'modification',
      'notification'
    ],
    en: [
      'agree',
      'consent',
      'liability',
      'rights',
      'obligations',
      'article',
      'clause',
      'user',
      'service',
      'agreement',
      'intellectual property',
      'termination',
      'modification',
      'notification'
    ]
  },
  minKeywordOccurrences: 8 // Nombre minimum d'occurrences de mots contractuels
};
