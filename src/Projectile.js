import * as THREE from 'three';

export class Projectile {
    constructor(startPosition, target, damage, splashRadius = 0) {
        this.target = target;
        this.damage = damage;
        this.splashRadius = splashRadius;
        this.speed = 8.0; // units per second
        this.maxDistance = 15.0; // Maximum travel distance before removal
        this.traveledDistance = 0;
        
        // Create projectile mesh
        const geometry = new THREE.SphereGeometry(0.1, 6, 4);
        const material = new THREE.MeshBasicMaterial({ 
            color: this.splashRadius > 0 ? 0xff00ff : 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(startPosition);
        
        // Store starting position for distance calculation
        this.startPosition = startPosition.clone();
        
        // Calculate initial direction to target
        this.direction = new THREE.Vector3();
        this.updateDirection();
        
        // Trail points for particle effect
        this.trailPoints = [];
        this.maxTrailPoints = 10;
        
        // Setup trail effect
        this.setupTrailEffect();
    }
    
    setupTrailEffect() {
        // Create trail geometry
        const trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(this.maxTrailPoints * 3);
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        
        // Create trail material
        const trailMaterial = new THREE.LineBasicMaterial({
            color: this.splashRadius > 0 ? 0xff00ff : 0xffff00,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        
        // Create trail mesh
        this.trail = new THREE.Line(trailGeometry, trailMaterial);
        this.mesh.add(this.trail);
    }
    
    updateTrail() {
        if (!this.trail) return;
        
        // Add current position to trail points
        this.trailPoints.unshift(this.mesh.position.clone());
        
        // Remove old points if we exceed maxTrailPoints
        if (this.trailPoints.length > this.maxTrailPoints) {
            this.trailPoints.pop();
        }
        
        // Update trail geometry
        const positions = this.trail.geometry.attributes.position.array;
        for (let i = 0; i < this.trailPoints.length; i++) {
            const point = this.trailPoints[i];
            positions[i * 3] = point.x - this.mesh.position.x;
            positions[i * 3 + 1] = point.y - this.mesh.position.y;
            positions[i * 3 + 2] = point.z - this.mesh.position.z;
        }
        
        this.trail.geometry.attributes.position.needsUpdate = true;
        
        // Fade out trail points
        for (let i = 0; i < this.trailPoints.length; i++) {
            const opacity = 1 - (i / this.maxTrailPoints);
            this.trail.material.opacity = opacity * 0.5;
        }
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
        
        // Update trail effect
        this.updateTrail();
        
        // Update traveled distance
        this.traveledDistance = this.mesh.position.distanceTo(this.startPosition);
        
        // Rotate projectile for visual effect
        this.mesh.rotation.x += deltaTime * 5;
        this.mesh.rotation.y += deltaTime * 3;
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
    
    getSplashTargets(enemies) {
        if (this.splashRadius <= 0) return [];
        
        const position = this.getPosition();
        return enemies.filter(enemy => {
            if (!enemy.isAlive() || enemy === this.target) return false;
            const distance = position.distanceTo(enemy.getPosition());
            return distance <= this.splashRadius;
        });
    }
    
    applyDamage(enemy) {
        if (!enemy.isAlive()) return 0;
        enemy.takeDamage(this.damage);
        return this.damage;
    }
    
    createImpactEffect() {
        const impactGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const impactMaterial = new THREE.MeshBasicMaterial({
            color: this.splashRadius > 0 ? 0xff00ff : 0xffff00,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        const impact = new THREE.Mesh(impactGeometry, impactMaterial);
        impact.position.copy(this.mesh.position);
        
        // Animate impact effect
        const startScale = 0.1;
        const endScale = this.splashRadius > 0 ? this.splashRadius : 0.5;
        const duration = 300; // ms
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const scale = startScale + (endScale - startScale) * progress;
            impact.scale.set(scale, scale, scale);
            impact.material.opacity = 0.8 * (1 - progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                impact.parent.remove(impact);
            }
        };
        
        animate();
        return impact;
    }
} 