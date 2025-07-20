import { debugLog } from '../config/DebugConfig.js';
import { TOWER_TYPES, calculateUpgradeCost } from '../TowerTypes.js';

export class TowerSelectionUI {
    constructor(gameState) {
        this.gameState = gameState;
        this.selectedTowerData = null;
        this.onTowerSelectedCallback = null;
        
        // Define tower weapon images with correct preview paths
        this.towerImages = {
            basic: '/kenney_tower-defense-kit/Previews/enemy-ufo-a-weapon.png',
            sniper: '/kenney_tower-defense-kit/Previews/weapon-ballista.png',
            rapid: '/kenney_tower-defense-kit/Previews/weapon-turret.png',
            area: '/kenney_tower-defense-kit/Previews/snow-detail-crystal-large.png'
        };
        
        this.initializeStyles();
        this.createTowerSelectionUI();
    }

    initializeStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .tower-slot {
                position: relative;
                width: 80px;
                height: 80px;
                margin: 5px;
                cursor: pointer;
                transition: transform 0.2s;
                border: 2px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                background: rgba(30, 30, 40, 0.9);
                overflow: visible;
            }
            
            .tower-slot:hover {
                transform: translateY(-2px);
                border-color: rgba(255, 255, 255, 0.4);
            }
            
            .tower-slot.selected {
                border-color: #4CAF50;
                box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
            }
            
            .tower-icon {
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                position: relative;
                background-size: 80%;
                background-position: center;
                background-repeat: no-repeat;
                padding: 5px;
            }
            
            .tower-cost {
                position: absolute;
                bottom: 5px;
                right: 5px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 12px;
            }
            
            .tower-tooltip {
                position: absolute;
                bottom: 105%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(20, 20, 30, 0.95);
                padding: 12px;
                border-radius: 8px;
                width: 180px;
                display: none;
                z-index: 1000;
                pointer-events: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .tower-slot:hover .tower-tooltip {
                display: block;
            }
            
            .tower-tooltip-header {
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .tower-tooltip-name {
                font-weight: bold;
                color: white;
                font-size: 14px;
                margin-bottom: 4px;
            }
            
            .tower-tooltip-description {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
                margin: 5px 0;
                line-height: 1.4;
            }
            
            .tower-tooltip-stats {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 4px 8px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.9);
                margin-top: 8px;
            }
            
            .stat-label {
                color: rgba(255, 255, 255, 0.6);
            }
            
            .stat-value {
                color: #4CAF50;
                text-align: right;
            }
            
            .cannot-afford {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .cannot-afford:hover {
                transform: none;
            }
        `;
        
        document.head.appendChild(style);
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
        
        // Set background image based on tower type
        const imagePath = this.towerImages[tower.id];
        if (imagePath) {
            icon.style.backgroundImage = `url(${imagePath})`;
        }
        
        const cost = document.createElement('div');
        cost.className = 'tower-cost';
        cost.textContent = tower.cost;
        icon.appendChild(cost);
        
        return icon;
    }

    createTowerTooltip(tower) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tower-tooltip';
        
        const towerConfig = TOWER_TYPES[tower.id.toUpperCase()];
        const nextLevel = 1; // For base tower
        const upgradeCost = calculateUpgradeCost(tower.id, nextLevel);
        
        tooltip.innerHTML = `
            <div class="tower-tooltip-header">
                <div class="tower-tooltip-name">${towerConfig.name}</div>
                <div class="tower-tooltip-description">${towerConfig.description}</div>
            </div>
            <div class="tower-tooltip-stats">
                <div class="stat-label">Damage</div>
                <div class="stat-value damage">${towerConfig.damage}</div>
                
                <div class="stat-label">Fire Rate</div>
                <div class="stat-value fire-rate">${towerConfig.fireRate}/s</div>
                
                <div class="stat-label">Range</div>
                <div class="stat-value range">${towerConfig.range} units</div>
                
                ${towerConfig.splashRadius ? `
                    <div class="stat-label">Area</div>
                    <div class="stat-value area">${towerConfig.splashRadius} units</div>
                ` : ''}
                
                <div class="stat-label">DPS</div>
                <div class="stat-value damage">${(towerConfig.damage * towerConfig.fireRate).toFixed(1)}</div>
            </div>
            ${upgradeCost ? `
                <div class="tower-tooltip-upgrade">
                    ↑ Next upgrade: ${upgradeCost} coins
                    <br>• Damage +${Math.round((towerConfig.upgrade.damageMultiplier - 1) * 100)}%
                    <br>• Fire Rate +${Math.round((towerConfig.upgrade.fireRateMultiplier - 1) * 100)}%
                </div>
            ` : ''}
        `;
        
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