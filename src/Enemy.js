import * as THREE from 'three';

export class Enemy {
    constructor(waypoints, wave = 1) {
        this.waypoints = waypoints;
        this.currentWaypointIndex = 0;
        
        // Enhanced scaling based on wave number
        const baseSpeed = 1.0;
        const baseHealth = 100;
        
        // Exponential scaling for higher waves
        const speedMultiplier = 1 + (wave - 1) * 0.20; // +20% speed per wave
        const healthMultiplier = Math.pow(1.25, wave - 1); // Exponential health scaling
        
        this.speed = baseSpeed * speedMultiplier;
        this.health = baseHealth * healthMultiplier;
        this.maxHealth = this.health;
        
        // Create enemy mesh with enhanced visual feedback
        const MAX_SIZE_MULTIPLIER = 2.5; // Maximum 2.5x the original size
        const sizeMultiplier = Math.min(
            MAX_SIZE_MULTIPLIER,
            1 + (wave - 1) * 0.1 // Base size + 10% per wave, capped at MAX_SIZE_MULTIPLIER
        );
        const size = 0.3 * sizeMultiplier;
        
        const geometry = new THREE.SphereGeometry(size, 8, 6);
        
        // Enhanced visual appearance for higher waves
        const waveColor = new THREE.Color(0xff4444);
        const emissiveIntensity = Math.min(0.5, 0.1 * (wave - 1)); // Stronger glow up to wave 5
        
        const material = new THREE.MeshPhongMaterial({ 
            color: waveColor,
            emissive: new THREE.Color(0xff0000),
            emissiveIntensity: emissiveIntensity,
            shininess: Math.min(100, wave * 10) // More metallic look in higher waves
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        
        // Add wave indicator effect
        if (wave > 1) {
            const ringGeometry = new THREE.RingGeometry(size * 1.2, size * 1.4, 16);
            const ringMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xff0000,
                transparent: true,
                opacity: 0.3 + Math.min(0.5, (wave - 1) * 0.1) // Cap ring opacity at 0.8
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = -Math.PI / 2;
            this.mesh.add(ring);
        }
        
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
        
        const targetWaypoint = this.waypoints[this.currentWaypointIndex + 1];
        const deltaTime = 0.016; // Approximately 60 FPS
        
        // Move towards the next waypoint
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
    }
    
    takeDamage(damage) {
        this.health -= damage;
        
        // Visual feedback for damage (flash red)
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
} 