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
        
        // Connection monitoring
        this.pingInterval = null;
        this.lastPingTime = 0;
        
        // Auto-reconnection
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = null;

        // Matchmaking state
        this.isInMatchmaking = false;
    }
    
    // Connect to the multiplayer server
    connect(serverUrl = 'http://localhost:4000') {
        if (this.isConnected) {
            console.log('Already connected to server');
            return;
        }

        console.log('Connecting to multiplayer server:', serverUrl);
        
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
            console.log('Connected to multiplayer server');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            if (this.onConnected) this.onConnected();
        });
        
        this.socket.on('player:connected', (data) => {
            console.log('Player connected to server:', data);
            this.playerId = data.playerId;
            
            // Set a custom player name if we have one
            if (this.playerName) {
                this.updatePlayerProfile({ name: this.playerName });
            }
        });
        
        this.socket.on('player:profile_updated', (data) => {
            console.log('Player profile updated:', data);
            this.playerName = data.name;
        });
        
        this.socket.on('player:error', (data) => {
            console.error('Player error:', data);
            if (this.onError) this.onError(data);
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
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
            console.log('Session created:', data);
            this.sessionId = data.sessionId;
            this.playerId = data.player.id;
            this.isHost = true;
            if (this.onSessionJoined) this.onSessionJoined(data);
        });
        
        this.socket.on('session:joined', (data) => {
            console.log('Session joined:', data);
            this.sessionId = data.sessionId;
            this.playerId = data.player.id;
            this.isHost = false;
            if (this.onSessionJoined) this.onSessionJoined(data);
        });
        
        this.socket.on('session:joined_as_spectator', (data) => {
            console.log('Joined as spectator:', data);
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
            console.log('Player joined:', data);
            if (this.onPlayerJoined) this.onPlayerJoined(data);
        });
        
        this.socket.on('player:left', (data) => {
            console.log('Player left:', data);
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
                console.log('Added to matchmaking queue');
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
            console.log('Added to matchmaking queue:', data);
            this.isInMatchmaking = true;
            if (this.onMatchmakingUpdate) {
                this.onMatchmakingUpdate({
                    status: 'queued',
                    position: data.position
                });
            }
        });

        this.socket.on('matchmaking:matched', (data) => {
            console.log('Match found:', data);
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
            
            // Extract sessionId and automatically join the session
            const sessionId = data.sessionId;
            
            if (sessionId) {
                console.log('Joining matched session:', sessionId);
                this.joinSession(sessionId); // Server already knows our name
            } else {
                console.error('No session ID provided in match data:', data);
                if (this.onError) {
                    this.onError({ message: 'Invalid match data: missing session ID' });
                }
            }
        });

        this.socket.on('matchmaking:timeout', (data) => {
            console.log('Matchmaking timeout:', data);
            this.isInMatchmaking = false;
            if (this.onMatchmakingUpdate) {
                this.onMatchmakingUpdate({
                    status: 'timeout',
                    reason: data.reason
                });
            }
        });

        this.socket.on('matchmaking:cancelled', () => {
            console.log('Matchmaking cancelled');
            this.isInMatchmaking = false;
            if (this.onMatchmakingUpdate) {
                this.onMatchmakingUpdate({
                    status: 'cancelled'
                });
            }
        });
    }
    
    // Create a new multiplayer session
    createSession() {
        if (!this.isConnected) {
            console.error('Cannot create session: not connected to server');
            return;
        }
        
        console.log('Creating multiplayer session...');
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
        
        console.log('Joining session:', sessionId, 'as player:', finalPlayerName);
        this.socket.emit('session:join', { 
            sessionId,
            playerName: finalPlayerName
        });
    }
    
    // Leave the current session
    leaveSession() {
        if (!this.isConnected || !this.sessionId) return;
        
        console.log('Leaving session:', this.sessionId);
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
        this.sendPlayerAction('start_defense_phase', {});
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

        console.log('Emitting matchmaking:quick_match event');
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

        console.log('Emitting matchmaking:cancel event');
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
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
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