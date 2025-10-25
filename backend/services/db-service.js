const fs = require('fs').promises;
const path = require('path');

const USERS_FILE = path.join(__dirname, '../db/users.json');
const LOCK_FILE = path.join(__dirname, '../db/users.lock');

/**
 * Service d'abstraction pour la base de données utilisateurs
 * Gère automatiquement le switch entre fichier local et JsonBin.io
 * Basé sur NODE_ENV : production/staging = JsonBin, sinon = local
 */
class DatabaseService {
  constructor() {
    this.lockActive = false;
    this.useJsonBin = null; // null = pas encore déterminé
    this.jsonBinKey = process.env.JSON_BIN_KEY;
    this.jsonBinId = process.env.JSON_BIN_ID;
    this.jsonBinUrl = this.jsonBinId ? `https://api.jsonbin.io/v3/b/${this.jsonBinId}` : null;
  }

  /**
   * Détermine si on doit utiliser JsonBin ou le fichier local
   * Basé sur NODE_ENV : production/staging = JsonBin, sinon = local
   */
  _shouldUseJsonBin() {
    if (this.useJsonBin !== null) {
      return this.useJsonBin;
    }

    // Utiliser JsonBin uniquement en production avec les credentials
    const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
    this.useJsonBin = isProduction && !!this.jsonBinKey && !!this.jsonBinId;

    console.log(`🗄️  [DB] Mode: ${this.useJsonBin ? 'JsonBin (distant)' : 'Local (users.json)'} [NODE_ENV: ${process.env.NODE_ENV || 'development'}]`);

    return this.useJsonBin;
  }

  /**
   * Lire les données utilisateurs
   */
  async readUsers() {
    if (this._shouldUseJsonBin()) {
      return await this._readFromJsonBin();
    } else {
      return await this._readFromLocalFile();
    }
  }

  /**
   * Écrire les données utilisateurs
   */
  async writeUsers(data) {
    if (this._shouldUseJsonBin()) {
      await this._writeToJsonBin(data);
    } else {
      await this._writeToLocalFile(data);
    }
  }

  /**
   * Acquérir un lock (seulement pour le mode local)
   */
  async acquireLock(maxRetries = 10, retryDelay = 100) {
    // Pas de lock nécessaire pour JsonBin (géré par leur API)
    if (this._shouldUseJsonBin()) {
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
  // Méthodes privées - JsonBin.io
  // ========================================

  async _readFromJsonBin() {
    try {
      const response = await fetch(`${this.jsonBinUrl}/latest`, {
        method: 'GET',
        headers: {
          'X-Master-Key': this.jsonBinKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.error(`❌ [DB] JsonBin error response (${response.status}):`, errorText);
        throw new Error(`JsonBin read error: ${response.status}`);
      }

      const result = await response.json();

      // JsonBin retourne { record: {...} }
      const data = result.record || { users: {} };

      // Assurer que la structure contient toujours un objet users
      if (!data.users) {
        data.users = {};
      }

      return data;
    } catch (error) {
      console.error('❌ [DB] Erreur lecture JsonBin:', error);
      throw error;
    }
  }

  async _writeToJsonBin(data) {
    try {
      const response = await fetch(this.jsonBinUrl, {
        method: 'PUT',
        headers: {
          'X-Master-Key': this.jsonBinKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.error(`❌ [DB] JsonBin error response (${response.status}):`, errorText);
        throw new Error(`JsonBin write error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [DB] Erreur écriture JsonBin:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService();
