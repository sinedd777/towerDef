import { debugLog } from '../config/DebugConfig.js';

export class TowerManagementUI {
    constructor(gameState, cssRenderer, camera) {
        this.gameState = gameState;
        this.cssRenderer = cssRenderer;
        this.camera = camera;
        this.selectedTower = null;
        this.managementPanel = null;
        this.isVisible = false;
        
        // Callbacks
        this.onTowerUpgradeCallback = null;
        this.onTowerDestroyCallback = null;
        
        this.initializeStyles();
        this.createManagementPanel();
    }

    initializeStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .tower-management-panel {
                position: absolute;
                background: linear-gradient(135deg, rgba(20, 20, 30, 0.95), rgba(30, 30, 40, 0.95));
                border: 2px solid rgba(100, 150, 255, 0.6);
                border-radius: 12px;
                padding: 16px;
                min-width: 280px;
                font-family: 'Arial', sans-serif;
                color: #ffffff;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(10px);
                z-index: 1000;
                pointer-events: all;
                transform-origin: bottom center;
                animation: panelAppear 0.3s ease-out;
            }
            
            @keyframes panelAppear {
                from {
                    opacity: 0;
                    transform: scale(0.8) translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            .tower-management-header {
                text-align: center;
                margin-bottom: 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                padding-bottom: 8px;
            }
            
            .tower-name {
                font-size: 18px;
                font-weight: bold;
                margin: 0;
                color: #ffffff;
            }
            
            .tower-level {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.7);
                margin: 2px 0 0 0;
            }
            
            .tower-stats {
                margin: 12px 0;
            }
            
            .stat-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 6px 0;
                font-size: 14px;
            }
            
            .stat-label {
                color: rgba(255, 255, 255, 0.8);
            }
            
            .stat-value {
                color: #ffffff;
                font-weight: bold;
            }
            
            .stat-preview {
                color: #4CAF50;
                font-size: 12px;
                margin-left: 8px;
            }
            
            .tower-actions {
                display: flex;
                gap: 8px;
                margin-top: 16px;
            }
            
            .action-button {
                flex: 1;
                padding: 10px 12px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
                overflow: hidden;
            }
            
            .upgrade-button {
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
            }
            
            .upgrade-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
            }
            
            .upgrade-button:disabled {
                background: linear-gradient(135deg, #666, #555);
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }
            
            .destroy-button {
                background: linear-gradient(135deg, #f44336, #d32f2f);
                color: white;
            }
            
            .destroy-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);
            }
            
            .button-cost {
                font-size: 12px;
                display: block;
                opacity: 0.9;
            }
            
            .cannot-afford {
                opacity: 0.5;
                cursor: not-allowed !important;
            }
            
            .cannot-afford:hover {
                transform: none !important;
                box-shadow: none !important;
            }
            
            .progress-bar {
                width: 100%;
                height: 4px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 2px;
                margin: 8px 0;
                overflow: hidden;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #81C784);
                border-radius: 2px;
                transition: width 0.3s ease;
            }
        `;
        document.head.appendChild(style);
    }

    createManagementPanel() {
        this.managementPanel = document.createElement('div');
        this.managementPanel.className = 'tower-management-panel';
        this.managementPanel.style.display = 'none';
        
        // Add to CSS renderer's DOM element
        this.cssRenderer.domElement.appendChild(this.managementPanel);
    }

    showPanel(tower) {
        if (!tower) return;
        
        this.selectedTower = tower;
        this.isVisible = true;
        
        this.updatePanelContent();
        this.positionPanel();
        
        this.managementPanel.style.display = 'block';
        
        debugLog('TowerManagementUI: Showing panel for tower', tower.getTowerInfo());
    }

    hidePanel() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.selectedTower = null;
        this.managementPanel.style.display = 'none';
        
        debugLog('TowerManagementUI: Hiding panel');
    }

    updatePanelContent() {
        if (!this.selectedTower) return;
        
        const towerInfo = this.selectedTower.getTowerInfo();
        const canAffordUpgrade = towerInfo.canUpgrade && towerInfo.upgradeCost <= this.gameState.money;
        
        const levelProgress = (towerInfo.level - 1) / (towerInfo.maxLevel - 1) * 100;
        
        // Get preview stats for next level
        let previewDamage = '';
        let previewFireRate = '';
        if (towerInfo.canUpgrade) {
            const nextLevel = towerInfo.level + 1;
            const nextStats = this.calculateNextLevelStats(towerInfo.type, nextLevel);
            if (nextStats) {
                previewDamage = ` → ${nextStats.damage} (+${nextStats.damage - towerInfo.damage})`;
                previewFireRate = ` → ${nextStats.fireRate} (+${(nextStats.fireRate - towerInfo.fireRate).toFixed(1)})`;
            }
        }
        
        this.managementPanel.innerHTML = `
            <div class="tower-management-header">
                <h3 class="tower-name">${towerInfo.name}</h3>
                <p class="tower-level">Level ${towerInfo.level}/${towerInfo.maxLevel}</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${levelProgress}%"></div>
                </div>
            </div>
            
            <div class="tower-stats">
                <div class="stat-row">
                    <span class="stat-label">Damage:</span>
                    <span>
                        <span class="stat-value">${towerInfo.damage}</span>
                        <span class="stat-preview">${previewDamage}</span>
                    </span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Fire Rate:</span>
                    <span>
                        <span class="stat-value">${towerInfo.fireRate}/s</span>
                        <span class="stat-preview">${previewFireRate}</span>
                    </span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Range:</span>
                    <span class="stat-value">${towerInfo.range}</span>
                </div>
            </div>
            
            <div class="tower-actions">
                <button class="action-button upgrade-button ${!canAffordUpgrade ? 'cannot-afford' : ''}" 
                        ${!towerInfo.canUpgrade ? 'disabled' : ''} 
                        data-action="upgrade">
                    ${towerInfo.canUpgrade ? 'Upgrade' : 'Max Level'}
                    ${towerInfo.canUpgrade ? `<span class="button-cost">$${towerInfo.upgradeCost}</span>` : ''}
                </button>
                <button class="action-button destroy-button" data-action="destroy">
                    Destroy
                    <span class="button-cost">+$${towerInfo.refundAmount}</span>
                </button>
            </div>
        `;
        
        // Add event listeners
        this.setupActionListeners();
    }

    calculateNextLevelStats(towerType, nextLevel) {
        // Simple calculation for preview - matches upgrade multipliers from TowerTypes.js
        const currentInfo = this.selectedTower.getTowerInfo();
        return {
            damage: Math.floor(currentInfo.damage * 1.5),
            fireRate: parseFloat((currentInfo.fireRate * 1.25).toFixed(2))
        };
    }

    setupActionListeners() {
        const upgradeButton = this.managementPanel.querySelector('[data-action="upgrade"]');
        const destroyButton = this.managementPanel.querySelector('[data-action="destroy"]');
        
        if (upgradeButton && !upgradeButton.disabled) {
            upgradeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleUpgrade();
            });
        }
        
        if (destroyButton) {
            destroyButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleDestroy();
            });
        }
    }

    handleUpgrade() {
        if (!this.selectedTower) return;
        
        const towerInfo = this.selectedTower.getTowerInfo();
        
        if (!towerInfo.canUpgrade) {
            debugLog('TowerManagementUI: Cannot upgrade tower - max level reached');
            return;
        }
        
        if (towerInfo.upgradeCost > this.gameState.money) {
            debugLog('TowerManagementUI: Cannot upgrade tower - insufficient funds');
            return;
        }
        
        // Deduct cost and upgrade tower
        this.gameState.money -= towerInfo.upgradeCost;
        this.selectedTower.upgrade();
        
        // Update panel content
        this.updatePanelContent();
        
        // Notify callback
        if (this.onTowerUpgradeCallback) {
            this.onTowerUpgradeCallback(this.selectedTower);
        }
        
        debugLog('TowerManagementUI: Tower upgraded to level', this.selectedTower.level);
    }

    handleDestroy() {
        if (!this.selectedTower) return;
        
        const towerInfo = this.selectedTower.getTowerInfo();
        
        // Confirm destruction for expensive towers
        if (towerInfo.refundAmount > 50) {
            const confirmed = confirm(`Destroy ${towerInfo.name} for $${towerInfo.refundAmount} refund?`);
            if (!confirmed) return;
        }
        
        // Add refund to money
        this.gameState.money += towerInfo.refundAmount;
        
        // Hide panel first
        this.hidePanel();
        
        // Notify callback to remove tower
        if (this.onTowerDestroyCallback) {
            this.onTowerDestroyCallback(this.selectedTower);
        }
        
        debugLog('TowerManagementUI: Tower destroyed, refund:', towerInfo.refundAmount);
    }

    positionPanel() {
        if (!this.selectedTower || !this.isVisible) return;
        
        // Get tower position in screen coordinates
        const towerWorldPos = this.selectedTower.position.clone();
        towerWorldPos.y += 2; // Position above tower
        
        const screenPos = towerWorldPos.project(this.camera);
        
        // Convert to CSS coordinates
        const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
        
        // Position panel above tower, centered horizontally
        this.managementPanel.style.left = `${x - 140}px`; // 140 = half of panel width
        this.managementPanel.style.top = `${y - 250}px`; // Position above tower
        
        // Keep panel on screen
        const rect = this.managementPanel.getBoundingClientRect();
        if (rect.left < 10) {
            this.managementPanel.style.left = '10px';
        } else if (rect.right > window.innerWidth - 10) {
            this.managementPanel.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        
        if (rect.top < 10) {
            this.managementPanel.style.top = '10px';
        }
    }

    update() {
        if (this.isVisible && this.selectedTower) {
            this.positionPanel();
            
            // Update money-dependent UI elements
            const towerInfo = this.selectedTower.getTowerInfo();
            const upgradeButton = this.managementPanel.querySelector('[data-action="upgrade"]');
            
            if (upgradeButton && towerInfo.canUpgrade) {
                const canAfford = towerInfo.upgradeCost <= this.gameState.money;
                upgradeButton.classList.toggle('cannot-afford', !canAfford);
            }
        }
    }

    // Callback setters
    setOnTowerUpgradeCallback(callback) {
        this.onTowerUpgradeCallback = callback;
    }

    setOnTowerDestroyCallback(callback) {
        this.onTowerDestroyCallback = callback;
    }

    // Cleanup
    destroy() {
        if (this.managementPanel) {
            this.managementPanel.remove();
        }
    }
} 