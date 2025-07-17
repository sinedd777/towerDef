import * as THREE from 'three';
import { assetManager } from './managers/AssetManager.js';

export class Projectile {
    constructor(startPosition, target, damage, splashRadius = 0, towerType = 'basic') {
        this.target = target;
        this.damage = damage;
        this.splashRadius = splashRadius;
        this.towerType = towerType;
        this.speed = 8.0; // units per second
        this.maxDistance = 15.0; // Maximum travel distance before removal
        this.traveledDistance = 0;
        this.isModelLoaded = false;
        
        // Create projectile mesh as a group
        this.mesh = new THREE.Group();
        this.mesh.position.copy(startPosition);
        
        // Load weapon-specific projectile model
        this.loadProjectileModel(towerType).then((projectileModel) => {
            if (projectileModel) {
                // Scale down the projectile for appropriate size
                const scale = 0.6;
                projectileModel.scale.set(scale, scale, scale);
                
                this.mesh.add(projectileModel);
                this.isModelLoaded = true;
            }
        }).catch((error) => {
            console.error('Failed to load projectile model, using fallback:', error);
            this.createFallbackMesh();
        });
        
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
        
        // Orient projectile in direction of travel if model is loaded
        if (this.isModelLoaded && this.mesh.children.length > 0) {
            // Calculate orientation based on direction
            const targetDirection = this.direction.clone().normalize();
            
            // Different orientation based on projectile type
            switch (this.towerType) {
                case 'sniper':
                    // Arrows point forward
                    this.mesh.lookAt(this.mesh.position.clone().add(targetDirection));
                    break;
                case 'area':
                    // Boulders tumble
                    this.mesh.rotation.x += deltaTime * 4;
                    this.mesh.rotation.z += deltaTime * 3;
                    break;
                case 'basic':
                case 'rapid':
                default:
                    // Bullets spin along travel axis
                    this.mesh.lookAt(this.mesh.position.clone().add(targetDirection));
                    this.mesh.rotateZ(deltaTime * 10);
                    break;
            }
        } else {
            // Fallback rotation for basic spheres
            this.mesh.rotation.x += deltaTime * 5;
            this.mesh.rotation.y += deltaTime * 3;
        }
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
    
    async loadProjectileModel(towerType) {
        try {
            const projectileModel = await assetManager.getProjectileModel(towerType);
            return projectileModel;
        } catch (error) {
            console.error('Failed to load projectile model for tower type', towerType, ':', error);
            return null;
        }
    }
    
    createFallbackMesh() {
        // Create fallback sphere geometry if 3D model loading fails
        console.warn('Using fallback geometry for projectile');
        
        const geometry = new THREE.SphereGeometry(0.1, 6, 4);
        const material = new THREE.MeshBasicMaterial({ 
            color: this.splashRadius > 0 ? 0xff00ff : 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        
        const fallbackMesh = new THREE.Mesh(geometry, material);
        
        // Clear the group and add fallback mesh
        this.mesh.clear();
        this.mesh.add(fallbackMesh);
        this.isModelLoaded = true;
    }
    
    reset(startPosition, target, damage, splashRadius = 0, towerType = 'basic') {
        // Reset all properties for object pooling
        this.target = target;
        this.damage = damage;
        this.splashRadius = splashRadius;
        this.towerType = towerType;
        this.traveledDistance = 0;
        
        // Reset position and direction
        this.mesh.position.copy(startPosition);
        this.startPosition = startPosition.clone();
        this.updateDirection();
        
        // Reset trail points
        this.trailPoints = [];
        
        // Reset rotation
        this.mesh.rotation.set(0, 0, 0);
        
        // If the model type changed, reload the appropriate model
        if (!this.isModelLoaded || this.lastTowerType !== towerType) {
            this.lastTowerType = towerType;
            this.loadProjectileModel(towerType).then((projectileModel) => {
                if (projectileModel) {
                    // Clear existing model and add new one
                    this.mesh.clear();
                    
                    const scale = 0.6;
                    projectileModel.scale.set(scale, scale, scale);
                    this.mesh.add(projectileModel);
                    this.isModelLoaded = true;
                    
                    // Re-add trail if it exists
                    if (this.trail) {
                        this.mesh.add(this.trail);
                    }
                }
            }).catch(() => {
                this.createFallbackMesh();
            });
        }
    }
    
    cleanup() {
        // Reset for pooling without disposing geometry/materials
        this.target = null;
        this.traveledDistance = 0;
        this.trailPoints = [];
        this.mesh.position.set(0, 0, 0);
        this.mesh.rotation.set(0, 0, 0);
        
        // Reset trail geometry
        if (this.trail && this.trail.geometry) {
            const positions = this.trail.geometry.attributes.position.array;
            positions.fill(0);
            this.trail.geometry.attributes.position.needsUpdate = true;
        }
    }
    
    dispose() {
        // Complete disposal for memory cleanup
        if (this.trail) {
            if (this.trail.geometry) this.trail.geometry.dispose();
            if (this.trail.material) this.trail.material.dispose();
            this.mesh.remove(this.trail);
            this.trail = null;
        }
        
        // Dispose of mesh children
        this.mesh.children.forEach(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        
        this.mesh.clear();
        this.target = null;
        this.trailPoints = [];
    }
} 