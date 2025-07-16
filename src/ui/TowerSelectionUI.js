import { getTowerById } from '../Elements.js';
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
        const style = document.createElement('style');
        style.textContent = `
            .tower-icon {
                width: 40px;
                height: 40px;
                border-radius: 6px;
                position: relative;
            }
            
            .tower-slot {
                position: relative;
                cursor: pointer;
                transition: transform 0.2s;
            }
            
            .tower-slot:hover {
                transform: scale(1.05);
            }
            
            .tower-slot.selected {
                transform: scale(1.1);
                filter: brightness(1.3);
            }
            
            .tower-slot.cannot-afford {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .tower-cost {
                position: absolute;
                bottom: 2px;
                right: 2px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                font-size: 10px;
                padding: 1px 3px;
                border-radius: 2px;
            }
            
            .tower-tooltip {
                position: absolute;
                bottom: 50px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 8px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s;
                z-index: 100;
            }
            
            .tower-slot:hover .tower-tooltip {
                opacity: 1;
            }
            
            .tower-tooltip-header {
                font-weight: bold;
                margin-bottom: 4px;
            }
            
            .tower-tooltip-name {
                color: #ffdd44;
            }
            
            .tower-tooltip-description {
                color: #ccc;
                font-style: italic;
                margin-bottom: 4px;
                max-width: 200px;
                white-space: normal;
            }
            
            .tower-tooltip-stats {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 4px;
                font-size: 11px;
            }
        `;
        document.head.appendChild(style);
    }

    createTowerSelectionUI() {
        const basicTowerMenu = document.getElementById('basic-tower-menu');
        const elementalTowerMenu = document.getElementById('elemental-tower-menu');
        
        if (!basicTowerMenu || !elementalTowerMenu) {
            console.error('Tower menus not found in HTML');
            return;
        }

        // Initialize with empty elemental towers
        this.updateElementalTowerGrid([]);
    }

    updateTowerSelectionUI(availableTowers, unlockedElements) {
        debugLog(`Updating tower selection UI with ${availableTowers.length} towers`, 'UI_INTERACTIONS');
        
        // Split towers into basic and elemental
        const basicTowers = availableTowers.filter(t => !t.elements || t.elements.length === 0);
        const elementalTowers = availableTowers.filter(t => t.elements && t.elements.length > 0);
        
        this.updateBasicTowerGrid(basicTowers);
        this.updateElementalTowerGrid(elementalTowers);
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

    updateElementalTowerGrid(elementalTowers) {
        const menu = document.getElementById('elemental-tower-menu');
        if (!menu) return;
        
        menu.innerHTML = '';
        
        if (elementalTowers.length === 0) {
            const message = document.createElement('div');
            message.style.cssText = `
                grid-column: 1 / -1;
                color: #888;
                text-align: center;
                padding: 20px;
                font-style: italic;
            `;
            message.textContent = 'Reach wave 5 to unlock your first element!';
            menu.appendChild(message);
            return;
        }
        
        elementalTowers.forEach(tower => {
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
            ${tower.element ? `<div>Element: ${tower.element}</div>` : ''}
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
        // Deselect any previously selected tower
        this.deselectAllTowers();
        
        // Select this tower
        slot.classList.add('selected');
        this.selectedTowerData = { ...tower }; // Create a copy of the tower data
        debugLog(`Selected tower data: ${JSON.stringify(this.selectedTowerData)}`, 'UI_INTERACTIONS');
        
        // Notify callback
        if (this.onTowerSelectedCallback) {
            this.onTowerSelectedCallback(this.selectedTowerData);
        }
    }

    deselectTower(slot) {
        this.selectedTowerData = null;
        slot.classList.remove('selected');
        
        // Notify callback
        if (this.onTowerSelectedCallback) {
            this.onTowerSelectedCallback(null);
        }
    }

    deselectAllTowers() {
        document.querySelectorAll('.tower-slot.selected').forEach(slot => {
            slot.classList.remove('selected');
        });
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
        const money = this.gameState.getMoney();
        document.querySelectorAll('.tower-slot').forEach(slot => {
            const towerId = slot.dataset.towerId;
            const towerData = getTowerById(towerId);
            if (!towerData) {
                console.warn(`No tower data found for id: ${towerId}`);
                return;
            }
            this.updateSlotAffordability(slot, towerData);
        });
    }

    // Public API
    setOnTowerSelectedCallback(callback) {
        this.onTowerSelectedCallback = callback;
    }

    getSelectedTowerData() {
        return this.selectedTowerData;
    }

    clearSelection() {
        this.deselectAllTowers();
        if (this.onTowerSelectedCallback) {
            this.onTowerSelectedCallback(null);
        }
    }
} 