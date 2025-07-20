import * as THREE from 'three';
import { Tower } from '../Tower.js';
import { debugLog } from '../config/DebugConfig.js';
import { TOWER_TYPES } from '../TowerTypes.js';

export class MultiplayerTowerInputManager {
    constructor(scene, camera, renderer, gameState, ground, mazeState, actionDispatcher, localPlayerId) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.gameState = gameState;
        this.ground = ground;
        this.mazeState = mazeState;
        this.actionDispatcher = actionDispatcher;
        this.localPlayerId = localPlayerId;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Turn-based state for cooperative multiplayer
        this.isMyTurn = false; // Will be updated by game
        this.currentTurn = null;
        this.gamePhase = 'defense';
        
        // Tower preview and selection
        this.previewTower = null;
        this.selectedTowerData = null;
        this.selectedTower = null; // For tower management
        
        // Maze obstacles for tower placement validation
        this.mazeObstacles = mazeState ? mazeState.getObstacles() : [];
        this.mazeObstacleSet = new Set(this.mazeObstacles.map(o => `${o.x.toFixed(1)}_${o.z.toFixed(1)}`));
        
        console.log('🏗️ Initial maze obstacles:', {
            count: this.mazeObstacles.length,
            setSize: this.mazeObstacleSet.size,
            firstFew: Array.from(this.mazeObstacleSet).slice(0, 5)
        });
        
        // Callbacks
        this.onTowerMenuUpdateCallback = null;
        this.onTowerSelectedCallback = null;
        this.onTowerDeselectedCallback = null;
        
        // Store bound event handlers for cleanup
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundClick = this.onClick.bind(this);
        this.boundRightClick = this.onRightClick.bind(this);
        this.boundKeyDown = this.onKeyDown.bind(this);
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('mousemove', this.boundMouseMove);
        window.addEventListener('click', this.boundClick);
        window.addEventListener('contextmenu', this.boundRightClick);
        window.addEventListener('keydown', this.boundKeyDown);
        window.addEventListener('resize', () => this.onWindowResize());
    }

    cleanup() {
        // Remove event listeners
        window.removeEventListener('mousemove', this.boundMouseMove);
        window.removeEventListener('click', this.boundClick);
        window.removeEventListener('contextmenu', this.boundRightClick);
        window.removeEventListener('keydown', this.boundKeyDown);
        
        // Clean up preview tower
        this.clearTowerSelection();
        
        console.log('MultiplayerTowerInputManager cleaned up');
    }

    // Turn management for cooperative multiplayer
    updateTurnState(currentTurn, localPlayerId, gamePhase) {
        console.log('🎯 MultiplayerTowerInputManager: updateTurnState called');
        console.log('🎯 currentTurn:', currentTurn, 'localPlayerId:', localPlayerId, 'gamePhase:', gamePhase);
        console.log('🎯 Previous state - currentTurn:', this.currentTurn, 'isMyTurn:', this.isMyTurn);
        
        this.currentTurn = currentTurn;
        this.gamePhase = gamePhase;
        
        // During defense phase, both players can place towers freely (cooperative gameplay)
        if (gamePhase === 'defense') {
            this.isMyTurn = true; // Always allow tower placement during defense
        } else {
            // During building phase, maintain turn-based system for maze building
            this.isMyTurn = (currentTurn === localPlayerId);
        }
        
        console.log('🎯 New state - currentTurn:', this.currentTurn, 'isMyTurn:', this.isMyTurn, `(defense=${gamePhase === 'defense' ? 'free placement' : 'turn-based'})`);
        debugLog(`Turn updated: ${currentTurn}, myTurn: ${this.isMyTurn} (${gamePhase} phase)`, 'TOWER_INPUT');
    }

    onMouseMove(event) {
        // Update mouse position
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update preview tower position if one is selected
        this.updatePreviewTowerPosition();
    }

    updatePreviewTowerPosition() {
        if (!this.selectedTowerData || !this.previewTower || !this.isMyTurn) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            // Snap to nearest cell centre (same as single player)
            const gridX = Math.round(point.x - 0.5) + 0.5;
            const gridZ = Math.round(point.z - 0.5) + 0.5;
            
            // Update preview tower position (same as single player)
            this.previewTower.mesh.position.set(gridX, 1.0, gridZ);
            
            // Update range indicator position if it exists
            if (this.previewTower.rangeIndicator) {
                this.previewTower.rangeIndicator.position.set(gridX, 0.01, gridZ);
            }
            
            // Update preview color based on position validity
            this.updatePreviewAppearance(gridX, gridZ);
        }
    }

    updatePreviewAppearance(gridX, gridZ) {
        if (!this.selectedTowerData || !this.previewTower) return;
        
        const isValid = this.isValidTowerPosition(gridX, gridZ);
        const canAfford = this.gameState.getMoney() >= (this.selectedTowerData?.cost || Infinity);
        const isMyTurnCheck = this.isMyTurn;
        
        // Color logic: red if can't afford or invalid position or not turn, otherwise tower color
        const color = !isMyTurnCheck ? 0xff9999 : (!canAfford ? 0xff0000 : (isValid ? (this.selectedTowerData?.color || 0x4444ff) : 0xff0000));
        const opacity = !isMyTurnCheck ? 0.3 : (!canAfford ? 0.3 : (isValid ? 0.5 : 0.3));
        
        // Update all materials in the tower mesh hierarchy
        this.previewTower.mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        mat.color.setHex(color);
                        mat.opacity = opacity;
                    });
                } else {
                    child.material.color.setHex(color);
                    child.material.opacity = opacity;
                }
            }
        });
        
        // Update range indicator
        if (this.previewTower.rangeIndicator?.material) {
            this.previewTower.rangeIndicator.material.color.setHex(color);
            this.previewTower.rangeIndicator.material.opacity = opacity * 0.4;
        }
    }

    onClick(event) {
        // Check turn-based restrictions for multiplayer (only during building phase)
        if (!this.isMyTurn && this.gamePhase !== 'defense') {
            this.showTurnMessage();
            return;
        }

        // Ignore clicks on UI elements
        if (event.target.closest('.tower-slot')) {
            return;
        }
        
        debugLog('Mouse clicked during defense phase', 'TOWER_INPUT');
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
        
        // Handle tower selection for management
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
                    this.placeTowerViaServer(gridX, gridZ);
                } else {
                    debugLog('Not enough money', 'TOWER_PLACEMENT');
                    this.showInsufficientFundsMessage();
                }
            } else {
                debugLog('Invalid position', 'TOWER_PLACEMENT');
                this.showInvalidPlacementMessage();
            }
        } else {
            debugLog('No ground intersection', 'TOWER_PLACEMENT');
        }
    }

    placeTowerViaServer(gridX, gridZ) {
        console.log(`🚀 Sending tower placement to server:`, {
            type: this.selectedTowerData.id,
            name: this.selectedTowerData.name,
            position: { x: gridX, y: 1.0, z: gridZ },
            cost: this.selectedTowerData.cost
        });
        
        // Send placement via ActionDispatcher
        if (this.actionDispatcher) {
            this.actionDispatcher.placeTower(this.selectedTowerData.id, {
                x: gridX,
                y: 1.0,
                z: gridZ
            });
        } else {
            console.error('❌ No ActionDispatcher available for tower placement');
        }
        
        // Clear tower selection and preview after sending to server
        this.clearTowerSelection();
    }

    isValidTowerPosition(x, z) {
        const mazeKey = `${x.toFixed(1)}_${z.toFixed(1)}`;
        const hasMazeKey = this.mazeObstacleSet.has(mazeKey);
        
        console.log('🔍 CLIENT: Tower validation:', {
            position: { x, z },
            mazeKey,
            hasMazeKey,
            totalObstacles: this.mazeObstacles.length
        });
        
        if (!hasMazeKey) {
            console.log('🔍 Available maze keys (first 5):', Array.from(this.mazeObstacleSet).slice(0, 5));
        }
        
        // Check if position is on a maze block (same as single player)
        if (!hasMazeKey) {
            console.log('❌ CLIENT: Position not on maze block');
            return false;
        }
        
        // Check if there's already a tower at this position
        // TODO: Check against current towers map when available
        // For now, simplified check (server will validate anyway)
        console.log('✅ CLIENT: Position is valid');
        return true;
    }

    handleTowerSelection(event) {
        // Tower selection for management - similar to single player
        // This would handle clicking on existing towers for upgrade/sell
        debugLog('Tower selection for management - not implemented yet', 'TOWER_INPUT');
    }

    onRightClick(event) {
        event.preventDefault();
        
        if (this.selectedTowerData && this.previewTower) {
            this.clearTowerSelection();
        } else if (this.selectedTower) {
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

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Tower selection management (same as single player)
    setSelectedTowerData(towerData) {
        // Only allow tower selection during player's turn
        if (!this.isMyTurn) {
            this.showTurnMessage();
            return;
        }

        debugLog(`Tower selected for placement: ${towerData.name}`, 'TOWER_INPUT');
        
        // Clear previous selection
        this.clearTowerSelection();
        
        this.selectedTowerData = towerData;
        this.createPreviewTower();
    }

    createPreviewTower() {
        if (!this.selectedTowerData || !this.isMyTurn) return;
        
        debugLog('Creating preview tower', 'TOWER_INPUT');
        
        // Create preview tower using the Tower class (same as single player)
        const tower = new Tower(0, 1.0, 0, this.selectedTowerData.id);
        
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
        
        this.previewTower = tower;
        this.scene.add(tower.mesh);
    }

    clearTowerSelection() {
        debugLog('Clearing tower selection', 'TOWER_INPUT');
        
        if (this.previewTower) {
            // Remove preview tower from scene
            this.scene.remove(this.previewTower.mesh);
            
            // Clean up tower resources properly
            this.previewTower.mesh.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            
            this.previewTower = null;
        }
        
        this.selectedTowerData = null;
    }

    /**
     * Refresh maze obstacles from mazeState (call after maze changes)
     */
    refreshMazeObstacles() {
        this.mazeObstacles = this.mazeState ? this.mazeState.getObstacles() : [];
        this.mazeObstacleSet = new Set(this.mazeObstacles.map(o => `${o.x.toFixed(1)}_${o.z.toFixed(1)}`));
        
        console.log('🔄 Refreshed maze obstacles:', {
            count: this.mazeObstacles.length,
            setSize: this.mazeObstacleSet.size,
            firstFew: Array.from(this.mazeObstacleSet).slice(0, 10)
        });
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

    // Callback setters (same interface as single player InputManager)
    setOnTowerMenuUpdateCallback(callback) {
        this.onTowerMenuUpdateCallback = callback;
    }

    setOnTowerSelectedCallback(callback) {
        this.onTowerSelectedCallback = callback;
    }

    setOnTowerDeselectedCallback(callback) {
        this.onTowerDeselectedCallback = callback;
    }

    // Turn restriction messaging
    showTurnMessage() {
        console.log('🚨 showTurnMessage called - currentTurn:', this.currentTurn, 'isMyTurn:', this.isMyTurn);
        
        // Don't show turn messages during defense phase since both players can place towers
        if (this.gamePhase === 'defense') {
            return;
        }
        
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 193, 7, 0.9);
            color: #000;
            padding: 10px 20px;
            border-radius: 5px;
            font-weight: bold;
            z-index: 2000;
            pointer-events: none;
        `;
        
        const turnText = this.currentTurn || 'Unknown';
        message.textContent = `Wait for your turn! It's ${turnText}'s turn.`;
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 2000);
    }

    showInsufficientFundsMessage() {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(244, 67, 54, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-weight: bold;
            z-index: 2000;
            pointer-events: none;
        `;
        message.textContent = `Insufficient funds! Need $${this.selectedTowerData?.cost || 0}`;
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 2000);
    }

    showInvalidPlacementMessage() {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(244, 67, 54, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-weight: bold;
            z-index: 2000;
            pointer-events: none;
        `;
        message.textContent = 'Invalid placement! Towers must be placed on maze blocks.';
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 2000);
    }
} 