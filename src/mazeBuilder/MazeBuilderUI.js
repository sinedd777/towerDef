export class MazeBuilderUI {
    constructor(mazeState) {
        this.mazeState = mazeState;
        this.createMazeBuilderPanel();
        this.updateShapeHand();
    }

    setOnStartDefenseCallback(callback) {
        this.onStartDefenseCallback = callback;
    }

    createMazeBuilderPanel() {
        // Create main maze builder panel
        this.panel = document.createElement('div');
        this.panel.id = 'maze-builder-panel';
        this.panel.style.cssText = `
            position: fixed;
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #444;
            border-radius: 10px;
            padding: 20px;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 1000;
            min-width: 200px;
        `;
        
        // Title
        const title = document.createElement('h3');
        title.textContent = 'Build Maze';
        title.style.cssText = `
            margin: 0 0 15px 0;
            text-align: center;
            color: #4CAF50;
        `;
        this.panel.appendChild(title);
        
        // Instructions
        const instructions = document.createElement('div');
        instructions.innerHTML = `
            <div style="font-size: 12px; margin-bottom: 15px; line-height: 1.4;">
                • Press T to pick up next shape<br>
                • Press R to rotate shape<br>
                • Click to place shape<br>
                • Block enemy paths strategically
            </div>
        `;
        this.panel.appendChild(instructions);
        
        // Shape count display
        this.shapeCountDisplay = document.createElement('div');
        this.shapeCountDisplay.style.cssText = `
            text-align: center;
            margin-bottom: 10px;
            font-size: 14px;
            color: #aaa;
        `;
        this.panel.appendChild(this.shapeCountDisplay);
        
        // Next shape container
        this.shapeContainer = document.createElement('div');
        this.shapeContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 20px;
            padding: 10px;
            border: 2px solid #666;
            border-radius: 5px;
            background: rgba(255, 255, 255, 0.05);
        `;
        
        // Next shape label
        const nextShapeLabel = document.createElement('div');
        nextShapeLabel.textContent = 'Next Shape';
        nextShapeLabel.style.cssText = `
            text-align: center;
            font-weight: bold;
            color: #4CAF50;
            margin-bottom: 5px;
        `;
        this.shapeContainer.appendChild(nextShapeLabel);
        
        this.panel.appendChild(this.shapeContainer);
        
        // Start Defense button
        this.startButton = document.createElement('button');
        this.startButton.textContent = 'Start Defense';
        this.startButton.style.cssText = `
            width: 100%;
            padding: 12px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            opacity: 0.5;
            transition: all 0.3s;
        `;
        this.startButton.disabled = true;
        
        this.startButton.addEventListener('click', () => {
            if (this.onStartDefenseCallback) {
                this.onStartDefenseCallback();
            }
        });
        
        this.panel.appendChild(this.startButton);
        
        document.body.appendChild(this.panel);
    }

    updateShapeHand() {
        // Clear existing shapes
        this.shapeContainer.innerHTML = '';
        
        // Add "Next Shape" label back
        const nextShapeLabel = document.createElement('div');
        nextShapeLabel.textContent = 'Next Shape';
        nextShapeLabel.style.cssText = `
            text-align: center;
            font-weight: bold;
            color: #4CAF50;
            margin-bottom: 5px;
        `;
        this.shapeContainer.appendChild(nextShapeLabel);
        
        // Update shape count display
        this.shapeCountDisplay.textContent = `Shapes Remaining: ${this.mazeState.currentShapeHand.length}`;
        
        // Only show the first shape in hand
        if (this.mazeState.currentShapeHand.length > 0) {
            const nextShape = this.mazeState.currentShapeHand[0];
            const shapeElement = this.createShapeElement(nextShape);
            this.shapeContainer.appendChild(shapeElement);
        }
        
        // Update start button state
        this.updateStartButton();
    }

    createShapeElement(shape) {
        const shapeDiv = document.createElement('div');
        shapeDiv.style.cssText = `
            border: 2px solid #666;
            border-radius: 5px;
            padding: 10px;
            transition: all 0.2s;
            background: rgba(255, 255, 255, 0.1);
            text-align: center;
        `;
        
        // Shape visual preview (simplified grid)
        const previewDiv = document.createElement('div');
        previewDiv.style.cssText = `
            display: inline-block;
            background: #333;
            padding: 5px;
            border-radius: 3px;
            margin-bottom: 5px;
        `;
        
        // Create mini grid to show shape
        const gridDiv = document.createElement('div');
        gridDiv.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 15px);
            grid-template-rows: repeat(4, 15px);
            gap: 1px;
        `;
        
        // Fill grid with shape cells
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const cell = document.createElement('div');
                const isShapeCell = shape.cells.some(([x, y]) => x === col && y === row);
                
                cell.style.cssText = `
                    width: 15px;
                    height: 15px;
                    background: ${isShapeCell ? `#${shape.color.toString(16).padStart(6, '0')}` : 'transparent'};
                    border: 1px solid #555;
                `;
                gridDiv.appendChild(cell);
            }
        }
        
        previewDiv.appendChild(gridDiv);
        shapeDiv.appendChild(previewDiv);
        
        // Shape name
        const nameDiv = document.createElement('div');
        nameDiv.textContent = `${shape.name}`;
        nameDiv.style.cssText = `
            font-weight: bold;
            color: #${shape.color.toString(16).padStart(6, '0')};
        `;
        shapeDiv.appendChild(nameDiv);
        
        return shapeDiv;
    }

    updateShapeSelection(shape) {
        // Update visual selection in UI
        const shapeElements = this.shapeContainer.querySelectorAll('div');
        shapeElements.forEach(element => {
            if (element.querySelector('div')?.textContent === shape.name) {
                element.style.background = 'rgba(76, 175, 80, 0.3)';
                element.style.borderColor = '#4CAF50';
            } else {
                element.style.background = 'rgba(255, 255, 255, 0.1)';
                element.style.borderColor = '#666';
            }
        });
    }

    updateStartButton() {
        // Enable start button when all shapes are placed
        const allShapesPlaced = this.mazeState.currentShapeHand.length === 0;
        this.startButton.disabled = !allShapesPlaced;
        this.startButton.style.opacity = allShapesPlaced ? '1' : '0.5';
    }

    // Called when shape is placed
    onShapePlaced() {
        this.updateShapeHand();
    }

    // Hide the maze builder UI
    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
    }

    // Show the maze builder UI
    show() {
        if (this.panel) {
            this.panel.style.display = 'block';
        }
    }
} 