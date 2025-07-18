class PlayerHandler {
    constructor(io, sessionHandler, logger) {
        this.io = io;
        this.sessionHandler = sessionHandler;
        this.logger = logger;
        this.connectedPlayers = new Map(); // socketId -> player info
        this.playerStats = new Map(); // socketId -> stats
    }
    
    registerEvents(socket) {
        socket.on('player:update_profile', (data) => this.handleUpdateProfile(socket, data));
        socket.on('player:ping', () => this.handlePing(socket));
        socket.on('player:get_stats', () => this.handleGetStats(socket));
        socket.on('matchmaking:quick_match', (data) => this.handleQuickMatch(socket, data));
        socket.on('matchmaking:cancel', () => this.handleCancelMatchmaking(socket));
    }
    
    handleConnection(socket) {
        const playerInfo = {
            socketId: socket.id,
            connectedAt: Date.now(),
            lastSeen: Date.now(),
            name: `Player_${socket.id.substring(0, 6)}`,
            sessionId: null,
            latency: 0
        };
        
        this.connectedPlayers.set(socket.id, playerInfo);
        this.logger.info(`Player connected: ${socket.id}`);
        
        // Send welcome message
        socket.emit('player:connected', {
            playerId: socket.id,
            serverTime: Date.now()
        });
    }
    
    handleUpdateProfile(socket, data) {
        try {
            const player = this.connectedPlayers.get(socket.id);
            if (!player) return;
            
            // Validate and sanitize profile data
            if (data.name && typeof data.name === 'string' && data.name.length <= 20) {
                player.name = data.name.trim();
            }
            
            player.lastSeen = Date.now();
            
            socket.emit('player:profile_updated', {
                name: player.name,
                connectedAt: player.connectedAt
            });
            
            this.logger.debug(`Player ${socket.id} updated profile: ${player.name}`);
        } catch (error) {
            this.logger.error('Error updating player profile:', error);
            socket.emit('player:error', { message: 'Failed to update profile' });
        }
    }
    
    handlePing(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (player) {
            player.lastSeen = Date.now();
            socket.emit('player:pong', { serverTime: Date.now() });
        }
    }
    
    handleGetStats(socket) {
        try {
            const stats = this.playerStats.get(socket.id) || {
                gamesPlayed: 0,
                gamesWon: 0,
                totalScore: 0,
                bestScore: 0,
                totalPlayTime: 0,
                averageLatency: 0
            };
            
            socket.emit('player:stats', stats);
        } catch (error) {
            this.logger.error('Error getting player stats:', error);
            socket.emit('player:error', { message: 'Failed to get stats' });
        }
    }

    handleQuickMatch(socket, data) {
        try {
            this.logger.info(`Player ${socket.id} requested quick match`);
            
            const player = this.connectedPlayers.get(socket.id);
            if (!player) {
                this.logger.error(`Player ${socket.id} not found for quick match`);
                socket.emit('matchmaking:error', { message: 'Player not found' });
                return;
            }

            this.logger.info(`Starting quick match for player ${socket.id} (${player.name})`);
            const result = this.sessionHandler.matchmakingManager.quickMatch(
                socket.id,
                {
                    name: player.name,
                    rating: data.rating || 1000
                },
                this.sessionHandler
            );

            if (result.success) {
                if (result.joined) {
                    this.logger.info(`Player ${socket.id} joined existing session ${result.sessionId}`);
                    socket.emit('matchmaking:joined', {
                        sessionId: result.sessionId
                    });
                } else if (result.created && result.match) {
                    this.logger.info(`New match created for player ${socket.id}: ${result.match.matchId}`);
                    if (!result.match.sessionId) {
                        this.logger.error('Match created without session ID:', result.match.matchId);
                        socket.emit('matchmaking:error', { message: 'Invalid match data' });
                        return;
                    }
                    socket.emit('matchmaking:matched', {
                        sessionId: result.match.sessionId,
                        match: result.match
                    });
                } else {
                    this.logger.info(`Player ${socket.id} added to matchmaking queue (position: ${result.position})`);
                    socket.emit('matchmaking:queued', {
                        position: result.position
                    });
                }
            } else if (result.reason === 'queued') {
                this.logger.info(`Player ${socket.id} added to matchmaking queue (position: ${result.position})`);
                socket.emit('matchmaking:queued', {
                    position: result.position
                });
            } else {
                this.logger.error(`Matchmaking failed for player ${socket.id}: ${result.reason}`);
                socket.emit('matchmaking:error', {
                    message: result.reason || 'Failed to start matchmaking'
                });
            }
        } catch (error) {
            this.logger.error('Error in quick match:', error);
            socket.emit('matchmaking:error', {
                message: 'Internal server error'
            });
        }
    }

    handleCancelMatchmaking(socket) {
        try {
            this.logger.info(`Player ${socket.id} cancelled matchmaking`);
            this.sessionHandler.matchmakingManager.removeFromQueue(socket.id);
            socket.emit('matchmaking:cancelled');
        } catch (error) {
            this.logger.error('Error cancelling matchmaking:', error);
            socket.emit('matchmaking:error', { message: 'Failed to cancel matchmaking' });
        }
    }
    
    handleDisconnect(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (player) {
            // Update stats with session time
            const sessionTime = Date.now() - player.connectedAt;
            this.updatePlayerStats(socket.id, { sessionTime });
            
            this.connectedPlayers.delete(socket.id);
            this.logger.info(`Player disconnected: ${socket.id}`);
        }
    }
    
    updatePlayerLatency(socketId, latency) {
        const player = this.connectedPlayers.get(socketId);
        if (player) {
            player.latency = latency;
            player.lastSeen = Date.now();
        }
    }
    
    updatePlayerStats(socketId, updates) {
        if (!this.playerStats.has(socketId)) {
            this.playerStats.set(socketId, {
                gamesPlayed: 0,
                gamesWon: 0,
                totalScore: 0,
                bestScore: 0,
                totalPlayTime: 0,
                averageLatency: 0
            });
        }
        
        const stats = this.playerStats.get(socketId);
        
        if (updates.gameCompleted) {
            stats.gamesPlayed++;
        }
        
        if (updates.gameWon) {
            stats.gamesWon++;
        }
        
        if (updates.score) {
            stats.totalScore += updates.score;
            stats.bestScore = Math.max(stats.bestScore, updates.score);
        }
        
        if (updates.sessionTime) {
            stats.totalPlayTime += updates.sessionTime;
        }
        
        if (updates.latency) {
            // Running average of latency
            stats.averageLatency = (stats.averageLatency + updates.latency) / 2;
        }
    }
    
    getPlayerInfo(socketId) {
        return this.connectedPlayers.get(socketId);
    }
    
    getConnectedPlayerCount() {
        return this.connectedPlayers.size;
    }
    
    getPlayerMetrics() {
        const players = Array.from(this.connectedPlayers.values());
        const now = Date.now();
        
        return {
            total: players.length,
            averageSessionTime: players.reduce((sum, p) => sum + (now - p.connectedAt), 0) / players.length || 0,
            averageLatency: players.reduce((sum, p) => sum + p.latency, 0) / players.length || 0,
            activePlayers: players.filter(p => (now - p.lastSeen) < 30000).length // Active in last 30 seconds
        };
    }
    
    // Broadcast to all connected players
    broadcastToAll(event, data) {
        this.io.emit(event, data);
    }
    
    // Send message to specific player
    sendToPlayer(socketId, event, data) {
        this.io.to(socketId).emit(event, data);
    }
}

export default PlayerHandler; 