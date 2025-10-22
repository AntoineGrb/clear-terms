const fs = require('fs').promises;
const path = require('path');

const USERS_FILE = path.join(__dirname, '../db/users.json');
const LOCK_FILE = path.join(__dirname, '../db/users.lock');
const INITIAL_CREDITS = 20;

/**
 * Service de gestion des utilisateurs et de leurs crédits
 */
class UserService {
  constructor() {
    this.lockActive = false;
  }

  /**
   * Lire le fichier users.json
   */
  async _readUsers() {
    try {
      const data = await fs.readFile(USERS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Fichier n'existe pas, créer un objet vide
        return { users: {} };
      }
      throw error;
    }
  }

  /**
   * Écrire dans le fichier users.json
   */
  async _writeUsers(data) {
    const jsonData = JSON.stringify(data, null, 2);
    await fs.writeFile(USERS_FILE, jsonData, 'utf8');
  }

  /**
   * Récupérer un utilisateur par son deviceId
   */
  async getUser(deviceId) {
    if (!deviceId) {
      throw new Error('deviceId is required');
    }

    try {
      await this._acquireLock();
      const data = await this._readUsers();
      return data.users[deviceId] || null;
    } finally {
      await this._releaseLock();
    }
  }

  /**
   * Générer une support_key courte à partir du deviceId
   * Format: CT-XXXX-YYYY (ex: CT-8F2A-119B)
   */
  _generateSupportKey(deviceId) {
    const parts = deviceId.split('-');
    const part1 = parts[0].substring(0, 4).toUpperCase();
    const part2 = parts[1].substring(0, 4).toUpperCase();
    return `CT-${part1}-${part2}`;
  }

  /**
   * Créer un nouvel utilisateur
   */
  async createUser(deviceId) {
    if (!deviceId) {
      throw new Error('deviceId is required');
    }

    try {
      await this._acquireLock();
      const data = await this._readUsers();

      // Vérifier si l'utilisateur existe déjà
      if (data.users[deviceId]) {
        return data.users[deviceId];
      }

      // Générer la support_key
      const supportKey = this._generateSupportKey(deviceId);

      // Créer le nouvel utilisateur
      const newUser = {
        deviceId,
        supportKey,
        remainingScans: INITIAL_CREDITS,
        totalScansUsed: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        plan: 'free'
      };

      data.users[deviceId] = newUser;
      await this._writeUsers(data);

      return newUser;
    } finally {
      await this._releaseLock();
    }
  }

  /**
   * Décrémenter les crédits d'un utilisateur
   */
  async decrementCredits(deviceId) {
    if (!deviceId) {
      throw new Error('deviceId is required');
    }

    try {
      await this._acquireLock();
      const data = await this._readUsers();

      const user = data.users[deviceId];
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      if (user.remainingScans <= 0) {
        throw new Error('QUOTA_EXCEEDED');
      }

      // Décrémenter les crédits
      user.remainingScans -= 1;
      user.totalScansUsed += 1;
      user.lastUsedAt = new Date().toISOString();

      data.users[deviceId] = user;
      await this._writeUsers(data);

      return user.remainingScans;
    } finally {
      await this._releaseLock();
    }
  }

  /**
   * Ajouter des crédits à un utilisateur (pour achats futurs)
   */
  async addCredits(deviceId, amount) {
    if (!deviceId) {
      throw new Error('deviceId is required');
    }

    if (!amount || amount <= 0) {
      throw new Error('amount must be positive');
    }

    try {
      await this._acquireLock();
      const data = await this._readUsers();

      const user = data.users[deviceId];
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Ajouter les crédits
      user.remainingScans += amount;
      user.lastUsedAt = new Date().toISOString();

      data.users[deviceId] = user;
      await this._writeUsers(data);

      return user.remainingScans;
    } finally {
      await this._releaseLock();
    }
  }

  /**
   * Obtenir les statistiques globales (pour debug)
   */
  async getStats() {
    try {
      await this._acquireLock();
      const data = await this._readUsers();
      const users = Object.values(data.users);

      return {
        totalUsers: users.length,
        totalScansUsed: users.reduce((sum, u) => sum + u.totalScansUsed, 0),
        totalRemainingScans: users.reduce((sum, u) => sum + u.remainingScans, 0)
      };
    } finally {
      await this._releaseLock();
    }
  }

    /**
   * Acquérir un lock sur le fichier users.json
   */
  async _acquireLock(maxRetries = 10, retryDelay = 100) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Tenter de créer le fichier lock
        await fs.writeFile(LOCK_FILE, Date.now().toString(), { flag: 'wx' });
        this.lockActive = true;
        return true;
      } catch (error) {
        if (error.code === 'EEXIST') {
          // Lock déjà présent, vérifier s'il est périmé (> 5 secondes)
          try {
            const stats = await fs.stat(LOCK_FILE);
            const lockAge = Date.now() - stats.mtimeMs;

            if (lockAge > 5000) {
              // Lock périmé, le supprimer
              await fs.unlink(LOCK_FILE).catch(() => {});
              continue;
            }
          } catch (statError) {
            // Lock n'existe plus, réessayer
            continue;
          }

          // Attendre avant de réessayer
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
  async _releaseLock() {
    if (this.lockActive) {
      try {
        await fs.unlink(LOCK_FILE);
        this.lockActive = false;
      } catch (error) {
        // Lock déjà supprimé, pas grave
      }
    }
  }
}

module.exports = new UserService();
