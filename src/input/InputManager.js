import * as THREE from 'three';
import { Tower } from '../Tower.js';
import { debugLog } from '../config/DebugConfig.js';
import { Pathfinding } from '../Pathfinding.js';

export class InputManager {
    constructor(scene, camera, renderer, gameState, ground, pathWaypoints, towers, mazeState) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.gameState = gameState;
        this.ground = ground;
        this.pathWaypoints = pathWaypoints;
        this.towers = towers;

        // Maze information – towers can only be placed on top of these blocks
        this.mazeObstacles = mazeState ? mazeState.getObstacles() : [];
        // Create a quick-lookup set for validity checks
        this.mazeObstacleSet = new Set(this.mazeObstacles.map(o => `${o.x.toFixed(1)}_${o.z.toFixed(1)}`));
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.previewTower = null;
        this.selectedTowerData = null;
        
        // Tower selection state
        this.selectedTower = null;
        
        // Callbacks
        this.onTowerPlacedCallback = null;
        this.onTowerMenuUpdateCallback = null;
        this.onTowerSelectedCallback = null;
        this.onTowerDeselectedCallback = null;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('click', (e) => this.onMouseClick(e));
        window.addEventListener('contextmenu', (e) => this.onRightClick(e));
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('resize', () => this.onWindowResize());
    }

    onMouseMove(event) {
        // Update mouse position
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update preview tower position if one is selected
        this.updatePreviewTowerPosition();
    }

    updatePreviewTowerPosition() {
        if (!this.selectedTowerData || !this.previewTower) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            // Snap to nearest cell centre (handles negative and positive correctly)
            const gridX = Math.round(point.x - 0.5) + 0.5;
            const gridZ = Math.round(point.z - 0.5) + 0.5;
            
            // Update preview tower position (center y = 1.0)
            this.previewTower.mesh.position.set(gridX, 1.0, gridZ);
            this.previewTower.rangeIndicator.position.set(gridX, 0.01, gridZ);
            
            // Update preview color based on position validity
            this.updatePreviewAppearance(gridX, gridZ);
        }
    }

    updatePreviewAppearance(gridX, gridZ) {
        if (!this.selectedTowerData || !this.previewTower) return;
        
        const isValid = this.isValidTowerPosition(gridX, gridZ);
        const canAfford = this.gameState.getMoney() >= (this.selectedTowerData?.cost || Infinity);
        
        // Default to blue if no color specified
        const defaultColor = 0x4444ff;
        const color = !canAfford ? 0xff0000 : (isValid ? (this.selectedTowerData?.color || defaultColor) : 0xff0000);
        const opacity = !canAfford ? 0.3 : (isValid ? 0.5 : 0.3);
        
        if (this.previewTower.mesh?.material) {
            this.previewTower.mesh.material.color.setHex(color);
            this.previewTower.mesh.material.opacity = opacity;
        }
        
        if (this.previewTower.rangeIndicator?.material) {
            this.previewTower.rangeIndicator.material.color.setHex(color);
            this.previewTower.rangeIndicator.material.opacity = opacity * 0.4;
        }
    }

    onMouseClick(event) {
        // Ignore clicks on UI elements
        if (event.target.closest('.tower-slot')) {
            return;
        }
        
        debugLog('Mouse clicked', 'UI_INTERACTIONS');
        if (event.button !== 0) return; // Only handle left click
        
        // Update mouse coordinates for raycaster
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Handle tower placement if a tower is selected
        if (this.selectedTowerData && this.previewTower) {
            this.handleTowerPlacement();
            return;
        }
        
        // Handle tower selection
        this.handleTowerSelection(event);
    }

    handleTowerPlacement() {
        debugLog(`Attempting to place tower: ${this.selectedTowerData.name}`, 'TOWER_PLACEMENT');
        
        const intersects = this.raycaster.intersectObject(this.ground);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const gridX = Math.round(point.x - 0.5) + 0.5;
            const gridZ = Math.round(point.z - 0.5) + 0.5;
            
            debugLog(`Grid position: ${gridX}, ${gridZ}`, 'TOWER_PLACEMENT');
            
            if (this.isValidTowerPosition(gridX, gridZ)) {
                debugLog('Position is valid', 'TOWER_PLACEMENT');
                
                if (this.gameState.getMoney() >= this.selectedTowerData.cost) {
                    this.placeTower(gridX, gridZ);
                } else {
                    debugLog('Not enough money', 'TOWER_PLACEMENT');
                }
            } else {
                debugLog('Invalid position', 'TOWER_PLACEMENT');
            }
        } else {
            debugLog('No ground intersection', 'TOWER_PLACEMENT');
        }
    }

    placeTower(gridX, gridZ) {
        debugLog(`Creating tower at: ${gridX}, ${gridZ}`, 'TOWER_PLACEMENT');
        
        // Create new tower using the Tower class
        const tower = new Tower(
            gridX,
            1.0, // Center height adjusted to sit on top of block
            gridZ,
            this.selectedTowerData.id
        );
        
        if (tower) {
            this.towers.push(tower);
            this.scene.add(tower.mesh);
            this.gameState.spendMoney(this.selectedTowerData.cost);
            
            debugLog('Tower created successfully', 'TOWER_PLACEMENT');
            
            // Clean up preview and selection
            this.clearTowerSelection();
            
            // Notify callback
            if (this.onTowerPlacedCallback) {
                this.onTowerPlacedCallback(tower);
            }
            
            if (this.onTowerMenuUpdateCallback) {
                this.onTowerMenuUpdateCallback();
            }
        } else {
            console.error('Failed to create tower');
        }
    }

    onRightClick(event) {
        event.preventDefault();
        
        if (this.selectedTowerData && this.previewTower) {
            this.clearTowerSelection();
        } else if (this.selectedTower) {
            // Right-click deselects tower
            this.deselectTower();
        }
    }
    
    onKeyDown(event) {
        // ESC key deselects tower or clears tower placement
        if (event.key === 'Escape') {
            if (this.selectedTowerData && this.previewTower) {
                this.clearTowerSelection();
            } else if (this.selectedTower) {
                this.deselectTower();
            }
            event.preventDefault();
        }
    }
    
    handleTowerSelection(event) {
        // Create raycaster objects for tower detection
        const towerMeshes = this.towers.map(tower => tower.mesh);
        
        if (towerMeshes.length === 0) {
            // No towers to select, deselect current if any
            if (this.selectedTower) {
                this.deselectTower();
            }
            return;
        }
        
        // Check for tower intersections
        const towerIntersects = this.raycaster.intersectObjects(towerMeshes, true);
        
        if (towerIntersects.length > 0) {
            // Find which tower was clicked
            let clickedTower = null;
            for (const tower of this.towers) {
                if (towerIntersects[0].object.parent === tower.mesh || 
                    towerIntersects[0].object === tower.mesh ||
                    tower.mesh.getObjectById(towerIntersects[0].object.id)) {
                    clickedTower = tower;
                    break;
                }
            }
            
            if (clickedTower) {
                if (this.selectedTower === clickedTower) {
                    // Clicking the same tower deselects it
                    this.deselectTower();
                } else {
                    // Select the new tower
                    this.selectTower(clickedTower);
                }
                return;
            }
        }
        
        // No tower was clicked, deselect current tower if any
        if (this.selectedTower) {
            this.deselectTower();
        }
    }
    
    selectTower(tower) {
        // Deselect previous tower
        if (this.selectedTower) {
            this.selectedTower.setSelected(false);
        }
        
        // Select new tower
        this.selectedTower = tower;
        tower.setSelected(true);
        
        debugLog('Tower selected:', tower.getTowerInfo());
        
        // Notify callback
        if (this.onTowerSelectedCallback) {
            this.onTowerSelectedCallback(tower);
        }
    }
    
    deselectTower() {
        if (!this.selectedTower) return;
        
        this.selectedTower.setSelected(false);
        const deselectedTower = this.selectedTower;
        this.selectedTower = null;
        
        debugLog('Tower deselected');
        
        // Notify callback
        if (this.onTowerDeselectedCallback) {
            this.onTowerDeselectedCallback(deselectedTower);
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update label renderer if it exists
        const labelRenderer = document.querySelector('.css2d-renderer');
        if (labelRenderer) {
            labelRenderer.style.width = window.innerWidth + 'px';
            labelRenderer.style.height = window.innerHeight + 'px';
        }
    }

    isValidTowerPosition(x, z) {
        // Towers must sit on a maze block
        if (!this.mazeObstacleSet.has(`${x.toFixed(1)}_${z.toFixed(1)}`)) {
            return false;
        }

        // Check if position is occupied by another tower
        for (const tower of this.towers) {
            const pos = tower.getPosition();
            if (pos.x === x && pos.z === z) {
                return false;
            }
        }
        
        // Check if placing tower here would block all possible paths
        const tempObstacles = [...this.getAllObstacles(), { x, z }];
        const pathfinding = new Pathfinding();
        const path = pathfinding.findPath(
            { x: -8, z: -8 }, // Enemy start position
            { x: 8, z: 8 },   // Enemy end position
            tempObstacles
        );
        
        // If no valid path exists with this tower placement, it's not valid
        if (!path) {
            return false;
        }
        
        return true;
    }
    
    getAllObstacles() {
        // Combine maze blocks (static) and existing towers (dynamic)
        const obstacles = [...this.mazeObstacles];
        for (const tower of this.towers) {
            const pos = tower.getPosition();
            obstacles.push({ x: pos.x, z: pos.z });
        }
        return obstacles;
    }

    // Tower selection management
    setSelectedTowerData(towerData) {
        debugLog(`Setting selected tower data: ${towerData ? towerData.name : 'null'}`, 'TOWER_PLACEMENT');
        
        this.selectedTowerData = towerData;
        
        // Clean up any existing preview
        if (this.previewTower) {
            this.scene.remove(this.previewTower.mesh);
            this.scene.remove(this.previewTower.rangeIndicator);
        }
        
        // Create new preview tower if data provided
        if (towerData) {
            this.previewTower = this.createPreviewTower(towerData);
            if (this.previewTower) {
                this.scene.add(this.previewTower.mesh);
                this.scene.add(this.previewTower.rangeIndicator);
                debugLog('Preview tower created', 'TOWER_PLACEMENT');
            } else {
                console.error('Failed to create preview tower');
            }
        } else {
            this.previewTower = null;
        }
    }

    createPreviewTower(towerData) {
        debugLog(`Creating preview tower for: ${towerData.name}`, 'TOWER_PLACEMENT');
        
        // Create preview tower using the Tower class
        const tower = new Tower(0, 1.0, 0, towerData.id);
        
        // Make preview tower transparent - traverse all materials in the group
        tower.mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        mat.transparent = true;
                        mat.opacity = 0.5;
                    });
                } else {
                    child.material.transparent = true;
                    child.material.opacity = 0.5;
                }
            }
        });
        
        // Make range indicator transparent
        if (tower.rangeIndicator && tower.rangeIndicator.material) {
            tower.rangeIndicator.material.transparent = true;
            tower.rangeIndicator.material.opacity = 0.2;
        }
        
        return tower;
    }

    clearTowerSelection() {
        this.setSelectedTowerData(null);
    }

    setOnTowerPlacedCallback(callback) {
        this.onTowerPlacedCallback = callback;
    }

    setOnTowerMenuUpdateCallback(callback) {
        this.onTowerMenuUpdateCallback = callback;
    }
    
    setOnTowerSelectedCallback(callback) {
        this.onTowerSelectedCallback = callback;
    }
    
    setOnTowerDeselectedCallback(callback) {
        this.onTowerDeselectedCallback = callback;
    }

    getSelectedTowerData() {
        return this.selectedTowerData;
    }
    
    getSelectedTower() {
        return this.selectedTower;
    }

    destroy() {
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('click', this.onMouseClick);
        window.removeEventListener('contextmenu', this.onRightClick);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('resize', this.onWindowResize);
    }
} 