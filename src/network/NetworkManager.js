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
    
    // Connect to the multiplayer server
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
        this.startPingMonitoring();
    }
    
    // Disconnect from the server
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.cleanup();
    }
    
    // Setup all Socket.IO event listeners
    setupEventListeners() {
        // Connection events
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            if (this.onConnected) this.onConnected();
        });
        
        this.socket.on('player:connected', (data) => {
            this.playerId = data.playerId;
            
            // Set a custom player name if we have one
            if (this.playerName) {
                this.updatePlayerProfile({ name: this.playerName });
            }
        });
        
        this.socket.on('player:profile_updated', (data) => {
            this.playerName = data.name;
        });
        
        this.socket.on('player:error', (data) => {
            console.error('Player error:', data);
            if (this.onError) this.onError(data);
        });
        
        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            if (this.onDisconnected) this.onDisconnected(reason);
            
            // Attempt reconnection for client-side disconnects
            if (reason === 'io client disconnect') {
                this.attemptReconnection();
            }
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            if (this.onError) this.onError(error);
            this.attemptReconnection();
        });
        
        // Game session events
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
            this.playerId = null; // Spectators don't have a player ID
            this.isHost = false;
            this.isSpectator = true; // Add flag to track spectator status
            if (this.onSessionJoined) this.onSessionJoined(data);
        });
        
        this.socket.on('session:error', (data) => {
            console.error('Session error:', data);
            if (this.onError) this.onError(data);
        });
        
        this.socket.on('player:joined', (data) => {
            if (this.onPlayerJoined) this.onPlayerJoined(data);
        });
        
        this.socket.on('player:left', (data) => {   
            if (this.onPlayerLeft) this.onPlayerLeft(data);
        });
        
        this.socket.on('game:error', (data) => {
            console.error('Game error:', data);
            if (this.onError) this.onError(data);
        });
        
        // Game state synchronization
        this.socket.on('game_state_update', (data) => {
            if (this.onGameStateUpdate) this.onGameStateUpdate(data);
        });
        
        this.socket.on('game_event', (data) => {
            if (this.onGameEvent) this.onGameEvent(data);
        });
        
        // Ping/latency monitoring
        this.socket.on('pong', (timestamp) => {
            this.latency = Date.now() - timestamp;
            this.updateConnectionQuality();
        });
        
        // Error handling
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            if (this.onError) this.onError(error);
        });

        // Matchmaking events
        this.socket.on('matchmaking:error', (error) => {
            console.error('Matchmaking error:', error);
            
            // Don't treat queued status as an error
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
            
            // Trigger the match found callback for UI updates
            if (this.onMatchFound) {
                this.onMatchFound({
                    sessionId: data.sessionId,
                    match: data.match
                });
            }
            
            // Also update matchmaking status
            if (this.onMatchmakingUpdate) {
                this.onMatchmakingUpdate({
                    status: 'matched',
                    sessionId: data.sessionId,
                    match: data.match
                });
            }
            
            // Store sessionId for reference (server already added us to session)
            const sessionId = data.sessionId;
            
            if (sessionId) {
                // Don't call joinSession() - server already added us during matchmaking
                this.sessionId = sessionId;
            } else {
                console.error('No session ID provided in match data:', data);
                if (this.onError) {
                    this.onError({ message: 'Invalid match data: missing session ID' });
                }
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

        // Maze placement events for cooperative mode
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

        // Cooperative mode: Other players' maze placements
        this.socket.on('maze:piece_placed', (data) => {
            if (this.onMazePiecePlaced) {
                this.onMazePiecePlaced(data);
            }
        });
    }
    
    // Create a new multiplayer session
    createSession() {
        if (!this.isConnected) {
            console.error('Cannot create session: not connected to server');
            return;
        }
        
        this.socket.emit('session:create');
    }
    
    // Join an existing session by ID
    joinSession(sessionId, playerName = null) {
        if (!this.isConnected) {
            console.error('Cannot join session: not connected to server');
            return;
        }
        
        // Use stored player name or generate default
        const finalPlayerName = playerName || this.playerName || `Player_${this.socket.id.slice(0, 6)}`;
        this.socket.emit('session:join', { 
            sessionId,
            playerName: finalPlayerName
        });
    }
    
    // Leave the current session
    leaveSession() {
        if (!this.isConnected || !this.sessionId) return;
        
        this.socket.emit('session:leave');
        this.sessionId = null;
        this.playerId = null;
        this.isHost = false;
    }
    
    // Send game events to the server
    sendGameEvent(eventType, data) {
        if (!this.isConnected || !this.sessionId) return;
        
        // Send specific events that match server expectations
        this.socket.emit(eventType, {
            ...data,
            timestamp: Date.now()
        });
    }
    
    // Send player actions
    sendPlayerAction(actionType, actionData) {
        this.socket.emit('player:action', {
            actionType,
            actionData,
            playerId: this.playerId,
            timestamp: Date.now()
        });
    }
    
    // Specific game actions
    placeTower(x, y, towerType) {
        this.socket.emit('tower:place', {
            x, y, towerType,
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
    
    startDefensePhase() {
        if (!this.socket || !this.sessionId) {
            console.error('Cannot start defense phase - not in session');
            return;
        }

        this.socket.emit('game:start_defense', {
            sessionId: this.sessionId,
            playerId: this.playerId,
            ready: true
        });
    }

    setOnDefensePhaseStarted(callback) {
        if (!this.socket) return;

        this.socket.on('game:defense_started', (data) => {
            if (callback) callback(data);
        });
    }

    setOnEnemySpawned(callback) {
        if (!this.socket) return;

        this.socket.on('game:enemy_spawned', (data) => {
            if (callback) callback(data);
        });
    }

    // Cooperative mode event handlers
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
            // Also trigger general game state update
            if (this.onGameStateUpdate) {
                this.onGameStateUpdate(data);
            }
        });
    }

    setOnDefenseStarted(callback) {
        this.onDefenseStarted = callback;
        if (!this.socket) return;

        this.socket.on('game:defense_started', (data) => {
            if (this.onDefenseStarted) {
                this.onDefenseStarted(data);
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

    setOnPathsUpdated(callback) {
        this.onPathsUpdated = callback;
        if (!this.socket) return;

        this.socket.on('game:paths_updated', (data) => {
            if (this.onPathsUpdated) {
                this.onPathsUpdated(data);
            }
        });
    }
    
    // Matchmaking methods
    startQuickMatch() {
        if (!this.isConnected) {
            console.error('Cannot start matchmaking: not connected to server');
            return;
        }

        if (this.isInMatchmaking) {
            console.warn('Already in matchmaking queue');
            return;
        }

        this.socket.emit('matchmaking:quick_match', {
            rating: 1000, // Default rating for now
            playerName: this.playerName || `Player_${this.socket.id.slice(0, 6)}`
        });
        this.isInMatchmaking = true;
    }

    cancelMatchmaking() {
        if (!this.isConnected || !this.isInMatchmaking) {
            console.warn('Not in matchmaking queue');
            return;
        }

        this.socket.emit('matchmaking:cancel');
        this.isInMatchmaking = false;
    }
    
    // Ping monitoring for connection quality
    startPingMonitoring() {
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.lastPingTime = Date.now();
                this.socket.emit('ping', this.lastPingTime);
            }
        }, 2000); // Ping every 2 seconds
    }
    
    // Update connection quality based on latency
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
    
    // Get connection status display
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
    
    // Attempt to reconnect to the server
    attemptReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect();
            }
        }, 1000 * this.reconnectAttempts);
    }

    // Update player profile
    updatePlayerProfile(data) {
        if (this.isConnected && this.playerId) {
            this.socket.emit('player:update_profile', {
                playerId: this.playerId,
                ...data
            });
        } else {
            console.warn('Cannot update player profile: not connected or no playerId');
        }
    }

    setPlayerName(name) {
        this.playerName = name;
        if (this.isConnected && this.playerId) {
            this.updatePlayerProfile({ name: this.playerName });
        }
    }
    
    // High Priority Updates - Immediate Sync
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

    // Medium Priority Updates - Batched
    sendEnemySpawn(enemyData) {
        // Send minimal spawn data
        this.socket.emit('enemy_spawn', {
            id: enemyData.id,
            type: enemyData.type,
            pathIndices: enemyData.pathIndices,
            speed: enemyData.speed,
            spawnTime: Date.now()
        });
    }

    // Low Priority Updates - Optimized
    syncEnemyStates(enemies) {
        const now = Date.now();
        if (now - this.lastEnemySync < this.enemySyncInterval) return;
        
        const updates = [];
        enemies.forEach(enemy => {
            const lastState = this.lastSentEnemyStates.get(enemy.id);
            
            // Calculate significant changes
            const hasSignificantChange = this.hasSignificantStateChange(enemy, lastState);
            
            if (hasSignificantChange) {
                const update = {
                    id: enemy.id,
                    pathIndex: enemy.currentPathIndex,
                    health: enemy.health,
                    // Only include position if significantly different
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

    // Handle incoming state updates
    setupStateHandlers() {
        this.socket.on('enemy_states', (data) => {
            // Apply received enemy updates with interpolation
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
        const interpolationTime = 100; // ms
        
        // Create interpolation data
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

    // Server messages for wave synchronization
    setupWaveHandlers() {
        // Receive wave data from server
        this.socket.on('wave_data', (data) => {
            this.waveData = data;
        });

        // Wave start signal
        this.socket.on('wave_start', (data) => {
            this.currentWave = data.waveNumber;
            this.isWaveInProgress = true;
            
            // Notify game to start spawning
            this.onWaveStart?.(data);
        });

        // Wave end signal
        this.socket.on('wave_end', (data) => {
            this.isWaveInProgress = false;
            
            // Notify game to stop spawning
            this.onWaveEnd?.(data);
            console.log('Wave ended:', data.waveNumber);
        });

        // Individual enemy spawn signal
        this.socket.on('enemy_spawn_signal', (data) => {
            // Signal the game to spawn this specific enemy
            this.onEnemySpawnSignal?.(data);
        });
    }

    // Client can request to start wave when ready
    requestWaveStart() {
        if (!this.isWaveInProgress) {
            this.socket.emit('request_wave_start', {
                currentWave: this.currentWave
            });
        }
    }

    // Set wave callbacks
    setWaveCallbacks(callbacks) {
        this.onWaveStart = callbacks.onWaveStart;
        this.onWaveEnd = callbacks.onWaveEnd;
        this.onEnemySpawnSignal = callbacks.onEnemySpawnSignal;
    }

    // Report wave completion
    reportWaveComplete(stats) {
        this.socket.emit('wave_complete', {
            waveNumber: this.currentWave,
            enemiesKilled: stats.enemiesKilled,
            healthRemaining: stats.healthRemaining,
            score: stats.score
        });
    }

    // Get current wave status
    getWaveStatus() {
        return {
            currentWave: this.currentWave,
            isInProgress: this.isWaveInProgress,
            waveData: this.waveData
        };
    }

    // Cleanup resources
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
    
    // Event callback setters
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