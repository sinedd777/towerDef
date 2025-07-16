import * as THREE from 'three';

export class Projectile {
    constructor(startPosition, target, damage) {
        this.target = target;
        this.damage = damage;
        this.speed = 8.0; // units per second
        this.maxDistance = 15.0; // Maximum travel distance before removal
        this.traveledDistance = 0;
        
        // Create projectile mesh (small yellow sphere)
        const geometry = new THREE.SphereGeometry(0.1, 6, 4);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
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
            // Predict target position based on enemy movement
            const targetPos = this.target.getPosition().clone();
            
            // Simple prediction: assume enemy continues in current direction
            if (this.target.direction) {
                const timeToHit = this.mesh.position.distanceTo(targetPos) / this.speed;
                const predictedOffset = this.target.direction.clone().multiplyScalar(this.target.speed * timeToHit);
                targetPos.add(predictedOffset);
            }
            
            this.direction.subVectors(targetPos, this.mesh.position).normalize();
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
    
    getDamage() {
        return this.damage;
    }
} 