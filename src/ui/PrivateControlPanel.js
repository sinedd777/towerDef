export class PrivateControlPanel {
    constructor(playerId, gameState, networkManager) {
        this.playerId = playerId;
        this.gameState = gameState;
        this.networkManager = networkManager;
        this.container = null;
        this.currentPhase = 'building'; // building, defense
        
        // Callbacks
        this.onShapeSelected = null;
        this.onTowerSelected = null;
        this.onStartDefense = null;
        
        this.createPrivateUI();
        this.setupEventListeners();
    }
    
    createPrivateUI() {
        // Remove existing control panel if it exists
        const existing = document.getElementById('private-controls');
        if (existing) existing.remove();
        
        this.container = document.createElement('div');
        this.container.id = 'private-controls';
        this.container.className = 'private-controls';
        
        this.container.innerHTML = `
            <div class="control-panel">
                <div class="maze-controls" id="maze-controls-${this.playerId}">
                    <h3>Your Maze Builder</h3>
                    <div class="shape-selector" id="shape-selector">
                        <div class="shape-hand" id="shape-hand">
                            <!-- Tetris shapes will be populated here -->
                        </div>
                        <div class="shape-info">
                            <span class="shapes-remaining" id="shapes-remaining">5 shapes remaining</span>
                            <button class="preview-btn" id="preview-path">Preview Path</button>
                        </div>
                    </div>
                </div>
                
                <div class="tower-controls" id="tower-controls-${this.playerId}" style="display: none;">
                    <h3>Your Towers</h3>
                    <div class="tower-selector" id="tower-selector">
                        <button class="tower-btn" data-tower="basic">💠 Basic ($20)</button>
                        <button class="tower-btn" data-tower="sniper">🗼 Sniper ($30)</button>
                        <button class="tower-btn" data-tower="cannon">⚡ Cannon ($40)</button>
                        <button class="tower-btn" data-tower="missile">🏹 Missile ($50)</button>
                    </div>
                    <div class="tower-info">
                        <div class="selected-tower-info" id="selected-tower-info">
                            Select a tower to see details
                        </div>
                    </div>
                </div>
                
                <div class="phase-controls">
                    <div class="phase-info">
                        <span class="current-phase">Phase: <span id="phase-${this.playerId}">Building</span></span>
                        <span class="your-money">Your Money: $<span id="money-${this.playerId}">150</span></span>
                    </div>
                    <div class="phase-actions">
                        <button class="start-defense-btn" id="start-defense-btn" style="display: none;">
                            Ready for Defense!
                        </button>
                        <button class="surrender-btn" id="surrender-btn" style="display: none;">
                            Surrender
                        </button>
                    </div>
                </div>
                
                <div class="instructions-panel" id="instructions-panel">
                    <div class="instructions-content">
                        <h4>Building Phase</h4>
                        <ul>
                            <li>Place Tetris shapes to build your maze</li>
                            <li>Ensure enemies have a path from spawn to exit</li>
                            <li>Click "Ready for Defense" when finished</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // Initialize with current game state
        this.updatePhaseDisplay();
        this.updateMoneyDisplay();
    }
    
    setupEventListeners() {
        // Tetris shape selection
        const shapeHand = document.getElementById('shape-hand');
        if (shapeHand) {
            shapeHand.addEventListener('click', (event) => {
                if (event.target.classList.contains('tetris-shape')) {
                    this.selectShape(event.target);
                }
            });
        }
        
        // Tower selection
        const towerSelector = document.getElementById('tower-selector');
        if (towerSelector) {
            towerSelector.addEventListener('click', (event) => {
                if (event.target.classList.contains('tower-btn')) {
                    this.selectTower(event.target);
                }
            });
        }
        
        // Start defense button
        const startDefenseBtn = document.getElementById('start-defense-btn');
        if (startDefenseBtn) {
            startDefenseBtn.addEventListener('click', () => {
                this.startDefensePhase();
            });
        }
        
        // Surrender button
        const surrenderBtn = document.getElementById('surrender-btn');
        if (surrenderBtn) {
            surrenderBtn.addEventListener('click', () => {
                this.surrender();
            });
        }
        
        // Preview path button
        const previewBtn = document.getElementById('preview-path');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                this.previewPath();
            });
        }
    }
    
    // Update the displayed Tetris shapes
    updateTetrisShapes(shapeHand) {
        const shapeHandElement = document.getElementById('shape-hand');
        if (!shapeHandElement) return;
        
        shapeHandElement.innerHTML = '';
        
        shapeHand.forEach((shape, index) => {
            const shapeElement = this.createShapeElement(shape, index);
            shapeHandElement.appendChild(shapeElement);
        });
        
        // Update shapes remaining counter
        const shapesRemainingElement = document.getElementById('shapes-remaining');
        if (shapesRemainingElement) {
            shapesRemainingElement.textContent = `${shapeHand.length} shapes remaining`;
        }
    }
    
    createShapeElement(shapeData, index) {
        const shapeElement = document.createElement('div');
        shapeElement.className = 'tetris-shape';
        shapeElement.dataset.shapeIndex = index;
        shapeElement.dataset.shapeType = shapeData.type;
        
        // Create visual representation of the shape
        const shapeGrid = document.createElement('div');
        shapeGrid.className = 'shape-grid';
        
        // Create a mini-grid to show the shape pattern
        const gridSize = Math.max(shapeData.pattern.length, shapeData.pattern[0]?.length || 0);
        shapeGrid.style.gridTemplate = `repeat(${gridSize}, 1fr) / repeat(${gridSize}, 1fr)`;
        
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'shape-cell';
                
                if (shapeData.pattern[row] && shapeData.pattern[row][col]) {
                    cell.classList.add('filled');
                    cell.style.backgroundColor = shapeData.color || '#4CAF50';
                }
                
                shapeGrid.appendChild(cell);
            }
        }
        
        shapeElement.appendChild(shapeGrid);
        
        // Add shape name
        const shapeName = document.createElement('div');
        shapeName.className = 'shape-name';
        shapeName.textContent = shapeData.name || shapeData.type;
        shapeElement.appendChild(shapeName);
        
        return shapeElement;
    }
    
    selectShape(shapeElement) {
        // Remove previous selection
        document.querySelectorAll('.tetris-shape').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Select new shape
        shapeElement.classList.add('selected');
        
        const shapeIndex = parseInt(shapeElement.dataset.shapeIndex);
        const shapeType = shapeElement.dataset.shapeType;
        
        if (this.onShapeSelected) {
            this.onShapeSelected(shapeIndex, shapeType);
        }
        
        console.log(`Selected shape: ${shapeType} (index ${shapeIndex})`);
    }
    
    selectTower(towerButton) {
        // Remove previous selection
        document.querySelectorAll('.tower-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Select new tower
        towerButton.classList.add('selected');
        
        const towerType = towerButton.dataset.tower;
        
        // Update tower info display
        this.updateTowerInfo(towerType);
        
        if (this.onTowerSelected) {
            this.onTowerSelected(towerType);
        }
        
        console.log(`Selected tower: ${towerType}`);
    }
    
    updateTowerInfo(towerType) {
        const infoElement = document.getElementById('selected-tower-info');
        if (!infoElement) return;
        
        const towerInfo = {
            basic: { name: 'Basic Tower', damage: 10, range: 3, cost: 20, description: 'Simple, reliable defense' },
            sniper: { name: 'Sniper Tower', damage: 25, range: 6, cost: 30, description: 'Long range, high damage' },
            cannon: { name: 'Cannon Tower', damage: 15, range: 4, cost: 40, description: 'Area damage, splash effect' },
            missile: { name: 'Missile Tower', damage: 30, range: 5, cost: 50, description: 'Homing missiles, highest damage' }
        };
        
        const info = towerInfo[towerType];
        if (info) {
            infoElement.innerHTML = `
                <div class="tower-details">
                    <h4>${info.name}</h4>
                    <p>Damage: ${info.damage}</p>
                    <p>Range: ${info.range}</p>
                    <p>Cost: $${info.cost}</p>
                    <p class="description">${info.description}</p>
                </div>
            `;
        }
    }
    
    updatePhaseDisplay() {
        const phaseElement = document.getElementById(`phase-${this.playerId}`);
        const mazeControls = document.getElementById(`maze-controls-${this.playerId}`);
        const towerControls = document.getElementById(`tower-controls-${this.playerId}`);
        const startDefenseBtn = document.getElementById('start-defense-btn');
        const surrenderBtn = document.getElementById('surrender-btn');
        const instructionsPanel = document.getElementById('instructions-panel');
        
        if (this.currentPhase === 'building') {
            if (phaseElement) phaseElement.textContent = 'Building';
            if (mazeControls) mazeControls.style.display = 'block';
            if (towerControls) towerControls.style.display = 'none';
            if (startDefenseBtn) startDefenseBtn.style.display = 'block';
            if (surrenderBtn) surrenderBtn.style.display = 'none';
            
            if (instructionsPanel) {
                instructionsPanel.innerHTML = `
                    <div class="instructions-content">
                        <h4>Building Phase</h4>
                        <ul>
                            <li>Place Tetris shapes to build your maze</li>
                            <li>Ensure enemies have a path from spawn to exit</li>
                            <li>Click "Ready for Defense" when finished</li>
                        </ul>
                    </div>
                `;
            }
        } else if (this.currentPhase === 'defense') {
            if (phaseElement) phaseElement.textContent = 'Defense';
            if (mazeControls) mazeControls.style.display = 'none';
            if (towerControls) towerControls.style.display = 'block';
            if (startDefenseBtn) startDefenseBtn.style.display = 'none';
            if (surrenderBtn) surrenderBtn.style.display = 'block';
            
            if (instructionsPanel) {
                instructionsPanel.innerHTML = `
                    <div class="instructions-content">
                        <h4>Defense Phase</h4>
                        <ul>
                            <li>Place towers on your maze blocks</li>
                            <li>Defend against incoming enemies</li>
                            <li>Upgrade towers to increase effectiveness</li>
                        </ul>
                    </div>
                `;
            }
        }
    }
    
    updateMoneyDisplay(amount) {
        const moneyElement = document.getElementById(`money-${this.playerId}`);
        if (moneyElement) {
            moneyElement.textContent = amount || this.gameState.money || 150;
        }
        
        // Update tower affordability
        this.updateTowerAffordability();
    }
    
    updateTowerAffordability() {
        const money = this.gameState.money || 150;
        const towerButtons = document.querySelectorAll('.tower-btn');
        
        towerButtons.forEach(button => {
            const cost = this.getTowerCost(button.dataset.tower);
            if (money < cost) {
                button.classList.add('unaffordable');
                button.disabled = true;
            } else {
                button.classList.remove('unaffordable');
                button.disabled = false;
            }
        });
    }
    
    getTowerCost(towerType) {
        const costs = { basic: 20, sniper: 30, cannon: 40, missile: 50 };
        return costs[towerType] || 20;
    }
    
    setPhase(phase) {
        this.currentPhase = phase;
        this.updatePhaseDisplay();
    }
    
    startDefensePhase() {
        console.log('Starting defense phase...');
        
        // Notify network manager
        if (this.networkManager) {
            this.networkManager.startDefensePhase();
        }
        
        // Call callback
        if (this.onStartDefense) {
            this.onStartDefense();
        }
        
        // Transition to defense phase
        this.setPhase('defense');
    }
    
    surrender() {
        if (confirm('Are you sure you want to surrender? This will end the game.')) {
            console.log('Player surrendered');
            
            // Notify network manager
            if (this.networkManager) {
                this.networkManager.sendPlayerAction('surrender', {});
            }
        }
    }
    
    previewPath() {
        console.log('Previewing enemy path...');
        // This would trigger path visualization in the game
        document.dispatchEvent(new CustomEvent('previewPath', { 
            detail: { playerId: this.playerId } 
        }));
    }
    
    // Show/hide the control panel
    show() {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }
    
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
    
    // Cleanup
    destroy() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
    
    // Callback setters
    setOnShapeSelected(callback) { this.onShapeSelected = callback; }
    setOnTowerSelected(callback) { this.onTowerSelected = callback; }
    setOnStartDefense(callback) { this.onStartDefense = callback; }
    
    // Flash notifications for important events
    flashNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `control-notification ${type}`;
        notification.textContent = message;
        
        this.container.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Disable/enable controls during network operations
    setControlsEnabled(enabled) {
        const buttons = this.container.querySelectorAll('button');
        const inputs = this.container.querySelectorAll('input, select');
        
        buttons.forEach(btn => btn.disabled = !enabled);
        inputs.forEach(input => input.disabled = !enabled);
        
        if (!enabled) {
            this.container.classList.add('disabled');
        } else {
            this.container.classList.remove('disabled');
        }
    }
} 