class GameEventHandler {
    constructor(io, sessionHandler, logger) {
        this.io = io;
        this.sessionHandler = sessionHandler;
        this.logger = logger;
    }
    
    registerEvents(socket) {
        // Tower events
        socket.on('tower:place', (data) => this.handleTowerPlace(socket, data));
        socket.on('tower:upgrade', (data) => this.handleTowerUpgrade(socket, data));
        socket.on('tower:sell', (data) => this.handleTowerSell(socket, data));
        
        // Maze events
        socket.on('maze:place', (data) => this.handleMazePlace(socket, data));
        socket.on('maze:remove', (data) => this.handleMazeRemove(socket, data));
        
        // Game phase events
        socket.on('game:phase_transition', (data) => this.handlePhaseTransition(socket, data));
        socket.on('game:pause', () => this.handleGamePause(socket));
        socket.on('game:resume', () => this.handleGameResume(socket));
        
        // Enemy events (read-only, for debugging)
        socket.on('enemy:get_info', (data) => this.handleEnemyInfo(socket, data));
        
        // Player action events
        socket.on('player:action', (data) => this.handlePlayerAction(socket, data));
    }
    
    handleTowerPlace(socket, data) {
        try {
            const result = this.processGameAction(socket, 'tower:place', data);
            if (result.success) {
                socket.emit('tower:placed', result.data);
                
                // For cooperative mode, broadcast turn changes and resource updates
                const sessionId = this.sessionHandler.playerSessions.get(socket.id);
                const session = sessionId ? this.sessionHandler.sessions.get(sessionId) : null;
                if (session && session.gameMode === 'cooperative') {
                    const gameState = session.gameState.getPublicState();
                    this.sessionHandler.io.to(session.sessionId).emit('game:state_update', {
                        currentTurn: gameState.currentTurn,
                        sharedResources: gameState.sharedResources,
                        towers: gameState.towers
                    });
                }
                
                this.logger.debug(`Tower placed by ${socket.id}:`, result.data.tower);
            } else {
                socket.emit('tower:place_failed', { reason: result.reason });
                
                // Send helpful error messages for turn-based failures
                if (result.reason === 'not_your_turn') {
                    socket.emit('game:message', { 
                        type: 'info', 
                        message: 'Please wait for your turn to place a tower.' 
                    });
                } else if (result.reason === 'insufficient_funds') {
                    socket.emit('game:message', { 
                        type: 'warning', 
                        message: 'Not enough shared money for this tower.' 
                    });
                }
                
                this.logger.warn(`Tower placement failed for ${socket.id}: ${result.reason}`);
            }
        } catch (error) {
            this.logger.error('Error handling tower placement:', error);
            socket.emit('tower:place_failed', { reason: 'server_error' });
        }
    }
    
    handleTowerUpgrade(socket, data) {
        try {
            const result = this.processGameAction(socket, 'tower:upgrade', data);
            if (result.success) {
                socket.emit('tower:upgraded', result.data);
                this.logger.debug(`Tower upgraded by ${socket.id}:`, result.data.tower);
            } else {
                socket.emit('tower:upgrade_failed', { reason: result.reason });
            }
        } catch (error) {
            this.logger.error('Error handling tower upgrade:', error);
            socket.emit('tower:upgrade_failed', { reason: 'server_error' });
        }
    }
    
    handleTowerSell(socket, data) {
        try {
            const result = this.processGameAction(socket, 'tower:sell', data);
            if (result.success) {
                socket.emit('tower:sold', result.data);
                this.logger.debug(`Tower sold by ${socket.id}:`, data.towerId);
            } else {
                socket.emit('tower:sell_failed', { reason: result.reason });
            }
        } catch (error) {
            this.logger.error('Error handling tower sale:', error);
            socket.emit('tower:sell_failed', { reason: 'server_error' });
        }
    }
    
    handleMazePlace(socket, data) {
        try {
            const result = this.processGameAction(socket, 'maze:place', data);
            if (result.success) {
                socket.emit('maze:placed', result);
                
                // For cooperative mode, broadcast turn changes and phase transitions
                const sessionId = this.sessionHandler.playerSessions.get(socket.id);
                const session = sessionId ? this.sessionHandler.sessions.get(sessionId) : null;
                if (session && session.gameMode === 'cooperative') {
                    // Get player ID for this socket
                    const playerId = socket.playerId;
                    console.log('🎯 Broadcasting maze placement for playerId:', playerId, 'socket:', socket.id);
                    
                    // Broadcast maze placement to ALL players in session
                    this.sessionHandler.io.to(session.sessionId).emit('maze:piece_placed', {
                        playerId: playerId,
                        mazePiece: result.mazePiece,
                        shapeData: data.shapeData,
                        totalShapes: result.totalShapes,
                        remainingShapes: result.remainingShapes
                    });
                    
                    // Broadcast current turn and phase info to all players
                    const gameState = session.gameState.getPublicState();
                    this.sessionHandler.io.to(session.sessionId).emit('game:state_update', {
                        currentTurn: gameState.currentTurn,
                        gamePhase: gameState.gamePhase,
                        shapesPlaced: gameState.shapesPlaced,
                        sharedResources: gameState.sharedResources
                    });
                    
                    // Check if defense phase started
                    if (result.remainingShapes === 0) {
                        this.sessionHandler.io.to(session.sessionId).emit('game:defense_started', {
                            phase: 'defense',
                            message: 'All shapes placed! Defense phase starting...'
                        });
                    }
                }
                
                this.logger.debug(`Maze piece placed by ${socket.id}:`, result.mazePiece);
            } else {
                socket.emit('maze:place_failed', { reason: result.reason });
                
                // Send helpful error messages for turn-based failures
                if (result.reason === 'not_your_turn') {
                    socket.emit('game:message', { 
                        type: 'info', 
                        message: 'Please wait for your turn to place a shape.' 
                    });
                }
            }
        } catch (error) {
            this.logger.error('Error handling maze placement:', error);
            socket.emit('maze:place_failed', { reason: 'server_error' });
        }
    }
    
    handleMazeRemove(socket, data) {
        try {
            const result = this.processGameAction(socket, 'maze:remove', data);
            if (result.success) {
                socket.emit('maze:removed', { mazeId: data.mazeId });
                this.logger.debug(`Maze piece removed by ${socket.id}:`, data.mazeId);
            } else {
                socket.emit('maze:remove_failed', { reason: result.reason });
            }
        } catch (error) {
            this.logger.error('Error handling maze removal:', error);
            socket.emit('maze:remove_failed', { reason: 'server_error' });
        }
    }
    
    handlePhaseTransition(socket, data) {
        try {
            const result = this.processGameAction(socket, 'game:phase_transition', data);
            if (result.success) {
                // Phase transitions are broadcast by the game session
                this.logger.info(`Phase transition initiated by ${socket.id}: ${data.newPhase}`);
            } else {
                socket.emit('game:phase_transition_failed', { reason: result.reason });
            }
        } catch (error) {
            this.logger.error('Error handling phase transition:', error);
            socket.emit('game:phase_transition_failed', { reason: 'server_error' });
        }
    }
    
    handleGamePause(socket) {
        try {
            const sessionId = this.sessionHandler.playerSessions.get(socket.id);
            if (!sessionId) {
                socket.emit('game:error', { message: 'Not in a session' });
                return;
            }
            
            const session = this.sessionHandler.sessions.get(sessionId);
            if (!session) {
                socket.emit('game:error', { message: 'Session not found' });
                return;
            }
            
            // Check if player has permission to pause (host or both players agree)
            const player = session.players.get(socket.id);
            if (player && player.isHost) {
                session.pauseGame();
                this.logger.info(`Game paused by host ${socket.id} in session ${sessionId}`);
            } else {
                socket.emit('game:error', { message: 'No permission to pause' });
            }
        } catch (error) {
            this.logger.error('Error handling game pause:', error);
            socket.emit('game:error', { message: 'Failed to pause game' });
        }
    }
    
    handleGameResume(socket) {
        try {
            const sessionId = this.sessionHandler.playerSessions.get(socket.id);
            if (!sessionId) {
                socket.emit('game:error', { message: 'Not in a session' });
                return;
            }
            
            const session = this.sessionHandler.sessions.get(sessionId);
            if (!session) {
                socket.emit('game:error', { message: 'Session not found' });
                return;
            }
            
            const player = session.players.get(socket.id);
            if (player && player.isHost) {
                session.resumeGame();
                this.logger.info(`Game resumed by host ${socket.id} in session ${sessionId}`);
            } else {
                socket.emit('game:error', { message: 'No permission to resume' });
            }
        } catch (error) {
            this.logger.error('Error handling game resume:', error);
            socket.emit('game:error', { message: 'Failed to resume game' });
        }
    }
    
    handleEnemyInfo(socket, data) {
        try {
            const sessionId = this.sessionHandler.playerSessions.get(socket.id);
            if (!sessionId) return;
            
            const session = this.sessionHandler.sessions.get(sessionId);
            if (!session) return;
            
            const enemy = session.gameState.enemies.get(data.enemyId);
            if (enemy) {
                socket.emit('enemy:info', {
                    enemy: {
                        id: enemy.id,
                        type: enemy.type,
                        health: enemy.health,
                        maxHealth: enemy.maxHealth,
                        position: enemy.position,
                        speed: enemy.speed
                    }
                });
            }
        } catch (error) {
            this.logger.error('Error getting enemy info:', error);
        }
    }
    
    handlePlayerAction(socket, data) {
        try {
            // Generic player action handler for future extensibility
            const result = this.processGameAction(socket, data.action, data.payload);
            
            socket.emit('player:action_result', {
                action: data.action,
                success: result.success,
                data: result.data,
                reason: result.reason
            });
        } catch (error) {
            this.logger.error('Error handling player action:', error);
            socket.emit('player:action_result', {
                action: data.action,
                success: false,
                reason: 'server_error'
            });
        }
    }
    
    // Core action processing
    processGameAction(socket, action, data) {
        const sessionId = this.sessionHandler.playerSessions.get(socket.id);
        if (!sessionId) {
            return { success: false, reason: 'not_in_session' };
        }
        
        const session = this.sessionHandler.sessions.get(sessionId);
        if (!session) {
            return { success: false, reason: 'session_not_found' };
        }
        
        if (session.status !== 'active' && !action.startsWith('game:')) {
            return { success: false, reason: 'game_not_active' };
        }
        
        // Delegate to session's game logic
        return session.handlePlayerAction(socket.id, action, data);
    }
    
    // Utility methods for broadcasting game events
    broadcastGameEvent(sessionId, event, data) {
        if (this.sessionHandler.sessions.has(sessionId)) {
            this.io.to(sessionId).emit(event, data);
        }
    }
    
    sendGameEventToPlayer(socketId, event, data) {
        this.io.to(socketId).emit(event, data);
    }
    
    // Event validation helpers
    validateTowerData(data) {
        return data && 
               data.type && 
               typeof data.type === 'string' &&
               data.position &&
               typeof data.position.x === 'number' &&
               typeof data.position.z === 'number';
    }
    
    validateMazeData(data) {
        return data &&
               data.shape &&
               typeof data.shape === 'string' &&
               Array.isArray(data.positions) &&
               data.positions.every(pos => 
                   typeof pos.x === 'number' && 
                   typeof pos.z === 'number'
               );
    }
    
    // Rate limiting and anti-cheat helpers
    checkActionRateLimit(socketId, action) {
        // Basic rate limiting - could be expanded
        const now = Date.now();
        if (!this.lastActionTimes) {
            this.lastActionTimes = new Map();
        }
        
        if (!this.lastActionTimes.has(socketId)) {
            this.lastActionTimes.set(socketId, new Map());
        }
        
        const playerActions = this.lastActionTimes.get(socketId);
        const lastTime = playerActions.get(action) || 0;
        
        const minInterval = this.getMinActionInterval(action);
        if (now - lastTime < minInterval) {
            return false;
        }
        
        playerActions.set(action, now);
        return true;
    }
    
    getMinActionInterval(action) {
        const intervals = {
            'tower:place': 100,
            'tower:upgrade': 200,
            'tower:sell': 150,
            'maze:place': 50,
            'maze:remove': 100
        };
        return intervals[action] || 100;
    }
}

export default GameEventHandler; 