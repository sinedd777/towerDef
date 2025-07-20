import { io } from 'socket.io-client';

export class NetworkManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.connectionQuality = 'excellent'; // excellent, good, fair, poor
        this.latency = 0;
        this.sessionId = null;
        this.playerId = null;
        this.playerName = null;
        this.isHost = false;
        
        // Event callbacks
        this.onConnected = null;
        this.onDisconnected = null;
        this.onError = null;
        this.onSessionJoined = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onGameStateUpdate = null;
        this.onGameEvent = null;
        this.onMatchmakingUpdate = null;
        this.onMatchFound = null;
        
        // Cooperative mode callbacks
        this.onTurnChanged = null;
        this.onDefenseStarted = null;
        this.onGameMessage = null;
        this.onMazePlaced = null;
        this.onMazePlaceFailed = null;
        this.onMazePiecePlaced = null;
        
        // Tower callbacks
        this.onTowerPlaced = null;
        this.onTowerPlaceFailed = null;
        this.onTowerUpgraded = null;
        this.onTowerUpgradeFailed = null;
        this.onTowerSold = null;
        this.onTowerSellFailed = null;
        
        // Connection monitoring
        this.pingInterval = null;
        this.lastPingTime = 0;
        
        // Auto-reconnection
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = null;

        // Matchmaking state
        this.isInMatchmaking = false;
        
        // State sync intervals
        this.lastEnemySync = 0;
        this.lastTowerSync = 0;
        this.enemySyncInterval = 300; // ms
        this.towerSyncInterval = 200; // ms
        
        // State caches for delta compression
        this.lastSentEnemyStates = new Map();
        this.lastSentTowerStates = new Map();

        // Wave synchronization
        this.currentWave = 0;
        this.waveData = null;
        this.isWaveInProgress = false;
    }
    
    connect(serverUrl = 'http://localhost:4000') {
        if (this.isConnected) {
            return;
        }
        
        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            timeout: 5000,
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });
        
        this.setupEventListeners();
        this.setupDeferredEventListeners();
        this.startPingMonitoring();
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.cleanup();
    }
    
    setupEventListeners() {
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            if (this.onConnected) this.onConnected();
        });
        
        this.socket.on('player:connected', (data) => {
            this.playerId = data.playerId;
            
            if (this.playerName) {
                this.updatePlayerProfile({ name: this.playerName });
            }
        });
        
        this.socket.on('player:profile_updated', (data) => {
            this.playerName = data.name;
        });
        
        this.socket.on('player:error', (data) => {
            if (this.onError) this.onError(data);
        });
        
        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            if (this.onDisconnected) this.onDisconnected(reason);
            
            if (reason === 'io client disconnect') {
                this.attemptReconnection();
            }
        });
        
        this.socket.on('connect_error', (error) => {
            if (this.onError) this.onError(error);
            this.attemptReconnection();
        });
        
        this.socket.on('session:created', (data) => {
            this.sessionId = data.sessionId;
            this.playerId = data.player.id;
            this.isHost = true;
            if (this.onSessionJoined) this.onSessionJoined(data);
        });
        
        this.socket.on('session:joined', (data) => {
            this.sessionId = data.sessionId;
            this.playerId = data.player.id;
            this.isHost = false;
            if (this.onSessionJoined) this.onSessionJoined(data);
        });
        
        this.socket.on('session:joined_as_spectator', (data) => {
            this.sessionId = data.sessionId;
            this.playerId = null;
            this.isHost = false;
            this.isSpectator = true;
            if (this.onSessionJoined) this.onSessionJoined(data);
        });
        
        this.socket.on('session:error', (data) => {
            if (this.onError) this.onError(data);
        });
        
        this.socket.on('player:joined', (data) => {
            if (this.onPlayerJoined) this.onPlayerJoined(data);
        });
        
        this.socket.on('player:left', (data) => {   
            if (this.onPlayerLeft) this.onPlayerLeft(data);
        });
        
        this.socket.on('game:error', (data) => {
            if (this.onError) this.onError(data);
        });
        
        this.socket.on('game_state_update', (data) => {
            if (this.onGameStateUpdate) this.onGameStateUpdate(data);
        });
        
        this.socket.on('game_event', (data) => {
            if (this.onGameEvent) this.onGameEvent(data);
        });
        
        this.socket.on('pong', (timestamp) => {
            this.latency = Date.now() - timestamp;
            this.updateConnectionQuality();
        });
        
        this.socket.on('error', (error) => {
            if (this.onError) this.onError(error);
        });

        this.socket.on('matchmaking:error', (error) => {
            if (error.message === 'queued') {
                if (this.onMatchmakingUpdate) {
                    this.onMatchmakingUpdate({
                        status: 'queued',
                        position: error.position || 1
                    });
                }
                return;
            }
            
            this.isInMatchmaking = false;
            if (this.onError) {
                this.onError(error);
            }
        });

        this.socket.on('matchmaking:queued', (data) => {
            this.isInMatchmaking = true;
            if (this.onMatchmakingUpdate) {
                this.onMatchmakingUpdate({
                    status: 'queued',
                    position: data.position
                });
            }
        });

        this.socket.on('matchmaking:matched', (data) => {
            this.isInMatchmaking = false;
            
            if (this.onMatchFound) {
                this.onMatchFound({
                    sessionId: data.sessionId,
                    match: data.match
                });
            }
            
            if (this.onMatchmakingUpdate) {
                this.onMatchmakingUpdate({
                    status: 'matched',
                    sessionId: data.sessionId,
                    match: data.match
                });
            }
            
            const sessionId = data.sessionId;
            
            if (sessionId) {
                this.sessionId = sessionId;
            } else if (this.onError) {
                this.onError({ message: 'Invalid match data: missing session ID' });
            }
        });

        this.socket.on('matchmaking:timeout', (data) => {
            this.isInMatchmaking = false;
            if (this.onMatchmakingUpdate) {
                this.onMatchmakingUpdate({
                    status: 'timeout',
                    reason: data.reason
                });
            }
        });

        this.socket.on('matchmaking:cancelled', () => {
            this.isInMatchmaking = false;
            if (this.onMatchmakingUpdate) {
                this.onMatchmakingUpdate({
                    status: 'cancelled'
                });
            }
        });

        this.socket.on('maze:placed', (data) => {
            if (this.onMazePlaced) {
                this.onMazePlaced(data);
            }
        });

        this.socket.on('maze:place_failed', (data) => {
            if (this.onMazePlaceFailed) {
                this.onMazePlaceFailed(data);
            }
        });

        this.socket.on('maze:piece_placed', (data) => {
            if (this.onMazePiecePlaced) {
                this.onMazePiecePlaced(data);
            }
        });

        this.socket.on('tower:placed', (data) => {
            if (this.onTowerPlaced) {
                this.onTowerPlaced(data);
            }
        });

        this.socket.on('tower:place_failed', (data) => {
            if (this.onTowerPlaceFailed) {
                this.onTowerPlaceFailed(data);
            }
        });

        this.socket.on('tower:upgraded', (data) => {
            if (this.onTowerUpgraded) {
                this.onTowerUpgraded(data);
            }
        });

        this.socket.on('tower:upgrade_failed', (data) => {
            if (this.onTowerUpgradeFailed) {
                this.onTowerUpgradeFailed(data);
            }
        });

        this.socket.on('tower:sold', (data) => {
            if (this.onTowerSold) {
                this.onTowerSold(data);
            }
        });

        this.socket.on('tower:sell_failed', (data) => {
            if (this.onTowerSellFailed) {
                this.onTowerSellFailed(data);
            }
        });
    }
    
    createSession() {
        if (!this.isConnected) {
            return;
        }
        
        this.socket.emit('session:create');
    }
    
    joinSession(sessionId, playerName = null) {
        if (!this.isConnected) {
            return;
        }
        
        const finalPlayerName = playerName || this.playerName || `Player_${this.socket.id.slice(0, 6)}`;
        this.socket.emit('session:join', { 
            sessionId,
            playerName: finalPlayerName
        });
    }
    
    leaveSession() {
        if (!this.isConnected || !this.sessionId) return;
        
        this.socket.emit('session:leave');
        this.sessionId = null;
        this.playerId = null;
        this.isHost = false;
    }
    
    sendGameEvent(eventType, data) {
        if (!this.isConnected || !this.sessionId) return;
        
        this.socket.emit(eventType, {
            ...data,
            timestamp: Date.now()
        });
    }
    
    sendPlayerAction(actionType, actionData) {
        this.socket.emit('player:action', {
            actionType,
            actionData,
            playerId: this.playerId,
            timestamp: Date.now()
        });
    }
    
    placeTower(x, z, towerType) {
        this.socket.emit('tower:place', {
            type: towerType,
            position: { x, z },
            playerId: this.playerId,
            timestamp: Date.now()
        });
    }
    
    upgradeTower(towerId) {
        this.socket.emit('tower:upgrade', {
            towerId,
            playerId: this.playerId,
            timestamp: Date.now()
        });
    }
    
    sellTower(towerId) {
        this.socket.emit('tower:sell', {
            towerId,
            playerId: this.playerId,
            timestamp: Date.now()
        });
    }
    
    placeMaze(x, y, shapeData) {
        this.socket.emit('maze:place', {
            x, y, shapeData,
            playerId: this.playerId,
            timestamp: Date.now()
        });
    }
    
    removeMaze(x, y) {
        this.socket.emit('maze:remove', {
            x, y,
            playerId: this.playerId,
            timestamp: Date.now()
        });
    }

    setOnDefensePhaseStarted(callback) {
        this.onDefenseStarted = callback;
        if (!this.socket) return;
    }

    setOnEnemySpawned(callback) {
        this.onEnemySpawned = callback;
        if (!this.socket) return;
    }

    setOnTurnChanged(callback) {
        this.onTurnChanged = callback;
        if (!this.socket) return;

        this.socket.on('game:state_update', (data) => {
            if (this.onTurnChanged && data.currentTurn) {
                this.onTurnChanged({
                    currentTurn: data.currentTurn,
                    gamePhase: data.gamePhase,
                    shapesPlaced: data.shapesPlaced,
                    sharedResources: data.sharedResources
                });
            }
            if (this.onGameStateUpdate) {
                this.onGameStateUpdate(data);
            }
        });
    }

    setOnGameMessage(callback) {
        this.onGameMessage = callback;
        if (!this.socket) return;

        this.socket.on('game:message', (data) => {
            if (this.onGameMessage) {
                this.onGameMessage(data);
            }
        });
    }

    setOnMazePlaced(callback) {
        this.onMazePlaced = callback;
    }

    setOnMazePlaceFailed(callback) {
        this.onMazePlaceFailed = callback;
    }

    setOnMazePiecePlaced(callback) {
        this.onMazePiecePlaced = callback;
    }

    setOnTowerPlaced(callback) {
        this.onTowerPlaced = callback;
    }

    setOnTowerPlaceFailed(callback) {
        this.onTowerPlaceFailed = callback;
    }

    setOnTowerUpgraded(callback) {
        this.onTowerUpgraded = callback;
    }

    setOnTowerUpgradeFailed(callback) {
        this.onTowerUpgradeFailed = callback;
    }

    setOnTowerSold(callback) {
        this.onTowerSold = callback;
    }

    setOnTowerSellFailed(callback) {
        this.onTowerSellFailed = callback;
    }

    setOnPathsUpdated(callback) {
        this.onPathsUpdated = callback;
        if (!this.socket) return;

        this.socket.on('game:paths_updated', (data) => {
            if (this.onPathsUpdated) {
                this.onPathsUpdated(data);
            }
        });
    }
    
    startQuickMatch() {
        if (!this.isConnected) {
            return;
        }

        if (this.isInMatchmaking) {
            return;
        }

        this.socket.emit('matchmaking:quick_match', {
            rating: 1000,
            playerName: this.playerName || `Player_${this.socket.id.slice(0, 6)}`
        });
        this.isInMatchmaking = true;
    }

    cancelMatchmaking() {
        if (!this.isConnected || !this.isInMatchmaking) {
            return;
        }

        this.socket.emit('matchmaking:cancel');
        this.isInMatchmaking = false;
    }
    
    startPingMonitoring() {
        this.pingInterval = setInterval(() => {
            if (this.socket && this.isConnected) {
                this.lastPingTime = Date.now();
                this.socket.emit('ping', this.lastPingTime);
            }
        }, 5000);
    }

    setupDeferredEventListeners() {
        if (this.onDefenseStarted) {
            this.socket.on('game:defense_started', (data) => {
                if (this.onDefenseStarted) {
                    this.onDefenseStarted(data);
                }
            });
        }
        
        if (this.onEnemySpawned) {
            this.socket.on('game:enemy_spawned', (data) => {
                if (this.onEnemySpawned) {
                    this.onEnemySpawned(data);
                }
            });
        }
    }

    stopPingMonitoring() {
    }
    
    updateConnectionQuality() {
        if (this.latency <= 50) {
            this.connectionQuality = 'excellent';
        } else if (this.latency <= 100) {
            this.connectionQuality = 'good';
        } else if (this.latency <= 200) {
            this.connectionQuality = 'fair';
        } else {
            this.connectionQuality = 'poor';
        }
    }
    
    getConnectionStatus() {
        const qualityIcons = {
            excellent: '●●●●',
            good: '●●●○',
            fair: '●●○○',
            poor: '●○○○'
        };
        
        return {
            quality: this.connectionQuality,
            icon: qualityIcons[this.connectionQuality],
            latency: this.latency,
            connected: this.isConnected
        };
    }
    
    attemptReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            return;
        }
        
        this.reconnectAttempts++;
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect();
            }
        }, 1000 * this.reconnectAttempts);
    }

    updatePlayerProfile(data) {
        if (this.isConnected && this.playerId) {
            this.socket.emit('player:update_profile', {
                playerId: this.playerId,
                ...data
            });
        }
    }

    setPlayerName(name) {
        this.playerName = name;
        if (this.isConnected && this.playerId) {
            this.updatePlayerProfile({ name: this.playerName });
        }
    }
    
    sendMazeUpdate(mazeData) {
        this.socket.emit('maze_update', {
            type: 'maze_piece',
            data: mazeData,
            timestamp: Date.now()
        });
    }

    sendTowerPlacement(towerData) {
        this.socket.emit('tower_update', {
            type: 'tower_placed',
            data: towerData,
            timestamp: Date.now()
        });
    }

    sendGameStateUpdate(gameState) {
        this.socket.emit('game_state', {
            health: gameState.health,
            score: gameState.score,
            resources: gameState.resources,
            wave: gameState.wave,
            timestamp: Date.now()
        });
    }

    sendEnemySpawn(enemyData) {
        this.socket.emit('enemy_spawn', {
            id: enemyData.id,
            type: enemyData.type,
            pathIndices: enemyData.pathIndices,
            speed: enemyData.speed,
            spawnTime: Date.now()
        });
    }

    syncEnemyStates(enemies) {
        const now = Date.now();
        if (now - this.lastEnemySync < this.enemySyncInterval) return;
        
        const updates = [];
        enemies.forEach(enemy => {
            const lastState = this.lastSentEnemyStates.get(enemy.id);
            
            const hasSignificantChange = this.hasSignificantStateChange(enemy, lastState);
            
            if (hasSignificantChange) {
                const update = {
                    id: enemy.id,
                    pathIndex: enemy.currentPathIndex,
                    health: enemy.health,
                    position: hasSignificantChange.includePosition ? {
                        x: enemy.mesh.position.x,
                        y: enemy.mesh.position.y,
                        z: enemy.mesh.position.z
                    } : undefined
                };
                
                updates.push(update);
                this.lastSentEnemyStates.set(enemy.id, { ...update });
            }
        });
        
        if (updates.length > 0) {
            this.socket.emit('enemy_states', {
                updates,
                timestamp: now
            });
        }
        
        this.lastEnemySync = now;
    }

    hasSignificantStateChange(currentState, lastState) {
        if (!lastState) return { includePosition: true };
        
        const healthChanged = !lastState.health || 
                            Math.abs(currentState.health - lastState.health) > 5;
                            
        const positionChanged = !lastState.position ||
                               this.getPositionDelta(currentState.mesh.position, lastState.position) > 0.5;
                               
        const pathIndexChanged = currentState.currentPathIndex !== lastState.pathIndex;
        
        return {
            includePosition: positionChanged,
            includeHealth: healthChanged,
            includePathIndex: pathIndexChanged
        };
    }

    getPositionDelta(pos1, pos2) {
        if (!pos2) return Infinity;
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    setupStateHandlers() {
        this.socket.on('enemy_states', (data) => {
            data.updates.forEach(update => {
                const enemy = this.gameState.enemies.get(update.id);
                if (enemy) {
                    if (update.position) {
                        this.interpolateEnemyPosition(enemy, update.position, data.timestamp);
                    }
                    if (update.health !== undefined) {
                        enemy.health = update.health;
                    }
                    if (update.pathIndex !== undefined) {
                        enemy.currentPathIndex = update.pathIndex;
                    }
                }
            });
        });
    }

    interpolateEnemyPosition(enemy, newPosition, timestamp) {
        const latency = Date.now() - timestamp;
        const interpolationTime = 100;
        
        enemy.interpolation = {
            startPosition: enemy.mesh.position.clone(),
            targetPosition: new THREE.Vector3(
                newPosition.x,
                newPosition.y,
                newPosition.z
            ),
            startTime: Date.now(),
            duration: interpolationTime + latency
        };
    }

    setupWaveHandlers() {
        this.socket.on('wave_data', (data) => {
            this.waveData = data;
        });

        this.socket.on('wave_start', (data) => {
            this.currentWave = data.waveNumber;
            this.isWaveInProgress = true;
            this.onWaveStart?.(data);
        });

        this.socket.on('wave_end', (data) => {
            this.isWaveInProgress = false;
            this.onWaveEnd?.(data);
        });

        this.socket.on('enemy_spawn_signal', (data) => {
            this.onEnemySpawnSignal?.(data);
        });
    }

    requestWaveStart() {
        if (!this.isWaveInProgress) {
            this.socket.emit('request_wave_start', {
                currentWave: this.currentWave
            });
        }
    }

    setWaveCallbacks(callbacks) {
        this.onWaveStart = callbacks.onWaveStart;
        this.onWaveEnd = callbacks.onWaveEnd;
        this.onEnemySpawnSignal = callbacks.onEnemySpawnSignal;
    }

    reportWaveComplete(stats) {
        this.socket.emit('wave_complete', {
            waveNumber: this.currentWave,
            enemiesKilled: stats.enemiesKilled,
            healthRemaining: stats.healthRemaining,
            score: stats.score
        });
    }

    getWaveStatus() {
        return {
            currentWave: this.currentWave,
            isInProgress: this.isWaveInProgress,
            waveData: this.waveData
        };
    }

    cleanup() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        
        this.isConnected = false;
        this.sessionId = null;
        this.playerId = null;
        this.isHost = false;
        this.lastSentEnemyStates.clear();
        this.lastSentTowerStates.clear();
    }
    
    setOnConnected(callback) { this.onConnected = callback; }
    setOnDisconnected(callback) { this.onDisconnected = callback; }
    setOnError(callback) { this.onError = callback; }
    setOnSessionJoined(callback) { this.onSessionJoined = callback; }
    setOnPlayerJoined(callback) { this.onPlayerJoined = callback; }
    setOnPlayerLeft(callback) { this.onPlayerLeft = callback; }
    setOnGameStateUpdate(callback) { this.onGameStateUpdate = callback; }
    setOnGameEvent(callback) { this.onGameEvent = callback; }
    setOnMatchmakingUpdate(callback) { this.onMatchmakingUpdate = callback; }
    setOnMatchFound(callback) { this.onMatchFound = callback; }
} 