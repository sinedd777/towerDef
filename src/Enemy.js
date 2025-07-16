import * as THREE from 'three';
import { ELEMENTS } from './Elements.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class Enemy {
    constructor(waypoints, wave = 1, element = null) {
        this.waypoints = waypoints;
        this.currentWaypointIndex = 0;
        this.element = element;
        this.wave = wave; // Store wave number first
        
        // Enhanced scaling based on wave number
        const baseSpeed = 1.0;
        const baseHealth = 100;
        
        // Exponential scaling for higher waves
        const speedMultiplier = 1 + (wave - 1) * 0.10; // +10% speed per wave
        const healthMultiplier = Math.pow(1.25, wave - 1); // Exponential health scaling
        
        this.speed = baseSpeed * speedMultiplier;
        this.baseSpeed = this.speed; // Store base speed for status effects
        this.health = baseHealth * healthMultiplier;
        this.maxHealth = this.health;
        
        // Status effect tracking
        this.activeEffects = new Map();
        this.baseDamageMultiplier = 1.0;
        
        // Create enemy mesh with enhanced visual feedback
        const MAX_SIZE_MULTIPLIER = 2.5;
        const sizeMultiplier = Math.min(
            MAX_SIZE_MULTIPLIER,
            1 + (wave - 1) * 0.1
        );
        const size = 0.3 * sizeMultiplier;
        
        const geometry = new THREE.SphereGeometry(size, 8, 6);
        
        // Enhanced visual appearance with elemental colors
        const elementConfig = element ? ELEMENTS[element] : null;
        const baseColor = elementConfig ? elementConfig.color : 0xff4444;
        const emissiveIntensity = Math.min(0.5, 0.1 * (wave - 1));
        
        const material = new THREE.MeshPhongMaterial({ 
            color: baseColor,
            emissive: elementConfig ? new THREE.Color(elementConfig.color) : new THREE.Color(0xff0000),
            emissiveIntensity: emissiveIntensity,
            shininess: Math.min(100, wave * 10)
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        
        // Add wave and elemental indicator effects
        if (wave > 1 || element) {
            const ringGeometry = new THREE.RingGeometry(size * 1.2, size * 1.4, 16);
            const ringMaterial = new THREE.MeshBasicMaterial({ 
                color: elementConfig ? elementConfig.color : 0xff0000,
                transparent: true,
                opacity: 0.3 + Math.min(0.5, (wave - 1) * 0.1)
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = -Math.PI / 2;
            this.mesh.add(ring);
            
            // Add elemental particle effects
            if (element) {
                this.setupElementalEffects(size, elementConfig);
            }
        }

        // Create debug label
        const debugDiv = document.createElement('div');
        debugDiv.className = 'enemy-debug';
        debugDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        debugDiv.style.color = 'white';
        debugDiv.style.padding = '4px';
        debugDiv.style.borderRadius = '4px';
        debugDiv.style.fontSize = '12px';
        debugDiv.style.pointerEvents = 'none';
        debugDiv.style.whiteSpace = 'nowrap';
        this.debugLabel = new CSS2DObject(debugDiv);
        this.debugLabel.position.set(0, 1, 0); // Position above the enemy

        // Add debug label to mesh after it's created
        this.mesh.add(this.debugLabel);
        
        // Update debug info initially
        this.updateDebugInfo();
        
        // Start at the first waypoint
        if (waypoints.length > 0) {
            this.mesh.position.copy(waypoints[0]);
        }
        
        this.direction = new THREE.Vector3();
        this.hasReachedEndFlag = false;
        
        this.calculateDirection();
    }
    
    setupElementalEffects(size, elementConfig) {
        // Create particle system for elemental effects
        const particleCount = 20;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount * 3; i += 3) {
            const angle = Math.random() * Math.PI * 2;
            const radius = size * (1 + Math.random() * 0.3);
            positions[i] = Math.cos(angle) * radius;
            positions[i + 1] = Math.random() * size * 2 - size;
            positions[i + 2] = Math.sin(angle) * radius;
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: elementConfig.particleColor,
            size: size * 0.2,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        
        this.particles = new THREE.Points(particles, particleMaterial);
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
            const newAngle = angle + 0.02;
            positions[i] = Math.cos(newAngle) * radius;
            positions[i + 2] = Math.sin(newAngle) * radius;
            
            // Oscillate particles vertically
            positions[i + 1] += Math.sin(Date.now() * 0.003 + i) * 0.01;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(() => this.animateParticles());
    }
    
    calculateDirection() {
        if (this.currentWaypointIndex < this.waypoints.length - 1) {
            const currentWaypoint = this.waypoints[this.currentWaypointIndex];
            const nextWaypoint = this.waypoints[this.currentWaypointIndex + 1];
            
            this.direction.subVectors(nextWaypoint, currentWaypoint).normalize();
            
            // If confused, reverse direction
            if (this.activeEffects.has('confused')) {
                this.direction.multiplyScalar(-1);
            }
        }
    }
    
    update() {
        if (this.hasReachedEndFlag || this.currentWaypointIndex >= this.waypoints.length - 1) {
            return;
        }
        
        // Update status effects
        this.updateStatusEffects();
        
        const targetWaypoint = this.waypoints[this.currentWaypointIndex + 1];
        const deltaTime = 0.016; // Approximately 60 FPS
        
        // If stunned, don't move
        if (this.activeEffects.has('stun')) {
            return;
        }
        
        // Move towards the next waypoint with current speed (affected by status effects)
        const movement = this.direction.clone().multiplyScalar(this.speed * deltaTime);
        this.mesh.position.add(movement);
        
        // Check if we've reached the current target waypoint
        const distanceToTarget = this.mesh.position.distanceTo(targetWaypoint);
        
        if (distanceToTarget < 0.1) {
            // Snap to waypoint and move to next one
            this.mesh.position.copy(targetWaypoint);
            
            // If confused, stay at current waypoint
            if (!this.activeEffects.has('confused')) {
                this.currentWaypointIndex++;
            }
            
            if (this.currentWaypointIndex >= this.waypoints.length - 1) {
                this.hasReachedEndFlag = true;
            } else {
                this.calculateDirection();
            }
        }
        
        // Update debug info
        this.updateDebugInfo();
    }
    
    updateStatusEffects() {
        const currentTime = Date.now();
        let speedModifier = 1.0;
        this.baseDamageMultiplier = 1.0;
        
        // Process all active effects
        for (const [effect, data] of this.activeEffects.entries()) {
            if (currentTime >= data.endTime) {
                this.activeEffects.delete(effect);
                // If confusion ends, recalculate direction
                if (effect === 'confused') {
                    this.calculateDirection();
                }
                continue;
            }
            
            // Apply effect modifiers
            switch (effect) {
                case 'slow':
                    speedModifier *= 0.7; // 30% slower
                    break;
                case 'weaken':
                    this.baseDamageMultiplier *= 1.25; // Takes 25% more damage
                    break;
                case 'burn':
                    if (currentTime - data.lastTickTime >= 1000) { // Damage every second
                        this.takeDamage(this.maxHealth * 0.05); // 5% max health as damage
                        data.lastTickTime = currentTime;
                    }
                    break;
                case 'poison':
                    if (currentTime - data.lastTickTime >= 500) { // Damage every 0.5 seconds
                        this.takeDamage(this.maxHealth * 0.03); // 3% max health as damage
                        data.lastTickTime = currentTime;
                    }
                    break;
                case 'stun':
                    speedModifier = 0; // Cannot move
                    break;
                case 'confused':
                    // Direction is handled in calculateDirection()
                    break;
            }
        }
        
        // Update final speed
        this.speed = this.baseSpeed * speedModifier;
    }
    
    applyElementalEffect(element, duration) {
        if (!element || !ELEMENTS[element]) return;
        
        const currentTime = Date.now();
        const elementConfig = ELEMENTS[element];
        
        // Define effect based on element type
        let effect = {
            endTime: currentTime + duration,
            lastTickTime: currentTime,
            element: element
        };
        
        switch (element) {
            case 'FIRE':
                this.activeEffects.set('burn', effect);
                break;
            case 'WATER':
                this.activeEffects.set('slow', effect);
                break;
            case 'NATURE':
                this.activeEffects.set('poison', effect);
                break;
            case 'LIGHT':
                this.activeEffects.set('weaken', effect);
                break;
            case 'DARKNESS':
                this.activeEffects.set('confused', effect);
                break;
            case 'EARTH':
                this.activeEffects.set('stun', {
                    ...effect,
                    endTime: currentTime + (duration * 0.5) // Stun duration is halved for balance
                });
                break;
        }
        
        // Show visual effect
        this.showEffectApplication(elementConfig.color);
        
        // Update debug info
        this.updateDebugInfo();
    }
    
    showEffectApplication(color) {
        // Create a quick flash effect
        const flashGeometry = new THREE.SphereGeometry(
            this.mesh.geometry.parameters.radius * 1.2,
            8,
            6
        );
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        this.mesh.add(flash);
        
        // Animate the flash
        const duration = 300; // ms
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            flash.material.opacity = 0.8 * (1 - progress);
            flash.scale.setScalar(1 + progress * 0.5);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.mesh.remove(flash);
            }
        };
        
        animate();
    }
    
    takeDamage(damage) {
        const actualDamage = damage * this.baseDamageMultiplier;
        this.health -= actualDamage;
        
        if (this.health < 0) {
            this.health = 0;
        }

        // Update debug info after damage
        this.updateDebugInfo();
        
        // Visual feedback for damage
        const damageColor = this.element ? ELEMENTS[this.element].color : 0xff0000;
        this.mesh.material.color.setHex(0xff0000);
        setTimeout(() => {
            if (this.mesh.material) {
                this.mesh.material.color.setHex(damageColor);
            }
        }, 100);
        
        return this.health <= 0;
    }
    
    hasReachedEnd() {
        return this.hasReachedEndFlag;
    }
    
    getPosition() {
        return this.mesh.position;
    }
    
    isAlive() {
        return this.health > 0;
    }

    updateDebugInfo() {
        if (!this.debugLabel) return;
        
        const healthPercent = Math.round((this.health / this.maxHealth) * 100);
        let statusEffects = Array.from(this.activeEffects.keys()).join(', ');
        
        let elementText = this.element ? `Element: ${this.element}` : '';
        let effectsText = statusEffects ? `Effects: ${statusEffects}` : '';
        
        this.debugLabel.element.innerHTML = `
            Wave ${this.wave}<br>
            HP: ${healthPercent}%<br>
            ${elementText}<br>
            ${effectsText}
        `;
        
        // Color code the health based on percentage
        let healthColor;
        if (healthPercent > 66) {
            healthColor = '#00ff00';
        } else if (healthPercent > 33) {
            healthColor = '#ffff00';
        } else {
            healthColor = '#ff0000';
        }
        
        // Update label style
        this.debugLabel.element.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.debugLabel.element.style.color = healthColor;
        this.debugLabel.element.style.padding = '4px';
        this.debugLabel.element.style.borderRadius = '4px';
        this.debugLabel.element.style.fontSize = '12px';
        this.debugLabel.element.style.textAlign = 'center';
    }

    // Update cleanup when enemy is removed
    cleanup() {
        // Remove debug label
        if (this.debugLabel) {
            this.mesh.remove(this.debugLabel);
            this.debugLabel.element.remove();
            this.debugLabel = null;
        }
        
        // Remove particle effects
        if (this.particles) {
            this.mesh.remove(this.particles);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.particles = null;
        }
        
        // Remove any child meshes (like rings or effects)
        while (this.mesh.children.length > 0) {
            const child = this.mesh.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            this.mesh.remove(child);
        }
        
        // Clear all status effects
        this.activeEffects.clear();
    }
} 