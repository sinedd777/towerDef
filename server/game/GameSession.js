import { v4 as uuidv4 } from 'uuid';
import GameState from './GameState.js';
import CooperativeGameState from './CooperativeGameState.js';
import GameLogic from './GameLogic.js';
import { Logger } from '../monitoring/Logger.js';

class GameSession {
    constructor(sessionId, maxPlayers = 2, gameMode = 'cooperative') {
        this.sessionId = sessionId || uuidv4();
        this.maxPlayers = maxPlayers;
        this.gameMode = gameMode; // 'competitive' or 'cooperative'
        this.players = new Map(); // socketId -> player data
        
        // Use appropriate game state based on mode
        this.gameState = gameMode === 'cooperative' ? 
            new CooperativeGameState() : 
            new GameState();
            
        this.gameLogic = new GameLogic(this);
        this.logger = new Logger();
        
        // Session state
        this.status = 'waiting'; // waiting, ready, active, paused, ended
        this.createdAt = Date.now();
        this.startedAt = null;
        this.endedAt = null;
        
        // Game timing
        this.tickRate = 60; // 60 ticks per second
        this.gameLoop = null;
        this.lastTickTime = 0;
        this.deltaTime = 0;
        
        // Synchronization
        this.stateVersion = 0;
        this.lastStateUpdate = 0;
        this.pendingUpdates = [];
        
        this.logger.info(`GameSession created: ${this.sessionId}`);
    }
    
    // Player Management
    addPlayer(socketId, playerData) {
        if (this.players.size >= this.maxPlayers) {
            // Reject if game is full (no spectators)
            return { success: false, reason: 'session_full' };
        }
        
        const playerId = `player${this.players.size + 1}`;
        const player = {
            socketId,
            playerId,
            name: playerData.name || `Player ${this.players.size + 1}`,
            health: 100,
            money: 150,
            score: 0,
            wave: 1,
            towers: [],
            ready: false,
            connected: true,
            joinedAt: Date.now(),
            ...playerData
        };
        
        this.players.set(socketId, player);
        this.gameState.addPlayer(playerId, player);
        
        this.logger.info(`Player ${playerId} joined session ${this.sessionId}`);
        this.checkReadyState();
        
        return { success: true, player, sessionId: this.sessionId };
    }
    
    removePlayer(socketId) {
        const player = this.players.get(socketId);
        if (!player) {
            return;
        }
        
        this.players.delete(socketId);
        this.gameState.removePlayer(player.playerId);
        
        this.logger.info(`Player ${player.playerId} left session ${this.sessionId}`);
        
        // End game if too few players
        if (this.status === 'active' && this.players.size < 1) {
            this.endGame('insufficient_players');
        }
    }
    

    
    // Session State Management
    setPlayerReady(socketId, ready = true) {
        const player = this.players.get(socketId);
        if (player) {
            player.ready = ready;
            this.checkReadyState();
        }
    }
    
    checkReadyState() {
        if (this.status !== 'waiting') return;
        
        // For cooperative games: auto-start when 2 players join (ignore ready status)
        if (this.gameMode === 'cooperative' && this.players.size >= 2) {
            console.log(`Auto-starting cooperative game with ${this.players.size} players`);
            this.status = 'ready';
            
            setTimeout(() => {
                try {
                    this.startGame();
                    this.logger.info(`Cooperative game auto-started: ${this.sessionId}`);
                } catch (error) {
                    this.logger.error('Failed to auto-start cooperative game:', error);
                }
            }, 1000); // Small delay to ensure everything is ready
            
            this.broadcastToSession('session:ready', {
                sessionId: this.sessionId,
                players: this.getPlayerList()
            });
            return;
        }
        
        // For competitive games: require all players to be ready
        const allReady = this.players.size >= 2 && 
                        Array.from(this.players.values()).every(p => p.ready);
        
        if (allReady) {
            this.status = 'ready';
            this.broadcastToSession('session:ready', {
                sessionId: this.sessionId,
                players: this.getPlayerList()
            });
        }
    }
    
    startGame() {
        if (this.status !== 'ready') {
            throw new Error('Cannot start game - session not ready');
        }
        
        this.status = 'active';
        this.startedAt = Date.now();
        this.lastTickTime = Date.now();
        
        // Initialize game state
        this.gameState.initialize();
        
        // Start game loop
        this.startGameLoop();
        
        this.broadcastToSession('game:start', {
            sessionId: this.sessionId,
            gameState: this.gameState.getPublicState(),
            timestamp: this.startedAt
        });
        
        this.logger.info(`Game started in session ${this.sessionId}`);
    }
    
    pauseGame() {
        if (this.status === 'active') {
            this.status = 'paused';
            this.stopGameLoop();
            this.broadcastToSession('game:pause', { sessionId: this.sessionId });
        }
    }
    
    resumeGame() {
        if (this.status === 'paused') {
            this.status = 'active';
            this.lastTickTime = Date.now();
            this.startGameLoop();
            this.broadcastToSession('game:resume', { sessionId: this.sessionId });
        }
    }
    
    endGame(reason = 'completed') {
        if (this.status === 'ended') return;
        
        this.status = 'ended';
        this.endedAt = Date.now();
        this.stopGameLoop();
        
        const gameResults = this.gameState.getGameResults();
        
        this.broadcastToSession('game:end', {
            sessionId: this.sessionId,
            reason,
            results: gameResults,
            duration: this.endedAt - this.startedAt
        });
        
        this.logger.info(`Game ended in session ${this.sessionId}, reason: ${reason}`);
    }
    
    // Game Loop
    startGameLoop() {
        if (this.gameLoop) return;
        
        this.gameLoop = setInterval(() => {
            this.tick();
        }, 1000 / this.tickRate);
    }
    
    stopGameLoop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
    }
    
    tick() {
        const now = Date.now();
        this.deltaTime = now - this.lastTickTime;
        this.lastTickTime = now;
        
        // Update game logic
        this.gameLogic.update(this.deltaTime);
        
        // Update game state
        this.gameState.update(this.deltaTime);
        
        // Send state updates
        this.sendStateUpdate();
    }
    
    // State Synchronization
    sendStateUpdate() {
        this.stateVersion++;
        this.lastStateUpdate = Date.now();
        
        const stateUpdate = {
            version: this.stateVersion,
            timestamp: this.lastStateUpdate,
            deltaTime: this.deltaTime,
            gameState: this.gameState.getDeltaState(),
            players: this.getPlayerStates()
        };
        
        this.broadcastToSession('game:state_update', stateUpdate);
    }
    
    handlePlayerAction(socketId, action, data) {
        const player = this.players.get(socketId);
        if (!player || this.status !== 'active') return false;

        // Handle defense phase start
        if (action === 'game:start_defense') {
            player.ready = true;
            
            // Check if all players are ready
            const allReady = Array.from(this.players.values()).every(p => p.ready);
            
            if (allReady) {
                // Start defense phase
                this.gameState.gamePhase = 'defense';
                
                if (this.gameMode === 'cooperative') {
                    // Cooperative mode: calculate shared path
                    const path = this.gameLogic.calculatePath('player1'); // Use any player ID for shared calculation
                    if (path) {
                        // Store shared path for all players
                        for (const [playerId, playerData] of this.players) {
                            this.gameState.setPlayerPath(playerId, path);
                        }
                        
                        // Notify all players with the shared path
                        this.broadcastToSession('game:defense_started', {
                            sharedPath: path,
                            gameMode: 'cooperative',
                            timestamp: Date.now()
                        });
                    }
                } else {
                    // Competitive mode: calculate paths for each player
                    const pathUpdates = {};
                    
                    for (const [playerId, playerData] of this.players) {
                        const path = this.gameLogic.calculatePath(playerId);
                        if (path) {
                            // Store path in game state
                            this.gameState.setPlayerPath(playerId, path);
                            pathUpdates[playerId] = path;
                        }
                    }
                    
                    // Notify players with their individual paths
                    this.broadcastToSession('game:defense_started', {
                        paths: pathUpdates,
                        gameMode: 'competitive',
                        timestamp: Date.now()
                    });
                }
                
                // Start enemy spawning
                this.gameState.lastEnemySpawn = Date.now();
                this.startEnemySpawning();
            }
            
            return { success: true };
        }

        // Process other actions through game logic
        const result = this.gameLogic.processPlayerAction(player.playerId, action, data);
        
        if (result.success) {
            // Broadcast action to other players
            this.broadcastToSession('player:action', {
                playerId: player.playerId,
                action,
                data: result.data,
                timestamp: Date.now()
            }, socketId);
        }
        
        return result;
    }

    startEnemySpawning() {
        // Start spawning enemies every 2 seconds
        this.enemySpawnInterval = setInterval(() => {
            if (this.gameState.gamePhase === 'defense') {
                for (const [playerId, playerData] of this.players) {
                    const path = this.gameState.getPlayerPath(playerId);
                    if (path) {
                        const enemyId = `enemy_${playerId}_${Date.now()}`;
                        const enemy = {
                            id: enemyId,
                            playerId,
                            wave: this.gameState.currentWave,
                            health: 100,
                            position: path[0],
                            path: path
                        };

                        // Add enemy to game state
                        this.gameState.enemies.set(enemyId, enemy);

                        // Notify players
                        this.broadcastToSession('game:enemy_spawned', {
                            enemy,
                            timestamp: Date.now()
                        });
                    }
                }
            } else {
                // Stop spawning if game phase changes
                clearInterval(this.enemySpawnInterval);
            }
        }, 2000);
    }
    
    // Communication
    broadcastToSession(event, data, excludeSocketId = null) {
        // Broadcast to all players
        for (const player of this.players.values()) {
            if (excludeSocketId && player.socketId === excludeSocketId) continue;
            this.emit(player.socketId, event, data);
        }
        

    }
    
    emit(socketId, event, data) {
        // This will be set by the SessionHandler
        if (this.io) {
            this.io.to(socketId).emit(event, data);
        }
    }
    
    setIO(io) {
        this.io = io;
    }
    
    // Getters
    getPlayerList() {
        return Array.from(this.players.values()).map(p => ({
            playerId: p.playerId,
            name: p.name,
            ready: p.ready,
            connected: p.connected
        }));
    }
    
    getPlayerStates() {
        return Array.from(this.players.values()).map(p => ({
            playerId: p.playerId,
            health: p.health,
            money: p.money,
            score: p.score,
            wave: p.wave,
            towers: p.towers.length
        }));
    }
    
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            status: this.status,
            playerCount: this.players.size,
            maxPlayers: this.maxPlayers,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            duration: this.startedAt ? Date.now() - this.startedAt : 0
        };
    }
    
    getMetrics() {
        return {
            ...this.getSessionInfo(),
            stateVersion: this.stateVersion,
            lastStateUpdate: this.lastStateUpdate,
            tickRate: this.tickRate,
            players: this.getPlayerStates()
        };
    }
    
    // Cleanup
    destroy() {
        this.stopGameLoop();
        this.players.clear();
        this.logger.info(`GameSession destroyed: ${this.sessionId}`);
    }
}

export default GameSession; 