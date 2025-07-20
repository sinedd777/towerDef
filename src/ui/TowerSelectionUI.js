import { debugLog } from '../config/DebugConfig.js';

export class TowerSelectionUI {
    constructor(gameState) {
        this.gameState = gameState;
        this.selectedTowerData = null;
        this.onTowerSelectedCallback = null;
        
        this.initializeStyles();
        this.createTowerSelectionUI();
    }

    initializeStyles() {
        // Styles are now handled by external CSS in index.html
        // This prevents conflicts between internal and external styling
    }

    createTowerSelectionUI() {
        const basicTowerMenu = document.getElementById('basic-tower-menu');
        
        if (!basicTowerMenu) {
            console.error('Tower menu not found in HTML');
            return;
        }
    }

    updateTowerSelectionUI(availableTowers) {
        debugLog(`Updating tower selection UI with ${availableTowers.length} towers`, 'UI_INTERACTIONS');
        this.updateBasicTowerGrid(availableTowers);
    }

    updateBasicTowerGrid(basicTowers) {
        const menu = document.getElementById('basic-tower-menu');
        if (!menu) return;
        
        menu.innerHTML = '';
        
        basicTowers.forEach(tower => {
            const slot = this.createTowerSlot(tower);
            menu.appendChild(slot);
        });
    }

    createTowerSlot(tower) {
        debugLog(`Creating tower slot for: ${tower.name}`, 'UI_INTERACTIONS');
        
        const slot = document.createElement('div');
        slot.className = 'tower-slot';
        slot.dataset.towerId = tower.id;
        
        // Create tower icon
        const icon = this.createTowerIcon(tower);
        const tooltip = this.createTowerTooltip(tower);
        
        slot.appendChild(icon);
        slot.appendChild(tooltip);
        
        this.addTowerSlotInteractions(slot, tower);
        this.updateSlotAffordability(slot, tower);
        
        return slot;
    }

    createTowerIcon(tower) {
        const icon = document.createElement('div');
        icon.className = 'tower-icon';
        icon.style.backgroundColor = '#' + tower.color.toString(16).padStart(6, '0');
        
        const cost = document.createElement('div');
        cost.className = 'tower-cost';
        cost.textContent = tower.cost;
        icon.appendChild(cost);
        
        return icon;
    }

    createTowerTooltip(tower) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tower-tooltip';
        
        const tooltipHeader = document.createElement('div');
        tooltipHeader.className = 'tower-tooltip-header';
        tooltipHeader.innerHTML = `
            <div class="tower-tooltip-name">${tower.name}</div>
        `;
        
        const tooltipDescription = document.createElement('div');
        tooltipDescription.className = 'tower-tooltip-description';
        tooltipDescription.textContent = tower.description;
        
        const tooltipStats = document.createElement('div');
        tooltipStats.className = 'tower-tooltip-stats';
        tooltipStats.innerHTML = `
            <div>Range: ${tower.range}</div>
            <div>Damage: ${tower.damage}</div>
            <div>Rate: ${tower.fireRate}/s</div>
        `;
        
        tooltip.appendChild(tooltipHeader);
        tooltip.appendChild(tooltipDescription);
        tooltip.appendChild(tooltipStats);
        
        return tooltip;
    }

    addTowerSlotInteractions(slot, tower) {
        slot.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            debugLog(`Tower slot clicked: ${tower.name}`, 'UI_INTERACTIONS');
            
            // Check if we can afford the tower
            if (this.gameState.getMoney() < tower.cost) {
                debugLog(`Not enough money for tower: ${tower.name} (Cost: ${tower.cost}, Money: ${this.gameState.getMoney()})`, 'UI_INTERACTIONS');
                return;
            }
            
            // Handle selection/deselection
            if (this.selectedTowerData && this.selectedTowerData.id === tower.id) {
                this.deselectTower(slot);
            } else {
                this.selectTower(slot, tower);
            }
        });
    }

    selectTower(slot, tower) {
        this.deselectAllTowers();
        slot.classList.add('selected');
        this.selectedTowerData = tower;
        
        if (this.onTowerSelectedCallback) {
            this.onTowerSelectedCallback(tower);
        }
    }

    deselectTower(slot) {
        slot.classList.remove('selected');
        this.selectedTowerData = null;
        
        if (this.onTowerSelectedCallback) {
            this.onTowerSelectedCallback(null);
        }
    }

    deselectAllTowers() {
        const slots = document.querySelectorAll('.tower-slot');
        slots.forEach(slot => slot.classList.remove('selected'));
        this.selectedTowerData = null;
    }

    updateSlotAffordability(slot, tower) {
        if (this.gameState.getMoney() < tower.cost) {
            slot.classList.add('cannot-afford');
        } else {
            slot.classList.remove('cannot-afford');
        }
    }

    updateTowerMenu() {
        const slots = document.querySelectorAll('.tower-slot');
        slots.forEach(slot => {
            const towerId = slot.dataset.towerId;
            const tower = this.selectedTowerData;
            if (tower && tower.id === towerId) {
                this.updateSlotAffordability(slot, tower);
            }
        });
    }

    setOnTowerSelectedCallback(callback) {
        this.onTowerSelectedCallback = callback;
    }

    getSelectedTowerData() {
        return this.selectedTowerData;
    }

    clearSelection() {
        this.deselectAllTowers();
    }

    // Show the tower selection UI
    show() {
        const menu = document.getElementById('basic-tower-menu');
        if (menu) {
            menu.style.display = 'grid';
        }
    }

    // Hide the tower selection UI
    hide() {
        const menu = document.getElementById('basic-tower-menu');
        if (menu) {
            menu.style.display = 'none';
        }
    }
} 