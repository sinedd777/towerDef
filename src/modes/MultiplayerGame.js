import * as THREE from 'three';
import { NetworkManager } from '../network/NetworkManager.js';
import { MultiplayerScene } from '../multiplayer/MultiplayerScene.js';
import { MultiplayerCamera } from '../multiplayer/MultiplayerCamera.js';
import { MultiplayerInputManager } from '../multiplayer/MultiplayerInputManager.js';
import { MultiplayerStatusUI } from '../ui/MultiplayerStatusUI.js';
import { PrivateControlPanel } from '../ui/PrivateControlPanel.js';
import { LoadingScreen } from '../ui/LoadingScreen.js';
import { GameState } from '../GameState.js';
import { assetManager } from '../managers/AssetManager.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class MultiplayerGame {
    constructor() {
        // Core systems
        this.networkManager = null;
        this.multiplayerStatusUI = null;
        this.privateControlPanel = null;
        this.loadingScreen = null;
        
        // Game systems
        this.multiplayerScene = null;
        this.multiplayerCamera = null;
        this.multiplayerInput = null;
        this.gameState = null;
        
        // Rendering
        this.renderer = null;
        this.labelRenderer = null;
        
        // State
        this.localPlayerId = null;
        this.isConnected = false;
        this.isInSession = false;
        
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
            
            // Update status if available
            if (this.multiplayerStatusUI) {
                this.multiplayerStatusUI.updatePhaseIndicator('Match found - Joining session...');
            }
        });

        // Session handlers
        this.networkManager.setOnSessionJoined((data) => {
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
            
            // Update UI
            if (this.multiplayerStatusUI) {
                this.multiplayerStatusUI.updatePhaseIndicator('Session joined - Starting game...');
            }
        });
        
        this.networkManager.setOnPlayerJoined((data) => {
            console.log('Another player joined:', data);
            if (this.multiplayerStatusUI) {
                this.multiplayerStatusUI.updatePhaseIndicator('Both players ready - Game starting!');
            }
        });
        
        this.networkManager.setOnPlayerLeft((data) => {
            console.log('Player left:', data);
            if (this.multiplayerStatusUI) {
                this.multiplayerStatusUI.updatePhaseIndicator('Player left - Waiting for new player...');
            }
        });
        
        // Connection handlers
        this.networkManager.setOnDisconnected((reason) => {
            console.log('Disconnected from server:', reason);
            this.isConnected = false;
            this.isInSession = false;
            
            if (this.multiplayerStatusUI) {
                this.multiplayerStatusUI.updatePhaseIndicator('Disconnected from server');
            }
            
            // Show error message and option to reconnect
            this.showMultiplayerError('Connection lost. Attempting to reconnect...');
        });
        
        this.networkManager.setOnError((error) => {
            console.error('Network error:', error);
            this.showMultiplayerError('Network error occurred. Please try again.');
        });
    }

    /**
     * Initialize multiplayer game systems after session join
     */
    async initializeMultiplayerSystems() {
        // Show loading screen while assets are loading
        if (this.loadingScreen) {
            this.loadingScreen.show();
            this.loadingScreen.setStatus('Loading game assets...');
        }

        try {
            // Preload essential assets before creating scene
            await assetManager.preloadEssentialAssets((progress) => {
                if (this.loadingScreen) {
                    this.loadingScreen.updateProgress(progress.loaded, progress.total, progress.currentAsset);
                }
            });
            
            // Create multiplayer scene
            this.multiplayerScene = new MultiplayerScene();
            
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
            this.renderer.setClearColor(0x000000, 1);
            document.body.appendChild(this.renderer.domElement);
            
            // CSS2D renderer for labels
            this.labelRenderer = new CSS2DRenderer();
            this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
            this.labelRenderer.domElement.style.position = 'absolute';
            this.labelRenderer.domElement.style.top = '0';
            this.labelRenderer.domElement.style.pointerEvents = 'none';
            document.body.appendChild(this.labelRenderer.domElement);
            
            // Initialize multiplayer camera
            this.multiplayerCamera = new MultiplayerCamera(this.renderer);
            
            // Create game state
            this.gameState = new GameState();
            
            // Initialize status UI if not already created
            if (!this.multiplayerStatusUI) {
                this.multiplayerStatusUI = new MultiplayerStatusUI();
            }
            
            // Initialize private control panel
            this.privateControlPanel = new PrivateControlPanel(this.localPlayerId, this.gameState, this.networkManager);
            this.privateControlPanel.show();
            
            // Initialize multiplayer input manager
            this.multiplayerInput = new MultiplayerInputManager(
                this.multiplayerScene, 
                this.multiplayerCamera.getCamera(), 
                this.renderer, 
                this.gameState,
                this.networkManager
            );

            // Hide loading screen once everything is ready
            if (this.loadingScreen) {
                this.loadingScreen.hide();
            }
            
            console.log('Multiplayer game systems initialized successfully');
            
        } catch (error) {
            console.error('Failed to load assets:', error);
            if (this.loadingScreen) {
                this.loadingScreen.setStatus('Error loading assets. Please refresh the page.');
            }
            throw error;
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
        if (this.renderer) {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
        
        if (this.labelRenderer) {
            this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        }
        
        if (this.multiplayerCamera) {
            this.multiplayerCamera.onWindowResize?.();
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
        console.log('Cleaning up multiplayer game...');
        
        // Cleanup network
        if (this.networkManager) {
            this.networkManager.disconnect();
            this.networkManager = null;
        }
        
        // Cleanup UI
        if (this.multiplayerStatusUI) {
            this.multiplayerStatusUI.destroy?.();
            this.multiplayerStatusUI = null;
        }
        
        if (this.privateControlPanel) {
            this.privateControlPanel.destroy?.();
            this.privateControlPanel = null;
        }
        
        // Cleanup input
        if (this.multiplayerInput) {
            this.multiplayerInput.cleanup?.();
            this.multiplayerInput = null;
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
        
        console.log('Multiplayer game cleaned up');
    }
} 