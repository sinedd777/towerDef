export class GameState {
    constructor() {
        this.money = 100;
        this.score = 0;
        this.wave = 1;
        this.enemiesCount = 0;
        this.maxEnemies = 10;
        // NEW: Track how many enemies have been spawned in the current wave
        this.enemiesSpawned = 0;
        // NEW: Delay between waves (milliseconds)
        this.waveDelay = 10000; // 10 seconds
        this.waveCooldownEnd = 0; // Timestamp until which spawning is paused
        
        // Game phases: 'MAZE_BUILDING' or 'DEFENSE'
        this.currentPhase = 'MAZE_BUILDING';
        this.mazeCompleted = false;
        
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
        // NEW: Increment how many enemies have been spawned this wave
        this.enemiesSpawned++;
        this.updateHUD();
    }
    
    removeEnemy() {
        this.enemiesCount--;
        if (this.enemiesCount <= 0) {
            this.wave++;
            this.enemiesCount = 0;
            this.maxEnemies = Math.floor(this.maxEnemies * 1.2); // 20% more enemies each wave
            // NEW: Reset spawned counter for the new wave
            this.enemiesSpawned = 0;
            // NEW: Start wave cooldown timer
            this.waveCooldownEnd = Date.now() + this.waveDelay;
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

    // NEW: Returns true if still in cooldown period after a wave
    isWaveCoolingDown() {
        return Date.now() < this.waveCooldownEnd;
    }

    // NEW: Returns true if we can spawn an enemy (spawn limit + cooldown)
    canSpawnMore() {
        return !this.isWaveCoolingDown() && this.enemiesSpawned < this.maxEnemies;
    }
    
    canAfford(cost) {
        return this.money >= cost;
    }
    
    updateHUD() {
        if (this.moneyElement) this.moneyElement.textContent = this.money;
        if (this.scoreElement) this.scoreElement.textContent = this.score;
        if (this.waveElement) this.waveElement.textContent = this.wave;
        if (this.enemiesElement) this.enemiesElement.textContent = this.enemiesCount;
        
        // Update phase indicator if it exists
        const phaseElement = document.getElementById('phase');
        if (phaseElement) {
            phaseElement.textContent = this.currentPhase === 'MAZE_BUILDING' ? 'Build Maze' : 'Defense';
        }
    }

    // Phase management methods
    getCurrentPhase() {
        return this.currentPhase;
    }

    isMazeBuilding() {
        return this.currentPhase === 'MAZE_BUILDING';
    }

    isDefensePhase() {
        return this.currentPhase === 'DEFENSE';
    }

    startDefensePhase() {
        this.currentPhase = 'DEFENSE';
        this.mazeCompleted = true;
        this.updateHUD();
        console.log('Defense phase started!');
    }

    resetToMazeBuildingPhase() {
        this.currentPhase = 'MAZE_BUILDING';
        this.mazeCompleted = false;
        this.updateHUD();
    }
    
    // Save game state
    save() {
        const saveData = {
            money: this.money,
            score: this.score,
            wave: this.wave,
            enemiesCount: this.enemiesCount,
            maxEnemies: this.maxEnemies,
            // NEW: Persist enemiesSpawned so reloading mid-wave keeps correct state
            enemiesSpawned: this.enemiesSpawned,
            // NEW: Persist waveCooldownEnd for mid-wave delays
            waveCooldownEnd: this.waveCooldownEnd
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
            // NEW: Restore enemiesSpawned (fallback to 0 for old saves)
            this.enemiesSpawned = data.enemiesSpawned || 0;
            // NEW: Restore cooldown timer
            this.waveCooldownEnd = data.waveCooldownEnd || 0;
            this.updateHUD();
        }
    }
} 