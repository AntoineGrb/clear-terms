/**
 * Système d'internationalisation (i18n) pour Clear Terms
 */

const translations = {
  fr: {
    // Header
    headerTitle: "Clear Terms",
    headerSubtitle: "Analyse IA des CGU et Politiques de Confidentialité",

    // Boutons principaux
    analyzeButton: "Analyser la page active",

    // Messages de statut
    statusExtracting: "Extraction du contenu de la page...",
    statusSending: "Envoi de la requête au serveur...",
    statusAnalyzing: "Analyse en cours par l'IA...",
    statusComplete: "Analyse terminée !",
    statusError: "Erreur :",
    notCGUPage: "Cette page ne contient pas de conditions générales ou de mentions légales analysables.",

    // Messages d'erreur (pour référence - gérés par error-handler.js)
    errorNetwork: "Impossible de se connecter au serveur. Vérifiez votre connexion internet.",
    errorBackend: "Le service d'analyse est temporairement indisponible.",
    errorContentScript: "Impossible d'accéder au contenu de la page. Rechargez la page et réessayez.",
    errorTooLarge: "Le contenu de la page est trop volumineux pour être analysé.",
    errorTimeout: "L'analyse prend trop de temps. Le serveur est peut-être surchargé.",
    errorProtected: "Cette page est protégée et ne peut pas être analysée.",
    errorInvalidResponse: "La réponse du serveur est invalide.",
    errorTooShort: "Le contenu de la page est trop court pour être analysé.",
    errorGeneric: "Une erreur inattendue est survenue.",

    // Rapport
    analyzedOn: "Analysé le",
    scoreLabel: "Score",

    // Catégories
    categories: {
      data_collection: "Collecte de données",
      data_usage: "Utilisation des données",
      data_sharing: "Partage des données",
      user_rights: "Droits utilisateur",
      data_retention: "Conservation des données",
      security_measures: "Mesures de sécurité",
      policy_changes: "Modifications de la politique",
      legal_compliance: "Transferts internationaux",
      cookies_tracking: "Cookies & Tracking",
      children_privacy: "Protection des mineurs",
      user_content_rights: "Droits sur le contenu",
      dispute_resolution: "Résolution des litiges"
    },

    // Footer
    about: "À propos",
    terms: "Conditions de Service",
    disclaimer: "⚠️ Clear Terms fournit un résumé non-juridique. Consultez toujours le texte original. Les analyses IA peuvent contenir des erreurs.",

    // Historique
    lastAnalysis: "Dernière analyse",
    viewHistory: "Voir l'historique →",
    historyTitle: "Historique des analyses",
    searchPlaceholder: "Rechercher par nom de site...",
    filterByScore: "Filtrer par score",
    sortBy: "Trier par",
    allScores: "Tous les scores",
    sortDateRecent: "Date (récent)",
    sortDateOld: "Date (ancien)",
    sortScoreAE: "Score (A→E)",
    sortScoreEA: "Score (E→A)",
    sortNameAZ: "Nom (A-Z)",
    sortNameZA: "Nom (Z-A)",
    noReports: "Aucun rapport trouvé",
    emptyHistory: "Votre historique est vide. Lancez une analyse pour commencer !",
    clearHistory: "Supprimer l'historique",
    exportJson: "Export JSON",
    exportCsv: "Export CSV",
    clearHistoryConfirm: "Êtes-vous sûr de vouloir supprimer tout l'historique ?",
    clearHistorySuccess: "Historique supprimé",
    analyzedAgo: "Il y a",
    justNow: "À l'instant",
    minutesAgo: "minutes",
    hoursAgo: "heures",
    daysAgo: "jours",
    weeksAgo: "semaines",
    monthsAgo: "mois",

    // Paramètres
    settings: "Paramètres",
    languageLabel: "Langue de l'interface et des rapports",
    languageHelp: "Les rapports seront générés dans cette langue",
    toastEnabled: "Activer la détection automatique",
    toastEnabledHelp: "Affiche un toast lorsque des CGU sont détectées sur une page",
    toastPositionLabel: "Position du toast",
    toastPositionBottomRight: "En bas à droite",
    toastPositionBottomLeft: "En bas à gauche",
    toastPositionTopRight: "En haut à droite",
    toastPositionTopLeft: "En haut à gauche",
    toastDurationLabel: "Durée d'affichage (secondes)",
    toastDurationManual: "Manuel (cliquer pour fermer)",

    // Page À propos
    aboutContent: {
      title: "À propos",
      missionTitle: "Notre mission",
      missionText: "Clear Terms aide les utilisateurs à comprendre rapidement les Conditions Générales d'Utilisation et Politiques de Confidentialité des services en ligne. Notre IA analyse le contenu et identifie les points importants pour vous permettre de prendre des décisions éclairées.",

      howItWorksTitle: "Comment ça marche ?",
      howItWorksText1: "Nous utilisons l'IA (Google Gemini) pour analyser automatiquement 12 catégories clés : collecte de données, partage avec des tiers, droits utilisateur, mesures de sécurité, et bien plus.",
      howItWorksText2: "Chaque catégorie reçoit un statut basé sur son impact pour l'utilisateur :",
      statusGreen: "🟢 Vert : Favorable pour l'utilisateur",
      statusAmber: "🟡 Ambre : Acceptable avec réserves",
      statusRed: "🔴 Rouge : Préoccupant",
      statusNA: "⚪ N/A : Non mentionné dans le document",

      scoreTitle: "Calcul du score",
      scoreText: "Le score global (A-E) est calculé en pondérant les catégories selon leur impact réel sur vos droits. Chaque catégorie a un poids spécifique : Résolution des litiges (13%), Partage des données (15%), Transferts internationaux (6%), etc. Pour chaque catégorie : vert = 2 points, ambre = 1 point, rouge = 0. Le score final est normalisé entre 0 et 1 puis converti en grade (A≥80%, B≥65%, C≥50%, D≥35%, E<35%).",

      privacyTitle: "Confidentialité",
      privacyText: "Vos données ne sont jamais stockées de manière identifiable. L'analyse est effectuée en temps réel et les résultats sont mis en cache anonymement (par hash du contenu) pour optimiser les performances et réduire les coûts.",

      limitationsTitle: "Limitations importantes",
      limitationsText: "Clear Terms n'est pas un conseil juridique et ne remplace pas l'avis d'un avocat qualifié. Les analyses peuvent contenir des erreurs ou des imprécisions. Consultez toujours le texte original et, si nécessaire, un professionnel du droit."
    },

    // Page Conditions de Service
    termsContent: {
      title: "Conditions de Service",
      effectiveDate: "Date d'effet : 6 octobre 2025",

      intro: "Bienvenue sur Clear Terms — un outil conçu pour aider les utilisateurs à mieux comprendre les conditions d'utilisation et politiques de confidentialité des services numériques. En installant ou en utilisant l'extension Clear Terms, vous acceptez d'être lié par les présentes Conditions de Service.",
      pleaseRead: "Veuillez les lire attentivement.",

      section1Title: "1. Présentation",
      section1Text: "Clear Terms est un outil qui identifie les clauses clés et les risques couramment présents dans les conditions d'utilisation et politiques de confidentialité en ligne. Il fournit des résumés, des évaluations de risque et des analyses basées sur des documents publics et notre analyse interne. Nous nous efforçons d'aider les utilisateurs à prendre des décisions éclairées, mais nous ne pouvons garantir l'exhaustivité ou l'exactitude juridique dans tous les contextes.",

      section2Title: "2. Absence de conseil juridique",
      section2Text: "Clear Terms n'est pas un cabinet d'avocats, et les informations fournies via l'extension ne constituent pas un conseil juridique.",
      section2Intro: "Vous comprenez et acceptez que :",
      section2Item1: "Clear Terms ne remplace pas la consultation d'un avocat qualifié.",
      section2Item2: "Les alertes, exemples et résumés que nous fournissons sont uniquement informatifs et peuvent ne pas s'appliquer à votre situation spécifique.",
      section2Item3: "Si vous avez besoin de conseils juridiques ou d'une représentation légale, vous devez contacter un avocat agréé dans votre juridiction.",
      section2Item4: "L'utilisation de Clear Terms ne crée pas de relation avocat-client.",

      section3Title: "3. Comptes utilisateur et données",
      section3Text: "Nous collectons uniquement le minimum de données nécessaire pour fournir le service. Actuellement, aucune donnée personnelle identifiable n'est collectée. Les analyses sont mises en cache de manière anonyme (par hash du contenu) pour améliorer les performances. Ces données ne sont jamais vendues ou partagées avec des tiers.",

      section4Title: "4. Exactitude et limitations",
      section4Intro: "Bien que nous visions à fournir des informations précises et à jour :",
      section4Item1: "Nous ne garantissons pas l'exhaustivité, l'exactitude ou la force exécutoire juridique de tout résumé ou évaluation de risque fourni.",
      section4Item2: "Les conditions d'utilisation changent fréquemment, et notre base de données peut ne pas toujours refléter la version la plus récente d'une politique donnée.",
      section4Item3: "Notre analyse est basée sur des processus de révision automatisés et manuels, qui peuvent avoir des limitations ou des cas particuliers.",

      section5Title: "5. Propriété intellectuelle",
      section5Text: "Le nom Clear Terms, le logo, le logiciel et le contenu original sont la propriété intellectuelle de ses créateurs. Vous ne pouvez pas :",
      section5Item1: "Faire de la rétro-ingénierie ou réutiliser l'extension",
      section5Item2: "Revendre ou distribuer notre analyse sans permission",
      section5Item3: "Présenter nos résumés comme des avis juridiques",

      section6Title: "6. Conduite de l'utilisateur",
      section6Text: "Vous acceptez de ne pas :",
      section6Item1: "Utiliser l'extension de manière abusive pour du scraping, de l'automation ou du spam",
      section6Item2: "Tenter de modifier le comportement de l'extension",
      section6Item3: "Prétendre que les informations fournies par Clear Terms constituent une autorité juridique",

      section7Title: "7. Résiliation",
      section7Text: "Nous nous réservons le droit de suspendre ou de résilier votre accès à l'extension si :",
      section7Item1: "Vous violez ces conditions",
      section7Item2: "Vous utilisez l'extension d'une manière qui nuit à autrui, viole la loi ou compromet l'intégrité du service",

      section8Title: "8. Exclusion de garanties",
      section8Text: "L'extension Clear Terms est fournie \"en l'état\" et \"selon disponibilité\" sans garanties d'aucune sorte. Nous déclinons toutes garanties expresses ou implicites, y compris, mais sans s'y limiter :",
      section8Item1: "Qualité marchande",
      section8Item2: "Adéquation à un usage particulier",
      section8Item3: "Non-violation",
      section8End: "Nous ne garantissons pas que l'extension sera exempte d'erreurs, ininterrompue ou totalement exacte.",

      section9Title: "9. Limitation de responsabilité",
      section9Text: "Dans toute la mesure permise par la loi, Clear Terms (et ses créateurs, équipe et affiliés) ne pourra être tenu responsable de :",
      section9Item1: "Tout dommage indirect, accessoire ou consécutif",
      section9Item2: "Toute perte de données, de profit ou d'opportunité commerciale",
      section9Item3: "Toute décision que vous prenez sur la base de notre contenu",
      section9End: "Votre seul recours en cas d'insatisfaction avec le service est de cesser de l'utiliser.",

      section10Title: "10. Droit applicable et conformité",
      section10Text: "Ces conditions sont régies et interprétées conformément aux lois françaises et aux réglementations européennes, notamment le Règlement Général sur la Protection des Données (RGPD). Nous nous engageons à protéger vos données personnelles conformément au RGPD et à respecter vos droits d'accès, de rectification, d'effacement et de portabilité des données. Tout litige sera traité exclusivement par les tribunaux compétents en France.",

      section11Title: "11. Modifications de ces conditions",
      section11Text: "Nous pouvons mettre à jour ces Conditions de Service de temps à autre. Si nous apportons des modifications importantes, nous vous en informerons via l'extension avec un délai de préavis de 30 jours. Si vous n'acceptez pas les nouvelles conditions, vous pouvez cesser d'utiliser l'extension en la désinstallant avant l'entrée en vigueur des modifications. L'utilisation continue du service après ce délai constitue votre acceptation des nouvelles conditions.",

      section12Title: "12. Contact",
      section12Text: "Questions ou préoccupations ? Contactez-nous à : [EMAIL]",

      lastUpdated: "Dernière mise à jour : 6 octobre 2025"
    }
  },

  en: {
    // Header
    headerTitle: "Clear Terms",
    headerSubtitle: "AI Analysis of Terms and Privacy Policies",

    // Main buttons
    analyzeButton: "Analyze active page",

    // Status messages
    statusExtracting: "Extracting page content...",
    statusSending: "Sending request to server...",
    statusAnalyzing: "AI analysis in progress...",
    statusComplete: "Analysis complete!",
    statusError: "Error:",
    notCGUPage: "This page does not contain analyzable terms of service or legal notices.",

    // Error messages (for reference - handled by error-handler.js)
    errorNetwork: "Cannot connect to server. Check your internet connection.",
    errorBackend: "Analysis service is temporarily unavailable.",
    errorContentScript: "Cannot access page content. Reload the page and try again.",
    errorTooLarge: "Page content is too large to analyze.",
    errorTimeout: "Analysis is taking too long. Server may be overloaded.",
    errorProtected: "This page is protected and cannot be analyzed.",
    errorInvalidResponse: "Server response is invalid.",
    errorTooShort: "Page content is too short to analyze.",
    errorGeneric: "An unexpected error occurred.",

    // Report
    analyzedOn: "Analyzed on",
    scoreLabel: "Score",

    // Categories
    categories: {
      data_collection: "Data Collection",
      data_usage: "Data Usage",
      data_sharing: "Data Sharing",
      user_rights: "User Rights",
      data_retention: "Data Retention",
      security_measures: "Security Measures",
      policy_changes: "Policy Changes",
      legal_compliance: "International Transfers",
      cookies_tracking: "Cookies & Tracking",
      children_privacy: "Children's Privacy",
      user_content_rights: "User Content Rights",
      dispute_resolution: "Dispute Resolution"
    },

    // Footer
    about: "About",
    terms: "Terms of Service",
    disclaimer: "⚠️ Clear Terms provides a non-legal summary. Always consult the original text. AI analyses may contain errors.",

    // History
    lastAnalysis: "Last Analysis",
    viewHistory: "View History →",
    historyTitle: "Analysis History",
    searchPlaceholder: "Search by site name...",
    filterByScore: "Filter by score",
    sortBy: "Sort by",
    allScores: "All scores",
    sortDateRecent: "Date (recent)",
    sortDateOld: "Date (old)",
    sortScoreAE: "Score (A→E)",
    sortScoreEA: "Score (E→A)",
    sortNameAZ: "Name (A-Z)",
    sortNameZA: "Name (Z-A)",
    noReports: "No reports found",
    emptyHistory: "Your history is empty. Start an analysis to begin!",
    clearHistory: "Clear History",
    clearHistoryConfirm: "Are you sure you want to clear all history?",
    clearHistorySuccess: "History cleared",
    exportJson: "Export JSON",
    exportCsv: "Export CSV",
    analyzedAgo: "ago",
    justNow: "Just now",
    minutesAgo: "minutes",
    hoursAgo: "hours",
    daysAgo: "days",
    weeksAgo: "weeks",
    monthsAgo: "months",

    // Settings
    settings: "Settings",
    languageLabel: "Interface and report language",
    languageHelp: "Reports will be generated in this language",
    toastEnabled: "Enable automatic detection",
    toastEnabledHelp: "Shows a toast when Terms are detected on a page",
    toastPositionLabel: "Toast position",
    toastPositionBottomRight: "Bottom right",
    toastPositionBottomLeft: "Bottom left",
    toastPositionTopRight: "Top right",
    toastPositionTopLeft: "Top left",
    toastDurationLabel: "Display duration (seconds)",
    toastDurationManual: "Manual (click to close)",

    // About page
    aboutContent: {
      title: "About",
      missionTitle: "Our Mission",
      missionText: "Clear Terms helps users quickly understand Terms of Service and Privacy Policies of online services. Our AI analyzes content and identifies key points to help you make informed decisions.",

      howItWorksTitle: "📊 How It Works",
      howItWorksText1: "We use AI (Google Gemini) to automatically analyze 12 key categories: data collection, third-party sharing, user rights, security measures, and more.",
      howItWorksText2: "Each category receives a status based on its impact for users:",
      statusGreen: "🟢 Green: Favorable for users",
      statusAmber: "🟡 Amber: Acceptable with reservations",
      statusRed: "🔴 Red: Concerning",
      statusNA: "⚪ N/A: Not mentioned in the document",

      scoreTitle: "Score Calculation",
      scoreText: "The overall score (A-E) is calculated by weighting categories according to their real impact on your rights. Each category has a specific weight: Dispute Resolution (13%), Data Sharing (15%), International Transfers (6%), etc. For each category: green = 2 points, amber = 1 point, red = 0. The final score is normalized between 0 and 1, then converted to a grade (A≥80%, B≥65%, C≥50%, D≥35%, E<35%).",

      privacyTitle: "Privacy",
      privacyText: "Your data is never stored in an identifiable manner. Analysis is performed in real-time and results are cached anonymously (by content hash) to optimize performance and reduce costs.",

      limitationsTitle: "Important Limitations",
      limitationsText: "Clear Terms is not legal advice and does not replace the opinion of a qualified attorney. Analyses may contain errors or inaccuracies. Always consult the original text and, if necessary, a legal professional."
    },

    // Terms of Service page
    termsContent: {
      title: "Terms of Service",
      effectiveDate: "Effective Date: October 6, 2025",

      intro: "Welcome to Clear Terms — a tool designed to help users better understand the terms of service and privacy policies of digital services. By installing or using the Clear Terms extension, you agree to be bound by these Terms of Service.",
      pleaseRead: "Please read them carefully.",

      section1Title: "1. Overview",
      section1Text: "Clear Terms is a tool that identifies key clauses and risks commonly found in online terms of service and privacy policies. It provides summaries, risk ratings, and insights based on publicly available documents and our internal analysis. We strive to help users make informed decisions, but we cannot guarantee legal completeness or accuracy in all contexts.",

      section2Title: "2. No Legal Advice Disclaimer",
      section2Text: "Clear Terms is not a law firm, and the information provided through the extension does not constitute legal advice.",
      section2Intro: "You understand and agree that:",
      section2Item1: "Clear Terms is not a substitute for consulting a qualified attorney.",
      section2Item2: "The alerts, examples, and summaries we provide are informational only and may not apply to your specific situation.",
      section2Item3: "If you require legal advice or legal representation, you should contact a licensed attorney in your jurisdiction.",
      section2Item4: "Use of Clear Terms does not create an attorney-client relationship.",

      section3Title: "3. User Accounts and Data",
      section3Text: "We collect only the minimal amount of data necessary to provide the service. Currently, no personally identifiable data is collected. Analyses are cached anonymously (by content hash) to improve performance. This data is never sold or shared with third parties.",

      section4Title: "4. Accuracy and Limitations",
      section4Intro: "While we aim to provide accurate and up-to-date information:",
      section4Item1: "We do not warrant the completeness, correctness, or legal enforceability of any summary or risk rating provided.",
      section4Item2: "Terms and conditions change frequently, and our database may not always reflect the most recent version of a given policy.",
      section4Item3: "Our analysis is based on automated and manual review processes, which may have limitations or edge cases.",

      section5Title: "5. Intellectual Property",
      section5Text: "The Clear Terms name, logo, software, and original content are the intellectual property of its creators. You may not:",
      section5Item1: "Reverse-engineer or repurpose the extension",
      section5Item2: "Resell or distribute our analysis without permission",
      section5Item3: "Represent our summaries as legal opinions",

      section6Title: "6. User Conduct",
      section6Text: "You agree not to:",
      section6Item1: "Misuse the extension for scraping, automation, or spamming",
      section6Item2: "Attempt to tamper with the extension's behavior",
      section6Item3: "Pretend the information provided by Clear Terms is a legal authority",

      section7Title: "7. Termination",
      section7Text: "We reserve the right to suspend or terminate your access to the extension if:",
      section7Item1: "You violate these terms",
      section7Item2: "You use the extension in a manner that harms others, violates the law, or compromises the integrity of the service",

      section8Title: "8. Disclaimer of Warranties",
      section8Text: "The Clear Terms extension is provided \"as is\" and \"as available\" without warranties of any kind. We disclaim all express or implied warranties, including but not limited to:",
      section8Item1: "Merchantability",
      section8Item2: "Fitness for a particular purpose",
      section8Item3: "Non-infringement",
      section8End: "We do not guarantee that the extension will be error-free, uninterrupted, or fully accurate.",

      section9Title: "9. Limitation of Liability",
      section9Text: "To the maximum extent permitted by law, Clear Terms (and its creators, team, and affiliates) shall not be liable for:",
      section9Item1: "Any indirect, incidental, or consequential damages",
      section9Item2: "Any loss of data, profit, or business opportunity",
      section9Item3: "Any decisions you make based on our content",
      section9End: "Your sole remedy for dissatisfaction with the service is to stop using it.",

      section10Title: "10. Governing Law and Compliance",
      section10Text: "These terms shall be governed by and construed in accordance with French law and European regulations, including the General Data Protection Regulation (GDPR). We are committed to protecting your personal data in accordance with GDPR and respecting your rights of access, rectification, erasure, and data portability. Any disputes shall be handled exclusively in the competent courts in France.",

      section11Title: "11. Changes to These Terms",
      section11Text: "We may update these Terms of Service from time to time. If we make material changes, we will notify you via the extension with a 30-day notice period. If you do not accept the new terms, you may stop using the extension by uninstalling it before the changes take effect. Continued use of the service after this period constitutes your acceptance of the new terms.",

      section12Title: "12. Contact",
      section12Text: "Questions or concerns? Contact us at: [EMAIL]",

      lastUpdated: "Last updated: October 6, 2025"
    }
  }
};

/**
 * Fonction helper pour récupérer une traduction
 * @param {string} key - Clé de traduction (ex: "headerTitle" ou "categories.data_collection")
 * @param {string} lang - Langue ('fr' ou 'en')
 * @returns {string} La traduction ou la clé si non trouvée
 */
function t(key, lang = 'fr') {
  const keys = key.split('.');
  let value = translations[lang];

  for (const k of keys) {
    value = value?.[k];
  }

  return value || key;
}

// Export pour utilisation dans popup.js
window.i18n = { translations, t };
