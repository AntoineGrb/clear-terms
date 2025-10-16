// ========================================
// TOAST UI - Interface de notification utilisateur
// ========================================

/**
 * Crée et affiche le toast de notification
 * Utilise Shadow DOM pour l'isolation CSS
 */
function createToast() {
  // Vérifier si le toast existe déjà
  if (document.getElementById('clear-terms-toast-container')) {
    console.log('[Clear Terms] Toast déjà affiché');
    return;
  }

  // Récupérer la langue et les préférences du toast
  chrome.storage.local.get(['userLanguage', 'toastPosition', 'toastDuration'], (result) => {
    const lang = result.userLanguage || 'fr';
    const position = result.toastPosition || 'bottom-right';
    const duration = result.toastDuration !== undefined ? result.toastDuration : 5000;

    const translations = {
      fr: {
        appName: 'Clear Terms',
        title: 'Analyse des CGU disponible',
        subtitle: 'Cliquer pour voir l\'analyse'
      },
      en: {
        appName: 'Clear Terms',
        title: 'Terms Analysis Available',
        subtitle: 'Click to view analysis'
      }
    };

    const t = translations[lang];

    // Créer le container avec la position choisie
    const toastContainer = document.createElement('div');
    toastContainer.id = 'clear-terms-toast-container';

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
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .toast:hover {
          box-shadow: 0 15px 50px rgba(0, 0, 0, 0.25);
          transform: translateY(-2px);
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
          background: linear-gradient(135deg, #6366f1 0%, #a78bfa 100%);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          color: white;
        }

        .app-name {
          flex: 1;
          font-size: 13px;
          font-weight: 600;
          color: #6366f1;
          margin: 0;
        }

        .toast-content {
          display: flex;
          align-items: start;
          gap: 12px;
        }

        .text-content {
          flex: 1;
          min-width: 0;
        }

        .title {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 4px 0;
        }

        .subtitle {
          font-size: 12px;
          color: #6b7280;
          margin: 0;
        }

        .close-btn {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          border: none;
          background: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .close-btn:hover {
          color: #4b5563;
        }

        .close-icon {
          width: 20px;
          height: 20px;
        }
      </style>
      <div class="toast">
        <div class="toast-header">
          <div class="logo">CT</div>
          <p class="app-name">${t.appName}</p>
          <button class="close-btn" id="close-toast" aria-label="Close">
            <svg class="close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="toast-content">
          <div class="text-content">
            <p class="title">${t.title}</p>
            <p class="subtitle">${t.subtitle}</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(toastContainer);

    // Event listener: Ouvrir la popup au clic
    const toastElement = shadow.querySelector('.toast');
    toastElement.addEventListener('click', (e) => {
      if (!e.target.closest('#close-toast')) {
        chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        toastContainer.remove();
      }
    });

    // Event listener: Fermer le toast
    shadow.querySelector('#close-toast').addEventListener('click', (e) => {
      e.stopPropagation();
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
