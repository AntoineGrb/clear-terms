# Clear Terms 🔍

Extension Chrome pour analyser automatiquement les CGU et Politiques de Confidentialité avec l'IA.

## Fonctionnalités

- **Analyse automatique** : détection et analyse en arrière-plan des pages CGU
- **Analyse manuelle** : scanner n'importe quelle page sur demande
- **Notation intelligente** : 12 catégories évaluées (collecte de données, droits utilisateur, RGPD, etc.)
- **Historique** : sauvegarde et recherche des analyses précédentes
- **Multilingue** : support FR/EN avec cache par langue
- **Interface moderne** : design Tailwind CSS responsive

## Utilisation

- **Mode automatique** : visitez une page CGU, l'analyse se lance automatiquement
- **Mode manuel** : cliquez sur l'icône de l'extension → "Analyser cette page"
- **Paramètres** : langue, position et durée du toast, activation/désactivation de la détection auto

## Catégories d'Analyse

L'IA évalue 12 catégories : collecte et utilisation des données, partage, droits utilisateur, rétention, sécurité, modifications de politique, conformité RGPD, cookies, protection des mineurs, droits sur le contenu, résolution des litiges.

Notation : 🟢 Acceptable | 🟠 Attention | 🔴 Problématique

Un score global de confiance (note A-E) est attribué aux CGs du site.

## Architecture

- **Frontend** : Extension Chrome (Manifest V3), Tailwind CSS, Content Scripts modulaires
- **Backend** : Node.js + Express, API REST, cache multilingue en mémoire
- **IA** : Gemini 2.0 Flash avec prompt engineering et fallback models

## Confidentialité

Aucune donnée personnelle collectée. Cache anonyme par hash. Données stockées localement (Chrome Storage). Conforme RGPD.
