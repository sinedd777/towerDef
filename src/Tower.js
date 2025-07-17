import * as THREE from 'three';
import { Projectile } from './Projectile.js';
import { TOWER_TYPES } from './TowerTypes.js';

export class Tower {
    constructor(x, y, z, type = 'basic') {
        const towerConfig = TOWER_TYPES[type.toUpperCase()];
        
        this.position = new THREE.Vector3(x, y, z);
        this.range = towerConfig.range;
        this.damage = towerConfig.damage;
        this.fireRate = towerConfig.fireRate;
        this.type = type;
        this.lastShotTime = 0;
        
        // Create tower mesh
        this.mesh = new THREE.Mesh(
            towerConfig.model.base.geometry,
            towerConfig.model.base.material.clone()
        );
        // Adjust vertical position so tower base sits on top of block (block top ≈ 0.5)
        // The cylinder geometry is centered, so half its height is 0.5 ⇒ bottom = center - 0.5
        // To align bottom with 0.5, set mesh center y to 1.0
        this.position.y = 1.0; // Override y to ensure correct placement
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        
        // Create range indicator
        const rangeGeometry = new THREE.RingGeometry(this.range - 0.1, this.range, 32);
        const rangeMaterial = new THREE.MeshBasicMaterial({ 
            color: towerConfig.color, 
            transparent: true, 
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        this.rangeIndicator = new THREE.Mesh(rangeGeometry, rangeMaterial);
        this.rangeIndicator.rotation.x = -Math.PI / 2;
        // Keep range indicator almost at ground level (y≈0.01)
        const groundOffset = 0.01 - this.position.y;
        this.rangeIndicator.position.set(0, groundOffset, 0);
        this.mesh.add(this.rangeIndicator);
        
        // Create barrel (except for area tower)
        if (this.type !== 'area') {
            this.barrel = new THREE.Mesh(
                towerConfig.model.barrel.geometry,
                towerConfig.model.barrel.material.clone()
            );
            this.barrel.position.set(0, 0.4, 0);
            this.mesh.add(this.barrel);
        }
        
        // For area tower, create pulse effect
        if (this.type === 'area') {
            this.pulseEffect = new THREE.Mesh(
                new THREE.CircleGeometry(this.range, 32),
                new THREE.MeshBasicMaterial({
                    color: towerConfig.color,
                    transparent: true,
                    opacity: 0.0,
                    side: THREE.DoubleSide
                })
            );
            this.pulseEffect.rotation.x = -Math.PI / 2;
            this.pulseEffect.position.set(0, -0.48, 0);
            this.mesh.add(this.pulseEffect);
            
            // Add glow effect
            const glowGeometry = new THREE.CircleGeometry(this.range * 0.8, 32);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: towerConfig.color,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide
            });
            this.glowEffect = new THREE.Mesh(glowGeometry, glowMaterial);
            this.glowEffect.rotation.x = -Math.PI / 2;
            this.glowEffect.position.set(0, -0.47, 0);
            this.mesh.add(this.glowEffect);
        }
        
        this.currentTarget = null;
    }
    
    findTarget(enemies) {
        if (this.type === 'area') {
            // Area tower doesn't need to find specific target
            return enemies.length > 0 ? enemies[0] : null;
        }
        
        let closestEnemy = null;
        let closestDistance = Infinity;
        
        for (const enemy of enemies) {
            if (!enemy.isAlive()) continue;
            
            const distance = this.position.distanceTo(enemy.getPosition());
            
            if (distance <= this.range && distance < closestDistance) {
                closestDistance = distance;
                closestEnemy = enemy;
            }
        }
        
        this.currentTarget = closestEnemy;
        
        // Rotate barrel towards target (except for area tower)
        if (this.currentTarget && this.type !== 'area') {
            const targetPos = this.currentTarget.getPosition();
            const direction = new THREE.Vector3().subVectors(targetPos, this.position);
            direction.y = 0; // Keep barrel horizontal
            direction.normalize();
            
            const angle = Math.atan2(direction.x, direction.z);
            this.barrel.rotation.y = angle;
        }
        
        return this.currentTarget;
    }
    
    shoot(target) {
        if (!this.canShoot()) return null;
        
        this.lastShotTime = Date.now();
        
        if (this.type === 'area') {
            // Pulse attack for area tower
            const enemies = target; // In this case, target is the enemies array
            const deadEnemies = [];
            
            for (const enemy of enemies) {
                const distance = this.position.distanceTo(enemy.getPosition());
                if (distance <= this.range) {
                    enemy.takeDamage(this.damage);
                    
                    if (!enemy.isAlive()) {
                        deadEnemies.push(enemy);
                    }
                }
            }
            
            // Animate pulse effect
            const pulseAnimation = () => {
                const startOpacity = 0.5;
                const duration = 500; // ms
                const startTime = Date.now();
                
                const animate = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    
                    this.pulseEffect.material.opacity = startOpacity * (1 - progress);
                    
                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    }
                };
                
                this.pulseEffect.material.opacity = startOpacity;
                animate();
            };
            
            pulseAnimation();
            return deadEnemies;
        }
        
        // Regular projectile for other towers
        const barrelTip = new THREE.Vector3(0, 0.8, 0);
        const worldBarrelTip = barrelTip.clone();
        this.mesh.localToWorld(worldBarrelTip);
        
        // Create projectile
        const projectile = new Projectile(
            worldBarrelTip,
            target,
            this.damage,
            this.type === 'area' ? this.range : 0
        );
        
        return projectile;
    }
    
    canShoot() {
        return Date.now() - this.lastShotTime > (1000 / this.fireRate);
    }
    
    getPosition() {
        return this.position;
    }
    
    showRangeIndicator() {
        this.rangeIndicator.visible = true;
    }
    
    hideRangeIndicator() {
        this.rangeIndicator.visible = false;
    }
} 