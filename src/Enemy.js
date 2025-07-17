import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class Enemy {
    constructor(waypoints, wave = 1) {
        this.waypoints = waypoints;
        this.currentWaypointIndex = 0;
        this.wave = wave;
        
        // Enhanced scaling based on wave number
        const baseSpeed = 1.0;
        const baseHealth = 100;
        
        // Exponential scaling for higher waves
        const speedMultiplier = 1 + (wave - 1) * 0.10; // +10% speed per wave
        const healthMultiplier = Math.pow(1.25, wave - 1); // Exponential health scaling
        
        this.speed = baseSpeed * speedMultiplier;
        this.baseSpeed = this.speed;
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
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xff4444,
            emissive: new THREE.Color(0xff0000),
            emissiveIntensity: Math.min(0.5, 0.1 * (wave - 1)),
            shininess: Math.min(100, wave * 10)
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        
        // Add wave indicator effects
        if (wave > 1) {
            const ringGeometry = new THREE.RingGeometry(size * 1.2, size * 1.4, 16);
            const ringMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xff0000,
                transparent: true,
                opacity: 0.3 + Math.min(0.5, (wave - 1) * 0.1)
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = -Math.PI / 2;
            this.mesh.add(ring);
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
        this.debugLabel.position.set(0, 1, 0);
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
    
    calculateDirection() {
        if (this.currentWaypointIndex < this.waypoints.length - 1) {
            const currentWaypoint = this.waypoints[this.currentWaypointIndex];
            const nextWaypoint = this.waypoints[this.currentWaypointIndex + 1];
            
            this.direction.subVectors(nextWaypoint, currentWaypoint).normalize();
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
            this.currentWaypointIndex++;
            
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
                case 'stun':
                    speedModifier = 0; // Cannot move
                    break;
            }
        }
        
        // Update final speed
        this.speed = this.baseSpeed * speedModifier;
    }
    
    applyEffect(effectType, duration) {
        const currentTime = Date.now();
        
        // Define effect
        let effect = {
            endTime: currentTime + duration,
            lastTickTime: currentTime
        };
        
        switch (effectType) {
            case 'slow':
            case 'weaken':
            case 'stun':
                this.activeEffects.set(effectType, effect);
                break;
        }
        
        // Show visual effect
        this.showEffectApplication();
        
        // Update debug info
        this.updateDebugInfo();
    }
    
    showEffectApplication() {
        // Create a quick flash effect
        const flashGeometry = new THREE.SphereGeometry(
            this.mesh.geometry.parameters.radius * 1.2,
            8,
            6
        );
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
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
        this.mesh.material.color.setHex(0xff0000);
        setTimeout(() => {
            if (this.mesh.material) {
                this.mesh.material.color.setHex(0xff4444);
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
        let effectsText = statusEffects ? `Effects: ${statusEffects}` : '';
        
        this.debugLabel.element.innerHTML = `
            Wave ${this.wave}<br>
            HP: ${healthPercent}%<br>
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

    cleanup() {
        // Remove debug label
        if (this.debugLabel) {
            this.mesh.remove(this.debugLabel);
            this.debugLabel.element.remove();
            this.debugLabel = null;
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