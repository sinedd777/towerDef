class CooperativeGameState {
    constructor() {
        this.players = new Map(); // playerId -> player data
        this.towers = new Map(); // towerId -> tower data
        this.enemies = new Map(); // enemyId -> enemy data
        this.projectiles = new Map(); // projectileId -> projectile data
        this.maze = new Map(); // position -> maze piece
        
        // Shared resources (key difference from competitive mode)
        this.sharedResources = {
            health: 100,
            money: 150,
            score: 0,
            wave: 1
        };
        
        // Turn management system
        this.gamePhase = 'building'; // building, defense, ended
        this.currentTurn = 'player1'; // whose turn it is
        this.shapesPlaced = {
            player1: 0, // max 3 per player
            player2: 0
        };
        
        // Single shared board (20x20 centered at origin)
        this.gameBoard = {
            mapSize: 20,
            center: { x: 0, y: 0, z: 0 },
            bounds: {
                minX: -10,
                maxX: 10,
                minZ: -10,
                maxZ: 10
            }
        };
        
        // Dual spawn system for cooperative play
        this.spawnPoints = [
            { x: -8, z: -8, id: 'spawn1' }, // Northwest
            { x: -8, z: 8, id: 'spawn2' }   // Southwest
        ];
        this.exitPoint = { x: 8, z: 0 }; // East center
        
        // Game progression
        this.enemiesSpawned = 0;
        this.enemiesKilled = 0;
        this.gameTime = 0;
        this.lastEnemySpawn = 0;
        this.enemySpawnInterval = 2000;
        
        // State tracking
        this.lastState = {};
        this.changedEntities = new Set();
        this.initialized = false;
    }
    
    initialize() {
        this.gameTime = 0;
        this.lastEnemySpawn = 0;
        this.enemiesSpawned = 0;
        this.enemiesKilled = 0;
        this.gamePhase = 'building';
        this.currentTurn = 'player1';
        
        // Reset shape placement counters
        this.shapesPlaced = { player1: 0, player2: 0 };
        
        this.initialized = true;
        this.markAllChanged();
        console.log('CooperativeGameState initialized');
    }
    
    // Player Management
    addPlayer(playerId, playerData) {
        const player = {
            playerId,
            name: playerData.name || playerId,
            ready: false,
            shapesRemaining: 3,
            connected: true,
            joinedAt: Date.now(),
            ...playerData
        };
        
        this.players.set(playerId, player);
        this.markEntityChanged('players', playerId);
        
        console.log(`Player ${playerId} added to cooperative game`);
    }
    
    removePlayer(playerId) {
        this.players.delete(playerId);
        this.markEntityChanged('players', playerId);
    }
    
    // Turn Management
    getCurrentTurn() {
        return this.currentTurn;
    }
    
    isPlayerTurn(playerId) {
        return this.currentTurn === playerId;
    }
    
    switchTurn() {
        this.currentTurn = this.currentTurn === 'player1' ? 'player2' : 'player1';
        this.markEntityChanged('gameState', 'turn');
        console.log(`Turn switched to ${this.currentTurn}`);
    }
    
    // Shape Placement (Building Phase)
    placeMazePiece(playerId, mazeData) {
        // Validate it's the player's turn
        if (!this.isPlayerTurn(playerId)) {
            return { success: false, reason: 'not_your_turn' };
        }
        
        // Validate we're in building phase
        if (this.gamePhase !== 'building') {
            return { success: false, reason: 'not_building_phase' };
        }
        
        // Validate player has shapes remaining
        if (this.shapesPlaced[playerId] >= 3) {
            return { success: false, reason: 'max_shapes_reached' };
        }
        
        // Validate maze placement
        const validation = this.validateMazePlacement(mazeData);
        if (!validation.success) return validation;
        
        // Place the maze piece
        const mazeId = `maze_${playerId}_${Date.now()}`;
        const mazePiece = {
            id: mazeId,
            playerId,
            shape: mazeData.shape,
            positions: mazeData.positions,
            createdAt: this.gameTime
        };
        
        // Add to maze grid
        for (const pos of mazeData.positions) {
            const gridPos = `${pos.x},${pos.z}`;
            console.log('🧩 Storing maze block:', {
                position: pos,
                gridKey: gridPos,
                mazePieceId: mazeId
            });
            this.maze.set(gridPos, mazePiece);
        }
        
        // Update shape counters
        this.shapesPlaced[playerId]++;
        this.markEntityChanged('maze', mazeId);
        this.markEntityChanged('gameState', 'shapes');
        
        // Switch turn
        this.switchTurn();
        
        // Check if we should transition to defense phase
        const totalShapes = this.shapesPlaced.player1 + this.shapesPlaced.player2;
        
        // Original logic: Start when 6 shapes total are placed
        const allShapesUsed = totalShapes >= 6;
        
        // NEW logic: Also start when both players have exhausted their individual supplies
        // This handles the case where players might not use all their shapes
        const player1Done = this.shapesPlaced.player1 >= 3;
        const player2Done = this.shapesPlaced.player2 >= 3;
        const bothPlayersExhausted = player1Done && player2Done;
        
        if (allShapesUsed || bothPlayersExhausted) {
            console.log(`🚀 Starting defense phase - Shapes: P1=${this.shapesPlaced.player1}, P2=${this.shapesPlaced.player2}, Total=${totalShapes}`);
            console.log(`🚀 Trigger: ${allShapesUsed ? 'All shapes used' : 'Both players exhausted'}`);
            this.startDefensePhase();
        }
        
        return { success: true, mazePiece, totalShapes, remainingShapes: 6 - totalShapes };
    }
    
    validateMazePlacement(mazeData) {
        const bounds = this.gameBoard.bounds;
        
        for (const pos of mazeData.positions) {
            // Check bounds
            if (pos.x < bounds.minX || pos.x > bounds.maxX ||
                pos.z < bounds.minZ || pos.z > bounds.maxZ) {
                return { success: false, reason: 'out_of_bounds' };
            }
            
            // Check if position is already occupied
            const gridPos = `${pos.x},${pos.z}`;
            if (this.maze.has(gridPos)) {
                return { success: false, reason: 'position_occupied' };
            }
        }
        
        return { success: true };
    }
    
    // Defense Phase
    startDefensePhase() {
        console.log('🚀 ===== SERVER: DEFENSE PHASE STARTING =====');
        console.log('🚀 Previous phase:', this.gamePhase);
        console.log('🚀 Previous turn:', this.currentTurn);
        
        this.gamePhase = 'defense';
        this.currentTurn = 'player1'; // Reset to player1 for defense
        this.markEntityChanged('gameState', 'phase');
        this.markEntityChanged('gameState', 'turn');
        
        console.log('🚀 Defense phase set to:', this.gamePhase);
        console.log('🚀 Current turn set to:', this.currentTurn);
        console.log('🚀 Phase and turn changes marked in entity changes');
        console.log('🚀 ===== DEFENSE PHASE TRANSITION COMPLETE =====');
        console.log('🚀 NOTE: game:defense_started event should be sent by GameEventHandler');
        
        return { success: true, phase: 'defense', currentTurn: this.currentTurn };
    }
    
    // Tower Management (Defense Phase)
    placeTower(playerId, towerData) {
        // Validate it's the player's turn
        if (!this.isPlayerTurn(playerId)) {
            return { success: false, reason: 'not_your_turn' };
        }
        
        // Validate we're in defense phase
        if (this.gamePhase !== 'defense') {
            return { success: false, reason: 'not_defense_phase' };
        }
        
        // Validate tower placement
        const validation = this.validateTowerPlacement(towerData);
        if (!validation.success) return validation;
        
        // Check if there's enough shared money
        if (this.sharedResources.money < towerData.cost) {
            return { success: false, reason: 'insufficient_funds' };
        }
        
        // Create tower
        const towerId = `tower_${playerId}_${Date.now()}`;
        const tower = {
            id: towerId,
            playerId,
            type: towerData.type,
            position: towerData.position,
            level: 1,
            damage: this.getTowerDamage(towerData.type),
            range: this.getTowerRange(towerData.type),
            fireRate: this.getTowerFireRate(towerData.type),
            lastFired: 0,
            cost: towerData.cost,
            createdAt: this.gameTime
        };
        
        // Deduct from shared money
        this.sharedResources.money -= towerData.cost;
        this.towers.set(towerId, tower);
        
        this.markEntityChanged('towers', towerId);
        this.markEntityChanged('gameState', 'resources');
        
        // Switch turn
        this.switchTurn();
        
        return { success: true, tower };
    }
    
    validateTowerPlacement(towerData) {
        const pos = towerData.position;
        const bounds = this.gameBoard.bounds;
        
        console.log('🔍 Tower placement validation:', {
            towerPosition: pos,
            bounds: bounds
        });
        
        // Check bounds
        if (pos.x < bounds.minX || pos.x > bounds.maxX ||
            pos.z < bounds.minZ || pos.z > bounds.maxZ) {
            return { success: false, reason: 'out_of_bounds' };
        }
        
        // Check if position is NOT on a maze block (towers must be placed on maze blocks)
        const gridPos = `${pos.x.toFixed(1)},${pos.z.toFixed(1)}`;
        
        console.log('🔍 Maze block validation:', {
            lookingFor: gridPos,
            allMazeKeys: Array.from(this.maze.keys()),
            mazeHasKey: this.maze.has(gridPos)
        });
        
        if (!this.maze.has(gridPos)) {
            return { success: false, reason: 'must_place_on_maze_block' };
        }
        
        // Check for tower conflicts
        for (const tower of this.towers.values()) {
            const distance = Math.sqrt(
                Math.pow(tower.position.x - pos.x, 2) +
                Math.pow(tower.position.z - pos.z, 2)
            );
            if (distance < 1.0) {
                return { success: false, reason: 'too_close_to_tower' };
            }
        }
        
        return { success: true };
    }
    
    // Shared Resource Management
    addSharedMoney(amount) {
        this.sharedResources.money += amount;
        this.markEntityChanged('gameState', 'resources');
    }
    
    addSharedScore(amount) {
        this.sharedResources.score += amount;
        this.markEntityChanged('gameState', 'resources');
    }
    
    loseSharedHealth(amount) {
        this.sharedResources.health -= amount;
        this.markEntityChanged('gameState', 'resources');
        
        if (this.sharedResources.health <= 0) {
            this.endGame('health_depleted');
        }
    }
    
    // Game State Management
    update(deltaTime) {
        if (!this.initialized || this.gamePhase === 'ended') return;
        
        this.gameTime += deltaTime;
        
        if (this.gamePhase === 'defense') {
            this.updateEnemies(deltaTime);
            this.updateProjectiles(deltaTime);
            this.updateTowers(deltaTime);
            this.updateEnemySpawning();
        }
    }
    
    updateEnemySpawning() {
        if (this.gamePhase !== 'defense') {
            return;
        }
        
        const timeSinceLastSpawn = this.gameTime - this.lastEnemySpawn;
        
        if (timeSinceLastSpawn >= this.enemySpawnInterval) {
            this.spawnEnemy();
            this.lastEnemySpawn = this.gameTime;
        }
    }
    
    spawnEnemy() {
        const enemyId = `enemy_${this.enemiesSpawned}`;
        
        // Choose random viable spawn point
        const viableSpawns = this.getViableSpawnPoints();
        
        if (viableSpawns.length === 0) {
            console.log(`❌ No viable spawn points available! Cannot spawn enemy.`);
            return;
        }
        
        const spawnPoint = viableSpawns[Math.floor(Math.random() * viableSpawns.length)];
        
        // Use calculated path if available, otherwise fall back to simple path
        let enemyPath = this.primaryPath;
        
        if (!enemyPath) {
            enemyPath = this.generateEnemyPath(spawnPoint);
        }
        
        // If we have a calculated path but it doesn't start from this spawn point,
        // create a path from this spawn point to the calculated path
        if (enemyPath && enemyPath.length > 0) {
            const pathStart = enemyPath[0];
            if (Math.abs(pathStart.x - spawnPoint.x) > 0.5 || Math.abs(pathStart.z - spawnPoint.z) > 0.5) {
                // Need to connect spawn point to the main path
                enemyPath = [spawnPoint, ...enemyPath];
            }
        }
        
        const enemyType = this.getEnemyTypeForWave(this.sharedResources.wave);
        const enemyHealth = this.getEnemyHealth(this.sharedResources.wave);
        const enemySpeed = this.getEnemySpeed(this.sharedResources.wave);
        
        const enemy = {
            id: enemyId,
            type: enemyType,
            health: enemyHealth,
            maxHealth: enemyHealth,
            speed: enemySpeed,
            position: { x: spawnPoint.x, y: 0, z: spawnPoint.z },
            path: enemyPath,
            pathProgress: 0,
            reward: this.getEnemyReward(this.sharedResources.wave),
            createdAt: this.gameTime
        };
        
        this.enemies.set(enemyId, enemy);
        this.enemiesSpawned++;
        this.markEntityChanged('enemies', enemyId);
        
        console.log(`🚀 Spawned enemy ${enemyId} (wave ${this.sharedResources.wave})`);
    }
    
    getViableSpawnPoints() {
        // Return spawn points that have valid paths to exit
        // For now, return both spawn points - pathfinding validation happens elsewhere
        return this.spawnPoints;
    }
    
    generateEnemyPath(spawnPoint) {
        // Simple fallback path from spawn to exit - will be replaced by A* pathfinding
        return [
            { x: spawnPoint.x, y: 0, z: spawnPoint.z },
            { x: this.exitPoint.x, y: 0, z: this.exitPoint.z }
        ];
    }
    
    // Get maze obstacles for pathfinding (all maze pieces on shared board)
    getMazeObstacles(playerId = null) {
        const obstacles = [];
        
        for (const [posKey, mazePiece] of this.maze) {
            // Parse position key (format: "x,z")
            const [x, z] = posKey.split(',').map(v => parseFloat(v));
            obstacles.push({ x, z });
        }
        
        return obstacles;
    }
    
    // Get tower obstacles for pathfinding (all towers on shared board)
    getTowerObstacles(playerId = null) {
        const obstacles = [];
        
        for (const [towerId, tower] of this.towers) {
            obstacles.push({ 
                x: tower.position.x, 
                z: tower.position.z 
            });
        }
        
        return obstacles;
    }
    
    // Set/get shared paths for cooperative mode
    setPlayerPath(playerId, path) {
        if (!this.sharedPaths) {
            this.sharedPaths = new Map();
        }
        this.sharedPaths.set(playerId, path);
        
        // In cooperative mode, we also store a primary shared path
        if (!this.primaryPath) {
            this.primaryPath = path;
        }
    }
    
    getPlayerPath(playerId) {
        if (!this.sharedPaths) {
            return this.primaryPath || null;
        }
        return this.sharedPaths.get(playerId) || this.primaryPath;
    }
    
    // Get all viable spawn points for cooperative mode
    getViableSpawnPoints() {
        // Return all configured spawn points
        // Could be enhanced to check if paths exist from each spawn point
        return this.spawnPoints || [
            { x: -8, z: -8 },  // Northwest
            { x: -8, z: 8 }    // Southwest
        ];
    }
    
    updateEnemies(deltaTime) {
        for (const [enemyId, enemy] of this.enemies) {
            enemy.pathProgress += (enemy.speed * deltaTime) / 1000;
            
            if (enemy.pathProgress >= 1.0) {
                this.handleEnemyReachedEnd(enemy);
                this.enemies.delete(enemyId);
                this.markEntityChanged('enemies', enemyId);
            } else {
                enemy.position = this.interpolatePathPosition(enemy.path, enemy.pathProgress);
                this.markEntityChanged('enemies', enemyId);
            }
        }
    }
    
    updateTowers(deltaTime) {
        // Basic tower update - to be enhanced
        for (const [towerId, tower] of this.towers) {
            // Tower logic here
        }
    }
    
    updateProjectiles(deltaTime) {
        // Basic projectile update - to be enhanced
        for (const [projectileId, projectile] of this.projectiles) {
            // Projectile logic here
        }
    }
    
    handleEnemyReachedEnd(enemy) {
        this.loseSharedHealth(10);
        console.log(`Enemy ${enemy.id} reached end! Shared health now: ${this.sharedResources.health}`);
    }
    
    // Helper methods
    getTowerDamage(type) {
        const damages = { basic: 25, sniper: 50, cannon: 100, missile: 75 };
        return damages[type] || 25;
    }
    
    getTowerRange(type) {
        const ranges = { basic: 3, sniper: 6, cannon: 2.5, missile: 4 };
        return ranges[type] || 3;
    }
    
    getTowerFireRate(type) {
        const rates = { basic: 1000, sniper: 2000, cannon: 3000, missile: 1500 };
        return rates[type] || 1000;
    }
    
    getEnemyTypeForWave(wave) {
        if (wave <= 3) return 'ufo-a';
        if (wave <= 6) return 'ufo-b';
        if (wave <= 9) return 'ufo-c';
        return 'ufo-d';
    }
    
    getEnemyHealth(wave) {
        return 50 + (wave * 15);
    }
    
    getEnemySpeed(wave) {
        return 2 + (wave * 0.2);
    }
    
    getEnemyReward(wave) {
        return 10 + Math.floor(wave / 2);
    }
    
    interpolatePathPosition(path, progress) {
        if (path.length < 2) return path[0] || { x: 0, y: 0, z: 0 };
        
        const segmentLength = 1 / (path.length - 1);
        const segmentIndex = Math.floor(progress / segmentLength);
        const segmentProgress = (progress % segmentLength) / segmentLength;
        
        const start = path[segmentIndex];
        const end = path[Math.min(segmentIndex + 1, path.length - 1)];
        
        // Ensure Y coordinates exist to prevent NaN
        const startY = start.y !== undefined ? start.y : 0;
        const endY = end.y !== undefined ? end.y : 0;
        
        return {
            x: start.x + (end.x - start.x) * segmentProgress,
            y: startY + (endY - startY) * segmentProgress,
            z: start.z + (end.z - start.z) * segmentProgress
        };
    }
    
    endGame(reason) {
        this.gamePhase = 'ended';
        this.markEntityChanged('gameState', 'phase');
        console.log(`Cooperative game ended: ${reason}`);
    }
    
    // State synchronization
    markEntityChanged(entityType, entityId) {
        this.changedEntities.add(`${entityType}:${entityId}`);
    }
    
    markAllChanged() {
        this.changedEntities.clear();
        for (const playerId of this.players.keys()) {
            this.markEntityChanged('players', playerId);
        }
        this.markEntityChanged('gameState', 'all');
    }
    
    getPublicState() {
        return {
            players: Array.from(this.players.values()),
            towers: Array.from(this.towers.values()),
            enemies: Array.from(this.enemies.values()),
            projectiles: Array.from(this.projectiles.values()),
            maze: Array.from(this.maze.values()),
            sharedResources: { ...this.sharedResources },
            gamePhase: this.gamePhase,
            currentTurn: this.currentTurn,
            shapesPlaced: { ...this.shapesPlaced },
            spawnPoints: this.spawnPoints,
            exitPoint: this.exitPoint,
            gameTime: this.gameTime
        };
    }
    
    getDeltaState() {
        const changes = {};
        
        for (const change of this.changedEntities) {
            const [entityType, entityId] = change.split(':');
            
            if (!changes[entityType]) changes[entityType] = {};
            
            switch (entityType) {
                case 'players':
                    changes[entityType][entityId] = this.players.get(entityId) || null;
                    break;
                case 'towers':
                    changes[entityType][entityId] = this.towers.get(entityId) || null;
                    break;
                case 'enemies':
                    changes[entityType][entityId] = this.enemies.get(entityId) || null;             
                    break;
                case 'projectiles':
                    changes[entityType][entityId] = this.projectiles.get(entityId) || null;
                    break;
                case 'maze':
                    changes[entityType][entityId] = this.maze.get(entityId) || null;
                    break;
                case 'gameState':
                    changes[entityType] = {
                        sharedResources: this.sharedResources,
                        gamePhase: this.gamePhase,
                        currentTurn: this.currentTurn,
                        shapesPlaced: this.shapesPlaced
                    };
                    break;
            }
        }
        
        this.changedEntities.clear();
        return changes;
    }
}

export default CooperativeGameState; 