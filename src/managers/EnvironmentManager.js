import * as THREE from 'three';
import { assetManager } from './AssetManager.js';

export class EnvironmentManager {
    constructor(scene, gridSize = 20) {
        this.scene = scene;
        this.gridSize = gridSize;
        this.environmentObjects = [];
        this.spawnPoints = [];
    }

    /**
     * Initialize environmental details
     * @param {Array} obstacles - Array of obstacle positions to avoid
     * @param {THREE.Vector3} enemyStart - Enemy spawn position
     * @param {THREE.Vector3} enemyEnd - Enemy end position
     */
    async initializeEnvironment(obstacles = [], enemyStart, enemyEnd) {
        try {
            // Clear existing environment objects
            this.clearEnvironment();
            
            // Add spawn points
            await this.addSpawnPoints(enemyStart, enemyEnd);
            
            // Scatter environmental details
            await this.scatterEnvironmentalObjects(obstacles, enemyStart, enemyEnd);
            
            console.log(`Environment initialized with ${this.environmentObjects.length} objects`);
        } catch (error) {
            console.error('Failed to initialize environment:', error);
        }
    }

    /**
     * Initialize environment for cooperative mode with multiple spawn points
     * @param {Array} obstacles - Array of obstacle positions to avoid
     * @param {Array<THREE.Vector3>} spawnPoints - Array of enemy spawn positions
     * @param {THREE.Vector3} exitPoint - Single exit position
     */
    async initializeCooperativeEnvironment(obstacles = [], spawnPoints = [], exitPoint) {
        try {
            // Clear existing environment objects
            this.clearEnvironment();
            
            // Add multiple spawn points and single exit point
            await this.addCooperativeSpawnPoints(spawnPoints, exitPoint);
            
            // Scatter environmental details (adjusted for multiple spawns and single exit)
            await this.scatterCooperativeEnvironmentalObjects(obstacles, spawnPoints, exitPoint);
            
            console.log(`Cooperative environment initialized with ${spawnPoints.length} spawn points and ${this.environmentObjects.length} objects`);
        } catch (error) {
            console.error('Failed to initialize cooperative environment:', error);
        }
    }

    /**
     * Add spawn point models for cooperative mode
     * @param {Array<THREE.Vector3>} spawnPoints - Array of enemy spawn positions  
     * @param {THREE.Vector3} exitPoint - Single exit position
     */
    async addCooperativeSpawnPoints(spawnPoints, exitPoint) {
        try {
            // Add multiple spawn points
            for (let i = 0; i < spawnPoints.length; i++) {
                const spawnPoint = spawnPoints[i];
                const spawnModel = await assetManager.loadAsset('environment', 'spawn-round');
                spawnModel.position.copy(spawnPoint);
                spawnModel.position.y = 0;
                spawnModel.scale.set(1.2, 1.2, 1.2);
                
                // Add green glow effect for spawn points
                spawnModel.traverse((child) => {
                    if (child.isMesh && child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => {
                                mat.emissive = new THREE.Color(0x00ff00);
                                mat.emissiveIntensity = 0.3;
                            });
                        } else {
                            child.material.emissive = new THREE.Color(0x00ff00);
                            child.material.emissiveIntensity = 0.3;
                        }
                    }
                });
                
                this.scene.add(spawnModel);
                this.spawnPoints.push(spawnModel);
                
                console.log(`Added spawn point ${i + 1} at (${spawnPoint.x}, ${spawnPoint.z})`);
            }
            
            // Add single exit point
            const exitModel = await assetManager.loadAsset('environment', 'spawn-square');
            exitModel.position.copy(exitPoint);
            exitModel.position.y = 0;
            exitModel.scale.set(1.4, 1.4, 1.4); // Slightly larger for exit
            
            // Add red glow for exit point
            exitModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            mat.emissive = new THREE.Color(0xff0000);
                            mat.emissiveIntensity = 0.4;
                        });
                    } else {
                        child.material.emissive = new THREE.Color(0xff0000);
                        child.material.emissiveIntensity = 0.4;
                    }
                }
            });
            
            this.scene.add(exitModel);
            this.spawnPoints.push(exitModel);
            
            console.log(`Added exit point at (${exitPoint.x}, ${exitPoint.z})`);
            
        } catch (error) {
            console.error('Failed to add cooperative spawn points:', error);
        }
    }

    /**
     * Scatter environmental objects for cooperative mode
     */
    async scatterCooperativeEnvironmentalObjects(obstacles, spawnPoints, exitPoint) {
        const objectTypes = [
            { category: 'environment', key: 'tree', weight: 0.3, scale: [1.2, 1.8] },
            { category: 'environment', key: 'rocks', weight: 0.25, scale: [0.9, 1.5] },
            { category: 'environment', key: 'crystal', weight: 0.2, scale: [1.0, 1.6] },
            { category: 'environment', key: 'dirt', weight: 0.25, scale: [0.8, 1.3] }
        ];

        const halfGrid = this.gridSize / 2;
        const totalObjects = Math.floor(this.gridSize * 0.8); // Slightly fewer objects for cooperative mode
        let placedObjects = 0;

        for (let attempt = 0; attempt < totalObjects * 3 && placedObjects < totalObjects; attempt++) {
            const position = new THREE.Vector3(
                (Math.random() - 0.5) * this.gridSize,
                0,
                (Math.random() - 0.5) * this.gridSize
            );

                         if (this.isValidCooperativePosition(position, obstacles, spawnPoints, exitPoint, 2.5)) {
                 const objectType = this.selectWeightedRandom(objectTypes);
                try {
                    const envObject = await assetManager.loadAsset(objectType.category, objectType.key);
                    if (envObject) {
                        envObject.position.copy(position);
                        envObject.position.y = 0;
                        
                        const scale = objectType.scale[0] + Math.random() * (objectType.scale[1] - objectType.scale[0]);
                        envObject.scale.set(scale, scale, scale);
                        
                        envObject.rotation.y = Math.random() * Math.PI * 2;
                        
                        this.scene.add(envObject);
                        this.environmentObjects.push(envObject);
                        placedObjects++;
                    }
                } catch (error) {
                    console.warn(`Failed to load environmental object ${objectType.key}:`, error);
                }
            }
        }
    }

    /**
     * Check if a position is valid for cooperative mode (away from all spawn points and exit)
     */
    isValidCooperativePosition(position, obstacles, spawnPoints, exitPoint, minDistance) {
        // Check distance from all spawn points
        for (const spawnPoint of spawnPoints) {
            if (position.distanceTo(spawnPoint) < minDistance) return false;
        }
        
        // Check distance from exit point
        if (position.distanceTo(exitPoint) < minDistance) return false;
        
        // Check distance from obstacles
        for (const obstacle of obstacles) {
            const obstaclePos = new THREE.Vector3(obstacle.x, 0, obstacle.z);
            if (position.distanceTo(obstaclePos) < minDistance) return false;
        }
        
        // Check distance from existing environment objects
        for (const envObj of this.environmentObjects) {
            if (position.distanceTo(envObj.position) < minDistance * 0.8) return false;
        }
        
        return true;
    }

    /**
     * Add spawn point models (original single-player method)
     */
    async addSpawnPoints(enemyStart, enemyEnd) {
        try {
            // Enemy spawn point
            const spawnModel = await assetManager.loadAsset('environment', 'spawn-round');
            spawnModel.position.copy(enemyStart);
            spawnModel.position.y = 0;
            spawnModel.scale.set(1.2, 1.2, 1.2);
            
            // Add subtle glow effect
            spawnModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            mat.emissive = new THREE.Color(0x00ff00);
                            mat.emissiveIntensity = 0.2;
                        });
                    } else {
                        child.material.emissive = new THREE.Color(0x00ff00);
                        child.material.emissiveIntensity = 0.2;
                    }
                }
            });
            
            this.scene.add(spawnModel);
            this.spawnPoints.push(spawnModel);
            
            // Enemy end point
            const endModel = await assetManager.loadAsset('environment', 'spawn-square');
            endModel.position.copy(enemyEnd);
            endModel.position.y = 0;
            endModel.scale.set(1.2, 1.2, 1.2);
            
            // Add red glow for end point
            endModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            mat.emissive = new THREE.Color(0xff0000);
                            mat.emissiveIntensity = 0.2;
                        });
                    } else {
                        child.material.emissive = new THREE.Color(0xff0000);
                        child.material.emissiveIntensity = 0.2;
                    }
                }
            });
            
            this.scene.add(endModel);
            this.spawnPoints.push(endModel);
            
        } catch (error) {
            console.error('Failed to add spawn points:', error);
        }
    }

    /**
     * Scatter environmental objects around the map
     */
    async scatterEnvironmentalObjects(obstacles, enemyStart, enemyEnd) {
        const objectTypes = [
            { category: 'environment', key: 'tree', weight: 0.3, scale: [1.2, 1.8] },
            { category: 'environment', key: 'rocks', weight: 0.25, scale: [0.9, 1.5] },
            { category: 'environment', key: 'crystal', weight: 0.2, scale: [1.0, 1.6] },
            { category: 'environment', key: 'dirt', weight: 0.15, scale: [0.8, 1.2] },
            { category: 'environment', key: 'tree-large', weight: 0.1, scale: [1.5, 2.2] }
        ];
        
        const numObjects = 25; // Number of environmental objects to place
        const minDistance = 3.0; // Increased minimum distance from obstacles/spawns (was 2.0)
        const maxAttempts = 100; // Max attempts to find valid position
        
        for (let i = 0; i < numObjects; i++) {
            let attempts = 0;
            let validPosition = null;
            
            // Try to find a valid position
            while (attempts < maxAttempts && !validPosition) {
                const x = (Math.random() - 0.5) * (this.gridSize - 2);
                const z = (Math.random() - 0.5) * (this.gridSize - 2);
                const position = new THREE.Vector3(x, 0, z);
                
                // Check if position is far enough from obstacles, spawns, and other objects
                if (this.isValidPosition(position, obstacles, enemyStart, enemyEnd, minDistance)) {
                    validPosition = position;
                }
                attempts++;
            }
            
            if (validPosition) {
                // Select random object type based on weights
                const objectType = this.selectWeightedRandom(objectTypes);
                await this.placeEnvironmentalObject(objectType, validPosition);
            }
        }
    }

    /**
     * Select a random object type based on weights
     */
    selectWeightedRandom(objects) {
        const totalWeight = objects.reduce((sum, obj) => sum + obj.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const obj of objects) {
            random -= obj.weight;
            if (random <= 0) {
                return obj;
            }
        }
        
        return objects[0]; // Fallback
    }

    /**
     * Check if a position is valid (not too close to obstacles or spawns)
     */
    isValidPosition(position, obstacles, enemyStart, enemyEnd, minDistance) {
        // Check distance from spawn points
        if (position.distanceTo(enemyStart) < minDistance) return false;
        if (position.distanceTo(enemyEnd) < minDistance) return false;
        
        // Check distance from obstacles
        for (const obstacle of obstacles) {
            const obstaclePos = new THREE.Vector3(obstacle.x, 0, obstacle.z);
            if (position.distanceTo(obstaclePos) < minDistance) return false;
        }
        
        // Check distance from existing environment objects
        for (const envObj of this.environmentObjects) {
            if (position.distanceTo(envObj.position) < minDistance * 0.8) return false;
        }
        
        return true;
    }

    /**
     * Place an environmental object at the specified position
     */
    async placeEnvironmentalObject(objectType, position) {
        try {
            const model = await assetManager.loadAsset(objectType.category, objectType.key);
            
            // Random scale within range
            const scaleRange = objectType.scale;
            const scale = scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0]);
            model.scale.set(scale, scale, scale);
            
            // Position the object
            model.position.copy(position);
            model.position.y = 0;
            
            // Random rotation for variety
            model.rotation.y = Math.random() * Math.PI * 2;
            
            // Add subtle random tilt for natural look
            if (objectType.key.includes('tree') || objectType.key.includes('crystal')) {
                model.rotation.x = (Math.random() - 0.5) * 0.2;
                model.rotation.z = (Math.random() - 0.5) * 0.2;
            }

            // Enhance materials specifically for environmental objects
            model.traverse((child) => {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {
                        // Brighten the base color
                        material.color.multiplyScalar(1.4);
                        
                        // Add subtle emissive glow
                        if (!material.emissive) {
                            material.emissive = new THREE.Color(0x303030);
                        }
                        material.emissiveIntensity = 0.15;
                        
                        // Adjust material properties for better visibility
                        if (material.type.includes('Standard') || material.type.includes('Physical')) {
                            material.metalness = 0.1;  // Low metalness for more diffuse look
                            material.roughness = 0.6;  // Moderate roughness
                        }
                        
                        material.needsUpdate = true;
                    });
                }
            });
            
            this.scene.add(model);
            this.environmentObjects.push(model);
            
        } catch (error) {
            console.error(`Failed to place environmental object ${objectType.key}:`, error);
        }
    }

    /**
     * Update environmental objects (for animations, if any)
     */
    update() {
        // Add subtle animations to crystals
        const time = Date.now() * 0.001;
        
        for (const obj of this.environmentObjects) {
            // Add gentle floating animation to crystals
            if (obj.userData.type === 'crystal') {
                obj.position.y = 0.05 + Math.sin(time * 2 + obj.position.x) * 0.02;
                obj.rotation.y += 0.01;
            }
        }
        
        // Animate spawn points
        for (const spawn of this.spawnPoints) {
            spawn.rotation.y += 0.005;
            
            // Pulse the emissive intensity
            const pulseFactor = 0.5 + 0.3 * Math.sin(time * 3);
            spawn.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            if (mat.emissive) {
                                mat.emissiveIntensity = 0.2 * pulseFactor;
                            }
                        });
                    } else if (child.material.emissive) {
                        child.material.emissiveIntensity = 0.2 * pulseFactor;
                    }
                }
            });
        }
    }

    /**
     * Clear all environmental objects
     */
    clearEnvironment() {
        // Remove environment objects
        for (const obj of this.environmentObjects) {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }
        this.environmentObjects = [];
        
        // Remove spawn points
        for (const spawn of this.spawnPoints) {
            this.scene.remove(spawn);
            if (spawn.geometry) spawn.geometry.dispose();
            if (spawn.material) spawn.material.dispose();
        }
        this.spawnPoints = [];
    }

    /**
     * Get statistics about the environment
     */
    getStats() {
        return {
            environmentObjects: this.environmentObjects.length,
            spawnPoints: this.spawnPoints.length,
            totalObjects: this.environmentObjects.length + this.spawnPoints.length
        };
    }
} 