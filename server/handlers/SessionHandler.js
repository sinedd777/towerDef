import GameSession from '../game/GameSession.js';

class SessionHandler {
    constructor(io, matchmakingManager, logger) {
        this.io = io;
        this.matchmakingManager = matchmakingManager;
        this.logger = logger;
        this.sessions = new Map(); // sessionId -> GameSession
        this.playerSessions = new Map(); // socketId -> sessionId
        
        // Session cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupInactiveSessions();
        }, 30000); // Every 30 seconds
    }
    
    registerEvents(socket) {
        socket.on('session:create', (data) => this.handleCreateSession(socket, data));
        socket.on('session:join', (data) => this.handleJoinSession(socket, data));
        socket.on('session:leave', () => this.handleLeaveSession(socket));
        socket.on('session:list', () => this.handleListSessions(socket));
        socket.on('session:info', (data) => this.handleSessionInfo(socket, data));
        socket.on('game:start', () => this.handleStartGame(socket));
        socket.on('game:ready', (data) => this.handlePlayerReady(socket, data));
    }
    
    handleCreateSession(socket, data) {
        try {
            const session = new GameSession(null, data.maxPlayers || 2);
            session.setIO(this.io);
            
            this.sessions.set(session.sessionId, session);
            
            // Add creator as first player
            const playerData = {
                name: data.playerName || 'Player 1',
                isHost: true
            };
            
            const result = session.addPlayer(socket.id, playerData);
            if (result.success) {
                this.playerSessions.set(socket.id, session.sessionId);
                socket.join(session.sessionId);
                
                socket.emit('session:created', {
                    sessionId: session.sessionId,
                    player: result.player,
                    sessionInfo: session.getSessionInfo()
                });
                
                this.logger.info(`Session created: ${session.sessionId} by ${socket.id}`);
            } else {
                socket.emit('session:error', { message: 'Failed to create session' });
            }
        } catch (error) {
            this.logger.error('Error creating session:', error);
            socket.emit('session:error', { message: 'Internal server error' });
        }
    }
    
    handleJoinSession(socket, data) {
        try {
            const sessionId = data.sessionId;
            const session = this.sessions.get(sessionId);
            
            if (!session) {
                socket.emit('session:error', { message: 'Session not found' });
                return;
            }
            
            if (session.status === 'ended') {
                socket.emit('session:error', { message: 'Session has ended' });
                return;
            }
            
            const playerData = {
                name: data.playerName || `Player ${session.players.size + 1}`
            };
            
            const result = session.addPlayer(socket.id, playerData);
            
            if (result.success) {
                this.playerSessions.set(socket.id, sessionId);
                socket.join(sessionId);
                
                socket.emit('session:joined', {
                    sessionId,
                    player: result.player,
                    sessionInfo: session.getSessionInfo(),
                    gameState: session.gameState.getPublicState()
                });
                
                // Notify other players
                socket.to(sessionId).emit('player:joined', {
                    player: result.player,
                    sessionInfo: session.getSessionInfo()
                });
                
                this.logger.info(`Player ${socket.id} joined session ${sessionId}`);
            } else {
                if (result.addedAsSpectator) {
                    this.playerSessions.set(socket.id, sessionId);
                    socket.join(sessionId);
                    
                    socket.emit('session:joined_as_spectator', {
                        sessionId,
                        sessionInfo: session.getSessionInfo(),
                        gameState: session.gameState.getPublicState()
                    });
                } else {
                    socket.emit('session:error', { 
                        message: result.reason || 'Failed to join session' 
                    });
                }
            }
        } catch (error) {
            this.logger.error('Error joining session:', error);
            socket.emit('session:error', { message: 'Internal server error' });
        }
    }
    
    handleLeaveSession(socket) {
        try {
            const sessionId = this.playerSessions.get(socket.id);
            if (!sessionId) return;
            
            const session = this.sessions.get(sessionId);
            if (session) {
                session.removePlayer(socket.id);
                socket.leave(sessionId);
                
                // Notify other players
                socket.to(sessionId).emit('player:left', {
                    socketId: socket.id,
                    sessionInfo: session.getSessionInfo()
                });
                
                // Clean up session if empty
                if (session.players.size === 0 && session.spectators.size === 0) {
                    this.destroySession(sessionId);
                }
            }
            
            this.playerSessions.delete(socket.id);
            this.logger.info(`Player ${socket.id} left session ${sessionId}`);
        } catch (error) {
            this.logger.error('Error leaving session:', error);
        }
    }
    
    handleListSessions(socket) {
        try {
            const publicSessions = Array.from(this.sessions.values())
                .filter(session => session.status === 'waiting' || session.status === 'ready')
                .map(session => ({
                    sessionId: session.sessionId,
                    playerCount: session.players.size,
                    maxPlayers: session.maxPlayers,
                    status: session.status,
                    createdAt: session.createdAt
                }));
            
            socket.emit('session:list', { sessions: publicSessions });
        } catch (error) {
            this.logger.error('Error listing sessions:', error);
            socket.emit('session:error', { message: 'Failed to get session list' });
        }
    }
    
    handleSessionInfo(socket, data) {
        try {
            const session = this.sessions.get(data.sessionId);
            if (!session) {
                socket.emit('session:error', { message: 'Session not found' });
                return;
            }
            
            socket.emit('session:info', {
                sessionInfo: session.getSessionInfo(),
                players: session.getPlayerList(),
                gameState: session.gameState.getPublicState()
            });
        } catch (error) {
            this.logger.error('Error getting session info:', error);
            socket.emit('session:error', { message: 'Failed to get session info' });
        }
    }
    
    handleStartGame(socket) {
        try {
            const sessionId = this.playerSessions.get(socket.id);
            if (!sessionId) {
                socket.emit('game:error', { message: 'Not in a session' });
                return;
            }
            
            const session = this.sessions.get(sessionId);
            if (!session) {
                socket.emit('game:error', { message: 'Session not found' });
                return;
            }
            
            // Check if player is host (first player)
            const player = session.players.get(socket.id);
            if (!player || !player.isHost) {
                socket.emit('game:error', { message: 'Only host can start game' });
                return;
            }
            
            if (session.status !== 'ready') {
                socket.emit('game:error', { message: 'Session not ready to start' });
                return;
            }
            
            session.startGame();
            this.logger.info(`Game started in session ${sessionId}`);
        } catch (error) {
            this.logger.error('Error starting game:', error);
            socket.emit('game:error', { message: 'Failed to start game' });
        }
    }
    
    handlePlayerReady(socket, data) {
        try {
            const sessionId = this.playerSessions.get(socket.id);
            if (!sessionId) return;
            
            const session = this.sessions.get(sessionId);
            if (session) {
                session.setPlayerReady(socket.id, data.ready);
            }
        } catch (error) {
            this.logger.error('Error setting player ready:', error);
        }
    }
    
    handleDisconnect(socket) {
        this.handleLeaveSession(socket);
    }
    
    // Cleanup and management
    cleanupInactiveSessions() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        
        for (const [sessionId, session] of this.sessions) {
            // Remove ended sessions older than 5 minutes
            if (session.status === 'ended' && (now - session.endedAt) > 5 * 60 * 1000) {
                this.destroySession(sessionId);
                continue;
            }
            
            // Remove empty waiting sessions older than 30 minutes
            if (session.status === 'waiting' && 
                session.players.size === 0 && 
                (now - session.createdAt) > maxAge) {
                this.destroySession(sessionId);
            }
        }
    }
    
    destroySession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.destroy();
            this.sessions.delete(sessionId);
            
            // Clean up player session mappings
            for (const [socketId, sessId] of this.playerSessions) {
                if (sessId === sessionId) {
                    this.playerSessions.delete(socketId);
                }
            }
            
            this.logger.info(`Session destroyed: ${sessionId}`);
        }
    }
    
    // Quick match support
    findAvailableSession() {
        for (const session of this.sessions.values()) {
            if (session.status === 'waiting' && session.players.size < session.maxPlayers) {
                return session;
            }
        }
        return null;
    }
    
    // Statistics
    getActiveSessionCount() {
        return Array.from(this.sessions.values())
            .filter(s => s.status === 'active').length;
    }
    
    getSessionMetrics() {
        const sessions = Array.from(this.sessions.values());
        return {
            total: sessions.length,
            waiting: sessions.filter(s => s.status === 'waiting').length,
            ready: sessions.filter(s => s.status === 'ready').length,
            active: sessions.filter(s => s.status === 'active').length,
            ended: sessions.filter(s => s.status === 'ended').length
        };
    }
    
    // Cleanup on shutdown
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        for (const session of this.sessions.values()) {
            session.destroy();
        }
        
        this.sessions.clear();
        this.playerSessions.clear();
    }
}

export default SessionHandler; 