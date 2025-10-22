const fs = require('fs').promises;
const path = require('path');

/**
 * Charge le prompt template
 * Essaie d'abord /etc/secrets/ (Render), puis fallback sur ./etc/secrets/ (local)
 */
async function loadPromptTemplate() {
  const paths = [
    '/etc/secrets/prompt-template.md', // Render (absolu)
    path.join(__dirname, '..', 'etc', 'secrets', 'prompt-template.md'), // Local (relatif)
    path.join(__dirname, '..', 'prompt-template.md') // Ancien emplacement (compatibilité)
  ];

  for (const promptPath of paths) {
    try {
      const content = await fs.readFile(promptPath, 'utf-8');
      return content;
    } catch (error) {
      // Fichier non trouvé, essayer le suivant
    }
  }

  throw new Error('Impossible de charger le prompt template depuis aucun des chemins configurés');
}

/**
 * Appelle l'API Gemini avec le système de fallback
 */
async function callGemini(prompt, fallbackModels, apiKey) {
  let lastError = null;

  for (const model of fallbackModels) {
    try {
      const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await (await fetch)(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://clear-terms.onrender.com'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 2048,
          }
        })
      });

      const raw = await response.text();

      if (!raw) {
        throw new Error("Réponse vide reçue de l'API Gemini.");
      }

      const data = JSON.parse(raw);

      if (!response.ok) {
        throw new Error(data.error?.message || `Erreur HTTP ${response.status}`);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || null;

      if (!text) {
        throw new Error("Aucune réponse générée par Gemini");
      }

      console.log(`✅ Modèle utilisé: ${model}`);
      return text;

    } catch (error) {
      console.error(`❌ Échec avec le modèle ${model}:`, error.message);
      lastError = error;
    }
  }

  throw new Error(`Tous les modèles ont échoué. Dernière erreur: ${lastError?.message}`);
}

module.exports = {
  loadPromptTemplate,
  callGemini
};
