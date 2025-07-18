import { LoadingScreen } from '../ui/LoadingScreen.js';
import { SinglePlayerGame } from '../modes/SinglePlayerGame.js';
import { MultiplayerGame } from '../modes/MultiplayerGame.js';
import { GameModeSelector } from '../ui/GameModeSelector.js';

export class GameModeManager {
    constructor() {
        // Game instances
        this.singlePlayerGame = null;
        this.multiplayerGame = null;
        this.currentGameMode = null;
        
        // UI components
        this.gameModeSelector = null;
        this.loadingScreen = null;
        
        // State
        this.isInitialized = false;
    }

    /**
     * Initialize the game mode manager
     */
    initialize() {
        console.log('Initializing GameModeManager...');
        
        // Initialize loading screen
        this.loadingScreen = new LoadingScreen();
        this.loadingScreen.show();

        // Initialize game mode selector
        this.gameModeSelector = new GameModeSelector();
        this.setupGameModeSelector();
        
        // Show the game mode selector
        this.gameModeSelector.show();
        
        this.isInitialized = true;
        console.log('GameModeManager initialized');
    }

    /**
     * Setup game mode selector event handlers
     */
    setupGameModeSelector() {
        this.gameModeSelector.setOnModeSelected((selectedMode, options = {}) => {
            this.currentGameMode = selectedMode;
            console.log(`Starting game in ${this.currentGameMode} mode`, options);
            
            if (this.currentGameMode === 'multiplayer' && options.matchmaking) {
                // Start multiplayer with matchmaking
                this.startMultiplayerMode();
            } else {
                // Start regular game mode
                this.gameModeSelector.hide();
                this.loadingScreen.show();
                this.startGameMode(this.currentGameMode);
            }
        });

        this.gameModeSelector.setOnMatchmakingCancelled(() => {
            if (this.multiplayerGame) {
                this.multiplayerGame.cancelMatchmaking();
            }
        });
    }

    /**
     * Start the specified game mode
     */
    async startGameMode(mode) {
        try {
            if (mode === 'singleplayer') {
                await this.startSinglePlayerMode();
            } else if (mode === 'multiplayer') {
                await this.startMultiplayerMode();
            } else {
                throw new Error(`Unknown game mode: ${mode}`);
            }
        } catch (error) {
            console.error(`Failed to start ${mode} mode:`, error);
            this.showError(`Failed to start ${mode} mode. Please try again.`);
        }
    }

    /**
     * Start single player mode
     */
    async startSinglePlayerMode() {
        console.log('Starting single player mode...');
        
        try {
            // Cleanup any existing games
            this.cleanup();
            
            // Create and initialize single player game
            this.singlePlayerGame = new SinglePlayerGame();
            await this.singlePlayerGame.initialize(this.loadingScreen);
            this.singlePlayerGame.start();
            
            console.log('Single player game started successfully');
            
        } catch (error) {
            console.error('Failed to start single player game:', error);
            this.loadingScreen.hide();
            this.showError('Failed to start single player game. Please refresh the page.');
            throw error;
        }
    }

    /**
     * Start multiplayer mode with matchmaking
     */
    async startMultiplayerMode() {
        console.log('Starting multiplayer mode with matchmaking...');
        
        try {
            // Cleanup any existing games
            this.cleanup();
            
            // Create multiplayer game instance
            this.multiplayerGame = new MultiplayerGame();
            
            // Set up callback for switching to single player from error dialog
            this.multiplayerGame.setOnSwitchToSinglePlayer(() => {
                this.switchToSinglePlayerFromMultiplayer();
            });
            
            // Setup status callbacks
            const statusCallbacks = {
                onMatchmakingUpdate: (status) => {
                    console.log('Matchmaking status:', status);
                    this.gameModeSelector.updateMatchmakingStatus(status);
                },
                onMatchFound: (data) => {
                    console.log('Match found:', data);
                    // Hide mode selector and show loading screen
                    this.gameModeSelector.hide();
                    this.loadingScreen.show();
                },
                onSessionJoined: () => {
                    console.log('Session joined - hiding game mode selector');
                    this.gameModeSelector.hide();
                }
            };
            
            // Initialize multiplayer with matchmaking
            await this.multiplayerGame.initializeWithMatchmaking(this.loadingScreen, statusCallbacks);
            
            console.log('Multiplayer matchmaking started successfully');
            
        } catch (error) {
            console.error('Failed to start matchmaking:', error);
            this.showMultiplayerError('Failed to connect to multiplayer server. Please try again.');
            throw error;
        }
    }

    /**
     * Switch from multiplayer to single player (from error dialog)
     */
    async switchToSinglePlayerFromMultiplayer() {
        console.log('Switching from multiplayer to single player...');
        
        // Cleanup multiplayer
        this.cleanupMultiplayer();
        
        // Update mode and start single player
        this.currentGameMode = 'singleplayer';
        this.gameModeSelector.hide();
        this.loadingScreen.show();
        
        await this.startSinglePlayerMode();
    }

    /**
     * Show a generic error message
     */
    showError(message) {
        alert(message); // Simple error for now, could be enhanced with custom dialog
    }

    /**
     * Show multiplayer-specific error with options
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
            if (this.multiplayerGame && this.multiplayerGame.getNetworkManager()) {
                this.multiplayerGame.getNetworkManager().connect();
            }
        });
        
        errorOverlay.querySelector('.single-btn').addEventListener('click', () => {
            errorOverlay.remove();
            this.switchToSinglePlayerFromMultiplayer();
        });
        
        errorOverlay.querySelector('.menu-btn').addEventListener('click', () => {
            errorOverlay.remove();
            this.cleanup();
            this.returnToMenu();
        });
    }

    /**
     * Return to the main menu
     */
    returnToMenu() {
        console.log('Returning to main menu...');
        this.cleanup();
        this.currentGameMode = null;
        
        // Reinitialize the game mode selector
        if (this.gameModeSelector) {
            this.gameModeSelector.show();
        } else {
            // If selector was destroyed, reload the page
            location.reload();
        }
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        if (this.currentGameMode === 'singleplayer' && this.singlePlayerGame) {
            this.singlePlayerGame.onWindowResize();
        } else if (this.currentGameMode === 'multiplayer' && this.multiplayerGame) {
            this.multiplayerGame.onWindowResize();
        }
    }

    /**
     * Get current game mode
     */
    getCurrentGameMode() {
        return this.currentGameMode;
    }

    /**
     * Check if a game is currently active
     */
    isGameActive() {
        return this.singlePlayerGame !== null || this.multiplayerGame !== null;
    }

    /**
     * Cleanup single player game
     */
    cleanupSinglePlayer() {
        if (this.singlePlayerGame) {
            this.singlePlayerGame.cleanup();
            this.singlePlayerGame = null;
        }
    }

    /**
     * Cleanup multiplayer game
     */
    cleanupMultiplayer() {
        if (this.multiplayerGame) {
            this.multiplayerGame.cleanup();
            this.multiplayerGame = null;
        }
    }

    /**
     * Cleanup all game instances
     */
    cleanup() {
        console.log('Cleaning up GameModeManager...');
        
        this.cleanupSinglePlayer();
        this.cleanupMultiplayer();
        
        // Note: We don't cleanup UI components (gameModeSelector, loadingScreen)
        // as they may be reused when returning to menu
        
        console.log('GameModeManager cleanup complete');
    }

    /**
     * Complete shutdown and cleanup
     */
    destroy() {
        console.log('Destroying GameModeManager...');
        
        this.cleanup();
        
        // Cleanup UI components
        if (this.gameModeSelector) {
            this.gameModeSelector.cleanup?.();
            this.gameModeSelector = null;
        }
        
        if (this.loadingScreen) {
            this.loadingScreen.cleanup?.();
            this.loadingScreen = null;
        }
        
        this.isInitialized = false;
        console.log('GameModeManager destroyed');
    }
} 