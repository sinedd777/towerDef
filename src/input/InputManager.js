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
        
        // Callbacks
        this.onTowerPlacedCallback = null;
        this.onTowerMenuUpdateCallback = null;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('click', (e) => this.onMouseClick(e));
        window.addEventListener('contextmenu', (e) => this.onRightClick(e));
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
        const isValid = this.isValidTowerPosition(gridX, gridZ);
        const canAfford = this.gameState.getMoney() >= this.selectedTowerData.cost;
        
        const color = !canAfford ? 0xff0000 : (isValid ? this.selectedTowerData.color : 0xff0000);
        const opacity = !canAfford ? 0.3 : (isValid ? 0.5 : 0.3);
        
        this.previewTower.mesh.material.color.setHex(color);
        this.previewTower.mesh.material.opacity = opacity;
        this.previewTower.rangeIndicator.material.color.setHex(color);
        this.previewTower.rangeIndicator.material.opacity = opacity * 0.4;
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
        
        // Check distance to path segments
        const minPathDistance = 1.5; // Minimum distance from path
        
        for (let i = 0; i < this.pathWaypoints.length - 1; i++) {
            const start = this.pathWaypoints[i];
            const end = this.pathWaypoints[i + 1];
            
            // Calculate distance from point to line segment
            const pathSegment = end.clone().sub(start);
            const pointToStart = new THREE.Vector3(x, 0.1, z).sub(start);
            
            // Project point onto line segment
            const segmentLength = pathSegment.length();
            const t = Math.max(0, Math.min(1, pointToStart.dot(pathSegment) / segmentLength ** 2));
            
            const projection = start.clone().add(pathSegment.multiplyScalar(t));
            const distance = new THREE.Vector3(x, 0.1, z).distanceTo(projection);
            
            if (distance < minPathDistance) {
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
        
        // Make preview tower transparent
        tower.mesh.material.transparent = true;
        tower.mesh.material.opacity = 0.5;
        tower.rangeIndicator.material.transparent = true;
        tower.rangeIndicator.material.opacity = 0.2;
        
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

    getSelectedTowerData() {
        return this.selectedTowerData;
    }

    destroy() {
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('click', this.onMouseClick);
        window.removeEventListener('contextmenu', this.onRightClick);
        window.removeEventListener('resize', this.onWindowResize);
    }
} 