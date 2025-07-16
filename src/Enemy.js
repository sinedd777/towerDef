import * as THREE from 'three';

export class Enemy {
    constructor(waypoints, wave = 1) {
        this.waypoints = waypoints;
        this.currentWaypointIndex = 0;
        
        // Scale stats based on wave number
        const speedMultiplier = 1 + (wave - 1) * 0.1; // +10% speed per wave
        const healthMultiplier = 1 + (wave - 1) * 0.2; // +20% health per wave
        
        this.speed = 1.0 * speedMultiplier;
        this.health = 100 * healthMultiplier;
        this.maxHealth = this.health;
        
        // Create enemy mesh (red sphere)
        const geometry = new THREE.SphereGeometry(0.3, 8, 6);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xff4444,
            emissive: new THREE.Color(0xff0000).multiplyScalar(0.2 * (wave - 1)) // Glow stronger with each wave
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        
        // Scale mesh size slightly with wave
        const scale = 1 + (wave - 1) * 0.1; // +10% size per wave
        this.mesh.scale.set(scale, scale, scale);
        
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