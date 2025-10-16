/**
 * Pondération des catégories (en %)
 * Reflète l'impact réel de chaque catégorie sur la vie privée et les droits utilisateur
 */
const CATEGORY_WEIGHTS = {
  data_collection: 10,
  data_usage: 10,
  data_sharing: 15,
  user_rights: 10,
  data_retention: 7,
  security_measures: 7,
  policy_changes: 5,
  legal_compliance: 6,        
  cookies_tracking: 5,
  children_privacy: 5,
  user_content_rights: 7,
  dispute_resolution: 13
};

/**
 * Calcule le grade (A-E) basé sur les catégories avec pondération
 */
function calculateGrade(categories) {
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // Pour chaque catégorie, calculer le score pondéré
  Object.entries(categories).forEach(([key, cat]) => {
    // Ignorer les catégories n/a
    if (cat.status === 'n/a') return;

    const weight = CATEGORY_WEIGHTS[key] || 0;

    // Score par status : green = 2, amber = 1, red = 0
    let statusScore = 0;
    if (cat.status === 'green') statusScore = 2;
    else if (cat.status === 'amber') statusScore = 1;
    else if (cat.status === 'red') statusScore = 0;

    totalWeightedScore += statusScore * weight;
    totalWeight += weight * 2; // Multiplié par 2 car le max est 2 points
  });

  // Si aucune catégorie valide, retourner E
  if (totalWeight === 0) return 'E';

  // Calculer le score normalisé (entre 0 et 1)
  const score = totalWeightedScore / totalWeight;

  // Attribuer le grade selon les seuils
  if (score >= 0.8) return 'A';
  if (score >= 0.65) return 'B';
  if (score >= 0.5) return 'C';
  if (score >= 0.35) return 'D';
  return 'E';
}
