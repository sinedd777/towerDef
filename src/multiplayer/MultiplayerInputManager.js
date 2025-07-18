import * as THREE from 'three';

export class MultiplayerInputManager {
    constructor(multiplayerScene, camera, renderer, gameState, localPlayerId, networkManager) {
        this.multiplayerScene = multiplayerScene;
        this.camera = camera;
        this.renderer = renderer;
        this.gameState = gameState;
        this.localPlayerId = localPlayerId; // 'player1' or 'player2'
        this.networkManager = networkManager;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Get player area boundaries from the multiplayer scene
        this.playerArea = this.multiplayerScene.getPlayerArea(this.localPlayerId);
        this.playerBounds = this.playerArea.bounds;
        
        // Current interaction mode: 'maze', 'tower', 'view'
        this.interactionMode = 'maze';
        
        // Selected objects and data
        this.selectedTowerData = null;
        this.selectedShapeData = null;
        this.previewObject = null;
        
        // Callbacks
        this.onValidPlacement = null;
        this.onInvalidPlacement = null;
        this.onObjectSelected = null;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Mouse/touch events
        this.renderer.domElement.addEventListener('click', (event) => this.handleClick(event));
        this.renderer.domElement.addEventListener('mousemove', (event) => this.handleMouseMove(event));
        this.renderer.domElement.addEventListener('contextmenu', (event) => this.handleRightClick(event));
        
        // Touch events for mobile
        this.renderer.domElement.addEventListener('touchstart', (event) => this.handleTouchStart(event));
        this.renderer.domElement.addEventListener('touchend', (event) => this.handleTouchEnd(event));
        
        // Keyboard events
        document.addEventListener('keydown', (event) => this.handleKeyDown(event));
        document.addEventListener('keyup', (event) => this.handleKeyUp(event));
    }
    
    updateMousePosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
    }
    
    handleClick(event) {
        event.preventDefault();
        this.updateMousePosition(event);
        
        const intersects = this.raycaster.intersectObjects(this.multiplayerScene.getScene().children, true);
        
        for (const intersect of intersects) {
            const point = intersect.point;
            
            // Only allow interaction within player's area
            if (this.isInPlayerArea(point)) {
                this.processInteraction(intersect, point);
                break;
            }
        }
    }
    
    handleMouseMove(event) {
        if (!this.selectedTowerData && !this.selectedShapeData) return;
        
        this.updateMousePosition(event);
        this.updatePreview();
    }
    
    handleRightClick(event) {
        event.preventDefault();
        this.cancelCurrentAction();
    }
    
    handleTouchStart(event) {
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.handleClick({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => {}
            });
        }
    }
    
    handleTouchEnd(event) {
        event.preventDefault();
    }
    
    handleKeyDown(event) {
        switch (event.code) {
            case 'Escape':
                this.cancelCurrentAction();
                break;
            case 'KeyR':
                if (this.selectedShapeData) {
                    this.rotateShape();
                }
                break;
            case 'KeyQ':
                this.setInteractionMode('maze');
                break;
            case 'KeyE':
                this.setInteractionMode('tower');
                break;
        }
    }
    
    handleKeyUp(event) {
        // Handle key release events if needed
    }
    
    isInPlayerArea(point) {
        return point.x >= this.playerBounds.minX && 
               point.x <= this.playerBounds.maxX &&
               point.z >= this.playerBounds.minZ && 
               point.z <= this.playerBounds.maxZ;
    }
    
    processInteraction(intersect, point) {
        const object = intersect.object;
        
        // Handle different interaction modes
        switch (this.interactionMode) {
            case 'maze':
                this.handleMazeInteraction(intersect, point);
                break;
            case 'tower':
                this.handleTowerInteraction(intersect, point);
                break;
            case 'view':
                this.handleViewInteraction(intersect, point);
                break;
        }
    }
    
    handleMazeInteraction(intersect, point) {
        if (!this.selectedShapeData) return;
        
        // Check if placement is valid
        if (this.isValidMazePlacement(point)) {
            this.placeMazeBlock(point);
        } else {
            this.showInvalidPlacementFeedback(point);
        }
    }
    
    handleTowerInteraction(intersect, point) {
        const object = intersect.object;
        
        // If clicking on existing tower, select it for management
        if (object.userData.isTower && object.userData.playerId === this.localPlayerId) {
            this.selectTowerForManagement(object);
            return;
        }
        
        // If we have a tower selected for placement
        if (this.selectedTowerData) {
            if (this.isValidTowerPlacement(point, object)) {
                this.placeTower(point);
            } else {
                this.showInvalidPlacementFeedback(point);
            }
        }
    }
    
    handleViewInteraction(intersect, point) {
        const object = intersect.object;
        
        // View mode - just inspect objects without modification
        if (object.userData.isTower || object.userData.isMazeBlock) {
            this.inspectObject(object);
        }
    }
    
    isValidMazePlacement(point) {
        // Convert world position to grid coordinates
        const gridPos = this.multiplayerScene.worldToGrid(point, this.localPlayerId);
        
        // Check bounds
        if (gridPos.x < 0 || gridPos.x >= 20 || gridPos.z < 0 || gridPos.z >= 20) {
            return false;
        }
        
        // Check if position is already occupied
        // This would need to check against current maze state
        return true; // Simplified for now
    }
    
    isValidTowerPlacement(point, object) {
        // Towers can only be placed on maze blocks that belong to the player
        if (!object.userData.isMazeBlock || object.userData.playerId !== this.localPlayerId) {
            return false;
        }
        
        // Check if there's already a tower there
        if (object.userData.hasTower) {
            return false;
        }
        
        // Check if player has enough money
        const towerCost = this.getTowerCost(this.selectedTowerData.type);
        if (this.gameState.money < towerCost) {
            return false;
        }
        
        return true;
    }
    
    placeMazeBlock(point) {
        console.log('Placing maze block at:', point);
        
        // Convert to grid position
        const gridPos = this.multiplayerScene.worldToGrid(point, this.localPlayerId);
        
        // Send placement to network manager
        if (this.networkManager) {
            this.networkManager.placeMazeBlock(gridPos, this.selectedShapeData);
        }
        
        // Create visual representation locally (will be confirmed by server)
        this.createMazeBlockPreview(point);
        
        // Call callback
        if (this.onValidPlacement) {
            this.onValidPlacement('maze', point, this.selectedShapeData);
        }
        
        // Clear selection after placement
        this.clearShapeSelection();
    }
    
    placeTower(point) {
        console.log('Placing tower at:', point);
        
        // Send placement to network manager
        if (this.networkManager) {
            this.networkManager.placeTower(point, this.selectedTowerData);
        }
        
        // Create visual representation locally (will be confirmed by server)
        this.createTowerPreview(point);
        
        // Call callback
        if (this.onValidPlacement) {
            this.onValidPlacement('tower', point, this.selectedTowerData);
        }
        
        // Clear selection after placement
        this.clearTowerSelection();
    }
    
    createMazeBlockPreview(point) {
        // Create a simple cube as preview
        const geometry = new THREE.BoxGeometry(1, 0.5, 1);
        const material = new THREE.MeshLambertMaterial({ 
            color: 0x4CAF50,
            transparent: true,
            opacity: 0.7
        });
        
        const preview = new THREE.Mesh(geometry, material);
        preview.position.copy(point);
        preview.position.y = 0.25;
        preview.userData.isPreview = true;
        preview.userData.playerId = this.localPlayerId;
        
        this.multiplayerScene.addToPlayerArea(preview, this.localPlayerId);
        
        // Auto-remove preview after a short time
        setTimeout(() => {
            this.multiplayerScene.removeFromScene(preview);
        }, 2000);
    }
    
    createTowerPreview(point) {
        // Create a simple tower preview
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 8);
        const material = new THREE.MeshLambertMaterial({ 
            color: 0x2196F3,
            transparent: true,
            opacity: 0.7
        });
        
        const preview = new THREE.Mesh(geometry, material);
        preview.position.copy(point);
        preview.position.y = 0.5;
        preview.userData.isPreview = true;
        preview.userData.playerId = this.localPlayerId;
        
        this.multiplayerScene.addToPlayerArea(preview, this.localPlayerId);
        
        // Auto-remove preview after a short time
        setTimeout(() => {
            this.multiplayerScene.removeFromScene(preview);
        }, 2000);
    }
    
    updatePreview() {
        // Remove existing preview
        if (this.previewObject) {
            this.multiplayerScene.removeFromScene(this.previewObject);
            this.previewObject = null;
        }
        
        const intersects = this.raycaster.intersectObjects(this.multiplayerScene.getScene().children, true);
        
        for (const intersect of intersects) {
            const point = intersect.point;
            
            if (this.isInPlayerArea(point)) {
                this.createInteractionPreview(point);
                break;
            }
        }
    }
    
    createInteractionPreview(point) {
        let geometry, material;
        
        if (this.selectedShapeData) {
            // Create maze block preview
            geometry = new THREE.BoxGeometry(1, 0.5, 1);
            material = new THREE.MeshLambertMaterial({ 
                color: 0x4CAF50,
                transparent: true,
                opacity: 0.3,
                wireframe: true
            });
        } else if (this.selectedTowerData) {
            // Create tower preview
            geometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 8);
            material = new THREE.MeshLambertMaterial({ 
                color: 0x2196F3,
                transparent: true,
                opacity: 0.3,
                wireframe: true
            });
        } else {
            return;
        }
        
        this.previewObject = new THREE.Mesh(geometry, material);
        this.previewObject.position.copy(point);
        this.previewObject.position.y = this.selectedTowerData ? 0.5 : 0.25;
        this.previewObject.userData.isPreview = true;
        
        this.multiplayerScene.addToPlayerArea(this.previewObject, this.localPlayerId);
    }
    
    showInvalidPlacementFeedback(point) {
        console.log('Invalid placement at:', point);
        
        // Create red indicator for invalid placement
        const geometry = new THREE.RingGeometry(0.3, 0.5, 8);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            transparent: true,
            opacity: 0.8
        });
        
        const indicator = new THREE.Mesh(geometry, material);
        indicator.position.copy(point);
        indicator.position.y = 0.01;
        indicator.rotation.x = -Math.PI / 2;
        
        this.multiplayerScene.addToPlayerArea(indicator, this.localPlayerId);
        
        // Animate and remove
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 1000; // 1 second animation
            
            if (progress < 1) {
                indicator.material.opacity = 0.8 * (1 - progress);
                indicator.scale.setScalar(1 + progress);
                requestAnimationFrame(animate);
            } else {
                this.multiplayerScene.removeFromScene(indicator);
            }
        };
        animate();
        
        if (this.onInvalidPlacement) {
            this.onInvalidPlacement(point);
        }
    }
    
    selectTowerForManagement(towerObject) {
        console.log('Selected tower for management:', towerObject);
        
        if (this.onObjectSelected) {
            this.onObjectSelected(towerObject);
        }
    }
    
    inspectObject(object) {
        console.log('Inspecting object:', object);
        // Show information about the object
    }
    
    setInteractionMode(mode) {
        this.interactionMode = mode;
        console.log('Interaction mode set to:', mode);
        
        // Clear current selections when changing modes
        if (mode !== 'maze') this.clearShapeSelection();
        if (mode !== 'tower') this.clearTowerSelection();
    }
    
    setSelectedTowerData(towerData) {
        this.selectedTowerData = towerData;
        this.setInteractionMode('tower');
        console.log('Selected tower data:', towerData);
    }
    
    setSelectedShapeData(shapeData) {
        this.selectedShapeData = shapeData;
        this.setInteractionMode('maze');
        console.log('Selected shape data:', shapeData);
    }
    
    clearTowerSelection() {
        this.selectedTowerData = null;
        if (this.previewObject) {
            this.multiplayerScene.removeFromScene(this.previewObject);
            this.previewObject = null;
        }
    }
    
    clearShapeSelection() {
        this.selectedShapeData = null;
        if (this.previewObject) {
            this.multiplayerScene.removeFromScene(this.previewObject);
            this.previewObject = null;
        }
    }
    
    cancelCurrentAction() {
        this.clearTowerSelection();
        this.clearShapeSelection();
        this.setInteractionMode('view');
        console.log('Cancelled current action');
    }
    
    rotateShape() {
        if (this.selectedShapeData && this.selectedShapeData.rotate) {
            this.selectedShapeData.rotate();
            console.log('Rotated shape');
        }
    }
    
    getTowerCost(towerType) {
        const costs = {
            basic: 20,
            sniper: 30,
            cannon: 40,
            missile: 50
        };
        return costs[towerType] || 20;
    }
    
    // Enable/disable input handling
    setEnabled(enabled) {
        if (enabled) {
            this.renderer.domElement.style.pointerEvents = 'auto';
        } else {
            this.renderer.domElement.style.pointerEvents = 'none';
            this.cancelCurrentAction();
        }
    }
    
    // Callback setters
    setOnValidPlacement(callback) { this.onValidPlacement = callback; }
    setOnInvalidPlacement(callback) { this.onInvalidPlacement = callback; }
    setOnObjectSelected(callback) { this.onObjectSelected = callback; }
    
    // Cleanup
    cleanup() {
        if (this.previewObject) {
            this.multiplayerScene.removeFromScene(this.previewObject);
            this.previewObject = null;
        }
        
        // Remove event listeners
        this.renderer.domElement.removeEventListener('click', this.handleClick);
        this.renderer.domElement.removeEventListener('mousemove', this.handleMouseMove);
        this.renderer.domElement.removeEventListener('contextmenu', this.handleRightClick);
        this.renderer.domElement.removeEventListener('touchstart', this.handleTouchStart);
        this.renderer.domElement.removeEventListener('touchend', this.handleTouchEnd);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }
} 