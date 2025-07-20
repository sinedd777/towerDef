import * as THREE from 'three';
import { Projectile } from './Projectile.js';
import { TOWER_TYPES, calculateUpgradedStats, calculateUpgradeCost, calculateRefundAmount } from './TowerTypes.js';
import { assetManager } from './managers/AssetManager.js';
import { objectPool } from './managers/ObjectPool.js';

export class Tower {
    constructor(x, y, z, type = 'basic') {
        const towerConfig = TOWER_TYPES[type.toUpperCase()];
        
        this.position = new THREE.Vector3(x, y, z);
        this.type = type;
        this.level = 1; // Start at level 1
        this.lastShotTime = 0;
        
        // Calculate initial stats based on level
        this.updateStatsFromLevel();
        
        // Selection state for tower management
        this.isSelected = false;
        this.selectionRing = null;
        
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
                // Setup weapon/crystal rotation for all tower types
                // For area towers: crystal rotates when enemies in range (crystal = highest part)
                // For other towers: weapon rotates to track enemies (weapon = highest part)
                this.weaponMesh = null;
                let highestY = -Infinity;
                
                towerModel.children.forEach(child => {
                    if (child.position.y > highestY) {
                        highestY = child.position.y;
                        this.weaponMesh = child; // For area towers, this will be the crystal
                    }
                });
                
                // If we found a weapon/crystal, set up a separate rotation group
                if (this.weaponMesh) {
                    // Create a rotation wrapper for the weapon/crystal
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
        
        // Rotate weapon towards target (non-area towers)
        if (this.currentTarget && this.type !== 'area' && this.weaponRotationGroup) {
            const targetPos = this.currentTarget.getPosition();
            const direction = new THREE.Vector3().subVectors(targetPos, this.position);
            direction.y = 0; // Keep weapon horizontal
            direction.normalize();
            
            const angle = Math.atan2(direction.x, direction.z);
            this.weaponRotationGroup.rotation.y = angle;
        }
        
        // For area towers, rotate crystal when enemies are in range
        if (this.type === 'area' && this.weaponRotationGroup) {
            const hasEnemiesInRange = enemies.some(enemy => 
                enemy.isAlive() && this.position.distanceTo(enemy.getPosition()) <= this.range
            );
            
            if (hasEnemiesInRange) {
                // Store animation state if not exists
                if (this.crystalRotationSpeed === undefined) {
                    this.crystalRotationSpeed = 0;
                    this.targetRotationSpeed = 0.05; // Target rotation speed
                }
                
                // Accelerate rotation when enemies are in range
                this.crystalRotationSpeed += (this.targetRotationSpeed - this.crystalRotationSpeed) * 0.1;
                this.weaponRotationGroup.rotation.y += this.crystalRotationSpeed;
            } else {
                // Decelerate when no enemies in range
                if (this.crystalRotationSpeed !== undefined) {
                    this.crystalRotationSpeed *= 0.95; // Gradual slowdown
                    this.weaponRotationGroup.rotation.y += this.crystalRotationSpeed;
                    
                    // Stop rotation when speed is very low
                    if (this.crystalRotationSpeed < 0.001) {
                        this.crystalRotationSpeed = 0;
                    }
                }
            }
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
            if (towerModel) {
                // Keep towers on default layer (0) for bright light
                towerModel.traverse((child) => {
                    if (child.isMesh) {
                        child.layers.set(0);  // Use default layer
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Apply enhanced materials
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(mat => {
                                const enhancedMat = mat.clone();
                                this.enhanceSingleMaterial(enhancedMat);
                                return enhancedMat;
                            });
                        } else {
                            const enhancedMat = child.material.clone();
                            this.enhanceSingleMaterial(enhancedMat);
                            child.material = enhancedMat;
                        }
                    }
                });
                return towerModel;
            }
        } catch (error) {
            console.error('Failed to load tower model for type', towerType, ':', error);
            return null;
        }
    }

    createEnhancedMaterial(originalMaterial) {
        // Create a new material that extends the original
        const newMaterial = originalMaterial.clone();
        
        // Add custom shader chunks for rim lighting
        if (newMaterial.onBeforeCompile) {
            newMaterial.onBeforeCompile = (shader) => {
                shader.fragmentShader = shader.fragmentShader.replace(
                    'void main() {',
                    `
                    varying vec3 vNormal;
                    varying vec3 vViewPosition;
                    
                    float rimStrength = 0.7;
                    float rimPower = 2.0;
                    
                    void main() {
                        // Calculate rim lighting
                        vec3 viewDir = normalize(vViewPosition);
                        float rim = 1.0 - max(0.0, dot(vNormal, viewDir));
                        rim = pow(rim, rimPower) * rimStrength;
                    `
                );
                
                shader.fragmentShader = shader.fragmentShader.replace(
                    'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
                    `
                        outgoingLight += rim * diffuseColor.rgb;
                        gl_FragColor = vec4(outgoingLight, diffuseColor.a);
                    `
                );
            };
        }
        
        return newMaterial;
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
        // Create a more stylized, vibrant look matching the preview images
        material.roughness = 0.1;  // Very low roughness for maximum shine
        material.metalness = 0.7;  // High metalness for strong reflections
        
        // Ensure materials respond to lighting
        if (material.color) {
            // Enhance color saturation and brightness
            const color = material.color;
            const hsl = {};
            color.getHSL(hsl);
            
            // Increase saturation and brightness significantly
            hsl.s = Math.min(1, hsl.s * 1.4); // 40% more saturation
            hsl.l = Math.min(1, hsl.l * 1.3); // 30% more brightness
            
            color.setHSL(hsl.h, hsl.s, hsl.l);
        }
        
        // Add stronger emissive glow for better visibility
        if (!material.emissive) {
            // Use a color-matched emissive glow
            const baseColor = material.color || new THREE.Color(0xffffff);
            const emissiveColor = new THREE.Color()
                .copy(baseColor)
                .multiplyScalar(0.25); // 25% of base color intensity
            material.emissive = emissiveColor;
        }

        // Add strong specular highlights for better definition
        if (material.type === 'MeshPhongMaterial') {
            material.specular = new THREE.Color(0xffffff);
            material.shininess = 100; // Very high shininess for sharp reflections
        }
        
        material.needsUpdate = true;
    }
    
    // Update tower stats based on current level
    updateStatsFromLevel() {
        const stats = calculateUpgradedStats(this.type, this.level);
        if (stats) {
            this.damage = stats.damage;
            this.fireRate = stats.fireRate;
            this.range = stats.range;
            this.splashRadius = stats.splashRadius;
        } else {
            // Fallback to base stats
            const towerConfig = TOWER_TYPES[this.type.toUpperCase()];
            this.damage = towerConfig.damage;
            this.fireRate = towerConfig.fireRate;
            this.range = towerConfig.range;
            this.splashRadius = towerConfig.splashRadius;
        }
    }
    
    // Check if tower can be upgraded
    canUpgrade() {
        const config = TOWER_TYPES[this.type.toUpperCase()];
        return config && config.upgrade && this.level < config.upgrade.maxLevel;
    }
    
    // Get upgrade cost for next level
    getUpgradeCost() {
        return calculateUpgradeCost(this.type, this.level);
    }
    
    // Get refund amount for destroying this tower
    getRefundAmount() {
        return calculateRefundAmount(this.type, this.level);
    }
    
    // Upgrade tower to next level
    upgrade() {
        if (!this.canUpgrade()) {
            return false;
        }
        
        this.level++;
        this.updateStatsFromLevel();
        
        // Update range indicator if it exists
        if (this.rangeIndicator) {
            this.rangeIndicator.geometry.dispose();
            const rangeGeometry = new THREE.RingGeometry(this.range - 0.1, this.range, 32);
            this.rangeIndicator.geometry = rangeGeometry;
        }
        
        // Visual upgrade effect (can be enhanced later)
        this.createUpgradeEffect();
        
        return true;
    }
    
    // Create visual effect when tower is upgraded
    createUpgradeEffect() {
        // Simple particle burst effect
        const particleCount = 20;
        const particles = new THREE.Group();
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 4, 4),
                new THREE.MeshBasicMaterial({ 
                    color: 0xffff00,
                    transparent: true,
                    opacity: 0.8
                })
            );
            
            // Random position around tower
            const angle = (i / particleCount) * Math.PI * 2;
            const radius = 0.5 + Math.random() * 0.5;
            particle.position.set(
                Math.cos(angle) * radius,
                0.5 + Math.random() * 1.0,
                Math.sin(angle) * radius
            );
            
            particles.add(particle);
        }
        
        this.mesh.add(particles);
        
        // Animate particles upward and fade out
        const startTime = Date.now();
        const duration = 1000; // 1 second
        
        const animateParticles = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress < 1) {
                particles.children.forEach((particle, index) => {
                    particle.position.y += 0.02;
                    particle.material.opacity = 0.8 * (1 - progress);
                    particle.rotation.y += 0.1;
                });
                requestAnimationFrame(animateParticles);
            } else {
                // Clean up particles
                this.mesh.remove(particles);
                particles.children.forEach(particle => {
                    particle.geometry.dispose();
                    particle.material.dispose();
                });
            }
        };
        
        animateParticles();
    }
    
    // Set selection state
    setSelected(selected) {
        this.isSelected = selected;
        
        if (selected && !this.selectionRing) {
            // Create selection ring
            const ringGeometry = new THREE.RingGeometry(0.6, 0.8, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            
            this.selectionRing = new THREE.Mesh(ringGeometry, ringMaterial);
            this.selectionRing.rotation.x = -Math.PI / 2;
            this.selectionRing.position.y = 0.02 - this.position.y; // Just above ground
            this.mesh.add(this.selectionRing);
            
            // Animate selection ring
            this.animateSelectionRing();
        } else if (!selected && this.selectionRing) {
            // Remove selection ring
            this.mesh.remove(this.selectionRing);
            this.selectionRing.geometry.dispose();
            this.selectionRing.material.dispose();
            this.selectionRing = null;
        }
    }
    
    // Animate the selection ring
    animateSelectionRing() {
        if (!this.selectionRing || !this.isSelected) return;
        
        const time = Date.now() * 0.003;
        this.selectionRing.material.opacity = 0.3 + 0.3 * Math.sin(time);
        this.selectionRing.rotation.z += 0.01;
        
        requestAnimationFrame(() => this.animateSelectionRing());
    }
    
    // Get tower info for UI display
    getTowerInfo() {
        const config = TOWER_TYPES[this.type.toUpperCase()];
        return {
            type: this.type,
            name: config.name,
            level: this.level,
            maxLevel: config.upgrade ? config.upgrade.maxLevel : 1,
            damage: this.damage,
            fireRate: this.fireRate,
            range: this.range,
            upgradeCost: this.getUpgradeCost(),
            refundAmount: this.getRefundAmount(),
            canUpgrade: this.canUpgrade()
        };
    }
} 