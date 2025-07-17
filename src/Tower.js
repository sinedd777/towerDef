import * as THREE from 'three';
import { Projectile } from './Projectile.js';
import { TOWER_TYPES } from './TowerTypes.js';
import { assetManager } from './managers/AssetManager.js';
import { objectPool } from './managers/ObjectPool.js';

export class Tower {
    constructor(x, y, z, type = 'basic') {
        const towerConfig = TOWER_TYPES[type.toUpperCase()];
        
        this.position = new THREE.Vector3(x, y, z);
        this.range = towerConfig.range;
        this.damage = towerConfig.damage;
        this.fireRate = towerConfig.fireRate;
        this.type = type;
        this.lastShotTime = 0;
        
        // Create tower mesh as a group
        this.mesh = new THREE.Group();
        this.mesh.castShadow = true;
        this.isModelLoaded = false;
        
        // Adjust vertical position so tower base sits on top of block (block top ≈ 0.5)
        this.position.y = 0.5; // Place tower directly on block surface
        this.mesh.position.copy(this.position);
        
        // Load the modular tower model
        this.loadTowerModel(type).then((towerModel) => {
            if (towerModel) {
                // Enhance model materials for better appearance
                this.enhanceModelMaterials(towerModel);
                
                this.mesh.add(towerModel);
                this.isModelLoaded = true;
                
                // Store weapon reference for targeting rotation
                // For area towers, no weapon rotation needed
                if (this.type !== 'area') {
                    // The weapon is typically the last or highest positioned child
                    // Find the child with the highest Y position (weapon on top)
                    this.weaponMesh = null;
                    let highestY = -Infinity;
                    
                    towerModel.children.forEach(child => {
                        if (child.position.y > highestY) {
                            highestY = child.position.y;
                            this.weaponMesh = child;
                        }
                    });
                    
                    // If we found a weapon, set up a separate rotation group
                    if (this.weaponMesh) {
                        // Create a rotation wrapper for the weapon
                        this.weaponRotationGroup = new THREE.Group();
                        
                        // Store original weapon position
                        const originalPosition = this.weaponMesh.position.clone();
                        
                        // Remove weapon from tower model and add to rotation group
                        towerModel.remove(this.weaponMesh);
                        this.weaponRotationGroup.add(this.weaponMesh);
                        
                        // Reset weapon position relative to rotation group
                        this.weaponMesh.position.set(0, 0, 0);
                        
                        // Position the rotation group where the weapon was
                        this.weaponRotationGroup.position.copy(originalPosition);
                        
                        // Add rotation group back to tower model
                        towerModel.add(this.weaponRotationGroup);
                    }
                }
            }
        }).catch((error) => {
            console.error('Failed to load tower model, using fallback:', error);
            this.createFallbackMesh(towerConfig);
        });
        
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
        
        // Weapon mesh will be part of the loaded tower model
        this.weaponMesh = null;
        this.weaponRotationGroup = null;
        
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
        
        // Rotate weapon towards target (except for area tower)
        if (this.currentTarget && this.type !== 'area' && this.weaponRotationGroup) {
            const targetPos = this.currentTarget.getPosition();
            const direction = new THREE.Vector3().subVectors(targetPos, this.position);
            direction.y = 0; // Keep weapon horizontal
            direction.normalize();
            
            const angle = Math.atan2(direction.x, direction.z);
            this.weaponRotationGroup.rotation.y = angle;
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
        let worldBarrelTip;
        
        if (this.weaponRotationGroup) {
            // Calculate projectile spawn from weapon position
            const weaponWorldPosition = new THREE.Vector3();
            this.weaponRotationGroup.getWorldPosition(weaponWorldPosition);
            
            // Add a small forward offset in the direction the weapon is facing
            const weaponDirection = new THREE.Vector3(0, 0, 1);
            weaponDirection.applyQuaternion(this.weaponRotationGroup.getWorldQuaternion(new THREE.Quaternion()));
            weaponDirection.multiplyScalar(0.3); // Forward offset
            
            worldBarrelTip = weaponWorldPosition.add(weaponDirection);
        } else {
            // Fallback to fixed position for area towers or if weapon not found
            const barrelTip = new THREE.Vector3(0, 0.3, 0);
            worldBarrelTip = barrelTip.clone();
            this.mesh.localToWorld(worldBarrelTip);
        }
        
        // Create projectile using object pool
        const projectile = objectPool.getProjectile(
            worldBarrelTip,
            target,
            this.damage,
            this.type === 'area' ? this.range : 0,
            this.type
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
    
    async loadTowerModel(towerType) {
        try {
            const towerModel = await assetManager.createTowerModel(towerType);
            return towerModel;
        } catch (error) {
            console.error('Failed to load tower model for type', towerType, ':', error);
            return null;
        }
    }
    
    createFallbackMesh(towerConfig) {
        // Create fallback cylinder geometry if 3D model loading fails
        console.warn('Using fallback geometry for tower');
        
        const fallbackMesh = new THREE.Mesh(
            towerConfig.model.base.geometry,
            towerConfig.model.base.material.clone()
        );
        fallbackMesh.castShadow = true;
        
        // Create barrel for non-area towers
        if (this.type !== 'area') {
            this.weaponMesh = new THREE.Mesh(
                towerConfig.model.barrel.geometry,
                towerConfig.model.barrel.material.clone()
            );
            
            // Create rotation group for weapon
            this.weaponRotationGroup = new THREE.Group();
            this.weaponRotationGroup.position.set(0, 0.4, 0);
            this.weaponRotationGroup.add(this.weaponMesh);
            fallbackMesh.add(this.weaponRotationGroup);
        }
        
        // Clear the group and add fallback mesh
        this.mesh.clear();
        this.mesh.add(fallbackMesh);
        this.isModelLoaded = true;
    }
    
    enhanceModelMaterials(model) {
        // Enhance materials for better appearance
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        this.enhanceSingleMaterial(mat);
                    });
                } else {
                    this.enhanceSingleMaterial(child.material);
                }
            }
        });
    }
    
    enhanceSingleMaterial(material) {
        // Improve material properties for better lighting
        material.roughness = 0.3;
        material.metalness = 0.1;
        
        // Ensure materials respond to lighting
        if (material.color) {
            material.color.multiplyScalar(1.2); // Brighten colors slightly
        }
        
        // Add slight emissive glow for visibility
        if (!material.emissive) {
            material.emissive = new THREE.Color(0x111111);
        }
        
        material.needsUpdate = true;
    }
} 