import * as THREE from 'three';

export class Projectile {
    constructor(startPosition, target, damage, splashRadius = 0) {
        this.target = target;
        this.damage = damage;
        this.splashRadius = splashRadius;
        this.speed = 8.0; // units per second
        this.maxDistance = 15.0; // Maximum travel distance before removal
        this.traveledDistance = 0;
        
        // Create projectile mesh (small yellow sphere)
        const geometry = new THREE.SphereGeometry(0.1, 6, 4);
        const material = new THREE.MeshBasicMaterial({ 
            color: this.splashRadius > 0 ? 0xff00ff : 0xffff00 
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(startPosition);
        
        // Store starting position for distance calculation
        this.startPosition = startPosition.clone();
        
        // Calculate initial direction to target
        this.direction = new THREE.Vector3();
        this.updateDirection();
    }
    
    updateDirection() {
        if (this.target && this.target.isAlive()) {
            this.direction.subVectors(this.target.getPosition(), this.mesh.position).normalize();
        }
    }
    
    update() {
        const deltaTime = 0.016; // Approximately 60 FPS
        
        // Update direction towards target (basic homing)
        this.updateDirection();
        
        // Move projectile
        const movement = this.direction.clone().multiplyScalar(this.speed * deltaTime);
        this.mesh.position.add(movement);
        
        // Update traveled distance
        this.traveledDistance = this.mesh.position.distanceTo(this.startPosition);
    }
    
    hasHitTarget() {
        if (!this.target || !this.target.isAlive()) {
            return false;
        }
        
        const distanceToTarget = this.mesh.position.distanceTo(this.target.getPosition());
        return distanceToTarget < 0.3; // Hit radius
    }
    
    shouldRemove() {
        // Remove if traveled too far or target is dead
        return this.traveledDistance > this.maxDistance || 
               (this.target && !this.target.isAlive());
    }
    
    getPosition() {
        return this.mesh.position;
    }
    
    // New method to handle splash damage
    getSplashTargets(enemies) {
        if (this.splashRadius <= 0) return [];
        
        const position = this.getPosition();
        return enemies.filter(enemy => {
            if (!enemy.isAlive() || enemy === this.target) return false;
            const distance = position.distanceTo(enemy.getPosition());
            return distance <= this.splashRadius;
        });
    }
} 