class MatchmakingManager {
    constructor() {
        this.matchmakingQueue = new Map(); // socketId -> matchmaking request
        this.matchmakingTimeout = 30000; // 30 seconds
        this.skillGroups = new Map(); // skill level -> player list
        
        // Cleanup interval for expired matchmaking requests
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredRequests();
        }, 10000); // Every 10 seconds

        // Process matchmaking queue periodically
        this.matchmakingInterval = setInterval(() => {
            this.processMatchmaking();
        }, 2000); // Every 2 seconds
    }
    
    // Add player to matchmaking queue
    addToQueue(socketId, playerData, preferences = {}) {
        console.log(`Adding player ${socketId} to matchmaking queue with data:`, playerData);
        
        const request = {
            socketId,
            playerData,
            preferences: {
                maxPlayers: preferences.maxPlayers || 2,
                skillLevel: preferences.skillLevel || 'beginner',
                gameMode: preferences.gameMode || 'cooperative',
                region: preferences.region || 'global',
                ...preferences
            },
            createdAt: Date.now(),
            attempts: 0
        };
        
        this.matchmakingQueue.set(socketId, request);
        console.log(`Queue size after adding player: ${this.matchmakingQueue.size}`);
        
        // Try to find immediate match
        const match = this.findMatch(request);
        if (match) {
            console.log(`Immediate match found for player ${socketId} with:`, match.map(p => p.socketId));
            const matchResult = this.createMatch(match);
            if (matchResult.success) {
                // Notify all players in the match (important for immediate matches)
                this.onMatchFound(matchResult.match);
            }
            return matchResult;
        }
        
        const position = this.getQueuePosition(socketId);
        console.log(`Player ${socketId} added to queue at position ${position}`);
        return { success: false, reason: 'added_to_queue', position };
    }
    
    // Remove player from matchmaking queue
    removeFromQueue(socketId) {
        return this.matchmakingQueue.delete(socketId);
    }
    
    // Find compatible players for a match
    findMatch(request) {
        const compatiblePlayers = [request];
        const maxPlayers = request.preferences.maxPlayers;
        
        this.logger.debug(`Looking for ${maxPlayers} players for match`);
        
        for (const [otherId, otherRequest] of this.matchmakingQueue) {
            if (otherId === request.socketId) continue;
            
            if (this.areCompatible(request, otherRequest)) {
                this.logger.debug(`Found compatible player ${otherId}`);
                compatiblePlayers.push(otherRequest);
                
                if (compatiblePlayers.length >= maxPlayers) {
                    this.logger.info(`Found enough players for match: ${compatiblePlayers.map(p => p.socketId).join(', ')}`);
                    break;
                }
            }
        }
        
        return compatiblePlayers.length >= maxPlayers ? compatiblePlayers : null;
    }
    
    // Check if two matchmaking requests are compatible
    areCompatible(request1, request2) {
        const prefs1 = request1.preferences;
        const prefs2 = request2.preferences;
        
        // Check max players compatibility
        if (prefs1.maxPlayers !== prefs2.maxPlayers) {
            return false;
        }
        
        // Check game mode compatibility
        if (prefs1.gameMode !== prefs2.gameMode) {
            return false;
        }
        
        // Check region compatibility (allow global)
        if (prefs1.region !== prefs2.region && 
            prefs1.region !== 'global' && 
            prefs2.region !== 'global') {
            return false;
        }
        
        // Check skill level compatibility (allow 1 level difference)
        const skillLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
        const level1 = skillLevels.indexOf(prefs1.skillLevel);
        const level2 = skillLevels.indexOf(prefs2.skillLevel);
        
        if (Math.abs(level1 - level2) > 1) {
            return false;
        }
        
        return true;
    }
    
    // Create a match from compatible players
    createMatch(players) {
        const matchId = this.generateMatchId();
        const match = {
            matchId,
            players: players.map(p => ({
                socketId: p.socketId,
                playerData: p.playerData,
                preferences: p.preferences
            })),
            createdAt: Date.now(),
            gameMode: players[0].preferences.gameMode,
            maxPlayers: players[0].preferences.maxPlayers,
            sessionId: null  // Will be set when session is created
        };
        
        // Create a new game session for the match
        const session = this.sessionHandler.createSession({
            maxPlayers: match.maxPlayers,
            gameMode: match.gameMode
        });

        if (!session) {
            this.logger.error('Failed to create session for match:', match.matchId);
            return { success: false, reason: 'failed_to_create_session' };
        }

        // Set the session ID in the match object
        match.sessionId = session.sessionId;
        
        // Remove players from queue
        for (const player of players) {
            this.matchmakingQueue.delete(player.socketId);
        }
        
        return { success: true, match };
    }
    
    // Quick match - find any available game or create new one
    quickMatch(socketId, playerData, sessionHandler) {
        console.log(`Quick match request from player ${socketId} with data:`, playerData);
        
        // First try to find an existing waiting session
        const availableSession = sessionHandler.findAvailableSession();
        
        if (availableSession) {
            console.log(`Found available session ${availableSession.sessionId} for player ${socketId}`);
            const result = availableSession.addPlayer(socketId, playerData);
            if (result.success) {
                return {
                    success: true,
                    sessionId: availableSession.sessionId,
                    joined: true
                };
            }
        }
        
        // If no available session, add to matchmaking queue
        console.log(`No available session found, adding player ${socketId} to matchmaking queue`);
        const matchResult = this.addToQueue(socketId, playerData, { 
            maxPlayers: 2, 
            gameMode: 'cooperative' 
        });
        
        if (matchResult.success) {
            console.log(`Immediate match found for player ${socketId}`);
            return {
                success: true,
                match: matchResult.match,
                created: true
            };
        }
        
        return {
            success: false,
            reason: 'queued',
            position: matchResult.position
        };
    }
    
    // Periodic matchmaking - run every few seconds to find new matches
    processMatchmaking() {
        if (this.matchmakingQueue.size === 0) return;
        
        console.log(`Processing matchmaking queue (${this.matchmakingQueue.size} players)`);
        const processedPlayers = new Set();
        
        for (const [socketId, request] of this.matchmakingQueue) {
            if (processedPlayers.has(socketId)) continue;
            
            console.log(`Looking for match for player ${socketId}`);
            const match = this.findMatch(request);
            
            if (match) {
                console.log(`Match found for players: ${match.map(p => p.socketId).join(', ')}`);
                // Mark all players in this match as processed
                for (const player of match) {
                    processedPlayers.add(player.socketId);
                }
                
                // Create the match
                const matchResult = this.createMatch(match);
                if (matchResult.success) {
                    // Notify about successful match
                    this.onMatchFound(matchResult.match);
                }
            } else {
                // Increase attempt count and check for timeout
                request.attempts++;
                
                if (Date.now() - request.createdAt > this.matchmakingTimeout) {
                    console.log(`Matchmaking timeout for player ${socketId}`);
                    // Timeout - remove from queue
                    this.matchmakingQueue.delete(socketId);
                    this.onMatchmakingTimeout(socketId, request);
                }
            }
        }
    }
    
    // Cleanup expired matchmaking requests
    cleanupExpiredRequests() {
        const now = Date.now();
        const expiredTimeout = this.matchmakingTimeout * 2; // Double timeout for cleanup
        
        for (const [socketId, request] of this.matchmakingQueue) {
            if (now - request.createdAt > expiredTimeout) {
                this.matchmakingQueue.delete(socketId);
            }
        }
    }
    
    // Get player's position in queue
    getQueuePosition(socketId) {
        let position = 0;
        const targetRequest = this.matchmakingQueue.get(socketId);
        
        if (!targetRequest) return -1;
        
        for (const [otherId, request] of this.matchmakingQueue) {
            if (otherId === socketId) break;
            if (request.createdAt < targetRequest.createdAt) {
                position++;
            }
        }
        
        return position + 1;
    }
    
    // Get queue statistics
    getQueueStats() {
        const requests = Array.from(this.matchmakingQueue.values());
        const now = Date.now();
        
        return {
            totalInQueue: requests.length,
            averageWaitTime: requests.reduce((sum, req) => sum + (now - req.createdAt), 0) / requests.length || 0,
            byGameMode: this.groupBy(requests, req => req.preferences.gameMode),
            bySkillLevel: this.groupBy(requests, req => req.preferences.skillLevel),
            byRegion: this.groupBy(requests, req => req.preferences.region)
        };
    }
    
    // Event handlers (to be overridden or set by server)
    onMatchFound(match) {
        // Override this method to handle successful matches
        console.log('Match found:', match.matchId, 'Players:', match.players.length);
    }
    
    onMatchmakingTimeout(socketId, request) {
        // Override this method to handle timeouts
        console.log('Matchmaking timeout for player:', socketId);
    }
    
    // Utility methods
    generateMatchId() {
        return 'match_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }
    
    groupBy(array, keyFunction) {
        const groups = {};
        for (const item of array) {
            const key = keyFunction(item);
            if (!groups[key]) groups[key] = 0;
            groups[key]++;
        }
        return groups;
    }
    
    // Get all players in queue for a specific game mode
    getPlayersInQueue(gameMode = null) {
        const requests = Array.from(this.matchmakingQueue.values());
        
        if (gameMode) {
            return requests.filter(req => req.preferences.gameMode === gameMode);
        }
        
        return requests;
    }
    
    // Force match creation (admin function)
    forceMatch(socketIds) {
        const players = [];
        
        for (const socketId of socketIds) {
            const request = this.matchmakingQueue.get(socketId);
            if (request) {
                players.push(request);
            }
        }
        
        if (players.length >= 2) {
            return this.createMatch(players);
        }
        
        return { success: false, reason: 'insufficient_players' };
    }
    
    // Priority matchmaking for VIP players or special cases
    priorityMatch(socketId, playerData, preferences = {}) {
        const request = {
            socketId,
            playerData,
            preferences: {
                maxPlayers: preferences.maxPlayers || 2,
                skillLevel: preferences.skillLevel || 'beginner',
                gameMode: preferences.gameMode || 'competitive',
                region: preferences.region || 'global',
                priority: true,
                ...preferences
            },
            createdAt: Date.now() - 10000, // Give 10 second head start
            attempts: 0
        };
        
        this.matchmakingQueue.set(socketId, request);
        
        const match = this.findMatch(request);
        if (match) {
            return this.createMatch(match);
        }
        
        return { success: false, reason: 'added_to_priority_queue' };
    }
    
    // Set dependencies needed for matchmaking
    setDependencies(sessionHandler, io, logger) {
        this.sessionHandler = sessionHandler;
        this.io = io;
        this.logger = logger;

        // Override onMatchFound to handle match creation
        this.onMatchFound = (match) => {
            if (!match.sessionId) {
                this.logger.error('Match has no session ID:', match.matchId);
                return;
            }

            // Get the session that was created during match creation
            const session = this.sessionHandler.sessions.get(match.sessionId);
            if (!session) {
                this.logger.error('Session not found for match:', match.matchId);
                return;
            }

            // Add all players to the session
            for (const player of match.players) {
                const result = session.addPlayer(player.socketId, player.playerData);
                if (result.success) {
                    // Make sure player socket joins the session room
                    const playerSocket = this.io.sockets.sockets.get(player.socketId);
                    if (playerSocket) {
                        playerSocket.join(match.sessionId);
                    }
                    
                    // CRITICAL: Set playerSessions mapping (required for game actions)
                    this.sessionHandler.playerSessions.set(player.socketId, match.sessionId);
                    
                    // Send matchmaking matched event
                    this.io.to(player.socketId).emit('matchmaking:matched', {
                        sessionId: match.sessionId,
                        match: match
                    });
                    
                    // Send session joined event (critical for UI transition)
                    this.io.to(player.socketId).emit('session:joined', {
                        sessionId: match.sessionId,
                        player: result.player,
                        sessionInfo: session.getSessionInfo(),
                        gameState: session.gameState.getPublicState()
                    });
                    
                    this.logger.info(`Player ${result.player.playerId} joined session ${match.sessionId} via matchmaking`);
                }
            }
        };

        // Override onMatchmakingTimeout to use logger
        this.onMatchmakingTimeout = (socketId, request) => {
            this.logger.info(`Matchmaking timeout for player: ${socketId}`);
            this.io.to(socketId).emit('matchmaking:timeout', {
                reason: 'No suitable match found within timeout period'
            });
        };
    }
    
    // Cleanup on shutdown
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.matchmakingInterval) {
            clearInterval(this.matchmakingInterval);
        }
        
        this.matchmakingQueue.clear();
        this.skillGroups.clear();
    }
}

export default MatchmakingManager; 