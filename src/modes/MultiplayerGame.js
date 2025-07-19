import * as THREE from 'three';
import { NetworkManager } from '../network/NetworkManager.js';
import { MultiplayerScene } from '../multiplayer/MultiplayerScene.js';
import { MultiplayerInputManager } from '../multiplayer/MultiplayerInputManager.js';
import { LoadingScreen } from '../ui/LoadingScreen.js';
import { SpectatorOverlay } from '../ui/SpectatorOverlay.js';
import { GameState } from '../GameState.js';
import { MazeState } from '../mazeBuilder/MazeState.js';
import { MazeBuilderUI } from '../mazeBuilder/MazeBuilderUI.js';
import { MazeInputManager } from '../mazeBuilder/MazeInputManager.js';
import { TowerSelectionUI } from '../ui/TowerSelectionUI.js';
import { TowerManagementUI } from '../ui/TowerManagementUI.js';
import { assetManager } from '../managers/AssetManager.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Enemy } from '../Enemy.js';
import { Pathfinding } from '../Pathfinding.js';

export class MultiplayerGame {
    constructor() {
        // Core systems
        this.networkManager = null;
        this.loadingScreen = null;
        this.spectatorOverlay = null;
        
        // Game systems
        this.multiplayerScene = null;
        this.camera = null;
        this.controls = null;
        this.gameState = null;
        this.mazeState = null;
        this.pathfinding = null;  // Add pathfinding
        
        // Game objects
        this.enemies = new Map();
        this.towers = new Map();
        
        // Game constants
        this.enemyStartPosition = new THREE.Vector3(-8, 0.1, -8);
        this.enemyEndPosition = new THREE.Vector3(8, 0.1, 8);
        this.lastEnemySpawn = 0;
        this.enemySpawnInterval = 2000;
        
        // Path visualization
        this.pathLine = null;
        
        // UI systems (like single player)
        this.mazeBuilderUI = null;
        this.towerSelectionUI = null;
        this.towerManagementUI = null;
        
        // Input managers
        this.mazeInputManager = null;
        
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
        
        // Callbacks
        this.onMatchmakingUpdate = null;
        this.onMatchmakingCancelled = null;
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
        
        console.log('Starting matchmaking process...');
        
        // Initialize network manager
        this.networkManager = new NetworkManager();
        
        // Setup network event handlers
        this.setupNetworkHandlers();
        
        // Setup connection handler to start matchmaking after connection
        this.networkManager.setOnConnected(() => {
            console.log('Connected to multiplayer server');
            this.isConnected = true;
            // Start quick match once connected
            this.networkManager.startQuickMatch();
        });
        
        // Connect to server
        this.networkManager.connect();
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
     * Setup all network event handlers
     */
    setupNetworkHandlers() {
        // Matchmaking handlers
        this.networkManager.setOnMatchmakingUpdate((status) => {
            console.log('Matchmaking status:', status);
            if (this.onMatchmakingUpdate) {
                this.onMatchmakingUpdate(status);
            }
        });
        
        this.networkManager.setOnMatchFound((data) => {
            console.log('Match found:', data);
            if (this.loadingScreen) {
                this.loadingScreen.show();
            }
        });

        // Add spectator update handler
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
            console.log('Defense phase started:', data);
            
            // Hide maze builder UI
            if (this.mazeBuilderUI) {
                this.mazeBuilderUI.hide();
            }
            
            // Show tower selection UI
            if (this.towerSelectionUI) {
                this.towerSelectionUI.show();
            }
            
            // Update path visualization
            if (data.path) {
                this.multiplayerScene.updatePathVisualization(data.path);
            }
        });

        // Enemy spawn handler
        this.networkManager.setOnEnemySpawned((data) => {
            console.log('Enemy spawned:', data);
            
            // Create enemy in scene
            if (data.enemy) {
                const enemy = new Enemy(data.enemy.path, data.enemy.wave);
                enemy.mesh.position.copy(data.enemy.position);
                this.multiplayerScene.scene.add(enemy.mesh);
                
                // Store enemy reference
                this.enemies.set(data.enemy.id, enemy);
            }
        });

        // Session handlers
        this.networkManager.setOnSessionJoined((data) => {
            console.log('*** SESSION JOINED EVENT FIRED ***', Date.now());
            console.log('Joined multiplayer session:', data);
            
            // Store local player ID
            this.localPlayerId = data.playerId;
            this.isInSession = true;
            
            // Call external callback to hide game mode selector
            if (this.onSessionJoined) {
                this.onSessionJoined();
            }
            
            // Initialize multiplayer game systems
            this.initializeMultiplayerSystems();
        });
        
        this.networkManager.setOnPlayerJoined((data) => {
            console.log('Another player joined:', data);
        });
        
        this.networkManager.setOnPlayerLeft((data) => {
            console.log('Player left:', data);
        });
        
        // Connection handlers
        this.networkManager.setOnDisconnected((reason) => {
            console.log('Disconnected from server:', reason);
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
            console.log('Multiplayer game loop started');
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
        console.log('Multiplayer game loop stopped');
    }

    /**
     * Main game loop
     */
    gameLoop() {
        if (!this.isRunning) return;

        this.animationId = requestAnimationFrame(() => this.gameLoop());

        const currentTime = Date.now();

        // Animate path line
        if (this.pathLine) {
            this.pathLine.material.dashOffset -= 0.02;
        }

        // Display path continuously during maze building
        if (this.gameState.isMazeBuilding()) {
            const obstacles = this.getAllObstacles();
            const currentPath = this.pathfinding.findPath(
                { x: this.enemyStartPosition.x, z: this.enemyStartPosition.z },
                { x: this.enemyEndPosition.x, z: this.enemyEndPosition.z },
                obstacles
            );
            this.updatePathVisualization(currentPath);
        }

        // Update enemies
        for (const [enemyId, enemy] of this.enemies) {
            enemy.update();
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
        // Remove existing path line
        if (this.pathLine) {
            this.multiplayerScene.scene.remove(this.pathLine);
            this.pathLine.geometry.dispose();
            this.pathLine.material.dispose();
            this.pathLine = null;
        }

        // Only create new path line if waypoints exist
        if (waypoints && waypoints.length > 0) {
            const positions = waypoints.map(waypoint => {
                return waypoint.position ? waypoint.position.clone() : waypoint.clone();
            });

            const pathGeometry = new THREE.BufferGeometry().setFromPoints(positions);

            const pathMaterial = new THREE.LineDashedMaterial({
                color: 0xff0000,
                dashSize: 0.2,
                gapSize: 0.8,
                transparent: true,
                opacity: 0.9
            });

            this.pathLine = new THREE.Line(pathGeometry, pathMaterial);
            this.pathLine.computeLineDistances();
            this.multiplayerScene.scene.add(this.pathLine);
        }
    }

    /**
     * Initialize multiplayer game systems after session join
     */
    async initializeMultiplayerSystems() {
        // Prevent double initialization with flag-based protection
        if (this.isInitializing) {
            console.log('Initialization already in progress, skipping...');
            return;
        }
        
        if (this.multiplayerScene || this.mazeInputManager) {
            console.log('Multiplayer systems already initialized, skipping...');
            return;
        }
        
        this.isInitializing = true; // Set flag to prevent concurrent initialization
        console.log('Starting multiplayer systems initialization...');
        
        try {
            // Ensure any existing input manager is cleaned up first
            if (this.mazeInputManager) {
                console.log('Cleaning up existing MazeInputManager before creating new one');
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
            
            // Initialize UI systems (like single player)
            this.mazeBuilderUI = new MazeBuilderUI(this.mazeState, this.gameState);
            this.towerSelectionUI = new TowerSelectionUI(this.gameState);
            this.towerManagementUI = new TowerManagementUI(this.gameState, this.labelRenderer, this.camera);
            
            // Setup UI callbacks
            this.mazeBuilderUI.setOnStartDefenseCallback(() => {
                this.startDefensePhase();
            });
            
            // Hide tower selection UI initially (show only during defense phase)
            this.towerSelectionUI.hide();

            // Initialize spectator overlay (small and unobtrusive)
            this.spectatorOverlay = new SpectatorOverlay();
            this.spectatorOverlay.show();
            
            // Initialize maze input manager for building phase
            this.mazeInputManager = new MazeInputManager(
                this.multiplayerScene.scene, 
                this.camera, 
                this.renderer, 
                this.multiplayerScene.ground,
                this.mazeState,
                this.mazeBuilderUI
            );

            // Hide loading screen once everything is ready
            if (this.loadingScreen) {
                this.loadingScreen.hide();
            }
            
            // Start the game loop after initialization
            this.start();
            
            console.log('Multiplayer game systems initialized successfully');
            
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

    startDefensePhase() {
        console.log('Starting defense phase...');
        
        // Calculate initial path
        const obstacles = this.getAllObstacles();
        const initialPath = this.pathfinding.findPath(
            { x: this.enemyStartPosition.x, z: this.enemyStartPosition.z },
            { x: this.enemyEndPosition.x, z: this.enemyEndPosition.z },
            obstacles
        );

        // Check if there's a valid path before starting defense phase
        if (!initialPath) {
            console.error('No valid path exists from start to end! Cannot start defense phase.');
            alert('Cannot start defense phase: No valid path exists from start to end. Please ensure there is a path through your maze.');
            return;
        }
        
        // Notify server that we're ready for defense phase
        this.networkManager.startDefensePhase();
        
        // Hide maze builder UI
        this.mazeBuilderUI.hide();
        
        // Show tower selection UI
        this.towerSelectionUI.show();
        
        // Cleanup maze input
        if (this.mazeInputManager) {
            this.mazeInputManager.cleanup();
            this.mazeInputManager = null;
        }
        
        // Update path visualization with the valid path
        this.updatePathVisualization(initialPath);
        
        console.log('Defense phase started');
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
     * Cleanup all multiplayer resources
     */
    cleanup() {
        // Stop the game loop first
        this.stop();
        
        console.log('Cleaning up multiplayer game...');
        
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
        
        if (this.spectatorOverlay) {
            this.spectatorOverlay.cleanup?.();
            this.spectatorOverlay = null;
        }
        
        // Cleanup input
        if (this.mazeInputManager) {
            this.mazeInputManager.cleanup?.();
            this.mazeInputManager = null;
        }
        
        // Cleanup controls
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
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
        
        console.log('Multiplayer game cleaned up');
    }
} 