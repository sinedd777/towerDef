import * as THREE from 'three';
import { generateShapeHand } from './TetrisShapes.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Pathfinding } from '../Pathfinding.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
        this.pathfinding = new Pathfinding(gridSize);
        this.lastPlacedShape = null;
        this.isPlacing = false; // Add placement lock
        
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
        
        // Generate initial hand of shapes (reduced to 3)
        this.currentShapeHand = generateShapeHand(3);
        
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

        // Create a single clean boundary outline instead of individual markers
        this.createBoundaryOutline();
    }
    
    createBoundaryOutline() {
        // Create a clean boundary outline using line geometry
        const halfGrid = this.gridSize / 2;
        const boundaryPoints = [
            new THREE.Vector3(-halfGrid + 0.5, 0.02, -halfGrid + 0.5), // Top-left
            new THREE.Vector3(halfGrid - 0.5, 0.02, -halfGrid + 0.5),  // Top-right
            new THREE.Vector3(halfGrid - 0.5, 0.02, halfGrid - 0.5),   // Bottom-right
            new THREE.Vector3(-halfGrid + 0.5, 0.02, halfGrid - 0.5),  // Bottom-left
            new THREE.Vector3(-halfGrid + 0.5, 0.02, -halfGrid + 0.5)  // Back to start
        ];
        
        const boundaryGeometry = new THREE.BufferGeometry().setFromPoints(boundaryPoints);
        const boundaryMaterial = new THREE.LineBasicMaterial({ 
            color: 0x666666, 
            transparent: true, 
            opacity: 1,
            linewidth: 3
        });
        
        const boundaryLine = new THREE.Line(boundaryGeometry, boundaryMaterial);
        this.scene.add(boundaryLine);
        this.restrictedAreaMarkers.push(boundaryLine);
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

    // Create a cohesive merged geometry for a shape
    createCohesiveShapeGeometry(shape, blockHeight = 0.5, blockSize = 1.0) {
        const geometries = [];
                
        // Create individual block geometries that touch each other
        for (const cell of shape.cells) {
            // Use full-size blocks (1.0) so they touch and create seamless appearance
            const blockGeometry = new THREE.BoxGeometry(
                blockSize, 
                blockHeight, 
                blockSize,
                8, // Higher segments for smoother beveling
                4, // Height segments for top/bottom rounding
                8  // Depth segments for smoother beveling
            );
            
            // Position the geometry at relative cell positions (NOT world positions)
            blockGeometry.translate(cell[0], blockHeight / 2, cell[1]);
            geometries.push(blockGeometry);
        }
        
        // Merge all geometries into one seamless shape
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
        
        // Apply bevel effect to create rounded, polished edges
        this.addBevelEffect(mergedGeometry, shape);
        
        // Compute vertex normals for smooth lighting across the merged surface
        mergedGeometry.computeVertexNormals();
        
        return mergedGeometry;
    }

    // Add sophisticated bevel effect for polished appearance
    addBevelEffect(geometry, shape) {
        const positionAttribute = geometry.attributes.position;
        const vertex = new THREE.Vector3();
        const bevelRadius = 0.08; // Subtle bevel amount
        
        // Get shape bounds to understand edge locations
        const shapeCells = new Set();
        shape.cells.forEach(cell => {
            shapeCells.add(`${cell[0]},${cell[1]}`);
        });
        
        for (let i = 0; i < positionAttribute.count; i++) {
            vertex.fromBufferAttribute(positionAttribute, i);
            
            // Determine if this vertex is on an external edge
            const cellX = Math.round(vertex.x);
            const cellZ = Math.round(vertex.z);
            
            // Check if we're at the edge of the shape
            let isExternalEdge = false;
            
            // Check neighboring cells to see if this is an external edge
            const neighbors = [
                [cellX + 1, cellZ], [cellX - 1, cellZ],
                [cellX, cellZ + 1], [cellX, cellZ - 1]
            ];
            
            for (const [nx, nz] of neighbors) {
                if (!shapeCells.has(`${nx},${nz}`)) {
                    isExternalEdge = true;
                    break;
                }
            }
            
            // Apply beveling only to external edges
            if (isExternalEdge) {
                // Calculate distance from cell center
                const distFromCenterX = Math.abs(vertex.x - cellX);
                const distFromCenterZ = Math.abs(vertex.z - cellZ);
                
                // Apply beveling to corners and edges
                if (distFromCenterX > 0.3 || distFromCenterZ > 0.3) {
                    // Smooth corner beveling
                    const maxDist = Math.max(distFromCenterX, distFromCenterZ);
                    const bevelFactor = Math.min(maxDist * bevelRadius, bevelRadius);
                    
                    // Pull edges slightly inward for rounding
                    if (distFromCenterX > 0.3) {
                        vertex.x = cellX + (vertex.x - cellX) * (1 - bevelFactor);
                    }
                    if (distFromCenterZ > 0.3) {
                        vertex.z = cellZ + (vertex.z - cellZ) * (1 - bevelFactor);
                    }
                }
                
                // Add subtle top edge rounding
                if (vertex.y > 0.3) {
                    const topBevel = Math.min(bevelRadius * 0.5, 0.03);
                    vertex.y -= topBevel * (distFromCenterX + distFromCenterZ);
                }
            }
            
            positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        
        positionAttribute.needsUpdate = true;
    }



    createPreview() {
        this.clearPreview();
        
        if (!this.selectedShape) return;
        
        // Create merged geometry for the entire shape
        const mergedGeometry = this.createCohesiveShapeGeometry(this.selectedShape, 0.3, 1.0);
        
        const material = new THREE.MeshPhongMaterial({
            color: this.selectedShape.color,
            transparent: true,
            opacity: 0.75,
            // Enhanced properties to show beveling
            emissive: new THREE.Color(this.selectedShape.color).multiplyScalar(0.12),
            flatShading: false, // Smooth shading to show bevels
            shininess: 50, // Subtle shininess to highlight rounded edges
            specular: new THREE.Color(0x111111) // Subtle specular highlights
        });
        
        // Create a single mesh for the entire shape
        this.shapePreview = new THREE.Mesh(mergedGeometry, material);
        this.shapePreview.position.set(0, 0, 0);
        
        this.scene.add(this.shapePreview);
    }

    clearPreview() {
        if (this.shapePreview) {
            // Properly dispose of geometry and materials to prevent memory leaks
            if (this.shapePreview.geometry) {
                this.shapePreview.geometry.dispose();
            }
            if (this.shapePreview.material) {
                this.shapePreview.material.dispose();
            }
            
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
        
        // Update the single mesh material color
        this.shapePreview.material.color.setHex(color);
    }

    rotateSelectedShape() {
        if (this.selectedShape && this.selectedShape.rotate()) {
            // Store the current position before clearing
            const currentPosition = this.lastPreviewPosition || { x: 0, z: 0 };
            
            // Properly clear the old preview first
            this.clearPreview();
            
            // Create new preview with rotated shape
            this.createPreview();
            
            // Restore position if it exists
            if (currentPosition) {
                this.updatePreview(currentPosition.x, currentPosition.z);
            }
            
            return true;
        }
        return false;
    }

    validatePath() {
        const obstacles = this.getObstacles();
        return this.pathfinding.findPath(
            { x: this.pathStartArea.x, z: this.pathStartArea.z },
            { x: this.pathEndArea.x, z: this.pathEndArea.z },
            obstacles
        );
    }

    undoLastPlacement() {
        if (!this.lastPlacedShape) return false;

        // Remove the shape from placedShapes
        const index = this.placedShapes.indexOf(this.lastPlacedShape);
        if (index !== -1) {
            this.placedShapes.splice(index, 1);
        }

        // Remove the shape's cells from gridState
        for (const cell of this.lastPlacedShape.getWorldCells()) {
            const gridX = Math.floor(cell.x + this.gridSize/2);
            const gridZ = Math.floor(cell.z + this.gridSize/2);
            if (this.gridState[gridZ] && this.gridState[gridZ][gridX]) {
                delete this.gridState[gridZ][gridX].occupied;
                delete this.gridState[gridZ][gridX].shape;
                delete this.gridState[gridZ][gridX].color;
            }
        }

        // Remove visual mesh for this shape
        const meshToRemove = this.gridBlocks.find(mesh => 
            mesh.userData.shape === this.lastPlacedShape
        );

        if (meshToRemove) {
            // Properly dispose of geometry and material
            if (meshToRemove.geometry) {
                meshToRemove.geometry.dispose();
            }
            if (meshToRemove.material) {
                meshToRemove.material.dispose();
            }
            
            this.scene.remove(meshToRemove);
            const blockIndex = this.gridBlocks.indexOf(meshToRemove);
            if (blockIndex !== -1) {
                this.gridBlocks.splice(blockIndex, 1);
            }
        }

        // Add the shape back to the hand
        this.currentShapeHand.push(this.lastPlacedShape);
        
        // Reset lastPlacedShape
        this.lastPlacedShape = null;

        return true;
    }

    placeShape(worldX, worldZ) {
        if (!this.selectedShape) {
            return false;
        }
        
        if (this.isPlacing) {
            return false;
        }
        
        this.isPlacing = true; // Lock placement
        console.log('Starting placement for shape:', this.selectedShape.name);
        
        // Snap to grid cell centers by adding 0.5
        const gridX = Math.floor(worldX) + 0.5;
        const gridZ = Math.floor(worldZ) + 0.5;
        
        console.log('Attempting to place at grid position:', gridX, gridZ);
        
        if (!this.selectedShape.canPlaceAt(gridX, gridZ, this.gridState, this.gridSize)) {
            console.log('Cannot place shape at this position');
            this.isPlacing = false; // Unlock
            return false;
        }
        
        // Place the shape
        this.selectedShape.position = { x: gridX, z: gridZ };
        this.selectedShape.placeInGrid(this.gridState, this.gridSize);
        
        console.log('Shape placed in grid state');
        
        // Create visual blocks
        this.createVisualBlocks(this.selectedShape);
        
        // Store as last placed shape before adding to placedShapes
        this.lastPlacedShape = this.selectedShape;
        
        // Add to placed shapes and remove from hand
        this.placedShapes.push(this.selectedShape);
        const handIndex = this.currentShapeHand.indexOf(this.selectedShape);
        if (handIndex !== -1) {
            this.currentShapeHand.splice(handIndex, 1);
            console.log('Removed shape from hand. New hand size:', this.currentShapeHand.length);
        }

        // Check if path is still valid
        const validPath = this.validatePath();
        if (!validPath) {
            console.log('Path blocked, undoing placement');
            // Show alert
            alert('This placement blocks all paths to the end! Click OK to undo and try again.');
            // Undo the placement
            this.undoLastPlacement();
            this.isPlacing = false; // Unlock
            return false;
        }
        
        // Clear selection
        this.selectedShape = null;
        this.clearPreview();
        
        console.log('Placement completed successfully');
        this.isPlacing = false; // Unlock
        
        return true;
    }

    createVisualBlocks(shape) {
        console.log('Creating visual blocks for shape:', shape.name);
        console.log('Shape position:', shape.position);
        console.log('Shape cells:', shape.cells);
        console.log('World cells:', shape.getWorldCells());
        
        // Create a cohesive merged geometry for the placed shape
        const mergedGeometry = this.createCohesiveShapeGeometry(shape, 0.5, 1.0);
        
        const material = new THREE.MeshPhongMaterial({ 
            color: shape.color,
            // Enhanced properties to showcase beveling
            emissive: new THREE.Color(shape.color).multiplyScalar(0.08),
            flatShading: false, // Smooth shading to show beveled edges
            shininess: 60, // Subtle shininess to highlight the beveling
            specular: new THREE.Color(0x222222) // Soft specular highlights
        });
        
        // Create a single mesh for the entire shape
        const shapeMesh = new THREE.Mesh(mergedGeometry, material);
        
        // Position the shape at its world position
        // NOTE: The geometry already includes the shape offset, so we position at the shape's grid position
        shapeMesh.position.set(shape.position.x, 0, shape.position.z);
        shapeMesh.castShadow = true;
        shapeMesh.receiveShadow = true;
        
        // Store reference to the shape for easier management
        shapeMesh.userData.shape = shape;
        
        console.log('Mesh final position:', shapeMesh.position);
        
        this.scene.add(shapeMesh);
        this.gridBlocks.push(shapeMesh);
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

    // Apply placement received from server (for multiplayer synchronization)
    applyServerPlacement(positions, shapeData) {
        console.log('🚀 applyServerPlacement called');
        console.log('📍 Positions received:', positions);
        console.log('🎨 Shape data received:', shapeData);
        
        // Server positions are already in correct world coordinates, use them directly
        const worldPositions = positions.map(pos => ({ x: pos.x, z: pos.z }));
        console.log('🌍 World positions:', worldPositions);
        
        // Create a shape object that matches what createVisualBlocks expects
        const shapeObj = {
            name: shapeData.name || shapeData.shape,
            color: shapeData.color || 0xff0000,
            position: worldPositions[0], // Use first position as the base position
            cells: worldPositions.map((pos, index) => [
                pos.x - worldPositions[0].x, 
                pos.z - worldPositions[0].z
            ]), // Calculate relative positions from first cell
            getWorldCells: function() {
                return worldPositions;
            },
            placed: true
        };
        
        console.log('🔧 Created shape object:', shapeObj);
        console.log('🎨 Shape color:', shapeObj.color);
        
        // Create visual blocks using the positions and color parameters
        console.log('🎭 Creating visual blocks...');
        this.createVisualBlocksFromPositions(worldPositions, shapeObj.color);
        
        // Update grid state using world coordinates directly
        console.log('🗺️ Updating grid state...');
        worldPositions.forEach(pos => {
            // Convert world coordinates to grid indices (0-based)
            const gridX = Math.floor(pos.x + this.gridSize / 2);
            const gridZ = Math.floor(pos.z + this.gridSize / 2);
            
            console.log(`📐 Grid conversion: World(${pos.x}, ${pos.z}) -> Grid(${gridX}, ${gridZ})`);
            
            // Ensure coordinates are within grid bounds
            if (gridX >= 0 && gridX < this.gridSize && gridZ >= 0 && gridZ < this.gridSize) {
                if (!this.gridState[gridZ]) {
                    this.gridState[gridZ] = {};
                }
                this.gridState[gridZ][gridX] = {
                    occupied: true,
                    shape: shapeObj,
                    color: shapeObj.color
                };
                console.log(`✅ Grid state updated at (${gridX}, ${gridZ})`);
            } else {
                console.log(`❌ Grid position out of bounds: (${gridX}, ${gridZ})`);
            }
        });
        
        // Add to placed shapes for tracking
        this.placedShapes.push(shapeObj);
        
        console.log('✅ Server placement applied successfully. Total shapes:', this.placedShapes.length);
        console.log('✅ Grid blocks in scene:', this.gridBlocks.length);
        console.log('🏁 applyServerPlacement completed');
    }

    // Helper method to create visual blocks from positions array (for server synchronization)
    createVisualBlocksFromPositions(positions, color) {
        console.log('🎭 createVisualBlocksFromPositions called');
        console.log('📍 Positions:', positions);
        console.log('🎨 Color:', color);
        console.log('🏗️ Scene exists:', !!this.scene);
        
        const geometries = [];
        
        for (const pos of positions) {
            console.log(`🧱 Creating block at position (${pos.x}, ${pos.z})`);
            const blockGeometry = new THREE.BoxGeometry(0.9, 0.2, 0.9);
            blockGeometry.translate(pos.x, 0.1, pos.z);
            geometries.push(blockGeometry);
        }
        
        console.log(`🔧 Created ${geometries.length} block geometries`);
        
        if (geometries.length > 0) {
            const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
            console.log('🔗 Merged geometries successfully');
            
            const blockMaterial = new THREE.MeshLambertMaterial({ 
                color: color,
                transparent: true,
                opacity: 0.9
            });
            console.log('🎨 Created material with color:', color);
            
            const blockMesh = new THREE.Mesh(mergedGeometry, blockMaterial);
            blockMesh.castShadow = true;
            blockMesh.receiveShadow = true;
            blockMesh.userData.isMazeBlock = true;
            console.log('🔨 Created mesh:', blockMesh);
            
            this.scene.add(blockMesh);
            this.gridBlocks.push(blockMesh);
            
            console.log('✅ Added mesh to scene. Scene children count:', this.scene.children.length);
            console.log('✅ Added to gridBlocks. GridBlocks count:', this.gridBlocks.length);
            console.log('🎯 Mesh position:', blockMesh.position);
            console.log('🔍 Mesh visible:', blockMesh.visible);
        } else {
            console.log('❌ No geometries to create mesh from');
        }
        
        console.log('🏁 createVisualBlocksFromPositions completed');
    }

    // Clean up maze builder
    cleanup() {
        // Clear all visual elements from the scene
        this.restrictedAreaMarkers.forEach(marker => {
            this.scene.remove(marker);
            if (marker.geometry) marker.geometry.dispose();
            if (marker.material) marker.material.dispose();
        });
        this.restrictedAreaMarkers = [];
        
        this.gridBlocks.forEach(block => {
            this.scene.remove(block);
            if (block.geometry) block.geometry.dispose();
            if (block.material) block.material.dispose();
        });
        this.gridBlocks = [];
        
        // Clear preview
        this.clearPreview();
    }
} 