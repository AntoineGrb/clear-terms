const { cleanText, calculateUrlHash } = require('../utils/text-processing');
const { loadPromptTemplate, callGemini } = require('../utils/gemini');

/**
 * Traite un job d'analyse
 */
async function processJob(jobId, jobs, cache, primaryModel, fallbackModels, apiKey, enforceCacheLimit) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'running';

    const { url, content, userLanguage } = job;
    const cleanedContent = cleanText(content);

    // Calculer le hash basé sur l'URL
    const urlHash = calculateUrlHash(url);

    console.log(`🔗 [JOB ${jobId}] URL: ${url}`);
    console.log(`📊 [JOB ${jobId}] Hash URL: ${urlHash.substring(0, 16)}...`);
    console.log(`🌍 [JOB ${jobId}] Langue demandée: ${userLanguage}`);

    // Vérifier le cache pour cette URL et cette langue
    if (cache.has(urlHash)) {
      const cachedEntry = cache.get(urlHash);

      // Vérifier si le cache est expiré (24h)
      const now = new Date();
      const cacheAge = now - new Date(cachedEntry.createdAt);
      const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 heures 

      if (cacheAge > MAX_CACHE_AGE) {
        console.log(`⏰ Cache expiré pour URL: ${url} (âge: ${Math.round(cacheAge / 1000 / 60 / 60)}h)`);
        cache.delete(urlHash);
        console.log(`🗑️  Entrée cache supprimée pour: ${url}`);
      } else {
        // Cache valide, vérifier si le rapport dans la langue demandée existe
        if (cachedEntry.reports && cachedEntry.reports[userLanguage]) {
          const cacheAgeHours = Math.round(cacheAge / 1000 / 60 / 60);
          console.log(`📦 Rapport ${userLanguage.toUpperCase()} trouvé en cache pour URL: ${url} (âge: ${cacheAgeHours}h)`);

          // Mettre à jour lastAccessedAt pour LRU
          cachedEntry.lastAccessedAt = new Date().toISOString();

          job.result = cachedEntry.reports[userLanguage];
          job.status = 'done';
          return;
        }

        console.log(`📦 Cache trouvé mais pas de version ${userLanguage.toUpperCase()}, génération en cours...`);
      }
    }

    // Charger le prompt et le schéma
    let promptTemplate = await loadPromptTemplate();

    // Ajouter la préférence de langue dans le prompt (instruction TRÈS forte pour éviter des erreurs de Gemini)
    const languageMap = {
      'fr': 'français',
      'en': 'English'
    };
    const languageName = languageMap[userLanguage] || 'English';

    const languageInstruction = `🚨🚨🚨 CRITICAL INSTRUCTION - MANDATORY LANGUAGE REQUIREMENT 🚨🚨🚨

OUTPUT LANGUAGE: ${languageName.toUpperCase()} (${userLanguage.toUpperCase()})

YOU MUST WRITE ALL YOUR ANALYSIS COMMENTS ("comment" FIELDS IN THE JSON) IN ${languageName.toUpperCase()} ONLY.
- Even if the source document is written in French, German, Spanish, or any other language
- Even if you are analyzing French Terms of Service, write your comments in ${languageName.toUpperCase()}
- This is MANDATORY and NON-NEGOTIABLE
- DO NOT use any other language for the "comment" fields
- The "status" field remains in English (green/amber/red/n/a)
- Only the "comment" fields must be in ${languageName.toUpperCase()}
---

`;

    const fullPrompt = languageInstruction + promptTemplate + '\n\n' + cleanedContent;

    // Appeler Gemini
    const aiResponse = await callGemini(fullPrompt, fallbackModels, apiKey);

    // Parser la réponse JSON
    let report;
    try {
      // Nettoyer la réponse (enlever les ```json si présents, balises HTML, etc.)
      let jsonText = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Si la réponse commence par <!DOCTYPE ou <html, c'est une erreur HTML
      if (jsonText.startsWith('<!DOCTYPE') || jsonText.startsWith('<html')) {
        throw new Error('Réponse HTML reçue au lieu de JSON (erreur API ou quota dépassé)');
      }

      // Extraire le JSON s'il est entouré d'autre texte
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      report = JSON.parse(jsonText);
      // console.log('📄 Rapport complet:', JSON.stringify(report, null, 2));

    } catch (error) {
      console.error('❌ Réponse Gemini invalide (500 premiers caractères):', aiResponse.substring(0, 500));
      throw new Error(`Impossible de parser la réponse JSON de Gemini: ${error.message}`);
    }

    // Valider le schéma (basique)
    if (!report.site_name || !report.categories) {
      console.error('❌ Validation échouée - Champs manquants');
      console.error('   - site_name présent:', !!report.site_name);
      console.error('   - categories présent:', !!report.categories);
      console.error('   - Structure reçue:', JSON.stringify(report, null, 2));
      throw new Error('Réponse invalide : champs obligatoires manquants');
    }

    // Ajouter des métadonnées
    report.metadata = {
      url_hash: urlHash,
      analyzed_at: new Date().toISOString(),
      analyzed_url: job.url || 'unknown',
      model_used: primaryModel,
      output_language: userLanguage
    };

    // Mettre en cache avec structure multilingue (basé sur URL)
    if (cache.has(urlHash)) {
      // Ajouter la nouvelle langue au cache existant
      const existing = cache.get(urlHash);
      existing.reports[userLanguage] = report;
      existing.lastAccessedAt = new Date().toISOString();
      console.log(`💾 Rapport ${userLanguage.toUpperCase()} ajouté au cache existant pour: ${url}`);
    } else {
      // Vérifier la limite du cache avant d'ajouter une nouvelle entrée
      if (enforceCacheLimit) {
        enforceCacheLimit();
      }

      // Créer une nouvelle entrée cache
      const now = new Date().toISOString();
      cache.set(urlHash, {
        url: url,
        domain: job.url ? new URL(job.url).hostname : 'unknown',
        reports: {
          [userLanguage]: report
        },
        createdAt: now,
        lastAccessedAt: now
      });
      console.log(`💾 Nouvelle entrée cache créée pour: ${url}`);
    }

    job.result = report;
    job.status = 'done';

  } catch (error) {
    console.error(`❌ Erreur lors du traitement du job ${jobId}:`, error.message);
    job.status = 'error';
    job.error = error.message;
  }
}

module.exports = {
  processJob
};
