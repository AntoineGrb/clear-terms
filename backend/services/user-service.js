const dbService = require('./db-service');

const INITIAL_CREDITS = 20;

/**
 * Service de gestion des utilisateurs et de leurs crédits
 * Utilise db-service pour gérer le stockage (local ou JsonSilo)
 */
class UserService {
  /**
   * Lire les données utilisateurs (via db-service)
   */
  async _readUsers() {
    return await dbService.readUsers();
  }

  /**
   * Écrire les données utilisateurs (via db-service)
   */
  async _writeUsers(data) {
    await dbService.writeUsers(data);
  }

  /**
   * Récupérer un utilisateur par son deviceId
   */
  async getUser(deviceId) {
    if (!deviceId) {
      throw new Error('deviceId is required');
    }

    try {
      await dbService.acquireLock();
      const data = await this._readUsers();
      return data.users[deviceId] || null;
    } finally {
      await dbService.releaseLock();
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
      await dbService.acquireLock();
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
      await dbService.releaseLock();
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
      await dbService.acquireLock();
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
      await dbService.releaseLock();
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
      await dbService.acquireLock();
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
      await dbService.releaseLock();
    }
  }

  /**
   * Obtenir les statistiques globales (pour debug)
   */
  async getStats() {
    try {
      await dbService.acquireLock();
      const data = await this._readUsers();
      const users = Object.values(data.users);

      return {
        totalUsers: users.length,
        totalScansUsed: users.reduce((sum, u) => sum + u.totalScansUsed, 0),
        totalRemainingScans: users.reduce((sum, u) => sum + u.remainingScans, 0)
      };
    } finally {
      await dbService.releaseLock();
    }
  }
}

module.exports = new UserService();
