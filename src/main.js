/**
 * Tower Defense Game - Main Entry Point
 * 
 * This is the minimal entry point for the Tower Defense game.
 * All game logic is handled by specialized modules:
 * - GameModeManager: Handles mode selection and routing
 * - SinglePlayerGame: Complete single player implementation  
 * - MultiplayerGame: Complete multiplayer implementation
 * - SceneSetup: Shared 3D scene and rendering setup
 */

import { GameModeManager } from './core/GameModeManager.js';
import './styles/multiplayer.css';

class TowerDefenseApp {
    constructor() {
        this.gameModeManager = null;
    }

    /**
     * Initialize the application
     */
    initialize() {
        console.log('🎮 Starting Tower Defense Game...');
        
        try {
            // Create and initialize the game mode manager
            this.gameModeManager = new GameModeManager();
            this.gameModeManager.initialize();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('✅ Tower Defense Game initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Tower Defense Game:', error);
            alert('Failed to start the game. Please refresh the page.');
        }
    }

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.gameModeManager) {
                this.gameModeManager.onWindowResize();
            }
        });

        // Handle page unload cleanup
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    /**
     * Cleanup application resources
     */
    cleanup() {
        if (this.gameModeManager) {
            this.gameModeManager.destroy();
            this.gameModeManager = null;
        }
    }
}

// Create and start the application
const app = new TowerDefenseApp();
app.initialize(); 