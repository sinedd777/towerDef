import { Projectile } from '../Projectile.js';

export class ObjectPool {
    constructor() {
        this.projectilePool = [];
        this.activeProjectiles = [];
        this.maxPoolSize = 50; // Maximum number of pooled objects
    }

    /**
     * Get a projectile from the pool or create a new one
     * @param {THREE.Vector3} startPosition - Starting position
     * @param {Object} target - Target object
     * @param {number} damage - Damage amount
     * @param {number} splashRadius - Splash damage radius
     * @param {string} towerType - Tower type for model selection
     * @returns {Projectile} - Projectile instance
     */
    getProjectile(startPosition, target, damage, splashRadius = 0, towerType = 'basic') {
        let projectile;
        
        if (this.projectilePool.length > 0) {
            // Reuse existing projectile
            projectile = this.projectilePool.pop();
            projectile.reset(startPosition, target, damage, splashRadius, towerType);
        } else {
            // Create new projectile
            projectile = new Projectile(startPosition, target, damage, splashRadius, towerType);
        }
        
        this.activeProjectiles.push(projectile);
        return projectile;
    }

    /**
     * Return a projectile to the pool
     * @param {Projectile} projectile - Projectile to return
     */
    returnProjectile(projectile) {
        const index = this.activeProjectiles.indexOf(projectile);
        if (index !== -1) {
            this.activeProjectiles.splice(index, 1);
            
            // Only add to pool if we haven't exceeded max size
            if (this.projectilePool.length < this.maxPoolSize) {
                projectile.cleanup();
                this.projectilePool.push(projectile);
            } else {
                // Dispose of excess projectiles
                projectile.dispose();
            }
        }
    }

    /**
     * Get all active projectiles
     * @returns {Array} - Array of active projectiles
     */
    getActiveProjectiles() {
        return this.activeProjectiles;
    }

    /**
     * Update all active projectiles
     */
    updateActiveProjectiles() {
        for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
            const projectile = this.activeProjectiles[i];
            projectile.update();
            
            // Check if projectile should be removed
            const hit = projectile.hasHitTarget();
            const shouldRemove = hit || projectile.shouldRemove();
            
            if (shouldRemove) {
                this.returnProjectile(projectile);
            }
        }
    }

    /**
     * Get pool statistics
     * @returns {Object} - Pool statistics
     */
    getStats() {
        return {
            pooled: this.projectilePool.length,
            active: this.activeProjectiles.length,
            total: this.projectilePool.length + this.activeProjectiles.length,
            maxPoolSize: this.maxPoolSize
        };
    }

    /**
     * Clear all pooled and active objects
     */
    clear() {
        // Dispose of all pooled projectiles
        for (const projectile of this.projectilePool) {
            projectile.dispose();
        }
        this.projectilePool = [];
        
        // Dispose of all active projectiles
        for (const projectile of this.activeProjectiles) {
            projectile.dispose();
        }
        this.activeProjectiles = [];
    }

    /**
     * Adjust pool size for memory management
     * @param {number} newSize - New maximum pool size
     */
    setMaxPoolSize(newSize) {
        this.maxPoolSize = newSize;
        
        // If current pool is larger than new size, dispose excess
        while (this.projectilePool.length > this.maxPoolSize) {
            const projectile = this.projectilePool.pop();
            projectile.dispose();
        }
    }
}

// Export singleton instance
export const objectPool = new ObjectPool(); 