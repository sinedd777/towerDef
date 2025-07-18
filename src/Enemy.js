import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { loadTexture } from './utils/textureLoader.js';
import { assetManager } from './managers/AssetManager.js';

// Preload texture (fallback for basic mode)
const ENEMY_TEX = loadTexture('https://threejs.org/examples/textures/planets/jupiter.jpg');

export class Enemy {
    constructor(waypoints, wave = 1) {
        this.originalWaypoints = waypoints;
        this.waypoints = waypoints;
        this.currentWaypointIndex = 0;
        this.wave = wave;
        
        // Enhanced scaling based on wave number
        const baseSpeed = 1.2;
        const baseHealth = 100;
        
        // Exponential scaling for higher waves
        const speedMultiplier = 1 + (wave - 1) * 0.10; // +10% speed per wave
        const healthMultiplier = Math.pow(1.25, wave - 1); // Exponential health scaling
        
        this.speed = baseSpeed * speedMultiplier;
        this.baseSpeed = this.speed;
        this.currentSpeed = this.speed; // Current speed (after turn modulation)
        this.health = baseHealth * healthMultiplier;
        this.maxHealth = this.health;
        
        // Path following variables
        this.pathProgress = 0; // Progress along current segment (0-1)
        this.currentSegmentIndex = 0;
        this.direction = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        
        // Collision avoidance
        this.radius = 0.25; // Collision radius
        this.minSeparationDistance = 0.6; // Minimum distance from other enemies
        this.avoidanceForce = new THREE.Vector3();
        
        // Turn detection and speed modulation
        this.upcomingTurnDistance = 3.0; // How far ahead to look for turns
        this.turnSpeedReduction = 0.8; // Maximum speed reduction at turns (60% reduction)
        this.minTurnAngle = Math.PI / 12; // Minimum angle (15 degrees) to start slowing
        this.isNearTurn = false;
        this.currentTurnAngle = 0;
        
        // Status effect tracking
        this.activeEffects = new Map();
        this.baseDamageMultiplier = 1.0;
        
        // Create enemy mesh with UFO model
        this.mesh = new THREE.Group();
        this.mesh.castShadow = true;
        this.isModelLoaded = false;
        
        // Load the appropriate UFO model based on wave
        this.loadUFOModel(wave).then((ufoModel) => {
            if (ufoModel) {
                // Keep UFOs at consistent size regardless of wave
                this.mesh.add(ufoModel);
                this.isModelLoaded = true;
            }
        }).catch((error) => {
            console.error('Failed to load UFO model, using fallback:', error);
            this.createFallbackMesh(wave);
        });

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
            const startPos = waypoints[0].position || waypoints[0];
            this.mesh.position.copy(startPos);
        }
        
        this.hasReachedEndFlag = false;
        
        this.calculateDirection();
    }
    
    calculateDirection() {
        if (this.currentSegmentIndex < this.waypoints.length - 1) {
            const currentWaypoint = this.waypoints[this.currentSegmentIndex];
            const nextWaypoint = this.waypoints[this.currentSegmentIndex + 1];
            
            const currentPos = currentWaypoint.position || currentWaypoint;
            const nextPos = nextWaypoint.position || nextWaypoint;
            
            this.direction.subVectors(nextPos, currentPos).normalize();
        }
    }
    
    update(allEnemies = []) {
        if (this.hasReachedEndFlag || this.currentSegmentIndex >= this.waypoints.length - 1) {
            return;
        }
        
        // Update status effects
        this.updateStatusEffects();
        
        const deltaTime = 0.016; // Approximately 60 FPS
        
        // If stunned, don't move
        if (this.activeEffects.has('stun')) {
            return;
        }
        
        // Enhanced turn detection using pathfinding metadata
        this.updateCurveBasedSpeed();
        
        // Calculate collision avoidance forces with curve preservation
        this.calculateCurveAwareAvoidance(allEnemies);
        
        // Update movement using enhanced smooth interpolation
        this.updateEnhancedMovement(deltaTime);
        
        // Add UFO rotation animation if model is loaded
        if (this.isModelLoaded && this.mesh.children.length > 0) {
            // Rotate the UFO around Y axis for floating effect
            this.mesh.rotation.y += 0.02;
            
            // Add subtle bobbing motion
            const time = Date.now() * 0.001;
            this.mesh.position.y = 0.1 + Math.sin(time * 2) * 0.05;
        }
        
        // Update debug info
        this.updateDebugInfo();
    }
    
    updateCurveBasedSpeed() {
        this.isNearTurn = false;
        this.currentTurnAngle = 0;
        let curveSpeedModifier = 1.0;
        
        // Check current waypoint for curve metadata
        if (this.currentSegmentIndex < this.waypoints.length) {
            const currentWaypoint = this.waypoints[this.currentSegmentIndex];
            
            // Use pathfinding metadata if available
            if (currentWaypoint.curvature !== undefined) {
                // Apply curve-based speed control
                curveSpeedModifier = currentWaypoint.speedMultiplier || 1.0;
                this.currentTurnAngle = currentWaypoint.turnAngle || 0;
                this.isNearTurn = currentWaypoint.isSharpTurn || false;
            }
        }
        
        // Look ahead for upcoming curves (enhanced prediction)
        let lookAheadDistance = 0;
        let checkIndex = this.currentSegmentIndex;
        const maxLookAhead = this.upcomingTurnDistance;
        
        while (checkIndex < this.waypoints.length - 1 && lookAheadDistance < maxLookAhead) {
            const waypoint = this.waypoints[checkIndex];
            const nextWaypoint = this.waypoints[checkIndex + 1];
            
            const currentPos = waypoint.position || waypoint;
            const nextPos = nextWaypoint.position || nextWaypoint;
            
            const segmentLength = currentPos.distanceTo(nextPos);
            lookAheadDistance += segmentLength;
            
            // Use enhanced curve metadata for prediction
            if (nextWaypoint.curvature !== undefined && nextWaypoint.curvature > 0.1) {
                this.isNearTurn = true;
                this.currentTurnAngle = Math.max(this.currentTurnAngle, nextWaypoint.turnAngle || 0);
                
                // Apply distance-based fade for upcoming curves
                const distanceFactor = Math.max(0.3, 1.0 - (lookAheadDistance / maxLookAhead));
                const upcomingSpeedModifier = nextWaypoint.speedMultiplier || 1.0;
                curveSpeedModifier = Math.min(curveSpeedModifier, 
                    1.0 - (1.0 - upcomingSpeedModifier) * distanceFactor);
                break;
            }
            
            checkIndex++;
        }
        
        // Apply the curve-based speed modification
        this.currentSpeed = this.speed * curveSpeedModifier;
    }
    
    calculateCurveAwareAvoidance(allEnemies) {
        this.avoidanceForce.set(0, 0, 0);
        
        // Get current movement direction for curve preservation
        const currentWaypoint = this.waypoints[this.currentSegmentIndex];
        const nextWaypoint = this.waypoints[Math.min(this.currentSegmentIndex + 1, this.waypoints.length - 1)];
        
        const currentPos = currentWaypoint.position || currentWaypoint;
        const nextPos = nextWaypoint.position || nextWaypoint;
        const pathDirection = new THREE.Vector3().subVectors(nextPos, currentPos).normalize();
        
        for (const otherEnemy of allEnemies) {
            if (otherEnemy === this || !otherEnemy.isAlive()) continue;
            
            const distance = this.mesh.position.distanceTo(otherEnemy.mesh.position);
            
            if (distance < this.minSeparationDistance && distance > 0) {
                // Calculate repulsion force
                const repulsion = new THREE.Vector3()
                    .subVectors(this.mesh.position, otherEnemy.mesh.position)
                    .normalize();
                
                // Enhanced force calculation with exponential falloff
                const forceMagnitude = Math.pow((this.minSeparationDistance - distance) / this.minSeparationDistance, 2);
                repulsion.multiplyScalar(forceMagnitude * 3.0);
                
                // Preserve curve direction by biasing avoidance perpendicular to path
                const perpendicular = new THREE.Vector3(-pathDirection.z, 0, pathDirection.x);
                const perpendicularComponent = perpendicular.dot(repulsion);
                const parallelComponent = pathDirection.dot(repulsion);
                
                // Favor perpendicular avoidance to maintain path following
                repulsion.copy(perpendicular).multiplyScalar(perpendicularComponent * 1.5);
                repulsion.add(pathDirection.clone().multiplyScalar(parallelComponent * 0.3));
                
                // Reduce Y component to keep movement horizontal
                repulsion.y *= 0.1;
                
                this.avoidanceForce.add(repulsion);
            }
        }
        
        // Limit avoidance force to prevent breaking the curved path
        const maxAvoidanceForce = 1.0; // Reduced to preserve curves better
        if (this.avoidanceForce.length() > maxAvoidanceForce) {
            this.avoidanceForce.normalize().multiplyScalar(maxAvoidanceForce);
        }
    }
    
    updateEnhancedMovement(deltaTime) {
        if (this.currentSegmentIndex >= this.waypoints.length - 1) {
            this.hasReachedEndFlag = true;
            return;
        }
        
        const currentWaypoint = this.waypoints[this.currentSegmentIndex];
        const nextWaypoint = this.waypoints[this.currentSegmentIndex + 1];
        
        const currentPos = currentWaypoint.position || currentWaypoint;
        const nextPos = nextWaypoint.position || nextWaypoint;
        
        // Calculate segment length and direction
        const segmentDirection = new THREE.Vector3().subVectors(nextPos, currentPos);
        const segmentLength = segmentDirection.length();
        segmentDirection.normalize();
        
        // Enhanced velocity calculation with curve-aware speed
        this.velocity.copy(segmentDirection);
        this.velocity.multiplyScalar(this.currentSpeed);
        
        // Apply curve-preserving avoidance force
        const avoidanceStrength = 0.2; // Reduced to better preserve curves
        this.velocity.add(this.avoidanceForce.clone().multiplyScalar(avoidanceStrength));
        
        // Move along the path
        const movement = this.velocity.clone().multiplyScalar(deltaTime);
        this.mesh.position.add(movement);
        
        // Enhanced progress calculation with curve support
        const currentSegmentPos = new THREE.Vector3().subVectors(this.mesh.position, currentPos);
        this.pathProgress = currentSegmentPos.dot(segmentDirection) / segmentLength;
        
        // Check if we've reached the next waypoint with curve tolerance
        const distanceToNext = this.mesh.position.distanceTo(nextPos);
        const progressThreshold = Math.max(0.9, 1.0 - (segmentLength * 0.1)); // Dynamic threshold
        
        if (this.pathProgress >= progressThreshold || distanceToNext < 0.2) {
            // Smooth transition to next waypoint with curve correction
            const targetPos = nextPos.clone();
            
            // Minimal avoidance offset that doesn't break curves
            const avoidanceOffset = this.avoidanceForce.clone().multiplyScalar(0.05);
            avoidanceOffset.y = 0; // Keep Y level
            targetPos.add(avoidanceOffset);
            
            // Smooth interpolation to target position
            const lerpFactor = 0.3; // Smooth transition
            this.mesh.position.lerp(targetPos, lerpFactor);
            
            // Move to next segment when close enough
            if (distanceToNext < 0.15) {
                this.currentSegmentIndex++;
                this.pathProgress = 0;
                
                if (this.currentSegmentIndex >= this.waypoints.length - 1) {
                    this.hasReachedEndFlag = true;
                } else {
                    this.calculateDirection();
                }
            }
        }
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
        
        // Update base speed (before turn modifications)
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
            this.radius * 1.5,
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
        this.showDamageEffect();
        
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
        
        // Enhanced curve and speed information
        const baseSpeedPercent = Math.round((this.currentSpeed / this.baseSpeed) * 100);
        
        // Get current waypoint curve information
        let curvatureText = '';
        let speedMultiplierText = '';
        if (this.currentSegmentIndex < this.waypoints.length) {
            const currentWaypoint = this.waypoints[this.currentSegmentIndex];
            if (currentWaypoint.curvature !== undefined) {
                const curvaturePercent = Math.round(currentWaypoint.curvature * 100);
                curvatureText = `Curve: ${curvaturePercent}%`;
                
                const speedMult = Math.round((currentWaypoint.speedMultiplier || 1.0) * 100);
                speedMultiplierText = `Path Speed: ${speedMult}%`;
            }
        }
        
        // Convert turn angle to degrees for display
        const turnAngleDegrees = Math.round(this.currentTurnAngle * (180 / Math.PI));
        let turnText = this.isNearTurn ? `Turn: ${turnAngleDegrees}°` : '';
        
        this.debugLabel.element.innerHTML = `
            Wave ${this.wave}<br>
            HP: ${healthPercent}%<br>
            Speed: ${baseSpeedPercent}%<br>
            ${speedMultiplierText ? speedMultiplierText + '<br>' : ''}
            ${curvatureText ? curvatureText + '<br>' : ''}
            ${turnText ? turnText + '<br>' : ''}
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
    
    async loadUFOModel(wave) {
        try {
            const ufoModel = await assetManager.getEnemyModel(wave);
            return ufoModel;
        } catch (error) {
            console.error('Failed to load UFO model for wave', wave, ':', error);
            return null;
        }
    }
    
    createFallbackMesh(wave) {
        // Create fallback sphere geometry if 3D model loading fails
        console.warn('Using fallback geometry for enemy');
        
        // Consistent size across all waves
        const size = this.radius;
        
        const geometry = new THREE.SphereGeometry(size, 8, 6);
        const material = new THREE.MeshPhongMaterial({ 
            map: ENEMY_TEX,
            color: 0xffffff
        });
        
        const fallbackMesh = new THREE.Mesh(geometry, material);
        fallbackMesh.castShadow = true;
        
        // Clear the group and add fallback mesh
        this.mesh.clear();
        this.mesh.add(fallbackMesh);
        this.isModelLoaded = true;
    }
    
    showDamageEffect() {
        // Visual feedback for damage on 3D models
        this.mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                const originalColor = child.material.color ? child.material.color.clone() : new THREE.Color(0xffffff);
                
                // Flash red
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        if (mat.color) mat.color.setHex(0xff0000);
                    });
                } else {
                    if (child.material.color) child.material.color.setHex(0xff0000);
                }
                
                // Restore original color after delay
                setTimeout(() => {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            if (mat.color) mat.color.copy(originalColor);
                        });
                    } else {
                        if (child.material.color) child.material.color.copy(originalColor);
                    }
                }, 150);
            }
        });
    }
} 