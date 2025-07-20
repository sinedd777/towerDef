import * as THREE from 'three';
import { NetworkManager } from '../network/NetworkManager.js';
import { MultiplayerScene } from '../multiplayer/MultiplayerScene.js';
import { MultiplayerInputManager } from '../multiplayer/MultiplayerInputManager.js';
import { MultiplayerTowerInputManager } from '../multiplayer/MultiplayerTowerInputManager.js';
import { LoadingScreen } from '../ui/LoadingScreen.js';
import { SpectatorOverlay } from '../ui/SpectatorOverlay.js';
import { TurnIndicatorUI } from '../ui/TurnIndicatorUI.js';
import { GameState } from '../GameState.js';
import { MazeState } from '../mazeBuilder/MazeState.js';
import { MazeBuilderUI } from '../mazeBuilder/MazeBuilderUI.js';
import { MazeInputManager } from '../mazeBuilder/MazeInputManager.js';
import { TowerSelectionUI } from '../ui/TowerSelectionUI.js';
import { TowerManagementUI } from '../ui/TowerManagementUI.js';
import { TOWER_TYPES } from '../TowerTypes.js';
import { assetManager } from '../managers/AssetManager.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Enemy } from '../Enemy.js';
import { Tower } from '../Tower.js';
import { Pathfinding } from '../Pathfinding.js';
import { EnvironmentManager } from '../managers/EnvironmentManager.js';

export class MultiplayerGame {
    constructor(gameController = null) {
        // Core systems (NEW ARCHITECTURE)
        this.gameController = gameController;
        this.networkManager = gameController ? gameController.getNetworkManager() : null;
        this.eventHub = gameController ? gameController.getEventHub() : null;
        
        // UI systems
        this.loadingScreen = null;
        this.spectatorOverlay = null;
        
        // Game systems
        this.multiplayerScene = null;
        this.camera = null;
        this.controls = null;
        this.gameState = null;
        this.mazeState = null;
        this.pathfinding = null;  // Add pathfinding
        this.environmentManager = null;  // Add environment manager
        
        // Game objects
        this.enemies = new Map();
        this.towers = new Map();
        
        // Game constants - updated for cooperative mode
        this.spawnPoints = [
            new THREE.Vector3(-8, 0.1, -8),  // Northwest
            new THREE.Vector3(-8, 0.1, 8)    // Southwest
        ];
        this.exitPoint = new THREE.Vector3(8, 0.1, 0);  // East center
        
        // Legacy single spawn (for backward compatibility)
        this.enemyStartPosition = this.spawnPoints[0];
        this.enemyEndPosition = this.exitPoint;
        this.lastEnemySpawn = 0;
        this.enemySpawnInterval = 2000;
        
        // Path visualization (support multiple paths for cooperative mode)
        this.pathLines = [];  // Array to hold multiple path lines
        this.pathLine = null; // Legacy single path line for backward compatibility
        
        // UI systems (like single player)
        this.mazeBuilderUI = null;
        this.towerSelectionUI = null;
        this.towerManagementUI = null;
        this.turnIndicatorUI = null;
        
        // Input managers  
        this.mazeInputManager = null;
        this.towerInputManager = null;
        
        // CRITICAL: Setup EventHub handlers IMMEDIATELY in constructor to avoid race conditions
        if (this.eventHub && this.gameController) {
            this.setupEventHubHandlers();
        }
        
        // Rendering
        this.renderer = null;
        this.labelRenderer = null;
        
        // State
        this.localPlayerId = null;
        this.isConnected = false;
        this.isInSession = false;
        this.isRunning = false;
        this.animationId = null;
        this.isInitializing = false; // Add initialization flag
        // Removed: defenseHandlerRegistered flag - no longer needed with proper architecture
        
        // Callbacks
        this.onMatchmakingUpdate = null;
        this.onMatchmakingCancelled = null;
        this.onSessionJoined = null;
    }

    /**
     * Initialize multiplayer game with matchmaking
     */
    async initializeWithMatchmaking(loadingScreen = null, statusCallbacks = {}) {
        this.loadingScreen = loadingScreen || new LoadingScreen();
        
        // Store callbacks
        this.onMatchmakingUpdate = statusCallbacks.onMatchmakingUpdate;
        this.onMatchmakingCancelled = statusCallbacks.onMatchmakingCancelled;
        this.onSessionJoined = statusCallbacks.onSessionJoined;
            
                // Validate GameController provided NetworkManager
        if (!this.networkManager) {
            console.error('❌ MultiplayerGame: NetworkManager not provided by GameController');
            throw new Error('MultiplayerGame requires NetworkManager from GameController');
        }
        
        // Event handlers already set up in constructor - no need to set up again
                    // Note: Defense handler now uses proper NetworkManager callback system
            // Direct socket access removed to follow proper architecture
            
            // Setup connection handler to start matchmaking after connection
            if (!this.gameController) {
                // LEGACY mode: handle connection ourselves
                this.networkManager.setOnConnected(() => {
                    this.isConnected = true;
                    // Start quick match once connected
                    this.networkManager.startQuickMatch();
                });
                
                // Connect to server
                this.networkManager.connect();
            } else {
                // NEW ARCHITECTURE: GameController already handles connection and matchmaking
                this.isConnected = this.networkManager.isConnected;
            }
    }

    /**
     * Cancel ongoing matchmaking
     */
    cancelMatchmaking() {
        if (this.networkManager) {
            this.networkManager.cancelMatchmaking();
        }
    }

    /**
     * Setup event handlers using EventHub (NEW ARCHITECTURE)
     */
    setupEventHubHandlers() {
        if (!this.eventHub) {
            console.error('❌ MultiplayerGame: No EventHub available!');
            return;
        }
        
        // === MATCHMAKING EVENTS ===
        this.eventHub.on('matchmaking:update', (status) => {
            if (this.onMatchmakingUpdate) {
                this.onMatchmakingUpdate(status);
            }
        });
        
        this.eventHub.on('matchmaking:found', (data) => {
            if (this.loadingScreen) {
                this.loadingScreen.show();
            }
        });
        
        // === GAME PHASE EVENTS ===
        this.eventHub.on('game:defense_started', (data) => {
            // CRITICAL: Aggressive cleanup first - multiple approaches
            this.forceCleanupWaitingMessages();
            
            // CRITICAL: Update turn state first for tower operations
            if (data.currentTurn && this.localPlayerId) {
                // Update turn indicator UI
                if (this.turnIndicatorUI) {
                    this.turnIndicatorUI.updateTurn({
                        currentTurn: data.currentTurn,
                        gamePhase: data.gamePhase || 'defense',
                        sharedResources: data.sharedResources
                    });
                    this.turnIndicatorUI.updateMyTurn(data.currentTurn === this.localPlayerId);
                }
                
                // Update tower input manager turn state
                if (this.towerInputManager) {
                    this.towerInputManager.updateTurnState(data.currentTurn, this.localPlayerId, data.gamePhase || 'defense');
                }
            }
            
            // Show phase transition UI
            if (this.turnIndicatorUI) {
                this.turnIndicatorUI.showPhaseTransition('defense');
                console.log('🚀 Phase transition UI triggered');
            }
            
            // Update local game state phase first
            if (this.gameState && this.gameState.startDefensePhase) {
                this.gameState.startDefensePhase();
                console.log('🚀 Local game state updated to defense phase');
            }
            
            // Perform UI transition
            this.transitionToDefensePhase();
            
            // Update path visualization based on game mode
            if (data.gameMode === 'cooperative' && data.sharedPath) {
                this.updateMultiplePathsFromServer(data.sharedPath);
                console.log('🚀 Multiple paths updated from shared path');
            } else if (data.gameMode === 'competitive' && data.paths && data.paths[this.localPlayerId]) {
                this.updatePathVisualization(data.paths[this.localPlayerId]);
                console.log('🚀 Player-specific path updated');
            } else if (data.path) {
                this.updatePathVisualization(data.path);
                console.log('🚀 Legacy path format updated');
            }
            
            console.log('🚀 Defense phase transition complete - enemies should start spawning soon!');
        });
        
        this.eventHub.on('game:turn_changed', (data) => {
            // Update turn indicator UI
            if (this.turnIndicatorUI) {
                this.turnIndicatorUI.updateTurn(data);
                this.turnIndicatorUI.updateMyTurn(data.currentTurn === this.localPlayerId);
            }
            
            // Update maze input manager turn state
            if (this.mazeInputManager) {
                this.mazeInputManager.updateTurnState(data.currentTurn, this.localPlayerId, data.gamePhase);
            }
            
            // Update tower input manager turn state
            if (this.towerInputManager) {
                this.towerInputManager.updateTurnState(data.currentTurn, this.localPlayerId, data.gamePhase);
            }
            
            // Update phase if changed
            if (data.gamePhase) {
                this.updateGamePhase(data.gamePhase);
            }
        });
        
        // === GAME STATE EVENTS ===
        this.eventHub.on('game:state_updated', (data) => {
            if (this.spectatorOverlay && data.players) {
                // Get opponent's data
                const opponentId = this.localPlayerId === 'player1' ? 'player2' : 'player1';
                const opponentData = data.players[opponentId];
                
                if (opponentData) {
                    // Update opponent stats
                    this.spectatorOverlay.updateOpponentStats({
                        health: opponentData.health,
                        score: opponentData.score,
                        wave: opponentData.wave,
                        money: opponentData.money
                    });
                    
                    // Update opponent game state visualization
                    this.spectatorOverlay.updateOpponentGameState({
                        mazeBlocks: opponentData.mazeBlocks || [],
                        towers: opponentData.towers || [],
                        enemies: opponentData.enemies || [],
                        path: opponentData.path
                    });
                }
            }
        });
        
        this.eventHub.on('game:message', (data) => {
            this.showGameMessage(data.message, data.type);
        });
        
        // === MAZE EVENTS ===
        this.eventHub.on('maze:placed', (data) => {
            this.handleMazePlacementSuccess(data);
        });
        
        this.eventHub.on('maze:place_failed', (data) => {
            this.handleMazePlacementFailure(data);
        });
        
        this.eventHub.on('maze:piece_placed', (data) => {
            this.handleOtherPlayerMazePlacement(data);
        });
        
        // === TOWER EVENTS ===
        this.eventHub.on('tower:placed', (data) => {
            this.handleTowerPlacementSuccess(data);
        });
        
        this.eventHub.on('tower:place_failed', (data) => {
            this.handleTowerPlacementFailure(data);
        });
        
        this.eventHub.on('tower:player_placed', (data) => {
            this.handlePlayerTowerPlacement(data);
        });
        
        // === ENEMY EVENTS ===
        this.eventHub.on('enemy:spawned', (data) => {
            // Create enemy in scene
            if (data.enemy) {
                // Convert server path format to client format
                const enemyPath = data.enemy.path.map(waypoint => {
                    if (waypoint.position) {
                        return waypoint; // Already in correct format
                    } else {
                        // Convert simple {x, z} to position format
                        return {
                            position: new THREE.Vector3(waypoint.x, 0.1, waypoint.z),
                            x: waypoint.x,
                            z: waypoint.z
                        };
                    }
                });
                
                // Extract wave number from enemy type (e.g., 'ufo-a' = wave 1, 'ufo-b' = wave 2)
                let wave = 1;
                if (data.enemy.type) {
                    const typeMap = { 'ufo-a': 1, 'ufo-b': 2, 'ufo-c': 3, 'ufo-d': 4 };
                    wave = typeMap[data.enemy.type] || 1;
                }
                
                // Create enemy with proper wave and path
                const enemy = new Enemy(enemyPath, wave);
                
                // Set initial position from server data
                if (data.enemy.position) {
                    const newPosition = {
                        x: data.enemy.position.x,
                        y: data.enemy.position.y || 0.1,
                        z: data.enemy.position.z
                    };
                    enemy.mesh.position.set(newPosition.x, newPosition.y, newPosition.z);
                }
                
                // Set health from server data
                if (data.enemy.health !== undefined) {
                    enemy.health = data.enemy.health;
                    enemy.maxHealth = data.enemy.maxHealth || data.enemy.health;
                }
                
                // Set speed from server data
                if (data.enemy.speed !== undefined) {
                    enemy.speed = data.enemy.speed;
                    enemy.baseSpeed = data.enemy.speed;
                    enemy.currentSpeed = data.enemy.speed;
                }
                
                // Add to scene and store reference
                if (this.multiplayerScene && this.multiplayerScene.scene) {
                    this.multiplayerScene.scene.add(enemy.mesh);
                } else {
                    console.error('❌ Cannot add enemy to scene - multiplayerScene not available!');
                }
                
                this.enemies.set(data.enemy.id, enemy);
            } else {
                console.error('❌ No enemy data in spawn event!', data);
            }
        });
        
        // === PATH EVENTS ===
        this.eventHub.on('paths:updated', (data) => {
            if (data.paths && data.paths[this.localPlayerId]) {
                // Check if this is cooperative mode to show multiple paths
                if (data.gameMode === 'cooperative' || this.spawnPoints.length > 1) {
                    this.updateMultiplePathsFromServer(data.paths[this.localPlayerId]);
                } else {
                    // Competitive mode: use player-specific path
                    this.updatePathVisualization(data.paths[this.localPlayerId]);
                }
                console.log('Paths updated due to obstacle changes (EventHub)');
            }
        });
        
        // === SESSION EVENTS ===
        this.eventHub.on('session:joined', (data) => {
            // Store local player ID - FIXED: read from data.player.playerId
            this.localPlayerId = data.player.playerId;
            this.isInSession = true;
            
            // Call external callback to hide game mode selector
            if (this.onSessionJoined) {
                this.onSessionJoined();
            }
            
            // Initialize multiplayer game systems
            this.initializeMultiplayerSystems();
        });
        
        this.eventHub.on('session:player_joined', (data) => {
            // Handle other players joining
        });
        
        this.eventHub.on('session:player_left', (data) => {
            // Handle other players leaving
        });
        
        // === CONNECTION EVENTS ===
        this.eventHub.on('network:connected', () => {
            this.isConnected = true;
        });
        
        this.eventHub.on('network:disconnected', (data) => {
            this.isConnected = false;
            this.isInSession = false;
            
            // Show error message and option to reconnect
            this.showMultiplayerError('Connection lost. Attempting to reconnect...');
        });
        
        this.eventHub.on('network:error', (data) => {
            console.error('Network error (EventHub):', data.error);
            this.showMultiplayerError('Network error occurred. Please try again.');
        });
        
        console.log('✅ MultiplayerGame: EventHub handlers setup complete');
    }

    /**
     * Setup all network event handlers (LEGACY - fallback when no EventHub)
     */
    setupNetworkHandlers() {
        if (!this.networkManager) {
            console.error('❌ MultiplayerGame: No NetworkManager available when setting up handlers!');
            return;
        }
        
        // Matchmaking handlers
        this.networkManager.setOnMatchmakingUpdate((status) => {
            if (this.onMatchmakingUpdate) {
                this.onMatchmakingUpdate(status);
            }
        });
        
        this.networkManager.setOnMatchFound((data) => {
            if (this.loadingScreen) {
                this.loadingScreen.show();
            }
        });

        // Cooperative mode handlers
        this.networkManager.setOnTurnChanged((data) => {
            
            // Update turn indicator UI
            if (this.turnIndicatorUI) {
                this.turnIndicatorUI.updateTurn(data);
                this.turnIndicatorUI.updateMyTurn(data.currentTurn === this.localPlayerId);
            }
            
            // Update maze input manager turn state
            if (this.mazeInputManager) {
                this.mazeInputManager.updateTurnState(data.currentTurn, this.localPlayerId, data.gamePhase);
            }
            
            // Update tower input manager turn state
            if (this.towerInputManager) {
                this.towerInputManager.updateTurnState(data.currentTurn, this.localPlayerId, data.gamePhase);
            }
            
            // Update phase if changed
            if (data.gamePhase) {
                this.updateGamePhase(data.gamePhase);
            }
        });

        this.networkManager.setOnGameMessage((data) => {
            this.showGameMessage(data.message, data.type);
        });

        // Handle maze placement responses
        this.networkManager.setOnMazePlaced((data) => {
            this.handleMazePlacementSuccess(data);
        });

        this.networkManager.setOnMazePlaceFailed((data) => {
            this.handleMazePlacementFailure(data);
        });

        // Handle other players' maze placements for synchronization
        this.networkManager.setOnMazePiecePlaced((data) => {
            this.handleOtherPlayerMazePlacement(data);
        });

        // Tower placement handlers
        this.networkManager.setOnTowerPlaced((data) => {
            this.handleTowerPlacementSuccess(data);
        });

        this.networkManager.setOnTowerPlaceFailed((data) => {
            this.handleTowerPlacementFailure(data);
        });
        
        // Handle all players' tower placements (including own for consistency)
        this.networkManager.setOnTowerPlayerPlaced((data) => {
            this.handlePlayerTowerPlacement(data);
        });

        // Add spectator update handler (keep existing for compatibility)
        this.networkManager.setOnGameStateUpdate((data) => {
            if (this.spectatorOverlay && data.players) {
                // Get opponent's data
                const opponentId = this.localPlayerId === 'player1' ? 'player2' : 'player1';
                const opponentData = data.players[opponentId];
                
                if (opponentData) {
                    // Update opponent stats
                    this.spectatorOverlay.updateOpponentStats({
                        health: opponentData.health,
                        score: opponentData.score,
                        wave: opponentData.wave,
                        money: opponentData.money
                    });
                    
                    // Update opponent game state visualization
                    this.spectatorOverlay.updateOpponentGameState({
                        mazeBlocks: opponentData.mazeBlocks || [],
                        towers: opponentData.towers || [],
                        enemies: opponentData.enemies || [],
                        path: opponentData.path
                    });
                }
            }
        });

        // Defense phase handlers
        this.networkManager.setOnDefensePhaseStarted((data) => {
            console.log('🚀 === DEFENSE PHASE STARTED EVENT RECEIVED ===');
            console.log('🚀 Defense phase data from server:', data);
            console.log('🚀 Game mode:', data.gameMode);
            console.log('🚀 Current turn from server:', data.currentTurn);
            console.log('🚀 Shared path available:', !!data.sharedPath);
            
            // CRITICAL: Update turn state first for tower operations
            if (data.currentTurn && this.localPlayerId) {
                console.log('🎯 Updating turn state: currentTurn =', data.currentTurn, 'localPlayerId =', this.localPlayerId);
                
                // Update turn indicator UI
                if (this.turnIndicatorUI) {
                    this.turnIndicatorUI.updateTurn({
                        currentTurn: data.currentTurn,
                        gamePhase: data.gamePhase || 'defense',
                        sharedResources: data.sharedResources
                    });
                    this.turnIndicatorUI.updateMyTurn(data.currentTurn === this.localPlayerId);
                    console.log('🎯 Turn indicator UI updated');
                }
                
                // Update tower input manager turn state
                if (this.towerInputManager) {
                    this.towerInputManager.updateTurnState(data.currentTurn, this.localPlayerId, data.gamePhase || 'defense');
                    console.log('🎯 Tower input manager turn state updated');
                }
            }
            
            // Show phase transition UI
            if (this.turnIndicatorUI) {
                this.turnIndicatorUI.showPhaseTransition('defense');
                console.log('🚀 Phase transition UI triggered');
            }
            
            // Update local game state phase first
            if (this.gameState && this.gameState.startDefensePhase) {
                this.gameState.startDefensePhase();
                console.log('🚀 Local game state updated to defense phase');
            }
            
            // Perform UI transition
            this.transitionToDefensePhase();
            
            // Update path visualization based on game mode
            if (data.gameMode === 'cooperative' && data.sharedPath) {
                // Cooperative mode: calculate multiple paths from all spawn points
                this.updateMultiplePathsFromServer(data.sharedPath);
                console.log('🚀 Multiple paths updated from shared path');
            } else if (data.gameMode === 'competitive' && data.paths && data.paths[this.localPlayerId]) {
                // Competitive mode: use player-specific path
                this.updatePathVisualization(data.paths[this.localPlayerId]);
                console.log('🚀 Player-specific path updated');
            } else if (data.path) {
                // Backward compatibility: use legacy path format
                this.updatePathVisualization(data.path);
                console.log('🚀 Legacy path format updated');
            }
            
            console.log('🚀 Defense phase transition complete - enemies should start spawning soon!');
        });
        
        // Handle path updates from server (when obstacles change)
        this.networkManager.setOnPathsUpdated((data) => {
            
            if (data.paths && data.paths[this.localPlayerId]) {
                // Check if this is cooperative mode to show multiple paths
                if (data.gameMode === 'cooperative' || this.spawnPoints.length > 1) {
                    this.updateMultiplePathsFromServer(data.paths[this.localPlayerId]);
                } else {
                    // Competitive mode: use player-specific path
                    this.updatePathVisualization(data.paths[this.localPlayerId]);
                }
                console.log('Paths updated due to obstacle changes');
            }
        });

        // Enemy spawn handler - CRITICAL for multiplayer enemy visibility
        console.log('🔧 MultiplayerGame: Setting up enemy spawn handler...');
        this.networkManager.setOnEnemySpawned((data) => {
            console.log('🎯 ===== CLIENT ENEMY CREATION START =====');
            console.log('🎯 Enemy spawn event received on client');
            console.log('🎯 Data received:', data);
            console.log('🎯 Current client enemies count before creation:', this.enemies.size);
            console.log('🎯 Client scene object count before creation:', this.multiplayerScene?.scene?.children?.length || 'scene not available');
            
            // Create enemy in scene
            if (data.enemy) {
                console.log('🔄 Processing enemy data...');
                
                // Convert server path format to client format
                const enemyPath = data.enemy.path.map(waypoint => {
                    if (waypoint.position) {
                        console.log('🛤️ Waypoint already in correct format:', waypoint);
                        return waypoint; // Already in correct format
                    } else {
                        // Convert simple {x, z} to position format
                        const converted = {
                            position: new THREE.Vector3(waypoint.x, 0.1, waypoint.z),
                            x: waypoint.x,
                            z: waypoint.z
                        };
                        console.log('🛤️ Converting waypoint format from', waypoint, 'to', converted);
                        return converted;
                    }
                });
                
                console.log('🛤️ Final enemy path created:', {
                    length: enemyPath.length,
                    firstWaypoint: enemyPath[0],
                    lastWaypoint: enemyPath[enemyPath.length - 1]
                });
                
                // Extract wave number from enemy type (e.g., 'ufo-a' = wave 1, 'ufo-b' = wave 2)
                let wave = 1;
                if (data.enemy.type) {
                    const typeMap = { 'ufo-a': 1, 'ufo-b': 2, 'ufo-c': 3, 'ufo-d': 4 };
                    wave = typeMap[data.enemy.type] || 1;
                }
                console.log('👾 Enemy wave calculated:', wave, 'from type:', data.enemy.type);
                
                // Create enemy with proper wave and path
                console.log('🏗️ Creating Enemy instance...');
                const enemy = new Enemy(enemyPath, wave);
                console.log('✅ Enemy instance created successfully');
                
                // Set initial position from server data
                if (data.enemy.position) {
                    const newPosition = {
                        x: data.enemy.position.x,
                        y: data.enemy.position.y || 0.1,
                        z: data.enemy.position.z
                    };
                    enemy.mesh.position.set(newPosition.x, newPosition.y, newPosition.z);
                    console.log('📍 Enemy position set to:', newPosition);
                }
                
                // Set health from server data
                if (data.enemy.health !== undefined) {
                    enemy.health = data.enemy.health;
                    enemy.maxHealth = data.enemy.maxHealth || data.enemy.health;
                    console.log('❤️ Enemy health set:', enemy.health, '/', enemy.maxHealth);
                }
                
                // Set speed from server data
                if (data.enemy.speed !== undefined) {
                    enemy.speed = data.enemy.speed;
                    enemy.baseSpeed = data.enemy.speed;
                    enemy.currentSpeed = data.enemy.speed;
                    console.log('💨 Enemy speed set:', enemy.speed);
                }
                
                // Add to scene and store reference
                if (this.multiplayerScene && this.multiplayerScene.scene) {
                    console.log('🎬 Adding enemy to scene...');
                    this.multiplayerScene.scene.add(enemy.mesh);
                    console.log('✅ Enemy mesh added to scene');
                } else {
                    console.error('❌ Cannot add enemy to scene - multiplayerScene not available!');
                }
                
                console.log('💾 Storing enemy in enemies map...');
                this.enemies.set(data.enemy.id, enemy);
                console.log('✅ Enemy stored in map');
                
                console.log('🎯 ===== ENEMY CREATION SUMMARY =====');
                console.log(`✅ Created enemy ${data.enemy.id} successfully`);
                console.log(`📍 Position: (${enemy.mesh.position.x}, ${enemy.mesh.position.y}, ${enemy.mesh.position.z})`);
                console.log(`🛤️ Path waypoints: ${enemyPath.length}`);
                console.log(`👾 Wave: ${wave}, Type: ${data.enemy.type}`);
                console.log(`❤️ Health: ${enemy.health}/${enemy.maxHealth}`);
                console.log(`💨 Speed: ${enemy.speed}`);
                console.log(`🎬 In scene: ${!!enemy.mesh.parent}`);
                console.log(`📊 Total enemies after creation: ${this.enemies.size}`);
                console.log(`🎬 Total scene objects after creation: ${this.multiplayerScene?.scene?.children?.length || 'scene not available'}`);
                console.log('🎯 ===== CLIENT ENEMY CREATION END =====');
            } else {
                console.error('❌ No enemy data in spawn event!', data);
            }
        });
        console.log('✅ MultiplayerGame: Enemy spawn handler registered');

        // Handle game state updates for enemy synchronization
        this.networkManager.setOnGameStateUpdate((data) => {
            // Handle enemy updates from state synchronization
            if (data.gameState && data.gameState.enemies) {
                for (const [enemyId, enemyUpdate] of Object.entries(data.gameState.enemies)) {
                    if (enemyUpdate === null) {
                        // Enemy was removed on server
                        this.removeEnemy(enemyId);
                    } else if (enemyUpdate && this.enemies.has(enemyId)) {
                        // Update existing enemy
                        this.updateEnemyFromServer(enemyId, enemyUpdate);
                    }
                }
            }
            
            // Spectator overlay updates
            if (this.spectatorOverlay && data.players) {
                // Get opponent's data
                const opponentId = this.localPlayerId === 'player1' ? 'player2' : 'player1';
                const opponentData = data.players[opponentId];
                
                if (opponentData) {
                    // Update opponent stats
                    this.spectatorOverlay.updateOpponentStats({
                        health: opponentData.health,
                        score: opponentData.score,
                        wave: opponentData.wave,
                        money: opponentData.money
                    });
                    
                    // Update opponent game state visualization
                    this.spectatorOverlay.updateOpponentGameState({
                        mazeBlocks: opponentData.mazeBlocks || [],
                        towers: opponentData.towers || [],
                        enemies: opponentData.enemies || [],
                        path: opponentData.path
                    });
                }
            }
        });

        // Session handlers
        this.networkManager.setOnSessionJoined((data) => {
            console.log('*** SESSION JOINED EVENT FIRED ***', Date.now());
            console.log('Joined multiplayer session:', data);
            
            // Store local player ID - FIXED: read from data.player.playerId
            this.localPlayerId = data.player.playerId;
            this.isInSession = true;
            
            console.log('🎯 Set localPlayerId to:', this.localPlayerId);
            
            // Call external callback to hide game mode selector
            if (this.onSessionJoined) {
                this.onSessionJoined();
            }
            
            // Initialize multiplayer game systems
            this.initializeMultiplayerSystems();
        });
        
        this.networkManager.setOnPlayerJoined((data) => {
        });
        
        this.networkManager.setOnPlayerLeft((data) => {
        });
        
        // Connection handlers
        this.networkManager.setOnDisconnected((reason) => {
            this.isConnected = false;
            this.isInSession = false;
            
            // Show error message and option to reconnect
            this.showMultiplayerError('Connection lost. Attempting to reconnect...');
        });
        
        this.networkManager.setOnError((error) => {
            console.error('Network error:', error);
            this.showMultiplayerError('Network error occurred. Please try again.');
        });
    }

    /**
     * Start the game loop
     */
    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.gameLoop();
        }
    }

    /**
     * Stop the game loop
     */
    stop() {
        this.isRunning = false;
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Main game loop
     */
    gameLoop() {
        if (!this.isRunning) return;

        this.animationId = requestAnimationFrame(() => this.gameLoop());

        const currentTime = Date.now();

        // Animate all path lines
        for (const pathLine of this.pathLines) {
            if (pathLine && pathLine.material) {
                pathLine.material.dashOffset -= 0.02;
            }
        }
        
        // Legacy path line animation for backward compatibility
        if (this.pathLine && this.pathLine.material) {
            this.pathLine.material.dashOffset -= 0.02;
        }

        // Display paths continuously during maze building (from all spawn points)
        if (this.gameState.isMazeBuilding()) {
            const obstacles = this.getAllObstacles();
            
            // Calculate paths from all spawn points to exit for cooperative mode
            const allPaths = [];
            for (const spawnPoint of this.spawnPoints) {
                const path = this.pathfinding.findPath(
                    { x: spawnPoint.x, z: spawnPoint.z },
                    { x: this.exitPoint.x, z: this.exitPoint.z },
                    obstacles
                );
                if (path) {
                    allPaths.push(path);
                }
            }
            
            this.updateMultiplePathVisualization(allPaths);
        }

        // Update enemies
        if (this.enemies.size > 0) {
            // Enemy update counter for internal tracking
            if (!this.enemyLogCounter) this.enemyLogCounter = 0;
            this.enemyLogCounter++;
        } else {
            // Phase counter for internal tracking
            if (!this.phaseLogCounter) this.phaseLogCounter = 0;
            this.phaseLogCounter++;
        }
        
        for (const [enemyId, enemy] of this.enemies) {
            if (enemy && enemy.update) {
                // Pass all enemies for collision avoidance
                const allEnemies = Array.from(this.enemies.values()).filter(e => e && e.isAlive());
                enemy.update(allEnemies);
                
                // Check if enemy has reached the end or is dead
                if (enemy.hasReachedEnd() || !enemy.isAlive()) {
                    this.removeEnemy(enemyId);
                }
            }
        }

        // Update controls
        if (this.controls) {
            this.controls.update();
        }

        // Render the scene
        if (this.renderer && this.multiplayerScene && this.camera) {
            this.renderer.render(this.multiplayerScene.scene, this.camera);
        }

        // Render labels
        if (this.labelRenderer && this.multiplayerScene && this.camera) {
            this.labelRenderer.render(this.multiplayerScene.scene, this.camera);
        }
    }

    getAllObstacles() {
        const obstacles = [];
        
        // Add maze blocks
        const mazeObstacles = this.mazeState.getObstacles();
        obstacles.push(...mazeObstacles);
        
        // Add towers
        for (const [_, tower] of this.towers) {
            const pos = tower.getPosition();
            obstacles.push({ x: pos.x, z: pos.z });
        }
        
        return obstacles;
    }

    updatePathVisualization(waypoints) {
        // Legacy method for single path - now delegates to multiple path visualization
        this.updateMultiplePathVisualization(waypoints ? [waypoints] : []);
    }

    updateMultiplePathVisualization(pathsArray) {
        // Remove all existing path lines
        this.clearAllPathLines();

        // Create new path lines for each path
        if (pathsArray && pathsArray.length > 0) {
            const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xff00ff]; // Red, Green, Blue, Magenta
            
            for (let i = 0; i < pathsArray.length; i++) {
                const waypoints = pathsArray[i];
                if (waypoints && waypoints.length > 0) {
                    const positions = waypoints.map(waypoint => {
                        return waypoint.position ? waypoint.position.clone() : waypoint.clone();
                    });

                    const pathGeometry = new THREE.BufferGeometry().setFromPoints(positions);

                    const pathMaterial = new THREE.LineDashedMaterial({
                        color: colors[i % colors.length], // Cycle through colors
                        dashSize: 0.2,
                        gapSize: 0.8,
                        transparent: true,
                        opacity: 0.8,
                        linewidth: 2
                    });

                    const pathLine = new THREE.Line(pathGeometry, pathMaterial);
                    pathLine.computeLineDistances();
                    this.multiplayerScene.scene.add(pathLine);
                    this.pathLines.push(pathLine);
                    
                    // Keep first path as legacy pathLine for compatibility
                    if (i === 0) {
                        this.pathLine = pathLine;
                    }
                }
            }
            
        }
    }

    clearAllPathLines() {
        // Remove all path lines
        for (const pathLine of this.pathLines) {
            this.multiplayerScene.scene.remove(pathLine);
            pathLine.geometry.dispose();
            pathLine.material.dispose();
        }
        this.pathLines = [];
        this.pathLine = null;
    }

    updateMultiplePathsFromServer(sharedPath) {
        // Server provides one path, but we need to calculate paths from all spawn points
        // to show the complete cooperative gameplay picture
        const obstacles = this.getAllObstacles();
        const allPaths = [];
        
        for (const spawnPoint of this.spawnPoints) {
            const path = this.pathfinding.findPath(
                { x: spawnPoint.x, z: spawnPoint.z },
                { x: this.exitPoint.x, z: this.exitPoint.z },
                obstacles
            );
            
            if (path) {
                allPaths.push(path);
            }
        }
        
        // If we couldn't calculate any local paths, fall back to server path
        if (allPaths.length === 0 && sharedPath) {
            console.warn('Could not calculate local paths, using server path');
            this.updatePathVisualization(sharedPath);
        } else {
            this.updateMultiplePathVisualization(allPaths);
        }
    }

    /**
     * Initialize multiplayer game systems after session join
     */
    async initializeMultiplayerSystems() {
        // Prevent double initialization with flag-based protection
        if (this.isInitializing) {
            return;
        }
        
        if (this.multiplayerScene || this.mazeInputManager) {
            return;
        }
        
        this.isInitializing = true; // Set flag to prevent concurrent initialization
        
        try {
            // Ensure any existing input manager is cleaned up first
            if (this.mazeInputManager) {
                this.mazeInputManager.cleanup();
                this.mazeInputManager = null;
            }
            
            // Show loading screen while assets are loading
            if (this.loadingScreen) {
                this.loadingScreen.show();
                this.loadingScreen.setStatus('Loading game assets...');
            }

            // Preload essential assets before creating scene
            await assetManager.preloadEssentialAssets((progress) => {
                if (this.loadingScreen) {
                    this.loadingScreen.updateProgress(progress.loaded, progress.total, progress.currentAsset);
                }
            });
            
            // Create multiplayer scene with local player ID
            this.multiplayerScene = new MultiplayerScene(this.localPlayerId);
            
            // Setup renderer
            this.renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                alpha: false,
                powerPreference: "high-performance"
            });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            
            // Enhanced shadow and rendering settings
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.6;
            this.renderer.sortObjects = true;
            this.renderer.setClearColor(0x87CEEB, 1); // Sky blue like single player
            document.body.appendChild(this.renderer.domElement);
            
            // CSS2D renderer for labels
            this.labelRenderer = new CSS2DRenderer();
            this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
            this.labelRenderer.domElement.style.position = 'absolute';
            this.labelRenderer.domElement.style.top = '0';
            this.labelRenderer.domElement.style.pointerEvents = 'none';
            document.body.appendChild(this.labelRenderer.domElement);
            
            // Initialize standard camera (like single player)
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.camera.position.set(0, 20, 15);
            this.camera.lookAt(0, 0, 0);
            
            // Initialize camera controls (like single player)
            const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.screenSpacePanning = false;
            this.controls.minDistance = 5;
            this.controls.maxDistance = 50;
            this.controls.maxPolarAngle = Math.PI / 2;
            
            // Create game state
            this.gameState = new GameState();
            this.mazeState = new MazeState(this.multiplayerScene.scene, 20);
            this.pathfinding = new Pathfinding(20);  // Initialize pathfinding
            this.environmentManager = new EnvironmentManager(this.multiplayerScene.scene, 20);  // Initialize environment
            
            // Initialize UI systems (true = multiplayer mode)
            this.mazeBuilderUI = new MazeBuilderUI(this.mazeState, this.gameState, true);
            this.towerSelectionUI = new TowerSelectionUI(this.gameState);
            this.towerManagementUI = new TowerManagementUI(this.gameState, this.labelRenderer, this.camera);
            
            // Initialize cooperative mode UI
            this.turnIndicatorUI = new TurnIndicatorUI();
            this.turnIndicatorUI.show();
            
            // Removed: Start Defense callback setup - defense phase starts automatically via server
            
            // Hide tower selection UI initially (show only during defense phase)
            this.towerSelectionUI.hide();

            // Initialize spectator overlay (small and unobtrusive)
            this.spectatorOverlay = new SpectatorOverlay();
            this.spectatorOverlay.show();
            
            // Initialize maze input manager for building phase with ActionDispatcher for turn-based control
            this.mazeInputManager = new MazeInputManager(
                this.multiplayerScene.scene, 
                this.camera, 
                this.renderer, 
                this.multiplayerScene.ground,
                this.mazeState,
                this.mazeBuilderUI,
                this.gameController ? this.gameController.getActionDispatcher() : null // NEW ARCHITECTURE: Use ActionDispatcher
            );

            // Hide loading screen once everything is ready
            if (this.loadingScreen) {
                this.loadingScreen.hide();
            }
            
            // Start the game loop after initialization
            this.start();
            
        } catch (error) {
            console.error('Failed to load assets:', error);
            if (this.loadingScreen) {
                this.loadingScreen.setStatus('Error loading assets. Please refresh the page.');
            }
            throw error;
        } finally {
            this.isInitializing = false; // Reset flag after initialization attempt
        }
    }

    /**
     * Initialize environment for cooperative mode with multiple spawn points
     */
    async initializeCooperativeEnvironment() {
        try {
            const obstacles = this.getAllObstacles();
            
            // Initialize environment with multiple spawn points
            await this.environmentManager.initializeCooperativeEnvironment(
                obstacles, 
                this.spawnPoints, 
                this.exitPoint
            );
            
            console.log('Cooperative environment initialized with dual spawn points');
        } catch (error) {
            console.error('Failed to initialize cooperative environment:', error);
        }
    }

    /**
     * Show multiplayer error overlay
     */
    showMultiplayerError(message) {
        // Create error overlay
        const errorOverlay = document.createElement('div');
        errorOverlay.className = 'multiplayer-error-overlay';
        errorOverlay.innerHTML = `
            <div class="error-content">
                <h3>⚠️ Multiplayer Error</h3>
                <p>${message}</p>
                <div class="error-actions">
                    <button class="retry-btn">Retry</button>
                    <button class="single-btn">Play Solo Instead</button>
                    <button class="menu-btn">Back to Menu</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(errorOverlay);
        
        // Setup event listeners
        errorOverlay.querySelector('.retry-btn').addEventListener('click', () => {
            errorOverlay.remove();
            if (this.networkManager) {
                this.networkManager.connect();
            }
        });
        
        errorOverlay.querySelector('.single-btn').addEventListener('click', () => {
            errorOverlay.remove();
            // Cleanup multiplayer and trigger single player callback
            this.cleanup();
            // Notify parent to switch to single player
            this.onSwitchToSinglePlayer?.();
        });
        
        errorOverlay.querySelector('.menu-btn').addEventListener('click', () => {
            errorOverlay.remove();
            this.cleanup();
            // Reload page to return to menu
            location.reload();
        });
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        if (this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }
        
        if (this.renderer) {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
        
        if (this.labelRenderer) {
            this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    /**
     * Get network manager (for external access)
     */
    getNetworkManager() {
        return this.networkManager;
    }

    /**
     * Check if currently connected
     */
    isNetworkConnected() {
        return this.isConnected;
    }

    /**
     * Check if in multiplayer session
     */
    isInMultiplayerSession() {
        return this.isInSession;
    }

    /**
     * Set callback for switching to single player
     */
    setOnSwitchToSinglePlayer(callback) {
        this.onSwitchToSinglePlayer = callback;
    }

    /**
     * Update game phase for cooperative mode
     */
    updateGamePhase(newPhase) {
        console.log(`🔄 updateGamePhase called: ${this.gameState?.currentPhase} → ${newPhase}`);
        
        // Update local game state
        if (this.gameState) {
            this.gameState.currentPhase = newPhase;
            console.log(`✅ Local game state phase updated to: ${this.gameState.currentPhase}`);
        } else {
            console.warn('⚠️ Cannot update game phase - gameState not initialized');
        }
        
        // Update UI
        if (this.turnIndicatorUI) {
            this.turnIndicatorUI.updatePhase(newPhase);
            console.log(`✅ Turn indicator UI updated to phase: ${newPhase}`);
        }
    }

    /**
     * Force cleanup of all waiting messages - multiple approaches
     */
    forceCleanupWaitingMessages() {
        console.log('🧹 FORCE CLEANUP: Starting aggressive waiting message cleanup...');
        
        // Method 1: MazeBuilderUI method
        if (this.mazeBuilderUI && this.mazeBuilderUI.hideWaitingMessage) {
            this.mazeBuilderUI.hideWaitingMessage();
            console.log('🧹 FORCE CLEANUP: MazeBuilderUI.hideWaitingMessage() called');
        }
        
        // Method 2: Direct removal by ID
        const waitingElement = document.getElementById('waiting-for-players');
        if (waitingElement) {
            waitingElement.remove();
            console.log('🧹 FORCE CLEANUP: Removed waiting-for-players by ID');
        }
        
        // Method 3: Search all elements by content
        const allElements = document.querySelectorAll('*');
        let removedCount = 0;
        allElements.forEach(el => {
            const text = el.textContent || '';
            if (text.includes('Waiting for other players') || 
                text.includes('Your maze is complete') ||
                text.includes('finish...')) {
                // Check if it's a container element (has the waiting message structure)
                if (el.innerHTML && (el.innerHTML.includes('spinner') || text.includes('complete'))) {
                    el.remove();
                    removedCount++;
                    console.log('🧹 FORCE CLEANUP: Removed element by content:', text.slice(0, 50));
                }
            }
        });
        
        // Method 4: Remove by common selectors
        const selectors = [
            '#waiting-for-players',
            '[id*="waiting"]',
            '[class*="waiting"]',
            'div:has(.spinner)', // If browser supports :has()
            'div[style*="position: fixed"]'
        ];
        
        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    const text = el.textContent || '';
                    if (text.includes('Waiting for other players') || 
                        text.includes('Your maze is complete') ||
                        el.id === 'waiting-for-players') {
                        el.remove();
                        console.log('🧹 FORCE CLEANUP: Removed element by selector:', selector);
                    }
                });
            } catch (e) {
                // Some selectors might not work in all browsers
                console.log('🧹 FORCE CLEANUP: Selector failed:', selector);
            }
        });
        
        console.log(`🧹 FORCE CLEANUP: Completed - removed ${removedCount} elements`);
        
        // Schedule additional cleanup in case something recreates the element
        setTimeout(() => {
            const laterElement = document.getElementById('waiting-for-players');
            if (laterElement) {
                laterElement.remove();
                console.log('🧹 DELAYED CLEANUP: Removed waiting element that appeared later');
            }
        }, 100);
        
        setTimeout(() => {
            const laterElement = document.getElementById('waiting-for-players');
            if (laterElement) {
                laterElement.remove();
                console.log('🧹 DELAYED CLEANUP 2: Removed waiting element that appeared later');
            }
        }, 500);
    }

    /**
     * Automatic transition to defense phase (triggered by server)
     */
    transitionToDefensePhase() {
        console.log('🔄 Transitioning to defense phase automatically...');
        
        // Use our new aggressive cleanup method
        this.forceCleanupWaitingMessages();
        
        // Hide maze builder UI
        if (this.mazeBuilderUI) {
            this.mazeBuilderUI.hide();
            console.log('🔄 Maze builder UI hidden');
        }
        
        // Show tower selection UI
        if (this.towerSelectionUI) {
            this.towerSelectionUI.show();
            console.log('🔄 Tower selection UI shown');
        }
        
        // Cleanup maze input and initialize tower input
        if (this.mazeInputManager) {
            this.mazeInputManager.cleanup();
            this.mazeInputManager = null;
            console.log('🔄 Maze input manager cleaned up');
        }
        
        // Initialize tower input manager for defense phase
        this.initializeTowerInput();
        
        // CRITICAL: Ensure tower input manager has current turn state
        if (this.towerInputManager && this.gameState) {
            // Get the most recent turn state from game state or server
            const currentTurn = this.gameState.currentTurn || 'player1'; // Default to player1 if not set
            console.log('🔧 Initializing tower input manager with turn state:', currentTurn);
            this.towerInputManager.updateTurnState(currentTurn, this.localPlayerId, 'defense');
        }
        
        console.log('🔄 Defense phase transition complete');
    }

    /**
     * Initialize tower input manager for multiplayer defense phase
     */
    initializeTowerInput() {
        if (this.towerInputManager) return; // Already initialized
        
        console.log('🏗️ Initializing tower input manager for defense phase...');
        
        this.towerInputManager = new MultiplayerTowerInputManager(
            this.multiplayerScene.scene,
            this.camera,
            this.renderer,
            this.gameState,
            this.multiplayerScene.ground,
            this.mazeState,
            this.gameController ? this.gameController.getActionDispatcher() : null,
            this.localPlayerId
        );
        
        // Initialize basic towers in the UI
        const basicTowers = Object.values(TOWER_TYPES);
        this.towerSelectionUI.updateBasicTowerGrid(basicTowers);
        
        // Connect TowerSelectionUI to tower input manager
        this.towerSelectionUI.setOnTowerSelectedCallback((towerData) => {
            this.towerInputManager.setSelectedTowerData(towerData);
        });

        // Connect tower input manager to UI updates
        this.towerInputManager.setOnTowerMenuUpdateCallback(() => {
            this.towerSelectionUI.updateTowerMenu();
        });
        
        // Connect tower management callbacks
        this.towerInputManager.setOnTowerSelectedCallback((tower) => {
            this.towerManagementUI.showPanel(tower);
        });
        
        this.towerInputManager.setOnTowerDeselectedCallback((tower) => {
            this.towerManagementUI.hidePanel();
        });
        
        this.towerManagementUI.setOnTowerUpgradeCallback((tower) => {
            this.towerSelectionUI.updateTowerMenu();
        });
        
        this.towerManagementUI.setOnTowerDestroyCallback((tower) => {
            // This would need server implementation for cooperative tower destruction
            console.log('Tower destruction in multiplayer not implemented yet');
        });
        
        console.log('✅ Tower input manager initialized for multiplayer defense phase');
    }

    /**
     * Show game messages (turn notifications, errors, etc.)
     */
    showGameMessage(message, type = 'info') {
        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: ${this.getMessageColor(type)};
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-weight: bold;
            z-index: 2000;
            pointer-events: none;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        messageElement.textContent = message;
        document.body.appendChild(messageElement);
        
        // Remove message after 3 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.style.opacity = '0';
                messageElement.style.transition = 'opacity 0.5s';
                setTimeout(() => {
                    if (messageElement.parentNode) {
                        messageElement.parentNode.removeChild(messageElement);
                    }
                }, 500);
            }
        }, 3000);
    }

    /**
     * Handle successful maze placement from server
     */
    handleMazePlacementSuccess(data) {
        
        // Apply the placement to local maze state
        if (this.mazeState && data.mazePiece) {
            // Create shape object from server data
            const shapeData = {
                name: data.mazePiece.shape,
                cells: data.mazePiece.positions.map(pos => [pos.x - data.mazePiece.positions[0].x, pos.z - data.mazePiece.positions[0].z]),
                color: data.color || 0xff0000
            };
            
            // Apply the placement locally
            this.mazeState.applyServerPlacement(data.mazePiece.positions, shapeData);
            
            // CRITICAL FIX: Advance the shape hand like single player mode does
            if (this.mazeState.selectedShape) {
                // Remove the placed shape from hand
                const handIndex = this.mazeState.currentShapeHand.indexOf(this.mazeState.selectedShape);
                if (handIndex !== -1) {
                    this.mazeState.currentShapeHand.splice(handIndex, 1);
                    console.log('Removed shape from hand. New hand size:', this.mazeState.currentShapeHand.length);
                }
                
                // Clear selection and preview
                this.mazeState.selectedShape = null;
                this.mazeState.clearPreview();
            }
            
            // Update UI
            if (this.mazeBuilderUI) {
                this.mazeBuilderUI.onShapePlaced();
            }
            
            // Refresh tower input manager maze obstacles after maze changes
            if (this.towerInputManager) {
                this.towerInputManager.refreshMazeObstacles();
                console.log('🔄 Tower input manager maze obstacles refreshed after placement');
            }
        }
    }

    /**
     * Handle failed maze placement from server
     */
    handleMazePlacementFailure(data) {
        this.showGameMessage(`Placement failed: ${data.reason}`, 'error');
        
        // Flash the preview to indicate failure
        if (this.mazeInputManager) {
            this.mazeInputManager.flashInvalidPlacement();
        }
    }

    /**
     * Handle successful tower placement from server
     */
    handleTowerPlacementSuccess(data) {
        // Create tower in the scene
        if (data.tower) {
            this.createTowerFromServerData(data.tower);
        }
        
        // Update shared money if provided
        if (data.sharedResources) {
            this.gameState.setMoney(data.sharedResources.money);
        }
        
        // Update tower UI
        if (this.towerSelectionUI) {
            this.towerSelectionUI.updateTowerMenu();
        }
        
        this.showGameMessage('Tower placed successfully!', 'success');
    }

    /**
     * Handle failed tower placement from server
     */
    handleTowerPlacementFailure(data) {
        let message = 'Tower placement failed';
        switch (data.reason) {
            case 'not_your_turn':
                message = 'Please wait for your turn to place towers';
                break;
            case 'insufficient_funds':
                message = 'Not enough shared money for this tower';
                break;
            case 'invalid_position':
                message = 'Invalid tower placement position';
                break;
            case 'out_of_bounds':
                message = 'Tower must be placed within map bounds';
                break;
            case 'must_place_on_maze_block':
                message = 'Towers must be placed on maze blocks';
                break;
            case 'too_close_to_tower':
                message = 'Too close to another tower';
                break;
            default:
                message = `Tower placement failed: ${data.reason}`;
        }
        
        this.showGameMessage(message, 'error');
    }

    /**
     * Create a tower in the scene from server data
     */
    createTowerFromServerData(towerData) {
        // Create tower instance (same as single player)
        const tower = new Tower(
            towerData.position.x,
            towerData.position.y || 1.0,
            towerData.position.z,
            towerData.type
        );
        
        // Store additional server data
        tower.serverId = towerData.id;
        tower.playerId = towerData.playerId;
        tower.level = towerData.level || 1;
        tower.cost = towerData.cost;
        
        // Add to scene and towers map
        this.multiplayerScene.scene.add(tower.mesh);
        this.towers.set(towerData.id, tower);
    }

    /**
     * Handle all players' tower placements (broadcast event)
     */
    handlePlayerTowerPlacement(data) {
        console.log('🏗️ CLIENT: Received player tower placement:', data);
        
        // Check if this tower already exists (to avoid duplicates)
        if (this.towers.has(data.tower.id)) {
            console.log('🏗️ CLIENT: Tower already exists, skipping creation');
            
            // Still update shared resources for consistency
            if (data.sharedResources) {
                this.gameState.setMoney(data.sharedResources.money);
                console.log('💰 CLIENT: Updated shared money to', data.sharedResources.money);
            }
            return;
        }
        
        // Create tower in the scene for ALL players
        if (data.tower) {
            console.log('🏗️ CLIENT: Creating tower from player placement:', data.tower.id);
            this.createTowerFromServerData(data.tower);
            
            // Show placement message
            const playerName = data.playerId === this.localPlayerId ? 'You' : data.playerId;
            this.showGameMessage(`${playerName} placed a ${data.tower.type} tower!`, 'info');
        }
        
        // Update shared resources (money deducted)
        if (data.sharedResources) {
            this.gameState.setMoney(data.sharedResources.money);
            console.log('💰 CLIENT: Updated shared money to', data.sharedResources.money);
        }
        
        // Update tower UI for both players
        if (this.towerSelectionUI) {
            this.towerSelectionUI.updateTowerMenu();
        }
        
        console.log('✅ CLIENT: Player tower placement handled successfully');
    }

    /**
     * Handle other players' maze placements for state synchronization
     */
    handleOtherPlayerMazePlacement(data) {
        // Only apply if it's NOT our own placement (to avoid double-application)
        if (data.playerId !== this.localPlayerId && this.mazeState && data.mazePiece) {
            // Apply the other player's placement to our local maze state
            this.mazeState.applyServerPlacement(data.mazePiece.positions, data.shapeData);
            
            // Refresh tower input manager maze obstacles after other player's placement
            if (this.towerInputManager) {
                this.towerInputManager.refreshMazeObstacles();
            }
        }
    }

    /**
     * Get color for different message types
     */
    getMessageColor(type) {
        switch (type) {
            case 'error': return 'rgba(244, 67, 54, 0.9)';
            case 'warning': return 'rgba(255, 152, 0, 0.9)';
            case 'success': return 'rgba(76, 175, 80, 0.9)';
            case 'info':
            default: return 'rgba(33, 150, 243, 0.9)';
        }
    }

    /**
     * Cleanup all multiplayer resources
     */
    cleanup() {
        // Stop the game loop first
        this.stop();
        
        // Reset initialization flag
        this.isInitializing = false;
        
        // Cleanup network
        if (this.networkManager) {
            this.networkManager.disconnect();
            this.networkManager = null;
        }
        
        // Cleanup UI
        
        if (this.mazeBuilderUI) {
            this.mazeBuilderUI.cleanup?.();
            this.mazeBuilderUI = null;
        }
        if (this.towerSelectionUI) {
            this.towerSelectionUI.cleanup?.();
            this.towerSelectionUI = null;
        }
        if (this.towerManagementUI) {
            this.towerManagementUI.cleanup?.();
            this.towerManagementUI = null;
        }
        if (this.turnIndicatorUI) {
            this.turnIndicatorUI.cleanup?.();
            this.turnIndicatorUI = null;
        }
        
        if (this.spectatorOverlay) {
            this.spectatorOverlay.cleanup?.();
            this.spectatorOverlay = null;
        }
        
        // Cleanup input
        if (this.mazeInputManager) {
            this.mazeInputManager.cleanup?.();
            this.mazeInputManager = null;
        }
        
        if (this.towerInputManager) {
            this.towerInputManager.cleanup?.();
            this.towerInputManager = null;
        }
        
        // Cleanup controls
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }
        
        // Cleanup paths
        this.clearAllPathLines();
        
        // Cleanup environment
        if (this.environmentManager) {
            this.environmentManager.clearEnvironment();
            this.environmentManager = null;
        }
        
        // Cleanup scene
        if (this.multiplayerScene) {
            this.multiplayerScene.dispose();
            this.multiplayerScene = null;
        }
        
        // Cleanup rendering
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
            this.renderer = null;
        }
        
        if (this.labelRenderer) {
            if (this.labelRenderer.domElement.parentNode) {
                this.labelRenderer.domElement.parentNode.removeChild(this.labelRenderer.domElement);
            }
            this.labelRenderer = null;
        }
        
        // Reset state
        this.localPlayerId = null;
        this.isConnected = false;
        this.isInSession = false;
        this.camera = null;
        
    }

    /**
     * Update enemy from server state
     */
    updateEnemyFromServer(enemyId, enemyUpdate) {
        const enemy = this.enemies.get(enemyId);
        if (enemy) {
            // Update position
            if (enemyUpdate.position) {
                enemy.mesh.position.set(
                    enemyUpdate.position.x,
                    enemyUpdate.position.y || 0.1,
                    enemyUpdate.position.z
                );
            }

            // Update health
            if (enemyUpdate.health !== undefined) {
                enemy.health = enemyUpdate.health;
                enemy.maxHealth = enemyUpdate.maxHealth || enemyUpdate.health;
            }

            // Update speed
            if (enemyUpdate.speed !== undefined) {
                enemy.speed = enemyUpdate.speed;
                enemy.baseSpeed = enemyUpdate.speed;
                enemy.currentSpeed = enemyUpdate.speed;
            }

            // Update path
            if (enemyUpdate.path) {
                enemy.setPath(enemyUpdate.path);
            }

            // Update current waypoint index
            if (enemyUpdate.currentWaypointIndex !== undefined) {
                enemy.currentWaypointIndex = enemyUpdate.currentWaypointIndex;
            }

            // Update state (e.g., if it's dead)
            if (enemyUpdate.state) {
                enemy.setState(enemyUpdate.state);
            }

        } else {
            console.warn(`Enemy with ID ${enemyId} not found in local enemies map.`);
        }
    }

    /**
     * Remove enemy from scene and map
     */
    removeEnemy(enemyId) {
        const enemy = this.enemies.get(enemyId);
        if (enemy) {
            enemy.cleanup(); // Call cleanup on the enemy object
            this.multiplayerScene.scene.remove(enemy.mesh);
            this.enemies.delete(enemyId);
        } else {
            console.warn(`Attempted to remove enemy with ID ${enemyId} but it was not found.`);
        }
    }
}