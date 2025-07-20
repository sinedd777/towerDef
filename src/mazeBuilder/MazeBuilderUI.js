export class MazeBuilderUI {
    constructor(mazeState, gameState, isMultiplayer = false) {
        this.mazeState = mazeState;
        this.gameState = gameState;
        this.isMultiplayer = isMultiplayer;  // NEW: Track if this is multiplayer mode
        this.container = null;
        this.playingCard = null;
        this.cardStack = null;
        this.shapesCounter = null;
        
        // Callback for single player mode defense phase start
        this.onStartDefenseCallback = null;
        
        this.createPlayingCardInterface();
        this.updateCardDisplay();
    }

    // RESTORED: setOnStartDefenseCallback method for single player compatibility
    setOnStartDefenseCallback(callback) {
        this.onStartDefenseCallback = callback;
    }

    createPlayingCardInterface() {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'card-container';
        this.container.style.cssText = `
            position: fixed;
            top: 0px;
            right: 20px;
            transform: scale(0.8);
            perspective: 1000px;
            z-index: 1000;
            font-family: Arial, sans-serif;
        `;

        // Create card stack container
        this.cardStack = document.createElement('div');
        this.cardStack.style.cssText = `
            position: relative;
            transform-style: preserve-3d;
            transition: all 0.3s ease;
        `;

        // Create stack effect cards (background cards)
        for (let i = 2; i >= 0; i--) {
            const stackCard = document.createElement('div');
            stackCard.className = 'stack-card';
            stackCard.style.cssText = `
                position: absolute;
                width: 240px;
                height: 336px;
                background: #f0f0f0;
                border-radius: 12px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                transform: translateZ(-${(i + 1) * 5}px) translateY(${(i + 1) * 2}px) translateX(${(i + 1) * 2}px);
                opacity: ${0.7 - (i * 0.1)};
                border: 2px solid #ddd;
            `;
            this.cardStack.appendChild(stackCard);
        }

        // Create main playing card
        this.playingCard = document.createElement('div');
        this.playingCard.className = 'playing-card';
        this.playingCard.style.cssText = `
            position: relative;
            width: 240px;
            height: 336px;
            background: #f0f0f0;
            border-radius: 12px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
            transform-style: preserve-3d;
            transition: all 0.3s ease;
            border: 2px solid #333;
            cursor: pointer;
            transform: translateZ(0px);
        `;

        // Create corner indicators
        this.createCornerIndicators();

        // Create center shape display
        this.createCenterShapeDisplay();

        // Create hover instructions panel
        this.createInstructionsPanel();

        // Add hover event listeners
        this.playingCard.addEventListener('mouseenter', () => this.showInstructions());
        this.playingCard.addEventListener('mouseleave', () => this.hideInstructions());

        this.cardStack.appendChild(this.playingCard);
        this.container.appendChild(this.cardStack);

        // Create shapes remaining counter
        this.createShapesCounter();

        // Create start defense button (for single player mode)
        this.createStartButton();

        document.body.appendChild(this.container);
    }

    createCornerIndicators() {
        // Top-left corner
        this.topLeftCorner = document.createElement('div');
        this.topLeftCorner.style.cssText = `
            position: absolute;
            top: 12px;
            left: 12px;
            width: 40px;
            height: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;

        // Bottom-right corner (rotated)
        this.bottomRightCorner = document.createElement('div');
        this.bottomRightCorner.style.cssText = `
            position: absolute;
            bottom: 12px;
            right: 12px;
            width: 40px;
            height: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transform: rotate(180deg);
        `;

        this.playingCard.appendChild(this.topLeftCorner);
        this.playingCard.appendChild(this.bottomRightCorner);
    }

    createCenterShapeDisplay() {
        this.centerDisplay = document.createElement('div');
        this.centerDisplay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-width: 35px;
            min-height: 35px;
        `;

        this.playingCard.appendChild(this.centerDisplay);
    }

    createInstructionsPanel() {
        this.instructionsPanel = document.createElement('div');
        this.instructionsPanel.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-size: 14px;
            line-height: 1.6;
            padding: 20px;
            box-sizing: border-box;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
            text-align: center;
        `;

        this.instructionsPanel.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; font-size: 16px;">Controls</div>
            <div>• Press T to pick up next shape</div>
            <div>• Press R to rotate shape</div>
            <div style="margin-top: 10px; font-style: italic;">Block enemy paths strategically</div>
        `;

        this.playingCard.appendChild(this.instructionsPanel);
    }

    createShapesCounter() {
        this.shapesCounter = document.createElement('div');
        this.shapesCounter.style.cssText = `
            margin-top: 20px;
            text-align: center;
            color: white;
            font-size: 16px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        `;
        this.container.appendChild(this.shapesCounter);
    }

    createStartButton() {
        // No Start Defense button needed in single player mode - auto-starts when shapes run out
        // Only needed for multiplayer mode (but currently not used there either)
        console.log('Skipping Start Defense button creation - automatic progression used');
        return;
    }

    updateCardDisplay() {
        const shapesRemaining = this.mazeState.currentShapeHand.length;
        console.log('Updating card display. Shapes remaining:', shapesRemaining);
        console.log('Current hand:', this.mazeState.currentShapeHand.map(s => s.name));
        
        // Update shapes counter
        this.shapesCounter.textContent = `Shapes remaining: ${shapesRemaining}`;

        // Hide UI if no shapes remaining
        if (shapesRemaining === 0) {
            if (this.cardStack) {
                this.cardStack.style.display = 'none';
            }
            if (this.shapesCounter) {
                this.shapesCounter.style.display = 'none';
            }
            
            if (this.isMultiplayer) {
                // Show waiting message in multiplayer mode
                this.showWaitingForOtherPlayer();
            } else {
                // In single player mode, automatically start defense phase
                console.log('Single player shapes exhausted - automatically starting defense phase');
                if (this.onStartDefenseCallback) {
                    this.onStartDefenseCallback();
                }
            }
            return;
        }

        // Show everything if shapes available
        if (this.cardStack) {
            this.cardStack.style.display = 'block';
            this.cardStack.style.opacity = '1';
        }
        if (this.shapesCounter) {
            this.shapesCounter.style.display = 'block';
        }
        if (this.playingCard) {
            this.playingCard.style.opacity = '1';
            this.playingCard.style.transform = 'scale(1)';
        }

        // Get current shape
        const currentShape = this.mazeState.currentShapeHand[0];
        if (currentShape) {
            console.log('Updating display with shape:', currentShape.name);
            this.updateShapeDisplay(currentShape);
        } else {
            console.log('No shape to display, clearing shape display');
            this.clearShapeDisplay();
        }
    }

    /**
     * Show a waiting message when this player is done but others aren't
     */
    showWaitingForOtherPlayer() {
        // Create or update waiting message
        let waitingElement = document.getElementById('waiting-for-players');
        if (!waitingElement) {
            waitingElement = document.createElement('div');
            waitingElement.id = 'waiting-for-players';
            waitingElement.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                z-index: 1000;
                font-family: Arial, sans-serif;
            `;
            document.body.appendChild(waitingElement);
        }
        
        waitingElement.innerHTML = `
            <h3>✅ Your maze is complete!</h3>
            <p>Waiting for other players to finish...</p>
            <div class="spinner" style="
                border: 3px solid #f3f3f3;
                border-top: 3px solid #3498db;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                margin: 10px auto;
            "></div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
    }

    /**
     * Hide the waiting message (called when defense phase actually starts)
     */
    hideWaitingMessage() {
        const waitingElement = document.getElementById('waiting-for-players');
        if (waitingElement) {
            waitingElement.remove();
        }
    }

    updateShapeDisplay(shape) {
        const shapeColor = `#${shape.color.toString(16).padStart(6, '0')}`;
        
        // Update corner indicators
        this.updateCornerIndicator(this.topLeftCorner, shape, shapeColor);
        this.updateCornerIndicator(this.bottomRightCorner, shape, shapeColor);

        // Update center display
        this.updateCenterDisplay(shape, shapeColor);
    }

    updateCornerIndicator(cornerElement, shape, color) {
        cornerElement.innerHTML = '';
        
        // Create mini grid for corner
        const miniGrid = document.createElement('div');
        miniGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 8px);
            grid-template-rows: repeat(4, 8px);
            gap: 1px;
        `;

        // Fill mini grid
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const cell = document.createElement('div');
                const isShapeCell = shape.cells.some(([x, y]) => x === col && y === row);
                
                cell.style.cssText = `
                    width: 8px;
                    height: 8px;
                    background: ${isShapeCell ? color : 'transparent'};
                    border-radius: 1px;
                `;
                miniGrid.appendChild(cell);
            }
        }

        cornerElement.appendChild(miniGrid);
    }

    updateCenterDisplay(shape, color) {
        this.centerDisplay.innerHTML = '';

        // Calculate shape bounds to center it
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        shape.cells.forEach(([x, y]) => {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });
        
        const width = (maxX - minX + 1) * 35;
        const height = (maxY - minY + 1) * 35;

        // Create a container for the shape cells only
        const shapeContainer = document.createElement('div');
        shapeContainer.style.cssText = `
            position: relative;
            width: ${width}px;
            height: ${height}px;
        `;

        // Only create divs for active shape cells, with adjusted positions
        shape.cells.forEach(([x, y]) => {
            const cell = document.createElement('div');
            cell.style.cssText = `
                position: absolute;
                width: 35px;
                height: 35px;
                left: ${(x - minX) * 35}px;
                top: ${(y - minY) * 35}px;
                background: ${color};
                border: 2px solid #333;
                border-radius: 4px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                transition: all 0.3s ease;
            `;
            shapeContainer.appendChild(cell);
        });

        this.centerDisplay.appendChild(shapeContainer);
    }

    clearShapeDisplay() {
        this.topLeftCorner.innerHTML = '';
        this.bottomRightCorner.innerHTML = '';
        this.centerDisplay.innerHTML = '';
    }

    showInstructions() {
        this.instructionsPanel.style.opacity = '1';
        this.instructionsPanel.style.pointerEvents = 'auto';
    }

    hideInstructions() {
        this.instructionsPanel.style.opacity = '0';
        this.instructionsPanel.style.pointerEvents = 'none';
    }

    // Animation for card selection (when pressing T)
    playCardSelectionAnimation() {
        return new Promise((resolve) => {
            // Simple fade out
            this.playingCard.style.opacity = '0';
            this.playingCard.style.transform = 'scale(0.95)';

            setTimeout(() => {
                // Update the card content while it's invisible
                this.updateCardDisplay();
                
                // Fade back in
                this.playingCard.style.opacity = '1';
                this.playingCard.style.transform = 'scale(1)';
                resolve();
            }, 200);
        });
    }

    // No longer need updateStartButton as we've removed the button

    // Called when shape is placed
    onShapePlaced() {
        console.log('Shape placed! Current hand before update:', this.mazeState.currentShapeHand.map(s => s.name));
        this.playCardSelectionAnimation();
        console.log('Shape placed! Current hand after update:', this.mazeState.currentShapeHand.map(s => s.name));
    }

    // Update shape selection (visual feedback)
    updateShapeSelection(shape) {
        // Add subtle glow effect to indicate selection
        this.playingCard.style.boxShadow = '0 8px 16px rgba(76, 175, 80, 0.4), 0 0 20px rgba(76, 175, 80, 0.3)';
        setTimeout(() => {
            this.playingCard.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.4)';
        }, 500);
    }

    // Show the maze builder UI
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            // Make sure card stack is visible
            if (this.cardStack) {
                this.cardStack.style.display = 'block';
            }
            // Make sure shapes counter is visible
            if (this.shapesCounter) {
                this.shapesCounter.style.display = 'block';
            }
            // Update the card display to show current shape
            this.updateCardDisplay();
            console.log('MazeBuilderUI shown with shapes:', this.mazeState.currentShapeHand.map(s => s.name));
        }
    }

    // Hide the maze builder UI
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
        
        // Hide waiting message when transitioning to defense
        this.hideWaitingMessage();
    }
} 