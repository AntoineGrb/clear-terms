// ========================================
// HISTORIQUE - Clear Terms
// ========================================

let allReports = [];
let filteredReports = [];
let currentLang = 'fr';

// ========================================
// Initialisation
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  // Toujours détecter automatiquement la langue du navigateur
  currentLang = detectBrowserLanguage();
  applyTranslations(currentLang);

  // Charger les rapports
  await loadReports();

  // Setup event listeners
  setupEventListeners();
});

// ========================================
// Chargement des rapports
// ========================================

async function loadReports() {
  try {
    const { reportsHistory = [] } = await chrome.storage.local.get(['reportsHistory']);
    allReports = reportsHistory;
    filteredReports = [...allReports];

    // Afficher les rapports
    renderReports();
    updateReportCount();

  } catch (error) {
    // Erreur silencieuse
  }
}

// ========================================
// Rendu des rapports
// ========================================

function renderReports() {
  const reportsList = document.getElementById('reportsList');
  const emptyState = document.getElementById('emptyState');
  const noResultsState = document.getElementById('noResultsState');

  // Si pas de rapports du tout
  if (allReports.length === 0) {
    reportsList.classList.add('hidden');
    emptyState.classList.remove('hidden');
    noResultsState.classList.add('hidden');
    return;
  }

  // Si pas de résultats après filtrage
  if (filteredReports.length === 0) {
    reportsList.classList.add('hidden');
    emptyState.classList.add('hidden');
    noResultsState.classList.remove('hidden');
    return;
  }

  // Afficher les rapports
  reportsList.classList.remove('hidden');
  emptyState.classList.add('hidden');
  noResultsState.classList.add('hidden');

  // Créer les cards des rapports
  reportsList.innerHTML = filteredReports.map(entry => createReportCard(entry)).join('');

  // Ajouter les event listeners pour les accordéons
  document.querySelectorAll('.report-card-toggle').forEach(button => {
    button.addEventListener('click', () => toggleReportCard(button));
  });
}

// ========================================
// Création d'une card de rapport
// ========================================

function createReportCard(entry) {
  const { id, report } = entry;
  const { site_name, categories, metadata } = report;

  // Calculer le grade
  const grade = calculateGrade(categories);

  // Compter les badges
  const statusCounts = { green: 0, amber: 0, red: 0 };
  Object.values(categories).forEach(cat => {
    if (cat.status !== 'n/a') {
      statusCounts[cat.status]++;
    }
  });

  // Couleur du score
  const gradeColors = {
    A: 'bg-emerald-600',
    B: 'bg-green-500',
    C: 'bg-yellow-500',
    D: 'bg-orange-500',
    E: 'bg-red-500'
  };

  // Bordure selon le score
  const borderColors = {
    A: 'border-emerald-600',
    B: 'border-green-500',
    C: 'border-yellow-500',
    D: 'border-orange-500',
    E: 'border-red-500'
  };

  // URL et date d'analyse
  const analyzedUrl = metadata?.analyzed_url || 'URL inconnue';
  const timestamp = metadata?.analyzed_at ? new Date(metadata.analyzed_at).getTime() : Date.now();
  const dateStr = formatDate(timestamp);
  const relativeTime = formatRelativeTime(timestamp);

  // Ordre des catégories (selon schema.json)
  const categoryOrder = [
    'data_collection',
    'data_usage',
    'data_sharing',
    'user_rights',
    'data_retention',
    'security_measures',
    'policy_changes',
    'legal_compliance',
    'cookies_tracking',
    'children_privacy',
    'user_content_rights',
    'dispute_resolution'
  ];

  // Trier par couleur d'abord (red > amber > green), puis par ordre du schema
  const sortOrder = { red: 0, amber: 1, green: 2, 'n/a': 3 };
  const sortedCategories = Object.entries(categories)
    .filter(([_, cat]) => cat.status !== 'n/a')
    .sort(([keyA, a], [keyB, b]) => {
      const colorDiff = sortOrder[a.status] - sortOrder[b.status];
      if (colorDiff !== 0) return colorDiff;
      return categoryOrder.indexOf(keyA) - categoryOrder.indexOf(keyB);
    });

  const categoryColors = {
    red: 'bg-red-50 border-red-500',
    amber: 'bg-amber-50 border-amber-500',
    green: 'bg-emerald-50 border-emerald-500'
  };

  return `
    <div class="overflow-hidden transition-shadow bg-white rounded-lg shadow-sm hover:shadow-md">
      <!-- Header (toujours visible) -->
      <button class="report-card-toggle w-full p-6 text-left transition-colors hover:bg-gray-50" data-card-id="${id}">
        <div class="flex items-center gap-6">
          <!-- Score -->
          <div class="flex items-center justify-center flex-shrink-0 w-16 h-16 text-4xl font-bold text-white rounded-full ${gradeColors[grade]}">
            ${grade}
          </div>

          <!-- Site Info -->
          <div class="flex-1 min-w-0">
            <h3 class="mb-2 text-xl font-semibold text-gray-900 truncate">${DOMPurify.sanitize(site_name || 'Site web')}</h3>
            <p class="mb-1.5 text-sm text-gray-500 truncate">${DOMPurify.sanitize(analyzedUrl)}</p>
            <p class="text-xs text-gray-400">${DOMPurify.sanitize(dateStr)} • ${DOMPurify.sanitize(relativeTime)}</p>
          </div>

          <!-- Badges -->
          <div class="flex flex-shrink-0 gap-3">
            <div class="flex flex-col items-center gap-1">
              <div class="flex items-center justify-center w-12 h-12 text-lg font-semibold rounded-lg bg-red-100 text-red-700">${statusCounts.red}</div>
              <span class="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Alert</span>
            </div>
            <div class="flex flex-col items-center gap-1">
              <div class="flex items-center justify-center w-12 h-12 text-lg font-semibold rounded-lg bg-amber-100 text-amber-700">${statusCounts.amber}</div>
              <span class="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Moy</span>
            </div>
            <div class="flex flex-col items-center gap-1">
              <div class="flex items-center justify-center w-12 h-12 text-lg font-semibold rounded-lg bg-emerald-100 text-emerald-700">${statusCounts.green}</div>
              <span class="text-[10px] text-gray-400 uppercase tracking-wide font-medium">OK</span>
            </div>
          </div>

          <!-- Chevron -->
          <div class="flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-gray-400 transition-transform chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      <!-- Content (caché par défaut) -->
      <div class="report-card-content hidden px-6 pb-6 pt-5 border-t border-gray-200" data-card-id="${id}">
        <!-- Catégories -->
        <div class="space-y-3">
          ${sortedCategories.map(([key, cat]) => `
            <div class="p-3.5 rounded-lg border-l-4 ${categoryColors[cat.status]}">
              <div class="mb-1.5 text-sm font-semibold text-gray-900">${i18n.t(`categories.${key}`, currentLang)}</div>
              <div class="text-xs leading-relaxed text-gray-600">${DOMPurify.sanitize(cat.comment)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ========================================
// Toggle de la card (accordéon)
// ========================================

function toggleReportCard(button) {
  const cardId = button.dataset.cardId;
  const content = document.querySelector(`.report-card-content[data-card-id="${cardId}"]`);
  const chevron = button.querySelector('.chevron');

  const isHidden = content.classList.toggle('hidden');

  // Rotation du chevron
  if (isHidden) {
    chevron.style.transform = 'rotate(0deg)';
  } else {
    chevron.style.transform = 'rotate(180deg)';
  }
}

// ========================================
// Formatage de la date
// ========================================

function formatDate(timestamp) {
  const locale = currentLang === 'fr' ? 'fr-FR' : 'en-US';
  return new Date(timestamp).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  if (diff < minute) {
    return i18n.t('justNow', currentLang);
  } else if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${i18n.t('analyzedAgo', currentLang)} ${minutes} ${i18n.t('minutesAgo', currentLang)}`;
  } else if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${i18n.t('analyzedAgo', currentLang)} ${hours} ${i18n.t('hoursAgo', currentLang)}`;
  } else if (diff < week) {
    const days = Math.floor(diff / day);
    return `${i18n.t('analyzedAgo', currentLang)} ${days} ${i18n.t('daysAgo', currentLang)}`;
  } else if (diff < month) {
    const weeks = Math.floor(diff / week);
    return `${i18n.t('analyzedAgo', currentLang)} ${weeks} ${i18n.t('weeksAgo', currentLang)}`;
  } else {
    const months = Math.floor(diff / month);
    return `${i18n.t('analyzedAgo', currentLang)} ${months} ${i18n.t('monthsAgo', currentLang)}`;
  }
}

// ========================================
// Event Listeners
// ========================================

function setupEventListeners() {
  // Recherche
  document.getElementById('searchInput').addEventListener('input', (e) => {
    applyFilters();
  });

  // Filtre par score
  document.getElementById('filterScore').addEventListener('change', () => {
    applyFilters();
  });

  // Tri
  document.getElementById('sortBy').addEventListener('change', () => {
    applyFilters();
  });

  // Supprimer l'historique
  document.getElementById('clearHistoryButton').addEventListener('click', async () => {
    const confirmMessage = i18n.t('clearHistoryConfirm', currentLang);
    if (confirm(confirmMessage)) {
      await clearHistory();
    }
  });

  // Export CSV
  document.getElementById('exportCsvButton').addEventListener('click', () => {
    exportToCSV();
  });

  // Export JSON
  document.getElementById('exportJsonButton').addEventListener('click', () => {
    exportToJSON();
  });
}

// ========================================
// Supprimer l'historique
// ========================================

async function clearHistory() {
  try {
    // Supprimer de chrome.storage
    await chrome.storage.local.set({ reportsHistory: [] });

    // Réinitialiser les variables locales
    allReports = [];
    filteredReports = [];

    // Re-render
    renderReports();
    updateReportCount();

  } catch (error) {
    // Erreur silencieuse
  }
}

// ========================================
// Filtrage et tri
// ========================================

function applyFilters() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
  const filterScore = document.getElementById('filterScore').value;
  const sortBy = document.getElementById('sortBy').value;

  // Filtrer
  filteredReports = allReports.filter(entry => {
    const { report } = entry;
    const { site_name, categories } = report;

    // Filtre par recherche
    if (searchTerm && !site_name.toLowerCase().includes(searchTerm)) {
      return false;
    }

    // Filtre par score
    if (filterScore !== 'all') {
      const grade = calculateGrade(categories);
      if (grade !== filterScore) {
        return false;
      }
    }

    return true;
  });

  // Trier
  filteredReports.sort((a, b) => {
    // Utiliser la vraie date d'analyse du rapport
    const getTimestamp = (entry) => {
      const analyzedAt = entry.report.metadata?.analyzed_at;
      return analyzedAt ? new Date(analyzedAt).getTime() : entry.timestamp;
    };

    switch (sortBy) {
      case 'date-recent':
        return getTimestamp(b) - getTimestamp(a);
      case 'date-old':
        return getTimestamp(a) - getTimestamp(b);
      case 'score-ae':
        return calculateGrade(a.report.categories).localeCompare(calculateGrade(b.report.categories));
      case 'score-ea':
        return calculateGrade(b.report.categories).localeCompare(calculateGrade(a.report.categories));
      case 'name-az':
        return a.report.site_name.localeCompare(b.report.site_name);
      case 'name-za':
        return b.report.site_name.localeCompare(a.report.site_name);
      default:
        return 0;
    }
  });

  // Re-render
  renderReports();
  updateReportCount();
}

// ========================================
// Compteur de rapports
// ========================================

function updateReportCount() {
  const count = filteredReports.length;
  const total = allReports.length;
  const reportCountEl = document.getElementById('reportCount');

  if (currentLang === 'fr') {
    if (total === 0) {
      reportCountEl.textContent = '• Aucun rapport';
    } else if (count === total) {
      reportCountEl.textContent = `• ${total} rapport${total > 1 ? 's' : ''}`;
    } else {
      reportCountEl.textContent = `• ${count} / ${total} rapport${total > 1 ? 's' : ''}`;
    }
  } else {
    if (total === 0) {
      reportCountEl.textContent = '• No reports';
    } else if (count === total) {
      reportCountEl.textContent = `• ${total} report${total > 1 ? 's' : ''}`;
    } else {
      reportCountEl.textContent = `• ${count} / ${total} report${total > 1 ? 's' : ''}`;
    }
  }
}

// ========================================
// Export CSV
// ========================================

function exportToCSV() {
  if (filteredReports.length === 0) {
    alert(currentLang === 'fr' ? 'Aucun rapport à exporter' : 'No reports to export');
    return;
  }

  // En-têtes CSV
  const headers = [
    'Site Name',
    'URL',
    'Analysis Date',
    'Grade',
    'Data Collection',
    'Data Usage',
    'Data Sharing',
    'User Rights',
    'Data Retention',
    'Security Measures',
    'Policy Changes',
    'Legal Compliance',
    'Cookies & Tracking',
    'Children Privacy',
    'User Content Rights',
    'Dispute Resolution'
  ];

  // Convertir les rapports en lignes CSV
  const rows = filteredReports.map(entry => {
    const { report } = entry;
    const { site_name, categories, metadata } = report;
    const grade = calculateGrade(categories);
    const analyzedUrl = metadata?.analyzed_url || 'Unknown';
    const analysisDate = metadata?.analyzed_at || new Date().toISOString();

    // Catégories dans l'ordre
    const categoryOrder = [
      'data_collection',
      'data_usage',
      'data_sharing',
      'user_rights',
      'data_retention',
      'security_measures',
      'policy_changes',
      'legal_compliance',
      'cookies_tracking',
      'children_privacy',
      'user_content_rights',
      'dispute_resolution'
    ];

    const categoryStatuses = categoryOrder.map(key => {
      const cat = categories[key];
      return cat ? cat.status.toUpperCase() : 'N/A';
    });

    return [
      escapeCSV(site_name),
      escapeCSV(analyzedUrl),
      escapeCSV(new Date(analysisDate).toISOString()),
      grade,
      ...categoryStatuses
    ];
  });

  // Construire le CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Télécharger le fichier
  downloadFile(csvContent, 'clear-terms-export.csv', 'text/csv');
}

// ========================================
// Export JSON
// ========================================

function exportToJSON() {
  if (filteredReports.length === 0) {
    alert(currentLang === 'fr' ? 'Aucun rapport à exporter' : 'No reports to export');
    return;
  }

  // Préparer les données JSON
  const exportData = {
    exported_at: new Date().toISOString(),
    report_count: filteredReports.length,
    reports: filteredReports.map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp,
      report: entry.report
    }))
  };

  // Convertir en JSON formaté
  const jsonContent = JSON.stringify(exportData, null, 2);

  // Télécharger le fichier
  downloadFile(jsonContent, 'clear-terms-export.json', 'application/json');
}

// ========================================
// Utilitaires d'export
// ========================================

/**
 * Échappe les valeurs pour CSV
 */
function escapeCSV(value) {
  if (value == null) return '';

  const stringValue = String(value);

  // Si la valeur contient une virgule, un guillemet ou un retour à la ligne, on l'entoure de guillemets
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Échapper les guillemets en les doublant
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Télécharge un fichier
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Nettoyer
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
