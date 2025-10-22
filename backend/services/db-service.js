const fs = require('fs').promises;
const path = require('path');

const USERS_FILE = path.join(__dirname, '../db/users.json');
const LOCK_FILE = path.join(__dirname, '../db/users.lock');
const JSON_SILO_URL = 'https://api.jsonsilo.com/e82ef63e-0916-49e4-ab05-aed10fefef2b';

/**
 * Service d'abstraction pour la base de données utilisateurs
 * Gère automatiquement le switch entre fichier local et JsonSilo
 * Basé sur NODE_ENV : production = JsonSilo, sinon = local
 */
class DatabaseService {
  constructor() {
    this.lockActive = false;
    this.useJsonSilo = null; // null = pas encore déterminé
    this.jsonSiloKey = process.env.JSON_SILO_KEY;
  }

  /**
   * Détermine si on doit utiliser JsonSilo ou le fichier local
   * Basé sur NODE_ENV : production = JsonSilo, sinon = local
   */
  _shouldUseJsonSilo() {
    if (this.useJsonSilo !== null) {
      return this.useJsonSilo;
    }

    // Utiliser JsonSilo uniquement en production
    const isProduction = process.env.NODE_ENV === 'production';
    this.useJsonSilo = isProduction && !!this.jsonSiloKey;

    console.log(`🗄️  [DB] Mode: ${this.useJsonSilo ? 'JsonSilo (distant)' : 'Local (users.json)'} [NODE_ENV: ${process.env.NODE_ENV || 'development'}]`);

    return this.useJsonSilo;
  }

  /**
   * Lire les données utilisateurs
   */
  async readUsers() {
    if (this._shouldUseJsonSilo()) {
      return await this._readFromJsonSilo();
    } else {
      return await this._readFromLocalFile();
    }
  }

  /**
   * Écrire les données utilisateurs
   */
  async writeUsers(data) {
    if (this._shouldUseJsonSilo()) {
      await this._writeToJsonSilo(data);
    } else {
      await this._writeToLocalFile(data);
    }
  }

  /**
   * Acquérir un lock (seulement pour le mode local)
   */
  async acquireLock(maxRetries = 10, retryDelay = 100) {
    // Pas de lock nécessaire pour JsonSilo (géré par leur API)
    if (this._shouldUseJsonSilo()) {
      return true;
    }

    for (let i = 0; i < maxRetries; i++) {
      try {
        await fs.writeFile(LOCK_FILE, Date.now().toString(), { flag: 'wx' });
        this.lockActive = true;
        return true;
      } catch (error) {
        if (error.code === 'EEXIST') {
          try {
            const stats = await fs.stat(LOCK_FILE);
            const lockAge = Date.now() - stats.mtimeMs;

            if (lockAge > 5000) {
              await fs.unlink(LOCK_FILE).catch(() => {});
              continue;
            }
          } catch (statError) {
            continue;
          }

          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          throw error;
        }
      }
    }

    throw new Error('Unable to acquire lock on users.json');
  }

  /**
   * Libérer le lock
   */
  async releaseLock() {
    if (this.lockActive) {
      try {
        await fs.unlink(LOCK_FILE);
        this.lockActive = false;
      } catch (error) {
        // Lock déjà supprimé, pas grave
      }
    }
  }

  // ========================================
  // Méthodes privées - Local File
  // ========================================

  async _readFromLocalFile() {
    try {
      const data = await fs.readFile(USERS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { users: {} };
      }
      throw error;
    }
  }

  async _writeToLocalFile(data) {
    const jsonData = JSON.stringify(data, null, 2);
    await fs.writeFile(USERS_FILE, jsonData, 'utf8');
  }

  // ========================================
  // Méthodes privées - JsonSilo
  // ========================================

  async _readFromJsonSilo() {
    try {
      const response = await fetch(JSON_SILO_URL, {
        method: 'GET',
        headers: {
          'X-SILO-KEY': this.jsonSiloKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Si 404 ou autre erreur, retourner structure vide
        if (response.status === 404) {
          console.log('🗄️  [DB] JsonSilo vide, initialisation...');
          return { users: {} };
        }
        throw new Error(`JsonSilo read error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ [DB] Données lues depuis JsonSilo');

      // Assurer que la structure contient toujours un objet users
      if (!data || typeof data !== 'object') {
        console.log('⚠️  [DB] JsonSilo retourne une structure invalide, initialisation...');
        return { users: {} };
      }

      if (!data.users) {
        console.log('⚠️  [DB] JsonSilo ne contient pas de propriété "users", ajout...');
        data.users = {};
      }

      return data;
    } catch (error) {
      console.error('❌ [DB] Erreur lecture JsonSilo:', error);
      throw error;
    }
  }

  async _writeToJsonSilo(data) {
    try {
      const response = await fetch(JSON_SILO_URL, {
        method: 'PUT',
        headers: {
          'X-SILO-KEY': this.jsonSiloKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`JsonSilo write error: ${response.status}`);
      }

      console.log('✅ [DB] Données écrites sur JsonSilo');
    } catch (error) {
      console.error('❌ [DB] Erreur écriture JsonSilo:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService();
