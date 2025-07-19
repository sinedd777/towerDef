import * as THREE from 'three';
import { loadTexture } from '../utils/textureLoader.js';

export class MultiplayerScene {
    constructor(localPlayerId) {
        this.scene = new THREE.Scene();
        this.localPlayerId = localPlayerId; // 'player1' or 'player2'
        
        // Main game area (like single player)
        this.mainGameArea = null;
        this.ground = null;
        
        // Path visualization
        this.pathLine = null;
        
        // Spectator view data (opponent's game state)
        this.spectatorGameData = {
            mazeBlocks: [],
            towers: [],
            enemies: [],
            path: null
        };
        
        this.mapSize = 20;
        
        this.setupScene();
        this.setupLighting();
        this.setupMainGameArea();
    }
    
    setupScene() {
        // Standard scene setup like single player
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue background
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 100);
    }
    
    setupLighting() {
        // Standard lighting setup like single player
        const ambientLight = new THREE.AmbientLight(0x606060, 0.6);
        this.scene.add(ambientLight);

        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
        mainLight.position.set(10, 20, 10);
        mainLight.castShadow = true;

        // Shadow settings
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 50;
        mainLight.shadow.camera.left = -25;
        mainLight.shadow.camera.right = 25;
        mainLight.shadow.camera.top = 25;
        mainLight.shadow.camera.bottom = -25;
        mainLight.shadow.bias = -0.0001;
        mainLight.shadow.normalBias = 0.02;
        this.scene.add(mainLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0x4444ff, 0.3);
        fillLight.position.set(-10, 8, -8);
        this.scene.add(fillLight);
    }
    
    setupMainGameArea() {
        // Create single game area centered at origin (like single player)
        const groundGeometry = new THREE.PlaneGeometry(this.mapSize, this.mapSize);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x3E7B3E // Standard green ground
        });
        
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.set(0, 0, 0); // Centered at origin
        this.ground.receiveShadow = true;
        this.ground.userData.isGround = true;
        this.scene.add(this.ground);
        
        // Create area bounds for interaction validation
        this.mainGameArea = {
            ground: this.ground,
            bounds: {
                minX: -this.mapSize / 2,
                maxX: this.mapSize / 2,
                minZ: -this.mapSize / 2,
                maxZ: this.mapSize / 2
            },
            center: new THREE.Vector3(0, 0, 0),
            playerId: this.localPlayerId
        };
    }
    
    // Get the main game area (for input manager)
    getPlayerArea(playerId) {
        // Always return the main game area for the local player
        if (playerId === this.localPlayerId) {
            return this.mainGameArea;
        }
        // For opponent, return virtual bounds (not interactive)
        return {
            bounds: { minX: -999, maxX: -999, minZ: -999, maxZ: -999 },
            center: new THREE.Vector3(-999, 0, -999),
            playerId: playerId
        };
    }
    
    // Get spawn position (like single player)
    getSpawnPosition(playerId = null) {
        return new THREE.Vector3(-8, 0.1, -8); // Standard spawn position
    }
    
    getEndPosition(playerId = null) {
        return new THREE.Vector3(8, 0.1, 8); // Standard end position
    }
    
    // Convert world position to grid coordinates (like single player)
    worldToGrid(worldPosition, playerId = null) {
        const localX = worldPosition.x;
        const localZ = worldPosition.z;
        
        // Convert to grid coordinates (assuming 1 unit = 1 grid cell)
        const gridX = Math.round(localX + this.mapSize / 2);
        const gridZ = Math.round(localZ + this.mapSize / 2);
        
        return { x: gridX, z: gridZ };
    }
    
    // Convert grid coordinates to world position (like single player)
    gridToWorld(gridX, gridZ, playerId = null) {
        const localX = gridX - this.mapSize / 2;
        const localZ = gridZ - this.mapSize / 2;
        
        return new THREE.Vector3(localX, 0, localZ);
    }
    
    // Add object to scene (like single player)
    addToPlayerArea(object, playerId = null) {
        object.userData.playerId = this.localPlayerId;
        this.scene.add(object);
    }
    
    // Remove object from scene (like single player)
    removeFromScene(object) {
        this.scene.remove(object);
        
        // Clean up resources
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(mat => mat.dispose());
            } else {
                object.material.dispose();
            }
        }
    }
    
    // Update spectator data from network
    updateSpectatorData(data) {
        this.spectatorGameData = { ...this.spectatorGameData, ...data };
        // The spectator view will be handled by UI overlay, not 3D scene
    }
    
    // Get spectator data for UI
    getSpectatorData() {
        return this.spectatorGameData;
    }
    
    // Get the Three.js scene object
    getScene() {
        return this.scene;
    }

    updatePathVisualization(waypoints) {
        // Remove existing path line
        if (this.pathLine) {
            this.scene.remove(this.pathLine);
            this.pathLine.geometry.dispose();
            this.pathLine.material.dispose();
            this.pathLine = null;
        }

        // Only create new path line if waypoints exist
        if (waypoints && waypoints.length > 0) {
            // Create positions array from waypoints
            const positions = waypoints.map(waypoint => {
                return new THREE.Vector3(waypoint.x, 0.1, waypoint.z);
            });

            const pathGeometry = new THREE.BufferGeometry().setFromPoints(positions);

            const pathMaterial = new THREE.LineDashedMaterial({
                color: 0xff0000,
                dashSize: 0.2,
                gapSize: 0.8,
                transparent: true,
                opacity: 0.9
            });

            this.pathLine = new THREE.Line(pathGeometry, pathMaterial);
            // Required for dashed lines to appear
            this.pathLine.computeLineDistances();
            this.scene.add(this.pathLine);
        }
    }
    
    // Cleanup resources
    dispose() {
        // Dispose of geometries and materials
        this.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        
        // Clear the scene
        while (this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }
    }
} 