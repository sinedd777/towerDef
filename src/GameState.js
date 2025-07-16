export class GameState {
    constructor() {
        this.money = 100;
        this.score = 0;
        this.wave = 1;
        this.enemiesCount = 0;
        this.enemiesKilled = 0;
        this.towersPlaced = 0;
        
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
            towersPlaced: this.towersPlaced
        };
    }
} 