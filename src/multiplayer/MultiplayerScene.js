import * as THREE from 'three';
import { loadTexture } from '../utils/textureLoader.js';

export class MultiplayerScene {
    constructor() {
        this.scene = new THREE.Scene();
        this.player1Area = null;
        this.player2Area = null;
        this.separatorMesh = null;
        
        // Map positions from specification
        this.player1Center = new THREE.Vector3(-12.5, 0, 0);
        this.player2Center = new THREE.Vector3(12.5, 0, 0);
        this.mapSize = 20;
        this.gap = 5;
        
        this.setupScene();
        this.setupLighting();
        this.setupMaps();
        this.setupVisualSeparation();
    }
    
    setupScene() {
        // Enhanced scene setup for multiplayer
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.Fog(0x000000, 50, 100);
    }
    
    setupLighting() {
        // Enhanced lighting setup for dual-map visibility
        const ambientLight = new THREE.AmbientLight(0x606060, 0.8);
        this.scene.add(ambientLight);

        // Main directional light (centered between maps)
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.4);
        mainLight.position.set(0, 20, 10); // Centered to illuminate both maps
        mainLight.castShadow = true;

        // Enhanced shadow settings for larger area
        mainLight.shadow.mapSize.width = 4096;
        mainLight.shadow.mapSize.height = 4096;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 50;
        mainLight.shadow.camera.left = -30;  // Extended for both maps
        mainLight.shadow.camera.right = 30;
        mainLight.shadow.camera.top = 25;
        mainLight.shadow.camera.bottom = -25;
        mainLight.shadow.bias = -0.0001;
        mainLight.shadow.normalBias = 0.02;
        this.scene.add(mainLight);

        // Fill lights for each map
        const fillLight1 = new THREE.DirectionalLight(0x4444ff, 0.3);
        fillLight1.position.set(-15, 8, -8); // Light for player 1 map
        this.scene.add(fillLight1);

        const fillLight2 = new THREE.DirectionalLight(0x4444ff, 0.3);
        fillLight2.position.set(15, 8, -8); // Light for player 2 map
        this.scene.add(fillLight2);

        // Rim lights for visual definition
        const rimLight1 = new THREE.DirectionalLight(0x4CAF50, 0.4); // Green for player 1
        rimLight1.position.set(-10, 5, -10);
        this.scene.add(rimLight1);

        const rimLight2 = new THREE.DirectionalLight(0xF44336, 0.4); // Red for player 2
        rimLight2.position.set(10, 5, -10);
        this.scene.add(rimLight2);

        // Spawn area lights
        const spawnLight1 = new THREE.PointLight(0x00ff00, 0.5, 10);
        spawnLight1.position.set(-20.5, 2, -8); // Player 1 spawn area
        this.scene.add(spawnLight1);

        const endLight1 = new THREE.PointLight(0xff0000, 0.5, 10);
        endLight1.position.set(-4.5, 2, 8); // Player 1 end area
        this.scene.add(endLight1);

        const spawnLight2 = new THREE.PointLight(0x00ff00, 0.5, 10);
        spawnLight2.position.set(4.5, 2, -8); // Player 2 spawn area
        this.scene.add(spawnLight2);

        const endLight2 = new THREE.PointLight(0xff0000, 0.5, 10);
        endLight2.position.set(20.5, 2, 8); // Player 2 end area
        this.scene.add(endLight2);
    }
    
    setupMaps() {
        // Player 1 ground (left map)
        this.player1Area = this.createGround(this.player1Center, 'player1');
        this.scene.add(this.player1Area.ground);
        
        // Player 2 ground (right map)
        this.player2Area = this.createGround(this.player2Center, 'player2');
        this.scene.add(this.player2Area.ground);
        
        // Add map boundaries for visual clarity
        this.addMapBoundaries();
    }
    
    createGround(centerPosition, playerId) {
        const groundGeometry = new THREE.PlaneGeometry(this.mapSize, this.mapSize);
        
        // Different colors for each player's map
        const colors = {
            player1: 0x1B4332, // Dark green
            player2: 0x2D1B32  // Dark purple
        };
        
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: colors[playerId]
        });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.copy(centerPosition);
        ground.receiveShadow = true;
        ground.userData.owner = playerId;
        ground.userData.isGround = true;
        
        // Create area bounds for interaction validation
        const bounds = {
            minX: centerPosition.x - this.mapSize / 2,
            maxX: centerPosition.x + this.mapSize / 2,
            minZ: centerPosition.z - this.mapSize / 2,
            maxZ: centerPosition.z + this.mapSize / 2
        };
        
        return {
            ground,
            bounds,
            center: centerPosition.clone(),
            playerId
        };
    }
    
    addMapBoundaries() {
        // Add subtle boundary lines around each map
        const boundaryMaterial = new THREE.LineBasicMaterial({ 
            color: 0x666666, 
            transparent: true, 
            opacity: 0.5 
        });
        
        // Player 1 boundary
        const boundary1Points = [
            new THREE.Vector3(-22.5, 0.02, -10),
            new THREE.Vector3(-2.5, 0.02, -10),
            new THREE.Vector3(-2.5, 0.02, 10),
            new THREE.Vector3(-22.5, 0.02, 10),
            new THREE.Vector3(-22.5, 0.02, -10)
        ];
        const boundary1Geometry = new THREE.BufferGeometry().setFromPoints(boundary1Points);
        const boundary1 = new THREE.Line(boundary1Geometry, boundaryMaterial);
        this.scene.add(boundary1);
        
        // Player 2 boundary
        const boundary2Points = [
            new THREE.Vector3(2.5, 0.02, -10),
            new THREE.Vector3(22.5, 0.02, -10),
            new THREE.Vector3(22.5, 0.02, 10),
            new THREE.Vector3(2.5, 0.02, 10),
            new THREE.Vector3(2.5, 0.02, -10)
        ];
        const boundary2Geometry = new THREE.BufferGeometry().setFromPoints(boundary2Points);
        const boundary2 = new THREE.Line(boundary2Geometry, boundaryMaterial);
        this.scene.add(boundary2);
    }
    
    setupVisualSeparation() {
        // Add visual separator in the gap between maps
        const separatorGeometry = new THREE.PlaneGeometry(1, this.mapSize + 2);
        const separatorMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x444444, 
            transparent: true, 
            opacity: 0.3 
        });
        
        this.separatorMesh = new THREE.Mesh(separatorGeometry, separatorMaterial);
        this.separatorMesh.rotation.x = -Math.PI / 2;
        this.separatorMesh.position.set(0, 0.01, 0); // Center between maps
        this.separatorMesh.userData.isSeparator = true;
        this.scene.add(this.separatorMesh);
        
        // Add separator text labels
        this.addPlayerLabels();
    }
    
    addPlayerLabels() {
        // Add floating text labels for each player area
        // Note: Using geometric indicators instead of text fonts for better compatibility
        this.addGeometricLabels();
    }
    
    addGeometricLabels() {
        // Simple geometric indicators for player areas
        // Player 1 indicator (green)
        const indicator1Geometry = new THREE.RingGeometry(0.5, 1, 8);
        const indicator1Material = new THREE.MeshBasicMaterial({ 
            color: 0x4CAF50, 
            transparent: true, 
            opacity: 0.7 
        });
        const indicator1 = new THREE.Mesh(indicator1Geometry, indicator1Material);
        indicator1.rotation.x = -Math.PI / 2;
        indicator1.position.set(-12.5, 0.05, -8);
        indicator1.userData.isPlayerIndicator = true;
        indicator1.userData.playerId = 'player1';
        this.scene.add(indicator1);
        
        // Player 2 indicator (red)
        const indicator2Geometry = new THREE.RingGeometry(0.5, 1, 8);
        const indicator2Material = new THREE.MeshBasicMaterial({ 
            color: 0xF44336, 
            transparent: true, 
            opacity: 0.7 
        });
        const indicator2 = new THREE.Mesh(indicator2Geometry, indicator2Material);
        indicator2.rotation.x = -Math.PI / 2;
        indicator2.position.set(12.5, 0.05, -8);
        indicator2.userData.isPlayerIndicator = true;
        indicator2.userData.playerId = 'player2';
        this.scene.add(indicator2);
    }
    
    // Utility methods for game logic
    getPlayerArea(playerId) {
        return playerId === 'player1' ? this.player1Area : this.player2Area;
    }
    
    isInPlayerArea(position, playerId) {
        const area = this.getPlayerArea(playerId);
        return position.x >= area.bounds.minX && 
               position.x <= area.bounds.maxX &&
               position.z >= area.bounds.minZ && 
               position.z <= area.bounds.maxZ;
    }
    
    getSpawnPosition(playerId) {
        if (playerId === 'player1') {
            return new THREE.Vector3(-20.5, 0.1, -8); // Player 1 spawn
        } else {
            return new THREE.Vector3(4.5, 0.1, -8);   // Player 2 spawn
        }
    }
    
    getEndPosition(playerId) {
        if (playerId === 'player1') {
            return new THREE.Vector3(-4.5, 0.1, 8);   // Player 1 end
        } else {
            return new THREE.Vector3(20.5, 0.1, 8);   // Player 2 end
        }
    }
    
    // Convert world position to local grid coordinates for a player
    worldToGrid(worldPosition, playerId) {
        const area = this.getPlayerArea(playerId);
        const localX = worldPosition.x - area.center.x;
        const localZ = worldPosition.z - area.center.z;
        
        // Convert to grid coordinates (assuming 1 unit = 1 grid cell)
        const gridX = Math.round(localX + this.mapSize / 2);
        const gridZ = Math.round(localZ + this.mapSize / 2);
        
        return { x: gridX, z: gridZ };
    }
    
    // Convert grid coordinates to world position for a player
    gridToWorld(gridX, gridZ, playerId) {
        const area = this.getPlayerArea(playerId);
        const localX = gridX - this.mapSize / 2;
        const localZ = gridZ - this.mapSize / 2;
        
        return new THREE.Vector3(
            area.center.x + localX,
            0,
            area.center.z + localZ
        );
    }
    
    // Add object to specific player's area
    addToPlayerArea(object, playerId) {
        object.userData.playerId = playerId;
        this.scene.add(object);
    }
    
    // Remove object from scene
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
    
    // Get the Three.js scene object
    getScene() {
        return this.scene;
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