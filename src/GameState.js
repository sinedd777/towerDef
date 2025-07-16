export class GameState {
    constructor() {
        this.money = 100;
        this.score = 0;
        this.wave = 1;
        this.enemiesCount = 0;
        this.enemiesKilled = 0;
        this.towersPlaced = 0;
        
        // Element system
        this.unlockedElements = [];
        this.elementSelectionPending = false;
        this.elementSelectionCallback = null;
        
        // DOM element references
        this.moneyElement = document.getElementById('money');
        this.scoreElement = document.getElementById('score');
        this.waveElement = document.getElementById('wave');
        this.enemiesElement = document.getElementById('enemies');
    }
    
    addMoney(amount) {
        this.money += amount;
        this.updateHUD();
    }
    
    spendMoney(amount) {
        if (this.money >= amount) {
            this.money -= amount;
            this.updateHUD();
            return true;
        }
        return false;
    }
    
    addScore(points) {
        this.score += points;
        this.updateHUD();
    }
    
    addEnemy() {
        this.enemiesCount++;
        this.updateHUD();
    }
    
    removeEnemy() {
        this.enemiesCount--;
        this.enemiesKilled++;
        this.updateHUD();
        
        // Check for wave progression
        this.checkWaveProgression();
    }
    
    checkWaveProgression() {
        // Simple wave progression: every 10 enemies killed = new wave
        if (this.enemiesKilled > 0 && this.enemiesKilled % 10 === 0) {
            this.wave++;
            this.addMoney(50); // Bonus money for completing wave
            this.updateHUD();
            
            // Check for element unlock (every 5 waves)
            this.checkElementUnlock();
        }
    }
    
    checkElementUnlock() {
        // Element unlock every 5 waves (waves 5, 10, 15, 20, 25, 30)
        if (this.wave % 5 === 0 && this.unlockedElements.length < 6) {
            this.triggerElementSelection();
        }
    }
    
    triggerElementSelection() {
        this.elementSelectionPending = true;
        // Trigger element selection UI - this will be handled by the ElementManager
        if (this.elementSelectionCallback) {
            this.elementSelectionCallback();
        }
    }
    
    setElementSelectionCallback(callback) {
        this.elementSelectionCallback = callback;
    }
    
    selectElement(elementId) {
        if (!this.unlockedElements.includes(elementId)) {
            this.unlockedElements.push(elementId);
            this.elementSelectionPending = false;
            console.log(`Element unlocked: ${elementId}. Total elements: ${this.unlockedElements.length}`);
            return true;
        }
        return false;
    }
    
    hasElement(elementId) {
        return this.unlockedElements.includes(elementId);
    }
    
    getUnlockedElements() {
        return [...this.unlockedElements];
    }
    
    isElementSelectionPending() {
        return this.elementSelectionPending;
    }
    
    // Helper method to check if player can build specific tower types
    canBuildTowerTier(tier) {
        switch (tier) {
            case 1: // Single element towers
                return this.unlockedElements.length >= 1;
            case 2: // Dual element towers
                return this.unlockedElements.length >= 2;
            case 3: // Triple element towers
                return this.unlockedElements.length >= 3;
            default:
                return false;
        }
    }
    
    placeTower() {
        this.towersPlaced++;
    }
    
    updateHUD() {
        if (this.moneyElement) this.moneyElement.textContent = this.money;
        if (this.scoreElement) this.scoreElement.textContent = this.score;
        if (this.waveElement) this.waveElement.textContent = this.wave;
        if (this.enemiesElement) this.enemiesElement.textContent = this.enemiesCount;
    }
    
    // Getters
    getMoney() {
        return this.money;
    }
    
    getScore() {
        return this.score;
    }
    
    getWave() {
        return this.wave;
    }
    
    getEnemiesCount() {
        return this.enemiesCount;
    }
    
    canAfford(cost) {
        return this.money >= cost;
    }
    
    getGameStats() {
        return {
            money: this.money,
            score: this.score,
            wave: this.wave,
            enemiesAlive: this.enemiesCount,
            enemiesKilled: this.enemiesKilled,
            towersPlaced: this.towersPlaced,
            unlockedElements: this.unlockedElements,
            elementSelectionPending: this.elementSelectionPending
        };
    }
} 