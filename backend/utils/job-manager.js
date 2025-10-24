/**
 * Gestionnaire de jobs avec protection contre les fuites mémoire
 * Limite le nombre de jobs en mémoire et nettoie automatiquement les anciens
 */
class JobManager {
  constructor(maxJobs = 1000, maxAge = 60 * 60 * 1000) {
    this.jobs = new Map();
    this.maxJobs = maxJobs;
    this.maxAge = maxAge;

    // Nettoyage périodique toutes les 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Ajoute un job avec vérification de taille
   */
  addJob(id, jobData) {
    // Vérifier la limite avant d'ajouter
    if (this.jobs.size >= this.maxJobs) {
      console.warn(`⚠️ Job limit reached (${this.maxJobs}), cleaning up old jobs...`);
      this.cleanup(true); // Force cleanup

      // Si toujours trop, supprimer les plus vieux
      if (this.jobs.size >= this.maxJobs) {
        this.removeOldest(Math.floor(this.maxJobs * 0.1)); // Supprimer 10%
      }
    }

    this.jobs.set(id, {
      ...jobData,
      createdAt: Date.now()
    });

    console.log(`📊 [JOB MANAGER] Jobs actifs: ${this.jobs.size}/${this.maxJobs}`);
  }

  getJob(id) {
    return this.jobs.get(id);
  }

  updateJob(id, updates) {
    const job = this.jobs.get(id);
    if (job) {
      this.jobs.set(id, { ...job, ...updates });
    }
  }

  deleteJob(id) {
    return this.jobs.delete(id);
  }

  /**
   * Nettoie les jobs expirés
   */
  cleanup(force = false) {
    const cutoff = Date.now() - this.maxAge;
    let deletedCount = 0;

    for (const [id, job] of this.jobs) {
      if (job.createdAt < cutoff || (force && job.status === 'done')) {
        this.jobs.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 [JOB MANAGER] Cleaned up ${deletedCount} old jobs`);
    }

    return deletedCount;
  }

  /**
   * Supprime les N jobs les plus anciens
   */
  removeOldest(count) {
    const sorted = Array.from(this.jobs.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, count);

    sorted.forEach(([id]) => this.jobs.delete(id));

    console.warn(`🚨 [JOB MANAGER] Force removed ${count} oldest jobs to free memory`);
  }

  /**
   * Statistiques pour monitoring
   */
  getStats() {
    const statuses = { pending: 0, running: 0, done: 0, error: 0 };

    for (const job of this.jobs.values()) {
      statuses[job.status] = (statuses[job.status] || 0) + 1;
    }

    return {
      total: this.jobs.size,
      max: this.maxJobs,
      usage: `${((this.jobs.size / this.maxJobs) * 100).toFixed(1)}%`,
      statuses
    };
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

module.exports = JobManager;
