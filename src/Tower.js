import * as THREE from 'three';
import { Projectile } from './Projectile.js';

export class Tower {
    constructor(x, y, z) {
        this.position = new THREE.Vector3(x, y, z);
        this.range = 3.0;
        this.damage = 50;
        this.fireRate = 1.0; // shots per second
        this.lastShotTime = 0;
        
        // Create tower mesh (blue cylinder)
        const geometry = new THREE.CylinderGeometry(0.3, 0.4, 1.0, 8);
        const material = new THREE.MeshPhongMaterial({ color: 0x4444ff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        
        // Create range indicator (visible circle at base)
        const rangeGeometry = new THREE.RingGeometry(this.range - 0.1, this.range, 32);
        const rangeMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        this.rangeIndicator = new THREE.Mesh(rangeGeometry, rangeMaterial);
        this.rangeIndicator.rotation.x = -Math.PI / 2;
        this.rangeIndicator.position.set(0, -0.49, 0); // Position relative to tower base
        this.mesh.add(this.rangeIndicator);
        
        // Barrel for visual appeal
        const barrelGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6);
        const barrelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        this.barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        this.barrel.position.set(0, 0.4, 0);
        this.mesh.add(this.barrel);
        
        this.currentTarget = null;
    }
    
    findTarget(enemies) {
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
        
        // Rotate barrel towards target
        if (this.currentTarget) {
            const targetPos = this.currentTarget.getPosition();
            const direction = new THREE.Vector3().subVectors(targetPos, this.position);
            direction.y = 0; // Keep barrel horizontal
            direction.normalize();
            
            const angle = Math.atan2(direction.x, direction.z);
            this.barrel.rotation.y = angle;
        }
        
        return this.currentTarget;
    }
    
    canShoot() {
        const currentTime = Date.now();
        const timeSinceLastShot = currentTime - this.lastShotTime;
        const shootInterval = 1000 / this.fireRate; // Convert to milliseconds
        
        return timeSinceLastShot >= shootInterval;
    }
    
    shoot(target) {
        if (!this.canShoot() || !target) return null;
        
        this.lastShotTime = Date.now();
        
        // Create projectile starting from the barrel tip
        const barrelTip = new THREE.Vector3(0, 0.8, 0);
        const worldBarrelTip = barrelTip.clone();
        this.mesh.localToWorld(worldBarrelTip);
        
        const projectile = new Projectile(
            worldBarrelTip,
            target,
            this.damage
        );
        
        return projectile;
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