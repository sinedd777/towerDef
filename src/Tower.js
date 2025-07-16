import * as THREE from 'three';
import { Projectile } from './Projectile.js';
import { TOWER_TYPES, createElementalTower } from './TowerTypes.js';
import { ELEMENTS, getElementalDamage } from './Elements.js';

export class Tower {
    constructor(x, y, z, type = 'basic', element = null) {
        const towerConfig = element ? 
            createElementalTower(type.toUpperCase(), element) : 
            TOWER_TYPES[type.toUpperCase()];
        
        this.position = new THREE.Vector3(x, y, z);
        this.range = towerConfig.range;
        this.damage = towerConfig.damage;
        this.fireRate = towerConfig.fireRate;
        this.type = type;
        this.element = element;
        this.lastShotTime = 0;
        
        // Create tower mesh
        this.mesh = new THREE.Mesh(
            towerConfig.model.base.geometry,
            towerConfig.model.base.material.clone()
        );
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        
        // Create range indicator with elemental color
        const rangeGeometry = new THREE.RingGeometry(this.range - 0.1, this.range, 32);
        const rangeMaterial = new THREE.MeshBasicMaterial({ 
            color: towerConfig.color, 
            transparent: true, 
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        this.rangeIndicator = new THREE.Mesh(rangeGeometry, rangeMaterial);
        this.rangeIndicator.rotation.x = -Math.PI / 2;
        this.rangeIndicator.position.set(0, -0.49, 0);
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
        
        // For area tower, create pulse effect with elemental properties
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
            
            // Add glow effect with elemental color
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

            // Add elemental particle system for area towers
            if (this.element) {
                this.setupElementalParticles();
            }
        }
        
        this.currentTarget = null;
    }
    
    setupElementalParticles() {
        const elementConfig = ELEMENTS[this.element];
        
        // Create particle geometry
        const particleCount = 50;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount * 3; i += 3) {
            const angle = (Math.random() * Math.PI * 2);
            const radius = Math.random() * this.range;
            positions[i] = Math.cos(angle) * radius;
            positions[i + 1] = 0;
            positions[i + 2] = Math.sin(angle) * radius;
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Create particle material
        const particleMaterial = new THREE.PointsMaterial({
            color: elementConfig.particleColor,
            size: 0.2,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        
        // Create particle system
        this.particles = new THREE.Points(particles, particleMaterial);
        this.particles.position.y = 0.1;
        this.mesh.add(this.particles);
        
        // Animate particles
        this.animateParticles();
    }
    
    animateParticles() {
        if (!this.particles) return;
        
        const positions = this.particles.geometry.attributes.position.array;
        const particleCount = positions.length / 3;
        
        for (let i = 0; i < particleCount * 3; i += 3) {
            const angle = Math.atan2(positions[i + 2], positions[i]);
            const radius = Math.sqrt(positions[i] * positions[i] + positions[i + 2] * positions[i + 2]);
            
            // Rotate particles
            const newAngle = angle + 0.01;
            positions[i] = Math.cos(newAngle) * radius;
            positions[i + 2] = Math.sin(newAngle) * radius;
            
            // Pulse radius
            const time = Date.now() * 0.001;
            const pulseRadius = radius + Math.sin(time + i) * 0.05;
            positions[i] *= pulseRadius / radius;
            positions[i + 2] *= pulseRadius / radius;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(() => this.animateParticles());
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
                    const damage = this.element ? 
                        getElementalDamage(this.damage, this.element, enemy.element) : 
                        this.damage;
                    
                    enemy.takeDamage(damage);
                    
                    // Apply elemental effect if tower has an element
                    if (this.element && ELEMENTS[this.element]) {
                        enemy.applyElementalEffect(this.element, ELEMENTS[this.element].effectDuration);
                    }
                    
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
        
        // Create projectile with elemental properties
        const projectile = new Projectile(
            worldBarrelTip,
            target,
            this.damage,
            this.type === 'splash' ? this.range * 0.5 : 0,
            this.element // Pass the element to the projectile
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
    
    // Method to upgrade tower with an element
    upgradeElement(element) {
        if (!ELEMENTS[element]) return false;
        
        const elementalConfig = createElementalTower(this.type.toUpperCase(), element);
        if (!elementalConfig) return false;
        
        // Update tower properties
        this.element = element;
        this.damage = elementalConfig.damage;
        
        // Update visuals
        this.mesh.material = elementalConfig.model.base.material.clone();
        if (this.barrel) {
            this.barrel.material = elementalConfig.model.barrel.material.clone();
        }
        
        // Update range indicator color
        this.rangeIndicator.material.color.setHex(elementalConfig.color);
        
        // Setup particle effects for area towers
        if (this.type === 'area') {
            if (this.particles) {
                this.mesh.remove(this.particles);
            }
            this.setupElementalParticles();
        }
        
        return true;
    }
} 