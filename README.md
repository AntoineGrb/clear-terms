# Clear Terms 🔍

Extension Chrome intelligente pour analyser automatiquement les Conditions Générales d'Utilisation (CGU) et Politiques de Confidentialité avec l'IA.

## 🎯 Fonctionnalités

### Analyse Automatique
- ✅ **Détection automatique** des pages CGU/Politique de confidentialité
- ✅ **Toast de notification** personnalisable (position, durée, activation/désactivation)
- ✅ **Analyse IA en arrière-plan** via Gemini 2.0 Flash
- ✅ **Rapport détaillé** avec 12 catégories d'évaluation
- ✅ **Système de notation** de A à E
- ✅ **Cache intelligent** par hash de contenu pour performances optimales

### Analyse Manuelle
- ✅ **Bouton d'analyse** pour scanner n'importe quelle page
- ✅ **Validation du contenu** avant analyse
- ✅ **Support multilingue** (FR/EN)

### Historique
- ✅ **Historisation complète** des analyses (max 100 rapports)
- ✅ **Page dédiée** avec recherche et filtres
- ✅ **Export individuel** en JSON
- ✅ **Suppression sélective** ou totale

### Gestion du Cache
- ✅ **Cache multilingue** (un rapport par langue)
- ✅ **Timestamps cohérents** (nouvelle analyse = nouvelle date)
- ✅ **Filtrage des éléments dynamiques** (bannières cookies, modales)
- ✅ **Extraction stable** pour SPAs (React, Vue, etc.)

### Interface
- ✅ **Design moderne** avec Tailwind CSS
- ✅ **Interface multilingue** (FR/EN auto-détectée)
- ✅ **Accordéon interactif** pour afficher/masquer le rapport
- ✅ **Copie d'URL** en un clic
- ✅ **Paramètres personnalisables**

## 📦 Installation

### Backend

1. Aller dans le dossier backend :
```bash
cd backend
```

2. Installer les dépendances :
```bash
npm install
```

3. Créer un fichier `.env` à partir de `.env.example` :
```bash
cp .env.example .env
```

4. Ajouter votre clé API Gemini dans le fichier `.env` :
```
GEMINI_API_KEY=votre_cle_api_google
PORT=3000
PRIMARY_MODEL=gemini-2.0-flash-exp
```

5. Démarrer le serveur :
```bash
npm start
```

### Extension Chrome

1. Ouvrir Chrome et aller à `chrome://extensions/`
2. Activer le "Mode développeur" en haut à droite
3. Cliquer sur "Charger l'extension non empaquetée"
4. Sélectionner le dossier `frontend`

## 🚀 Utilisation

### Analyse Automatique
1. S'assurer que le serveur backend est démarré
2. Naviguer vers une page de CGU/Politique de confidentialité
3. Un toast apparaît automatiquement si la page est détectée
4. L'analyse se lance en arrière-plan
5. Ouvrir la popup pour voir le rapport

### Analyse Manuelle
1. Naviguer vers n'importe quelle page
2. Cliquer sur l'icône de l'extension
3. Cliquer sur "Analyser cette page"
4. Le rapport s'affiche dans la popup

### Paramètres
- **Langue** : Français ou English (auto-détectée par défaut)
- **Détection automatique** : Activer/désactiver le toast
- **Position du toast** : 4 positions disponibles
- **Durée du toast** : Personnalisable (1-10 secondes)

## 📊 Catégories d'Analyse

L'IA analyse 12 catégories :
1. 🔍 **Collecte de données** - Quelles données sont collectées ?
2. 📊 **Utilisation des données** - Comment sont-elles utilisées ?
3. 🤝 **Partage des données** - Avec qui sont-elles partagées ?
4. ⚖️ **Droits de l'utilisateur** - Quels sont vos droits ?
5. 🗑️ **Rétention des données** - Combien de temps sont-elles gardées ?
6. 🔒 **Mesures de sécurité** - Comment sont-elles protégées ?
7. 📝 **Modifications de politique** - Comment êtes-vous informé ?
8. 🏛️ **Conformité légale** - RGPD, lois applicables ?
9. 🍪 **Cookies et tracking** - Quels traceurs sont utilisés ?
10. 👶 **Protection des mineurs** - Âge minimum, consentement parental ?
11. 📄 **Droits sur le contenu utilisateur** - Qui possède vos contenus ?
12. ⚖️ **Résolution des litiges** - Arbitrage, juridiction ?

Chaque catégorie est notée :
- 🟢 **Vert** - Acceptable
- 🟠 **Orange** - Attention requise
- 🔴 **Rouge** - Problématique

## 🛠️ Architecture Technique

### Frontend (Extension Chrome)
- **Manifest V3**
- **Content Scripts modulaires** :
  - `config.js` - Configuration et critères
  - `exclusions.js` - Filtrage des moteurs de recherche
  - `extraction.js` - Extraction du contenu
  - `detection.js` - Détection et validation
  - `toast.js` - Interface toast
- **Services** :
  - `api-client.js` - Communication avec le backend
  - `report-display.js` - Affichage des rapports
- **Utils** :
  - `grading.js` - Système de notation
  - `hash.js` - Calcul de hash SHA-256
  - `translations.js` - Gestion i18n

### Backend (Node.js + Express)
- **API REST** :
  - `POST /scan` - Lancer une analyse
  - `GET /jobs/:id` - Récupérer l'état d'un job
  - `GET /report?hash=xxx&lang=fr` - Rechercher en cache
  - `GET /health` - Health check
- **Services** :
  - `job-processor.js` - Traitement des analyses
  - `gemini.js` - Appels à l'API Gemini
  - `text-processing.js` - Nettoyage et hashing
- **Cache multilingue** en mémoire (Map)
- **Système de jobs** avec polling

### IA (Gemini 2.0 Flash)
- **Prompt engineering** avec schéma JSON strict
- **Instruction de langue renforcée**
- **Fallback models** en cas d'erreur
- **Cache par hash de contenu**

## 🔒 Conformité et Confidentialité

Clear Terms respecte les plus hauts standards :
- ✅ **Conformité RGPD** explicite
- ✅ **Aucune donnée personnelle** collectée
- ✅ **Cache anonyme** par hash
- ✅ **Préavis de 30 jours** pour modifications de CGU
- ✅ **Opt-out explicite** disponible
- ✅ **Données locales** (Chrome Storage)

Voir les [Conditions de Service](frontend/popup.html#termsPage) intégrées dans l'extension.

## 🐛 Débogage

Activer les logs détaillés dans la console :
```javascript
// Console du content script
[Clear Terms] 🔍 Détection lancée sur: https://...
[Clear Terms] 🔄 Tentative 1/20 - Contenu: 12458 caractères
[Clear Terms] ✅ Contenu réel détecté, lancement de la détection
[Clear Terms] ✅✅✅ CGU détectée et validée !
```

Logs backend :
```javascript
📦 Rapport FR trouvé en cache pour hash: 420d6366...
📊 Job ID créé: 5e964237-0509-4c86-872a-78528b5b9916
✅ Analyse auto terminée pour l'onglet 1469964281
```

## 📝 Note

Pour obtenir une clé API Gemini, visitez : https://aistudio.google.com/app/apikey

## 🔮 Améliorations Futures

- [ ] Support de plus de langues (ES, DE, IT)
- [ ] Export historique complet (CSV, PDF)
- [ ] Comparaison de rapports
- [ ] Notifications de changements de CGU
- [ ] Mode hors-ligne avec modèles locaux

## 📄 Licence

[À définir]

## 👥 Contributeurs

[À définir]
