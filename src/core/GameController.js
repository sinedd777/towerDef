import { EventHub } from './EventHub.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { ActionDispatcher } from './ActionDispatcher.js';

/**
 * Central Game Controller that coordinates between network events and game events
 * This is the ONLY place that should set up NetworkManager callbacks
 */
export class GameController {
    constructor() {
        this.eventHub = new EventHub();
        this.networkManager = new NetworkManager();
        this.actionDispatcher = new ActionDispatcher(this.networkManager, this.eventHub);
        
        // Enable debug mode for development
        this.eventHub.setDebugMode(true);
        
        console.log('🎮 GameController: Initializing central event coordinator with ActionDispatcher');
        
        // Set up the bridge between network events and game events
        this.setupNetworkToEventBridge();
    }
    
    /**
     * SINGLE SOURCE OF TRUTH for all network event handling
     * This is the ONLY method that should call networkManager.setOn...() methods
     */
    setupNetworkToEventBridge() {
        console.log('🌉 GameController: Setting up network-to-event bridge');
        
        // === CONNECTION EVENTS ===
        this.networkManager.setOnConnected(() => {
            this.eventHub.emit('network:connected');
        });
        
        this.networkManager.setOnDisconnected((reason) => {
            this.eventHub.emit('network:disconnected', { reason });
        });
        
        this.networkManager.setOnError((error) => {
            this.eventHub.emit('network:error', { error });
        });
        
        // === SESSION EVENTS ===
        this.networkManager.setOnSessionJoined((data) => {
            this.eventHub.emit('session:joined', data);
        });
        
        this.networkManager.setOnPlayerJoined((data) => {
            this.eventHub.emit('session:player_joined', data);
        });
        
        this.networkManager.setOnPlayerLeft((data) => {
            this.eventHub.emit('session:player_left', data);
        });
        
        // === MATCHMAKING EVENTS ===
        this.networkManager.setOnMatchmakingUpdate((status) => {
            this.eventHub.emit('matchmaking:update', status);
        });
        
        this.networkManager.setOnMatchFound((data) => {
            this.eventHub.emit('matchmaking:found', data);
        });
        
        // === GAME PHASE EVENTS ===
        this.networkManager.setOnDefensePhaseStarted((data) => {
            console.log('🌉 GameController: Defense phase started, bridging to EventHub');
            this.eventHub.emit('game:defense_started', data);
        });
        
        this.networkManager.setOnTurnChanged((data) => {
            this.eventHub.emit('game:turn_changed', data);
        });
        
        // === TOWER EVENTS ===
        this.networkManager.setOnTowerPlaced((data) => {
            this.eventHub.emit('tower:placed', data);
        });
        
        this.networkManager.setOnTowerPlaceFailed((data) => {
            this.eventHub.emit('tower:place_failed', data);
        });
        
        this.networkManager.setOnTowerPlayerPlaced((data) => {
            this.eventHub.emit('tower:player_placed', data);
        });
        
        // === ENEMY EVENTS ===
        this.networkManager.setOnEnemySpawned((data) => {
            console.log('🌉 GameController: Enemy spawned, bridging to EventHub');
            this.eventHub.emit('enemy:spawned', data);
        });
        
        // === GAME STATE EVENTS ===
        this.networkManager.setOnGameStateUpdate((data) => {
            this.eventHub.emit('game:state_updated', data);
        });
        
        this.networkManager.setOnGameMessage((data) => {
            this.eventHub.emit('game:message', data);
        });
        
        // === MAZE EVENTS ===
        this.networkManager.setOnMazePlaced((data) => {
            this.eventHub.emit('maze:placed', data);
        });
        
        this.networkManager.setOnMazePlaceFailed((data) => {
            this.eventHub.emit('maze:place_failed', data);
        });
        
        this.networkManager.setOnMazePiecePlaced((data) => {
            this.eventHub.emit('maze:piece_placed', data);
        });
        
        // === ENEMY EVENTS ===
        this.networkManager.setOnEnemySpawned((data) => {
            this.eventHub.emit('enemy:spawned', data);
        });
        
        // === PATH EVENTS ===
        this.networkManager.setOnPathsUpdated((data) => {
            this.eventHub.emit('paths:updated', data);
        });
        
        console.log('✅ GameController: Network-to-event bridge setup complete');
    }
    
    /**
     * Get the EventHub for components to subscribe to events
     */
    getEventHub() {
        return this.eventHub;
    }
    
    /**
     * Get the NetworkManager for sending events to server
     */
    getNetworkManager() {
        return this.networkManager;
    }
    
    /**
     * Get the ActionDispatcher for sending game actions
     */
    getActionDispatcher() {
        return this.actionDispatcher;
    }
    
    /**
     * Initialize multiplayer game with matchmaking
     */
    async initializeMultiplayer(loadingScreen, statusCallbacks) {
        console.log('🎮 GameController: Initializing multiplayer');
        
        // Ensure NetworkManager is connected and WAIT for connection
        if (!this.networkManager.isConnected) {
            console.log('🎮 GameController: Connecting NetworkManager...');
            
            // Create a promise that resolves when connected
            const connectionPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout after 10 seconds'));
                }, 10000);
                
                // Listen for connection success
                this.eventHub.once('network:connected', () => {
                    clearTimeout(timeout);
                    console.log('🎮 GameController: Connection established successfully');
                    resolve();
                });
                
                // Listen for connection error
                this.eventHub.once('network:error', (data) => {
                    clearTimeout(timeout);
                    console.error('🎮 GameController: Connection failed:', data.error);
                    reject(data.error);
                });
            });
            
            // Start the connection
            this.networkManager.connect();
            
            // Wait for connection to be established
            await connectionPromise;
        }
        
        console.log('🎮 GameController: NetworkManager ready for matchmaking');
        return this.networkManager;
    }
    
    /**
     * Start quick match
     */
    startQuickMatch() {
        this.networkManager.startQuickMatch();
    }
    
    /**
     * Cancel matchmaking
     */
    cancelMatchmaking() {
        this.networkManager.cancelMatchmaking();
    }
    
    /**
     * Clean up all connections and listeners
     */
    cleanup() {
        console.log('🎮 GameController: Cleaning up');
        
        if (this.networkManager) {
            this.networkManager.disconnect();
        }
        
        if (this.eventHub) {
            this.eventHub.clear();
        }
        
        // ActionDispatcher doesn't need explicit cleanup (no state to clear)
        this.actionDispatcher = null;
    }
    
    /**
     * Get debug information about the controller state
     */
    getDebugInfo() {
        return {
            isConnected: this.networkManager?.isConnected || false,
            registeredEvents: this.eventHub?.getRegisteredEvents() || [],
            sessionId: this.networkManager?.sessionId || null,
            playerId: this.networkManager?.playerId || null
        };
    }
} 