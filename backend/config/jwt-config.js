const crypto = require('crypto');

// Génération d'un secret JWT fort (256 bits)
// IMPORTANT: En production, stocker cette clé dans une variable d'environnement
const JWT_SECRET = process.env.JWT_SECRET;

// Durée de validité du JWT (30 jours)
const JWT_EXPIRATION = '30d';

module.exports = {
  JWT_SECRET,
  JWT_EXPIRATION
};
