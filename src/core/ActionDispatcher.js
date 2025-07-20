/**
 * ActionDispatcher - Implements Command Pattern
 * Decouples UI/Input components from Network operations
 * All game actions flow through this dispatcher
 */
export class ActionDispatcher {
    constructor(networkManager, eventHub) {
        this.networkManager = networkManager;
        this.eventHub = eventHub;
        
        console.log('🎮 ActionDispatcher: Initialized');
    }
    
    /**
     * MAZE ACTIONS
     */
    placeMazeShape(shapeData, position) {
        console.log('🎮 ActionDispatcher: Placing maze shape', shapeData);
        
        if (!this.networkManager) {
            throw new Error('NetworkManager not available');
        }
        
        this.networkManager.placeMaze(position.x, position.z, shapeData);
    }
    
    /**
     * TOWER ACTIONS  
     */
    placeTower(towerType, position) {
        console.log('🎮 ActionDispatcher: Placing tower', { towerType, position });
        
        if (!this.networkManager) {
            console.error('❌ ActionDispatcher: NetworkManager not available');
            throw new Error('NetworkManager not available');
        }
        
        console.log('🎮 ActionDispatcher: NetworkManager state:', {
            isConnected: this.networkManager.isConnected,
            sessionId: this.networkManager.sessionId,
            playerId: this.networkManager.playerId,
            hasSocket: !!this.networkManager.socket
        });
        
        this.networkManager.placeTower(position.x, position.z, towerType);
    }
    
    upgradeTower(towerId) {
        console.log('🎮 ActionDispatcher: Upgrading tower', towerId);
        
        if (!this.networkManager) {
            throw new Error('NetworkManager not available');
        }
        
        this.networkManager.upgradeTower(towerId);
    }
    
    sellTower(towerId) {
        console.log('🎮 ActionDispatcher: Selling tower', towerId);
        
        if (!this.networkManager) {
            throw new Error('NetworkManager not available');
        }
        
        this.networkManager.sellTower(towerId);
    }
    
    /**
     * GAME PHASE ACTIONS
     */
    startDefensePhase() {
        console.log('🎮 ActionDispatcher: Starting defense phase');
        
        // Emit local event first (for immediate UI feedback)
        this.eventHub.emit('game:defense_phase_requested');
        
        // Send to server (this was the violation in PrivateControlPanel)
        if (this.networkManager && this.networkManager.startDefensePhase) {
            this.networkManager.startDefensePhase();
        }
    }
    
    /**
     * PLAYER ACTIONS
     */
    surrender() {
        console.log('🎮 ActionDispatcher: Player surrendering');
        
        // Emit local event first
        this.eventHub.emit('player:surrender_requested');
        
        // Send to server (this was the violation in PrivateControlPanel)
        if (this.networkManager && this.networkManager.sendPlayerAction) {
            this.networkManager.sendPlayerAction('surrender', {});
        }
    }
    
    /**
     * MATCHMAKING ACTIONS
     */
    startQuickMatch() {
        console.log('🎮 ActionDispatcher: Starting quick match');
        
        if (this.networkManager && this.networkManager.startQuickMatch) {
            this.networkManager.startQuickMatch();
        }
    }
    
    cancelMatchmaking() {
        console.log('🎮 ActionDispatcher: Cancelling matchmaking');
        
        if (this.networkManager && this.networkManager.cancelMatchmaking) {
            this.networkManager.cancelMatchmaking();
        }
    }
    
    /**
     * CONNECTION ACTIONS
     */
    connect() {
        console.log('🎮 ActionDispatcher: Connecting to server');
        
        if (this.networkManager && this.networkManager.connect) {
            this.networkManager.connect();
        }
    }
    
    disconnect() {
        console.log('🎮 ActionDispatcher: Disconnecting from server');
        
        if (this.networkManager && this.networkManager.disconnect) {
            this.networkManager.disconnect();
        }
    }
    
    /**
     * UTILITY METHODS
     */
    isConnected() {
        return this.networkManager ? this.networkManager.isConnected : false;
    }
    
    getConnectionStatus() {
        if (!this.networkManager) return 'no_network_manager';
        
        return {
            connected: this.networkManager.isConnected,
            sessionId: this.networkManager.sessionId,
            playerId: this.networkManager.playerId,
            latency: this.networkManager.latency
        };
    }
} 