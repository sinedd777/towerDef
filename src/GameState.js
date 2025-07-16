export class GameState {
    constructor() {
        this.money = 100;
        this.score = 0;
        this.wave = 1;
        this.enemiesCount = 0;
        this.maxEnemies = 10;
        
        // DOM element references
        this.moneyElement = document.getElementById('money');
        this.scoreElement = document.getElementById('score');
        this.waveElement = document.getElementById('wave');
        this.enemiesElement = document.getElementById('enemies');
        
        // Initialize HUD
        this.updateHUD();
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
        if (this.enemiesCount <= 0) {
            this.wave++;
            this.enemiesCount = 0;
            this.maxEnemies = Math.floor(this.maxEnemies * 1.2); // 20% more enemies each wave
            this.addMoney(50); // Wave completion bonus
            this.addScore(500);
        }
        this.updateHUD();
    }
    
    getWave() {
        return this.wave;
    }
    
    getMoney() {
        return this.money;
    }
    
    getScore() {
        return this.score;
    }
    
    getEnemiesCount() {
        return this.enemiesCount;
    }
    
    getMaxEnemies() {
        return this.maxEnemies;
    }
    
    canAfford(cost) {
        return this.money >= cost;
    }
    
    updateHUD() {
        if (this.moneyElement) this.moneyElement.textContent = this.money;
        if (this.scoreElement) this.scoreElement.textContent = this.score;
        if (this.waveElement) this.waveElement.textContent = this.wave;
        if (this.enemiesElement) this.enemiesElement.textContent = this.enemiesCount;
    }
    
    // Save game state
    save() {
        const saveData = {
            money: this.money,
            score: this.score,
            wave: this.wave,
            enemiesCount: this.enemiesCount,
            maxEnemies: this.maxEnemies
        };
        
        localStorage.setItem('towerDefenseGameState', JSON.stringify(saveData));
    }
    
    // Load game state
    load() {
        const savedData = localStorage.getItem('towerDefenseGameState');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.money = data.money;
            this.score = data.score;
            this.wave = data.wave;
            this.enemiesCount = data.enemiesCount;
            this.maxEnemies = data.maxEnemies;
            this.updateHUD();
        }
    }
} 