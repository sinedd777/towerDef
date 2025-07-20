import * as THREE from 'three';

export class MazeInputManager {
    constructor(scene, camera, renderer, ground, mazeState, mazeBuilderUI, actionDispatcher = null) {
        
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.ground = ground;
        this.mazeState = mazeState;
        this.mazeBuilderUI = mazeBuilderUI;
        this.actionDispatcher = actionDispatcher; // NEW ARCHITECTURE: Use ActionDispatcher instead of NetworkManager
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Turn-based state for cooperative multiplayer
        this.isMyTurn = true; // Default to true for single player
        this.currentTurn = null;
        this.gamePhase = 'building';
        
        // Add debouncing for key presses and clicks
        this.lastKeyPress = 0;
        this.lastClick = 0;
        this.keyDebounceTime = 200; // 200ms debounce
        this.clickDebounceTime = 300; // 300ms debounce for clicks
        
        // Store bound event handlers for cleanup
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundClick = this.onClick.bind(this);
        this.boundKeyDown = this.onKeyDown.bind(this);
        
        this.setupEventListeners();
    }

    // Turn management for cooperative multiplayer
    updateTurnState(currentTurn, localPlayerId, gamePhase) {
        this.currentTurn = currentTurn;
        this.gamePhase = gamePhase;
        this.isMyTurn = (currentTurn === localPlayerId) && (gamePhase === 'building');
        
        // Update UI visual state based on turn
        this.updateUIForTurn();
    }

    updateUIForTurn() {
        // Add visual indicators if not player's turn
        const container = document.querySelector('#card-container');
        if (container) {
            if (this.isMyTurn) {
                container.classList.remove('disabled-turn');
                container.style.opacity = '1.0';
                container.style.pointerEvents = 'auto';
            } else {
                container.classList.add('disabled-turn');
                container.style.opacity = '0.6';
                container.style.pointerEvents = 'none';
            }
        }
    }

    setupEventListeners() {
        window.addEventListener('mousemove', this.boundMouseMove);
        window.addEventListener('click', this.boundClick);
        window.addEventListener('keydown', this.boundKeyDown);
    }

    cleanup() {
        // Remove event listeners
        window.removeEventListener('mousemove', this.boundMouseMove);
        window.removeEventListener('click', this.boundClick);
        window.removeEventListener('keydown', this.boundKeyDown);
        
        // Clear any preview shapes if they exist
        if (this.mazeState.shapePreview) {
            this.scene.remove(this.mazeState.shapePreview);
            this.mazeState.shapePreview = null;
        }
    }

    onKeyDown(event) {
        const currentTime = Date.now();
        if (currentTime - this.lastKeyPress < this.keyDebounceTime) {
            return;
        }
        this.lastKeyPress = currentTime;
        
        if (event.key.toLowerCase() === 't') {
            // Select the first available shape from hand
            if (this.mazeState.currentShapeHand.length > 0) {
                const nextShape = this.mazeState.currentShapeHand[0];
                this.mazeState.selectShape(nextShape);
                this.mazeBuilderUI.updateShapeSelection(nextShape);
            }
        } else if (event.key.toLowerCase() === 'r') {
            this.mazeState.rotateSelectedShape();
        }
    }

    onMouseMove(event) {
        // Skip if clicking on UI elements
        if (event.target.closest('#card-container')) {
            return;
        }
        
        // Update mouse position
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update preview position if shape is selected
        if (this.mazeState.selectedShape) {
            this.updatePreviewPosition();
        }
    }

    updatePreviewPosition() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.mazeState.updatePreview(point.x, point.z);
        }
    }

    onClick(event) {
        // Prevent any event bubbling that might cause multiple triggers
        event.preventDefault();
        event.stopPropagation();
        
        const clickTime = Date.now();
        
        // Add click debouncing
        if (clickTime - this.lastClick < this.clickDebounceTime) {
            return;
        }
        this.lastClick = clickTime;
        
        // Skip if clicking on UI elements
        if (event.target.closest('#card-container')) {
            return;
        }

        // Check turn-based restrictions for multiplayer
        if (this.actionDispatcher && !this.isMyTurn) {
            this.showTurnMessage();
            return;
        }

        if (!this.mazeState.selectedShape) {
            return;
        }
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            
            // Store shape name before placement (since it gets cleared)
            const shapeName = this.mazeState.selectedShape.name;
            
            // For multiplayer, send placement to server; for single player, place locally
            if (this.actionDispatcher) {
                // Multiplayer mode: send to server for validation and synchronization via ActionDispatcher
                this.sendShapePlacementToServer(shapeName, point.x, point.z);
                // Important: Update the click debounce time after sending
                this.lastClick = Date.now();
            } else {
                // Single player mode: place locally
                if (this.mazeState.placeShape(point.x, point.z)) {
                    // Shape placed successfully
                    this.mazeBuilderUI.onShapePlaced();
                    
                    // Important: Update the click debounce time after successful placement
                    this.lastClick = Date.now();
                    } else {
                    // Invalid placement
                    this.flashInvalidPlacement();
                }
            }
        } else {
        }
    }

    flashInvalidPlacement() {
        // Create a visual feedback for invalid placement
        if (this.mazeState.shapePreview) {
            const originalColor = this.mazeState.selectedShape.color;
            
            // Flash red
            this.mazeState.shapePreview.material.color.setHex(0xff0000);
            this.mazeState.shapePreview.material.opacity = 0.8;
            
            // Return to original color after a short delay
            setTimeout(() => {
                if (this.mazeState.shapePreview) {
                    this.mazeState.shapePreview.material.color.setHex(originalColor);
                    this.mazeState.shapePreview.material.opacity = 0.6;
                }
            }, 200);
        }
    }

    sendShapePlacementToServer(shapeName, x, z) {
        if (!this.actionDispatcher || !this.mazeState.selectedShape) {
            console.error('Cannot send shape placement: missing ActionDispatcher or selected shape');
            return;
        }

        // Use the same grid snapping as single player: grid center coordinates
        const gridX = Math.floor(x) + 0.5;
        const gridZ = Math.floor(z) + 0.5;

        // Prepare shape data to send to server
        const shapeData = {
            shape: shapeName,
            positions: this.mazeState.selectedShape.cells.map(cell => ({
                x: gridX + cell[0],  // Use grid center coordinates like single player
                z: gridZ + cell[1]
            })),
            color: this.mazeState.selectedShape.color,
            gridX: gridX,
            gridZ: gridZ
        };

        console.log('🧩 Sending maze shape to server:', {
            shapeName,
            gridPosition: { x: gridX, z: gridZ },
            positions: shapeData.positions
        });

        // Send to server via ActionDispatcher (NEW ARCHITECTURE)
        this.actionDispatcher.placeMazeShape(shapeData, { x: gridX, z: gridZ });
    }

    showTurnMessage() {
        // Show a brief message indicating it's not the player's turn
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
        message.textContent = `Wait for your turn! It's ${this.currentTurn}'s turn.`;
        document.body.appendChild(message);
        
        // Remove message after 2 seconds
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 2000);
    }
} 