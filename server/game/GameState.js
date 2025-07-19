class GameState {
    constructor() {
        this.players = new Map(); // playerId -> player state
        this.towers = new Map(); // towerId -> tower data
        this.enemies = new Map(); // enemyId -> enemy data
        this.projectiles = new Map(); // projectileId -> projectile data
        this.maze = new Map(); // position -> maze piece
        
        // Game progression
        this.currentWave = 1;
        this.enemiesSpawned = 0;
        this.enemiesKilled = 0;
        this.gamePhase = 'building'; // building, defense, ended
        
        // Timing
        this.gameTime = 0;
        this.lastEnemySpawn = 0;
        this.enemySpawnInterval = 2000; // 2 seconds
        
        // State tracking for delta updates
        this.lastState = {};
        this.changedEntities = new Set();
        
        this.initialized = false;
    }
    
    initialize() {
        this.gameTime = 0;
        this.lastEnemySpawn = 0;
        this.currentWave = 1;
        this.enemiesSpawned = 0;
        this.enemiesKilled = 0;
        this.gamePhase = 'building';
        
        // Initialize player game areas
        for (const [playerId, player] of this.players) {
            this.initializePlayerArea(playerId);
        }
        
        this.initialized = true;
        this.markAllChanged();
    }
    
    update(deltaTime) {
        if (!this.initialized) return;
        
        this.gameTime += deltaTime;
        
        // Update enemies
        this.updateEnemies(deltaTime);
        
        // Update projectiles
        this.updateProjectiles(deltaTime);
        
        // Update towers
        this.updateTowers(deltaTime);
        
        // Spawn enemies
        this.updateEnemySpawning();
        
        // Check win/lose conditions
        this.checkGameConditions();
    }
    
    // Player Management
    addPlayer(playerId, playerData) {
        const player = {
            playerId,
            name: playerData.name,
            health: 100,
            money: 150,
            score: 0,
            wave: 1,
            mapPosition: this.getPlayerMapPosition(playerId),
            towers: [],
            maze: [],
            ready: false,
            ...playerData
        };
        
        this.players.set(playerId, player);
        this.markEntityChanged('players', playerId);
    }
    
    removePlayer(playerId) {
        // Remove player's towers and maze pieces
        const player = this.players.get(playerId);
        if (player) {
            // Remove towers
            for (const towerId of player.towers) {
                this.towers.delete(towerId);
                this.markEntityChanged('towers', towerId);
            }
            
            // Remove maze pieces
            for (const mazePos of player.maze) {
                this.maze.delete(mazePos);
                this.markEntityChanged('maze', mazePos);
            }
        }
        
        this.players.delete(playerId);
        this.markEntityChanged('players', playerId);
    }
    
    getPlayerMapPosition(playerId) {
        // Player 1 gets left map (-12.5, 0, 0), Player 2 gets right map (12.5, 0, 0)
        const playerNumber = parseInt(playerId.replace('player', ''));
        return playerNumber === 1 ? 
            { x: -12.5, y: 0, z: 0 } : 
            { x: 12.5, y: 0, z: 0 };
    }
    
    initializePlayerArea(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        // Clear any existing data for this player
        player.towers = [];
        player.maze = [];
        player.health = 100;
        player.money = 150;
        player.score = 0;
    }
    
    // Tower Management
    placeTower(playerId, towerData) {
        const player = this.players.get(playerId);
        if (!player) return { success: false, reason: 'player_not_found' };
        
        // Validate tower placement
        const validation = this.validateTowerPlacement(playerId, towerData);
        if (!validation.success) return validation;
        
        // Check if player has enough money
        if (player.money < towerData.cost) {
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
            target: null,
            cost: towerData.cost,
            createdAt: this.gameTime
        };
        
        // Deduct money and add tower
        player.money -= towerData.cost;
        player.towers.push(towerId);
        this.towers.set(towerId, tower);
        
        this.markEntityChanged('players', playerId);
        this.markEntityChanged('towers', towerId);
        
        return { success: true, tower };
    }
    
    validateTowerPlacement(playerId, towerData) {
        const player = this.players.get(playerId);
        const pos = towerData.position;
        
        // Check if position is within player's map bounds
        const mapBounds = this.getPlayerMapBounds(playerId);
        if (pos.x < mapBounds.minX || pos.x > mapBounds.maxX ||
            pos.z < mapBounds.minZ || pos.z > mapBounds.maxZ) {
            return { success: false, reason: 'out_of_bounds' };
        }
        
        // Check if position is not occupied by maze or other towers
        const gridPos = `${Math.floor(pos.x)},${Math.floor(pos.z)}`;
        if (this.maze.has(gridPos)) {
            return { success: false, reason: 'position_occupied_maze' };
        }
        
        // Check for tower conflicts
        for (const tower of this.towers.values()) {
            if (tower.playerId === playerId) {
                const distance = Math.sqrt(
                    Math.pow(tower.position.x - pos.x, 2) +
                    Math.pow(tower.position.z - pos.z, 2)
                );
                if (distance < 1.0) { // Minimum 1 unit spacing
                    return { success: false, reason: 'too_close_to_tower' };
                }
            }
        }
        
        return { success: true };
    }
    
    getPlayerMapBounds(playerId) {
        const mapPos = this.getPlayerMapPosition(playerId);
        return {
            minX: mapPos.x - 10,
            maxX: mapPos.x + 10,
            minZ: mapPos.z - 10,
            maxZ: mapPos.z + 10
        };
    }
    
    // Maze Management
    placeMazePiece(playerId, mazeData) {
        const player = this.players.get(playerId);
        if (!player) return { success: false, reason: 'player_not_found' };
        
        const validation = this.validateMazePlacement(playerId, mazeData);
        if (!validation.success) return validation;
        
        const positions = mazeData.positions; // Array of positions for this piece
        const mazeId = `maze_${playerId}_${Date.now()}`;
        
        const mazePiece = {
            id: mazeId,
            playerId,
            shape: mazeData.shape,
            positions: positions,
            createdAt: this.gameTime
        };
        
        // Add to maze grid
        for (const pos of positions) {
            const gridPos = `${pos.x},${pos.z}`;
            this.maze.set(gridPos, mazePiece);
        }
        
        player.maze.push(mazeId);
        this.markEntityChanged('players', playerId);
        this.markEntityChanged('maze', mazeId);
        
        return { success: true, mazePiece };
    }
    
    validateMazePlacement(playerId, mazeData) {
        // Similar validation logic for maze pieces
        const player = this.players.get(playerId);
        const mapBounds = this.getPlayerMapBounds(playerId);
        
        for (const pos of mazeData.positions) {
            // Check bounds
            if (pos.x < mapBounds.minX || pos.x > mapBounds.maxX ||
                pos.z < mapBounds.minZ || pos.z > mapBounds.maxZ) {
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
    
    // Enemy Management
    updateEnemies(deltaTime) {
        for (const [enemyId, enemy] of this.enemies) {
            // Update enemy position along path
            enemy.pathProgress += (enemy.speed * deltaTime) / 1000;
            
            if (enemy.pathProgress >= 1.0) {
                // Enemy reached end - damage player
                this.handleEnemyReachedEnd(enemy);
                this.enemies.delete(enemyId);
                this.markEntityChanged('enemies', enemyId);
            } else {
                // Update position based on path
                enemy.position = this.interpolatePathPosition(enemy.path, enemy.pathProgress);
                this.markEntityChanged('enemies', enemyId);
            }
        }
    }
    
    updateEnemySpawning() {
        if (this.gamePhase !== 'defense') return;
        
        const timeSinceLastSpawn = this.gameTime - this.lastEnemySpawn;
        if (timeSinceLastSpawn >= this.enemySpawnInterval) {
            this.spawnEnemy();
            this.lastEnemySpawn = this.gameTime;
        }
    }
    
    spawnEnemy() {
        // Spawn enemies for each player
        for (const [playerId, player] of this.players) {
            const enemyId = `enemy_${playerId}_${this.enemiesSpawned}`;
            const mapPos = this.getPlayerMapPosition(playerId);
            
            const enemy = {
                id: enemyId,
                playerId,
                type: this.getEnemyTypeForWave(this.currentWave),
                health: this.getEnemyHealth(this.currentWave),
                maxHealth: this.getEnemyHealth(this.currentWave),
                speed: this.getEnemySpeed(this.currentWave),
                position: { x: mapPos.x - 10, y: 0, z: mapPos.z - 10 }, // Start position
                path: this.generateEnemyPath(playerId),
                pathProgress: 0,
                reward: this.getEnemyReward(this.currentWave),
                createdAt: this.gameTime
            };
            
            this.enemies.set(enemyId, enemy);
            this.markEntityChanged('enemies', enemyId);
        }
        
        this.enemiesSpawned++;
    }
    
    generateEnemyPath(playerId) {
        // Generate path through player's maze
        const mapPos = this.getPlayerMapPosition(playerId);
        const startPos = { x: mapPos.x - 10, z: mapPos.z - 10 };
        const endPos = { x: mapPos.x + 10, z: mapPos.z + 10 };
        
        // Simple fallback path - this will be replaced by proper A* pathfinding
        return [startPos, endPos];
    }
    
    // Get maze obstacles for a specific player
    getMazeObstacles(playerId) {
        const obstacles = [];
        const mapPos = this.getPlayerMapPosition(playerId);
        
        for (const [posKey, mazePiece] of this.maze) {
            // Parse position key (format: "x,z,playerId")
            const [x, z, piecePlayerId] = posKey.split(',').map(v => parseFloat(v));
            
            // Only include maze pieces for this player
            if (piecePlayerId === playerId || posKey.endsWith(`,${playerId}`)) {
                obstacles.push({ x, z });
            }
        }
        
        return obstacles;
    }
    
    // Get tower obstacles for a specific player
    getTowerObstacles(playerId) {
        const obstacles = [];
        
        for (const [towerId, tower] of this.towers) {
            // Only include towers for this player
            if (tower.playerId === playerId) {
                obstacles.push({ 
                    x: tower.position.x, 
                    z: tower.position.z 
                });
            }
        }
        
        return obstacles;
    }
    
    // Set/get player paths for pathfinding
    setPlayerPath(playerId, path) {
        if (!this.playerPaths) {
            this.playerPaths = new Map();
        }
        this.playerPaths.set(playerId, path);
    }
    
    getPlayerPath(playerId) {
        if (!this.playerPaths) {
            return null;
        }
        return this.playerPaths.get(playerId);
    }
    
    // Tower/Enemy Combat
    updateTowers(deltaTime) {
        for (const [towerId, tower] of this.towers) {
            // Find targets
            const target = this.findTowerTarget(tower);
            
            if (target && this.gameTime - tower.lastFired >= tower.fireRate) {
                this.fireTower(tower, target);
                tower.lastFired = this.gameTime;
                this.markEntityChanged('towers', towerId);
            }
        }
    }
    
    findTowerTarget(tower) {
        let closestEnemy = null;
        let closestDistance = tower.range;
        
        for (const enemy of this.enemies.values()) {
            if (enemy.playerId !== tower.playerId) continue;
            
            const distance = Math.sqrt(
                Math.pow(enemy.position.x - tower.position.x, 2) +
                Math.pow(enemy.position.z - tower.position.z, 2)
            );
            
            if (distance <= tower.range && distance < closestDistance) {
                closestEnemy = enemy;
                closestDistance = distance;
            }
        }
        
        return closestEnemy;
    }
    
    fireTower(tower, target) {
        const projectileId = `projectile_${tower.id}_${Date.now()}`;
        const projectile = {
            id: projectileId,
            towerId: tower.id,
            playerId: tower.playerId,
            targetId: target.id,
            position: { ...tower.position },
            targetPosition: { ...target.position },
            speed: 20, // units per second
            damage: tower.damage,
            createdAt: this.gameTime
        };
        
        this.projectiles.set(projectileId, projectile);
        this.markEntityChanged('projectiles', projectileId);
    }
    
    updateProjectiles(deltaTime) {
        for (const [projectileId, projectile] of this.projectiles) {
            const target = this.enemies.get(projectile.targetId);
            
            if (!target) {
                // Target no longer exists
                this.projectiles.delete(projectileId);
                this.markEntityChanged('projectiles', projectileId);
                continue;
            }
            
            // Move projectile toward target
            const dx = target.position.x - projectile.position.x;
            const dz = target.position.z - projectile.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < 0.5) {
                // Hit target
                this.damageEnemy(target, projectile.damage, projectile.playerId);
                this.projectiles.delete(projectileId);
                this.markEntityChanged('projectiles', projectileId);
            } else {
                // Move closer
                const moveDistance = (projectile.speed * deltaTime) / 1000;
                projectile.position.x += (dx / distance) * moveDistance;
                projectile.position.z += (dz / distance) * moveDistance;
                this.markEntityChanged('projectiles', projectileId);
            }
        }
    }
    
    damageEnemy(enemy, damage, attackingPlayerId) {
        enemy.health -= damage;
        
        if (enemy.health <= 0) {
            // Enemy died
            this.killEnemy(enemy, attackingPlayerId);
        } else {
            this.markEntityChanged('enemies', enemy.id);
        }
    }
    
    killEnemy(enemy, killingPlayerId) {
        const player = this.players.get(killingPlayerId);
        if (player) {
            player.money += enemy.reward;
            player.score += enemy.reward * 10;
            this.markEntityChanged('players', killingPlayerId);
        }
        
        this.enemies.delete(enemy.id);
        this.enemiesKilled++;
        this.markEntityChanged('enemies', enemy.id);
    }
    
    handleEnemyReachedEnd(enemy) {
        const player = this.players.get(enemy.playerId);
        if (player) {
            player.health -= 10; // 10 damage per enemy that escapes
            this.markEntityChanged('players', enemy.playerId);
        }
    }
    
    // Game progression
    checkGameConditions() {
        // Check if any player has lost
        for (const [playerId, player] of this.players) {
            if (player.health <= 0) {
                this.endGame('player_defeated', playerId);
                return;
            }
        }
        
        // Check wave progression
        if (this.enemiesKilled >= this.currentWave * 10) {
            this.nextWave();
        }
    }
    
    nextWave() {
        this.currentWave++;
        this.enemiesSpawned = 0;
        this.enemiesKilled = 0;
        
        // Give players money for completing wave
        for (const [playerId, player] of this.players) {
            player.money += 50;
            player.wave = this.currentWave;
            this.markEntityChanged('players', playerId);
        }
    }
    
    endGame(reason, playerId = null) {
        this.gamePhase = 'ended';
        // Game ending will be handled by GameSession
    }
    
    // Helper methods for game balance
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
    
    // State synchronization helpers
    markEntityChanged(entityType, entityId) {
        this.changedEntities.add(`${entityType}:${entityId}`);
    }
    
    markAllChanged() {
        this.changedEntities.clear();
        
        for (const playerId of this.players.keys()) {
            this.markEntityChanged('players', playerId);
        }
        for (const towerId of this.towers.keys()) {
            this.markEntityChanged('towers', towerId);
        }
        for (const enemyId of this.enemies.keys()) {
            this.markEntityChanged('enemies', enemyId);
        }
        for (const projectileId of this.projectiles.keys()) {
            this.markEntityChanged('projectiles', projectileId);
        }
    }
    
    getPublicState() {
        return {
            players: Array.from(this.players.values()),
            towers: Array.from(this.towers.values()),
            enemies: Array.from(this.enemies.values()),
            projectiles: Array.from(this.projectiles.values()),
            maze: Array.from(this.maze.values()),
            gamePhase: this.gamePhase,
            currentWave: this.currentWave,
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
            }
        }
        
        this.changedEntities.clear();
        return changes;
    }
    
    getGameResults() {
        const results = {
            duration: this.gameTime,
            finalWave: this.currentWave,
            players: []
        };
        
        for (const [playerId, player] of this.players) {
            results.players.push({
                playerId,
                name: player.name,
                score: player.score,
                health: player.health,
                money: player.money,
                towers: player.towers.length,
                survived: player.health > 0
            });
        }
        
        return results;
    }
    
    interpolatePathPosition(path, progress) {
        if (path.length < 2) return path[0] || { x: 0, y: 0, z: 0 };
        
        const segmentLength = 1 / (path.length - 1);
        const segmentIndex = Math.floor(progress / segmentLength);
        const segmentProgress = (progress % segmentLength) / segmentLength;
        
        const start = path[segmentIndex];
        const end = path[Math.min(segmentIndex + 1, path.length - 1)];
        
        return {
            x: start.x + (end.x - start.x) * segmentProgress,
            y: start.y + (end.y - start.y) * segmentProgress,
            z: start.z + (end.z - start.z) * segmentProgress
        };
    }
}

export default GameState; 