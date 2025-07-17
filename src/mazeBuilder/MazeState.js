import * as THREE from 'three';
import { generateShapeHand } from './TetrisShapes.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class MazeState {
    constructor(scene, gridSize = 10) {
        this.scene = scene;
        this.gridSize = gridSize;
        this.isBuilding = true;
        this.gridState = {};
        this.currentShapeHand = [];
        this.selectedShape = null;
        this.shapePreview = null;
        this.placedShapes = [];
        this.gridBlocks = []; // Visual blocks in the scene
        this.restrictedAreaMarkers = []; // Visual markers for restricted areas
        
        // Path constraints - start and end must remain clear
        // Start area is 2x2 in top-left corner at (-8,-8)
        this.pathStartArea = { x: -8, z: -8, width: 2, height: 2 };
        // End area is 2x2 in bottom-right corner at (8,8)
        this.pathEndArea = { x: 8, z: 8, width: 2, height: 2 };
        
        this.init();
    }

    init() {
        // Initialize grid state
        for (let z = 0; z < this.gridSize; z++) {
            this.gridState[z] = {};
        }
        
        // Generate initial hand of shapes (increased to 10)
        this.currentShapeHand = generateShapeHand(10);
        
        // Mark path areas as restricted
        this.markPathAreas();
        
        // Create visual markers for restricted areas
        this.createRestrictedAreaMarkers();
    }

    markPathAreas() {
        const halfGrid = this.gridSize / 2;
        
        // Mark start area as restricted (2x2 area)
        for (let x = -9; x <= -7; x++) {
            for (let z = -9; z <= -7; z++) {
                const gridX = x + halfGrid;
                const gridZ = z + halfGrid;
                if (gridX >= 0 && gridX < this.gridSize && gridZ >= 0 && gridZ < this.gridSize) {
                    if (!this.gridState[gridZ][gridX]) {
                        this.gridState[gridZ][gridX] = {};
                    }
                    this.gridState[gridZ][gridX].restricted = true;
                }
            }
        }
        
        // Mark end area as restricted (2x2 area)
        for (let x = 7; x <= 9; x++) {
            for (let z = 7; z <= 9; z++) {
                const gridX = x + halfGrid;
                const gridZ = z + halfGrid;
                if (gridX >= 0 && gridX < this.gridSize && gridZ >= 0 && gridZ < this.gridSize) {
                    if (!this.gridState[gridZ][gridX]) {
                        this.gridState[gridZ][gridX] = {};
                    }
                    this.gridState[gridZ][gridX].restricted = true;
                }
            }
        }

        // Mark edge boundaries as restricted (1-unit wide border)
        for (let i = 0; i < this.gridSize; i++) {
            // Top edge
            if (!this.gridState[0][i]) this.gridState[0][i] = {};
            this.gridState[0][i].restricted = true;
            
            // Bottom edge
            if (!this.gridState[this.gridSize - 1][i]) this.gridState[this.gridSize - 1][i] = {};
            this.gridState[this.gridSize - 1][i].restricted = true;
            
            // Left edge
            if (!this.gridState[i][0]) this.gridState[i][0] = {};
            this.gridState[i][0].restricted = true;
            
            // Right edge
            if (!this.gridState[i][this.gridSize - 1]) this.gridState[i][this.gridSize - 1] = {};
            this.gridState[i][this.gridSize - 1].restricted = true;
        }
    }

    createRestrictedAreaMarkers() {
        // Clear existing markers
        this.restrictedAreaMarkers.forEach(marker => this.scene.remove(marker));
        this.restrictedAreaMarkers = [];

        // Create markers for start and end areas
        const startMarker = this.createAreaMarker(
            this.pathStartArea.x,
            this.pathStartArea.z,
            this.pathStartArea.width,
            this.pathStartArea.height,
            0xff0000, // Red for restricted
            'Start'
        );
        
        const endMarker = this.createAreaMarker(
            this.pathEndArea.x,
            this.pathEndArea.z,
            this.pathEndArea.width,
            this.pathEndArea.height,
            0xff0000, // Red for restricted
            'End'
        );

        // Create markers for edge boundaries
        const halfGrid = this.gridSize / 2;
        const markerGeometry = new THREE.BoxGeometry(1, 0.1, 1);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 });

        for (let i = -halfGrid; i < halfGrid; i++) {
            // Top edge
            const topMarker = new THREE.Mesh(markerGeometry, markerMaterial);
            topMarker.position.set(i + 0.5, 0, -halfGrid + 0.5);
            this.scene.add(topMarker);
            this.restrictedAreaMarkers.push(topMarker);

            // Bottom edge
            const bottomMarker = new THREE.Mesh(markerGeometry, markerMaterial);
            bottomMarker.position.set(i + 0.5, 0, halfGrid - 0.5);
            this.scene.add(bottomMarker);
            this.restrictedAreaMarkers.push(bottomMarker);

            // Left edge
            const leftMarker = new THREE.Mesh(markerGeometry, markerMaterial);
            leftMarker.position.set(-halfGrid + 0.5, 0, i + 0.5);
            this.scene.add(leftMarker);
            this.restrictedAreaMarkers.push(leftMarker);

            // Right edge
            const rightMarker = new THREE.Mesh(markerGeometry, markerMaterial);
            rightMarker.position.set(halfGrid - 0.5, 0, i + 0.5);
            this.scene.add(rightMarker);
            this.restrictedAreaMarkers.push(rightMarker);
        }
    }

    createAreaMarker(x, z, width, height, color, label) {
        // Create ground marker
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        const marker = new THREE.Mesh(geometry, material);
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(x, 0.01, z);
        this.scene.add(marker);
        this.restrictedAreaMarkers.push(marker);
        
        // Create text label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'area-label';
        labelDiv.textContent = label;
        labelDiv.style.color = '#' + color.toString(16).padStart(6, '0');
        labelDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        labelDiv.style.padding = '2px 5px';
        labelDiv.style.borderRadius = '3px';
        
        const labelObject = new CSS2DObject(labelDiv);
        labelObject.position.set(x, 0.5, z);
        this.scene.add(labelObject);
        this.restrictedAreaMarkers.push(labelObject);
    }

    selectShape(shape) {
        if (this.selectedShape === shape) {
            // Deselect if selecting the same shape
            this.selectedShape = null;
            this.clearPreview();
        } else {
            this.selectedShape = shape;
            this.createPreview();
        }
    }

    createPreview() {
        this.clearPreview();
        
        if (!this.selectedShape) return;
        
        const geometry = new THREE.BoxGeometry(0.8, 0.3, 0.8);
        const material = new THREE.MeshLambertMaterial({
            color: this.selectedShape.color,
            transparent: true,
            opacity: 0.6
        });
        
        this.shapePreview = new THREE.Group();
        
        for (const cell of this.selectedShape.cells) {
            const block = new THREE.Mesh(geometry, material.clone());
            block.position.set(cell[0], 0.5, cell[1]);
            this.shapePreview.add(block);
        }
        
        this.scene.add(this.shapePreview);
    }

    clearPreview() {
        if (this.shapePreview) {
            this.scene.remove(this.shapePreview);
            this.shapePreview = null;
        }
    }

    updatePreview(worldX, worldZ) {
        if (!this.shapePreview || !this.selectedShape) return;
        
        // Store current position for rotation
        this.lastPreviewPosition = { x: worldX, z: worldZ };
        
        // Snap to grid cell centers by adding 0.5
        const gridX = Math.floor(worldX) + 0.5;
        const gridZ = Math.floor(worldZ) + 0.5;
        
        this.shapePreview.position.set(gridX, 0, gridZ);
        
        // Update colors based on validity
        const canPlace = this.selectedShape.canPlaceAt(gridX, gridZ, this.gridState, this.gridSize);
        const color = canPlace ? this.selectedShape.color : 0xff0000;
        
        this.shapePreview.children.forEach(block => {
            block.material.color.setHex(color);
        });
    }

    rotateSelectedShape() {
        if (this.selectedShape && this.selectedShape.rotate()) {
            // Store the current position
            const currentPosition = this.lastPreviewPosition || { x: 0, z: 0 };
            
            // Recreate preview
            this.createPreview();
            
            // Restore position if it exists
            if (this.lastPreviewPosition) {
                this.updatePreview(currentPosition.x, currentPosition.z);
            }
            
            return true;
        }
        return false;
    }

    placeShape(worldX, worldZ) {
        if (!this.selectedShape) return false;
        
        // Snap to grid cell centers by adding 0.5
        const gridX = Math.floor(worldX) + 0.5;
        const gridZ = Math.floor(worldZ) + 0.5;
        
        if (!this.selectedShape.canPlaceAt(gridX, gridZ, this.gridState, this.gridSize)) {
            return false;
        }
        
        // Place the shape
        this.selectedShape.position = { x: gridX, z: gridZ };
        this.selectedShape.placeInGrid(this.gridState, this.gridSize);
        
        // Create visual blocks
        this.createVisualBlocks(this.selectedShape);
        
        // Add to placed shapes and remove from hand
        this.placedShapes.push(this.selectedShape);
        const handIndex = this.currentShapeHand.indexOf(this.selectedShape);
        if (handIndex !== -1) {
            this.currentShapeHand.splice(handIndex, 1);
        }
        
        // Clear selection
        this.selectedShape = null;
        this.clearPreview();
        
        return true;
    }

    createVisualBlocks(shape) {
        const geometry = new THREE.BoxGeometry(0.9, 0.5, 0.9);
        const material = new THREE.MeshLambertMaterial({ color: shape.color });
        
        for (const cell of shape.getWorldCells()) {
            const block = new THREE.Mesh(geometry, material.clone());
            // Position blocks at cell centers
            block.position.set(cell.x, 0.25, cell.z);
            block.castShadow = true;
            block.receiveShadow = true;
            this.scene.add(block);
            this.gridBlocks.push(block);
        }
    }

    // Get obstacles for pathfinding
    getObstacles() {
        const obstacles = [];
        
        for (const shape of this.placedShapes) {
            for (const cell of shape.getWorldCells()) {
                obstacles.push({ x: cell.x, z: cell.z });
            }
        }
        
        return obstacles;
    }

    // Check if player has placed at least one shape
    hasPlacedShapes() {
        return this.placedShapes.length > 0;
    }

    // Transition to defense phase
    startDefense() {
        this.isBuilding = false;
        this.clearPreview();
        this.selectedShape = null;
        
        // Optionally hide UI elements
        return this.getObstacles();
    }

    // Clean up maze builder
    cleanup() {
        this.clearPreview();
        this.gridBlocks.forEach(block => this.scene.remove(block));
        this.gridBlocks = [];
        
        // Clean up restricted area markers
        this.restrictedAreaMarkers.forEach(marker => this.scene.remove(marker));
        this.restrictedAreaMarkers = [];
    }
} 