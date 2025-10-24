// ========================================
// TOAST UI - Interface de notification utilisateur
// ========================================

/**
 * Crée et affiche le toast de notification
 * @param {string} type - 'found' (rapport trouvé) ou 'detected' (CGU détectées)
 * @param {string} url - URL de la page
 * @param {string} hash - Hash du contenu
 * @param {Object|string} data - Rapport (si found) ou contenu (si detected)
 */
function createToast(type, url, data) {
  // Vérifier si le toast existe déjà
  if (document.getElementById('clear-terms-toast-container')) {
    console.log('[Clear Terms] Toast déjà affiché');
    return;
  }

  // Récupérer la langue et les préférences du toast
  chrome.storage.local.get(['userLanguage', 'toastPosition', 'toastDuration'], (result) => {
    const lang = result.userLanguage || 'fr';
    const position = result.toastPosition || 'bottom-right';
    const duration = result.toastDuration !== undefined ? result.toastDuration : 30000;

    const translations = {
      fr: {
        appName: 'Clear Terms',
        foundMessage: 'Analyse trouvée pour ce site',
        detectedMessage: 'CGU détectées sur cette page',
        btnView: 'Voir',
        btnIgnore: 'Ignorer',
        btnAnalyze: 'Analyser',
        btnCancel: 'Annuler'
      },
      en: {
        appName: 'Clear Terms',
        foundMessage: 'Analysis found for this site',
        detectedMessage: 'Terms detected on this page',
        btnView: 'View',
        btnIgnore: 'Ignore',
        btnAnalyze: 'Analyze',
        btnCancel: 'Cancel'
      }
    };

    const t = translations[lang];
    const message = type === 'found' ? t.foundMessage : t.detectedMessage;
    const btnPrimary = type === 'found' ? t.btnView : t.btnAnalyze;
    const btnSecondary = type === 'found' ? t.btnIgnore : t.btnCancel;

    // Créer le container avec la position choisie
    const toastContainer = document.createElement('div');
    toastContainer.id = 'clear-terms-toast-container';
    toastContainer.dataset.type = type;
    toastContainer.dataset.url = url;

    // Stocker les données dans le dataset
    if (type === 'found') {
      toastContainer.dataset.report = JSON.stringify(data);
    } else {
      toastContainer.dataset.content = data;
    }

    // Définir la position selon la préférence
    const positions = {
      'bottom-right': 'bottom: 20px; right: 20px;',
      'bottom-left': 'bottom: 20px; left: 20px;',
      'top-right': 'top: 20px; right: 20px;',
      'top-left': 'top: 20px; left: 20px;'
    };

    toastContainer.style.cssText = `
      position: fixed;
      ${positions[position]}
      z-index: 2147483647;
      animation: slideIn 0.3s ease-out;
    `;

    // Récupérer l'URL de l'icône AVANT de créer le Shadow DOM
    const iconUrl = chrome.runtime.getURL('icon/icon48.png');

    // Créer Shadow DOM
    const shadow = toastContainer.attachShadow({ mode: 'open' });

    // Injecter le style et le HTML
    shadow.innerHTML = `
      <style>
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .toast {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 16px;
          max-width: 340px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .toast-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .logo {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
        }

        .logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .app-name {
          flex: 1;
          font-size: 13px;
          font-weight: 600;
          color: #6366f1;
          margin: 0;
        }

        .toast-body {
          margin-bottom: 12px;
        }

        .message {
          font-size: 14px;
          font-weight: 500;
          color: #111827;
          margin: 0;
          line-height: 1.4;
        }

        .toast-actions {
          display: flex;
          gap: 8px;
        }

        .toast-btn {
          flex: 1;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .toast-btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .toast-btn-primary:hover {
          background: linear-gradient(135deg, #5568d3 0%, #63408a 100%);
        }

        .toast-btn-secondary {
          background: #f3f4f6;
          color: #6b7280;
        }

        .toast-btn-secondary:hover {
          background: #e5e7eb;
        }
      </style>
      <div class="toast">
        <div class="toast-header">
          <div class="logo">
            <img src="${iconUrl}" alt="Clear Terms">
          </div>
          <p class="app-name">${t.appName}</p>
        </div>

        <div class="toast-body">
          <p class="message">${message}</p>
        </div>

        <div class="toast-actions">
          <button class="toast-btn toast-btn-primary" data-action="primary">
            ${btnPrimary}
          </button>
          <button class="toast-btn toast-btn-secondary" data-action="secondary">
            ${btnSecondary}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(toastContainer);

    // Event listeners pour les boutons
    const primaryBtn = shadow.querySelector('[data-action="primary"]');
    const secondaryBtn = shadow.querySelector('[data-action="secondary"]');

    primaryBtn.addEventListener('click', () => {
      handleToastPrimaryAction(type, url, data);
      toastContainer.remove();
    });

    secondaryBtn.addEventListener('click', () => {
      toastContainer.remove();
    });

    // Auto-fermeture selon la durée choisie (0 = manuel)
    if (duration > 0) {
      setTimeout(() => {
        if (document.getElementById('clear-terms-toast-container')) {
          toastContainer.remove();
        }
      }, duration);
    }
  });
}

/**
 * Gère l'action principale du toast (Voir ou Analyser)
 */
function handleToastPrimaryAction(type, url, data) {
  if (type === 'found') {
    // Rapport trouvé : afficher le rapport dans le popup
    chrome.runtime.sendMessage({
      type: 'DISPLAY_REPORT',
      report: data
    });
  } else {
    // CGU détectées : lancer une analyse
    chrome.runtime.sendMessage({
      type: 'PERFORM_ANALYSIS',
      url: url,
      content: data
    });
  }
}
