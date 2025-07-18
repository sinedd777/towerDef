class GameLogic {
    constructor(gameSession) {
        this.gameSession = gameSession;
        this.gameState = gameSession.gameState;
        
        // Rate limiting
        this.actionLimits = {
            'tower:place': { interval: 100, max: 10 }, // Max 10 towers per 100ms
            'tower:upgrade': { interval: 200, max: 5 },
            'tower:sell': { interval: 150, max: 5 },
            'maze:place': { interval: 50, max: 20 }
        };
        
        this.playerActionHistory = new Map(); // playerId -> action history
    }
    
    update(deltaTime) {
        // Clean up old action history for rate limiting
        this.cleanupActionHistory();
    }
    
    processPlayerAction(playerId, action, data) {
        // Rate limiting check
        if (!this.checkRateLimit(playerId, action)) {
            return { success: false, reason: 'rate_limited' };
        }
        
        // Validate player exists and is active
        const player = this.gameState.players.get(playerId);
        if (!player) {
            return { success: false, reason: 'player_not_found' };
        }
        
        // Record action for rate limiting
        this.recordAction(playerId, action);
        
        // Process action based on type
        switch (action) {
            case 'tower:place':
                return this.handleTowerPlace(playerId, data);
            case 'tower:upgrade':
                return this.handleTowerUpgrade(playerId, data);
            case 'tower:sell':
                return this.handleTowerSell(playerId, data);
            case 'maze:place':
                return this.handleMazePlace(playerId, data);
            case 'maze:remove':
                return this.handleMazeRemove(playerId, data);
            case 'game:ready':
                return this.handlePlayerReady(playerId, data);
            case 'game:phase_transition':
                return this.handlePhaseTransition(playerId, data);
            default:
                return { success: false, reason: 'unknown_action' };
        }
    }
    
    // Tower Actions
    handleTowerPlace(playerId, data) {
        // Validate tower placement data
        const validation = this.validateTowerPlaceData(data);
        if (!validation.success) return validation;
        
        // Check game phase
        if (this.gameState.gamePhase !== 'defense') {
            return { success: false, reason: 'wrong_phase' };
        }
        
        // Get tower cost and validate
        const towerCost = this.getTowerCost(data.type);
        const towerData = {
            type: data.type,
            position: data.position,
            cost: towerCost
        };
        
        // Delegate to game state
        const result = this.gameState.placeTower(playerId, towerData);
        
        if (result.success) {
            return {
                success: true,
                data: {
                    tower: result.tower,
                    playerMoney: this.gameState.players.get(playerId).money
                }
            };
        }
        
        return result;
    }
    
    handleTowerUpgrade(playerId, data) {
        const validation = this.validateTowerUpgradeData(data);
        if (!validation.success) return validation;
        
        const tower = this.gameState.towers.get(data.towerId);
        if (!tower) {
            return { success: false, reason: 'tower_not_found' };
        }
        
        if (tower.playerId !== playerId) {
            return { success: false, reason: 'not_your_tower' };
        }
        
        const upgradeCost = this.getUpgradeCost(tower.type, tower.level);
        const player = this.gameState.players.get(playerId);
        
        if (player.money < upgradeCost) {
            return { success: false, reason: 'insufficient_funds' };
        }
        
        // Upgrade tower
        tower.level++;
        tower.damage = Math.floor(tower.damage * 1.5);
        tower.range = tower.range * 1.1;
        player.money -= upgradeCost;
        
        this.gameState.markEntityChanged('towers', data.towerId);
        this.gameState.markEntityChanged('players', playerId);
        
        return {
            success: true,
            data: {
                tower,
                playerMoney: player.money,
                upgradeCost
            }
        };
    }
    
    handleTowerSell(playerId, data) {
        const validation = this.validateTowerSellData(data);
        if (!validation.success) return validation;
        
        const tower = this.gameState.towers.get(data.towerId);
        if (!tower) {
            return { success: false, reason: 'tower_not_found' };
        }
        
        if (tower.playerId !== playerId) {
            return { success: false, reason: 'not_your_tower' };
        }
        
        // Calculate sell value (75% of total investment)
        const totalInvestment = tower.cost + this.getTotalUpgradeCost(tower.type, tower.level - 1);
        const sellValue = Math.floor(totalInvestment * 0.75);
        
        const player = this.gameState.players.get(playerId);
        player.money += sellValue;
        
        // Remove from player's tower list
        const towerIndex = player.towers.indexOf(data.towerId);
        if (towerIndex > -1) {
            player.towers.splice(towerIndex, 1);
        }
        
        // Remove tower
        this.gameState.towers.delete(data.towerId);
        
        this.gameState.markEntityChanged('towers', data.towerId);
        this.gameState.markEntityChanged('players', playerId);
        
        return {
            success: true,
            data: {
                sellValue,
                playerMoney: player.money
            }
        };
    }
    
    // Maze Actions
    handleMazePlace(playerId, data) {
        const validation = this.validateMazePlaceData(data);
        if (!validation.success) return validation;
        
        // Check game phase
        if (this.gameState.gamePhase !== 'building') {
            return { success: false, reason: 'wrong_phase' };
        }
        
        // Delegate to game state
        const result = this.gameState.placeMazePiece(playerId, data);
        
        return result;
    }
    
    handleMazeRemove(playerId, data) {
        const validation = this.validateMazeRemoveData(data);
        if (!validation.success) return validation;
        
        if (this.gameState.gamePhase !== 'building') {
            return { success: false, reason: 'wrong_phase' };
        }
        
        // Find and remove maze piece
        const player = this.gameState.players.get(playerId);
        const mazeIndex = player.maze.indexOf(data.mazeId);
        
        if (mazeIndex === -1) {
            return { success: false, reason: 'maze_piece_not_found' };
        }
        
        // Remove from maze grid
        const mazePiece = Array.from(this.gameState.maze.values())
            .find(piece => piece.id === data.mazeId);
        
        if (mazePiece) {
            for (const pos of mazePiece.positions) {
                const gridPos = `${pos.x},${pos.z}`;
                this.gameState.maze.delete(gridPos);
            }
        }
        
        player.maze.splice(mazeIndex, 1);
        
        this.gameState.markEntityChanged('players', playerId);
        this.gameState.markEntityChanged('maze', data.mazeId);
        
        return { success: true };
    }
    
    // Game State Actions
    handlePlayerReady(playerId, data) {
        this.gameSession.setPlayerReady(playerId, data.ready !== false);
        return { success: true };
    }
    
    handlePhaseTransition(playerId, data) {
        // Only allow phase transition if all players are ready
        const allPlayersReady = Array.from(this.gameState.players.values())
            .every(p => p.ready);
        
        if (!allPlayersReady) {
            return { success: false, reason: 'not_all_players_ready' };
        }
        
        if (this.gameState.gamePhase === 'building' && data.newPhase === 'defense') {
            this.gameState.gamePhase = 'defense';
            
            // Reset player ready states
            for (const player of this.gameState.players.values()) {
                player.ready = false;
            }
            
            this.gameState.markAllChanged();
            
            return {
                success: true,
                data: { newPhase: 'defense' }
            };
        }
        
        return { success: false, reason: 'invalid_phase_transition' };
    }
    
    // Validation Methods
    validateTowerPlaceData(data) {
        if (!data.type || !data.position) {
            return { success: false, reason: 'missing_required_fields' };
        }
        
        const validTypes = ['basic', 'sniper', 'cannon', 'missile'];
        if (!validTypes.includes(data.type)) {
            return { success: false, reason: 'invalid_tower_type' };
        }
        
        if (typeof data.position.x !== 'number' || 
            typeof data.position.z !== 'number') {
            return { success: false, reason: 'invalid_position' };
        }
        
        return { success: true };
    }
    
    validateTowerUpgradeData(data) {
        if (!data.towerId) {
            return { success: false, reason: 'missing_tower_id' };
        }
        return { success: true };
    }
    
    validateTowerSellData(data) {
        if (!data.towerId) {
            return { success: false, reason: 'missing_tower_id' };
        }
        return { success: true };
    }
    
    validateMazePlaceData(data) {
        if (!data.shape || !data.positions || !Array.isArray(data.positions)) {
            return { success: false, reason: 'missing_required_fields' };
        }
        
        const validShapes = ['I', 'O', 'T', 'S', 'Z', 'L', 'J'];
        if (!validShapes.includes(data.shape)) {
            return { success: false, reason: 'invalid_shape' };
        }
        
        for (const pos of data.positions) {
            if (typeof pos.x !== 'number' || typeof pos.z !== 'number') {
                return { success: false, reason: 'invalid_position_format' };
            }
        }
        
        return { success: true };
    }
    
    validateMazeRemoveData(data) {
        if (!data.mazeId) {
            return { success: false, reason: 'missing_maze_id' };
        }
        return { success: true };
    }
    
    // Rate Limiting
    checkRateLimit(playerId, action) {
        const limit = this.actionLimits[action];
        if (!limit) return true; // No limit for this action
        
        const history = this.getActionHistory(playerId);
        const recentActions = history.filter(
            actionData => actionData.action === action &&
            Date.now() - actionData.timestamp < limit.interval
        );
        
        return recentActions.length < limit.max;
    }
    
    recordAction(playerId, action) {
        const history = this.getActionHistory(playerId);
        history.push({
            action,
            timestamp: Date.now()
        });
        
        // Keep only recent actions (last 5 seconds)
        const cutoff = Date.now() - 5000;
        const filtered = history.filter(actionData => actionData.timestamp > cutoff);
        this.playerActionHistory.set(playerId, filtered);
    }
    
    getActionHistory(playerId) {
        if (!this.playerActionHistory.has(playerId)) {
            this.playerActionHistory.set(playerId, []);
        }
        return this.playerActionHistory.get(playerId);
    }
    
    cleanupActionHistory() {
        const cutoff = Date.now() - 10000; // 10 seconds
        for (const [playerId, history] of this.playerActionHistory) {
            const filtered = history.filter(actionData => actionData.timestamp > cutoff);
            this.playerActionHistory.set(playerId, filtered);
        }
    }
    
    // Cost Calculations
    getTowerCost(type) {
        const costs = {
            basic: 20,
            sniper: 30,
            cannon: 40,
            missile: 35
        };
        return costs[type] || 20;
    }
    
    getUpgradeCost(type, currentLevel) {
        const baseCost = this.getTowerCost(type);
        return Math.floor(baseCost * Math.pow(1.5, currentLevel));
    }
    
    getTotalUpgradeCost(type, level) {
        let total = 0;
        for (let i = 1; i <= level; i++) {
            total += this.getUpgradeCost(type, i);
        }
        return total;
    }
}

export default GameLogic; 