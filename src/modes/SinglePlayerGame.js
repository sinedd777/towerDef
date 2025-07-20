import * as THREE from 'three';
import { Enemy } from '../Enemy.js';
import { GameState } from '../GameState.js';
import { InputManager } from '../input/InputManager.js';
import { MazeState } from '../mazeBuilder/MazeState.js';
import { MazeBuilderUI } from '../mazeBuilder/MazeBuilderUI.js';
import { MazeInputManager } from '../mazeBuilder/MazeInputManager.js';
import { Pathfinding } from '../Pathfinding.js';
import { TowerSelectionUI } from '../ui/TowerSelectionUI.js';
import { TowerManagementUI } from '../ui/TowerManagementUI.js';
import { TOWER_TYPES } from '../TowerTypes.js';
import { assetManager } from '../managers/AssetManager.js';
import { LoadingScreen } from '../ui/LoadingScreen.js';
import { EnvironmentManager } from '../managers/EnvironmentManager.js';
import { objectPool } from '../managers/ObjectPool.js';
import { ParticleSystem } from '../effects/ParticleSystem.js';
import { SceneSetup } from '../core/SceneSetup.js';
import { GameSummaryUI } from '../ui/GameSummaryUI.js';
import { Modal } from '../ui/Modal.js';
import { WaveCountdownUI } from '../ui/TurnIndicatorUI.js';

export class SinglePlayerGame {
    constructor() {
        // Core systems
        this.sceneSetup = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.labelRenderer = null;
        this.controls = null;
        this.ground = null;
        
        // Game systems
        this.gameState = null;
        this.mazeState = null;
        this.pathfinding = null;
        this.environmentManager = null;
        this.particleSystem = null;
        
        // UI systems
        this.mazeBuilderUI = null;
        this.towerSelectionUI = null;
        this.towerManagementUI = null;
        this.loadingScreen = null;
        this.gameSummaryUI = null;  // Add game summary UI
        this.infoModal = new Modal();
        
        // Add wave countdown UI
        this.waveCountdownUI = new WaveCountdownUI();
        
        // Show info modal with game objectives and strategy tips
        const modalContent = `
            <div class="modal-info">
                <div class="modal-section">
                    <h3>🎯 Objective</h3>
                    <p>Survive as long as possible and accumulate the highest score!</p>
                </div>

                <div class="modal-section">
                    <h3>🏗️ Build Phase</h3>
                    <p>Use the build phase wisely to create a maze that forces enemies to take longer paths to reach the end.</p>
                </div>

                <div class="modal-section">
                    <h3>⚔️ Game Mechanics</h3>
                    <ul>
                        <li>Towers can be upgraded to increase their power</li>
                        <li>Your resources are limited - spend wisely!</li>
                        <li>Enemies deal damage to your base</li>
                        <li>Base Health starts at 100</li>
                    </ul>
                </div>

                <div class="modal-section">
                    <h3>⚡ Strategic Tips</h3>
                    <ul>
                        <li>Enemies become stronger with each wave</li>
                        <li>Every 5 waves, you get to place a new shape - plan ahead!</li>
                        <li>Use <span class="key">T</span> to select shape type and <span class="key">R</span> to rotate shapes</li>
                    </ul>
                </div>
            </div>
        `;
        
        this.infoModal.show('Welcome Commander', modalContent);
        
        // Input managers
        this.inputManager = null;
        this.mazeInputManager = null;
        
        // Game objects
        this.enemies = [];
        this.towers = [];
        
        // Game constants
        this.enemyStartPosition = new THREE.Vector3(-8, 1.0, -8);
        this.enemyEndPosition = new THREE.Vector3(8, 1.0, 8);
        this.lastEnemySpawn = 0;
        this.enemySpawnInterval = 2000;
        
        // Path visualization
        this.pathLine = null;
        
        // Game loop
        this.isRunning = false;
        this.animationId = null;
    }

    async initialize(loadingScreen = null) {
        // Use provided loading screen or create new one
        this.loadingScreen = loadingScreen || new LoadingScreen();
        if (!loadingScreen) {
            this.loadingScreen.show();
        }
        this.loadingScreen.setStatus('Initializing single player game...');

        // Setup scene
        this.sceneSetup = new SceneSetup();
        const sceneComponents = this.sceneSetup.initialize(true);
        
        this.scene = sceneComponents.scene;
        this.camera = sceneComponents.camera;
        this.renderer = sceneComponents.renderer;
        this.labelRenderer = sceneComponents.labelRenderer;
        this.controls = sceneComponents.controls;
        this.ground = sceneComponents.ground;

        // Initialize game systems
        this.gameState = new GameState();
        this.mazeState = new MazeState(this.scene, 20);
        this.pathfinding = new Pathfinding(20);
        this.environmentManager = new EnvironmentManager(this.scene, 20);
        this.particleSystem = new ParticleSystem(this.scene);

        // Initialize UI systems
        this.towerSelectionUI = new TowerSelectionUI(this.gameState);
        this.towerManagementUI = new TowerManagementUI(this.gameState, this.labelRenderer, this.camera);
                    this.mazeBuilderUI = new MazeBuilderUI(this.mazeState, this.gameState, false);  // false = single player mode

        // Initialize game summary UI
        this.gameSummaryUI = new GameSummaryUI();

        // Setup UI callbacks
        this.setupUICallbacks();

        // Initialize maze input manager for building phase
        this.initializeMazeInput();

        // Hide tower selection UI initially (show only during defense phase)
        this.towerSelectionUI.hide();

        // Listen for tower updates
        document.addEventListener('towersUpdated', (event) => {
            this.towerSelectionUI.updateTowerMenu();
        });

        // Hide loading screen
        this.loadingScreen.hide();
        
        console.log('Single player game initialized');
    }

    start() {
        this.isRunning = true;
        this.gameLoop();
        console.log('Single player game started');
    }

    setupUICallbacks() {
        // Setup maze builder callbacks
        this.mazeBuilderUI.setOnStartDefenseCallback(() => {
            this.startDefensePhase();
        });

        // Listen for phase changes
        document.addEventListener('phaseChanged', (event) => {
            if (event.detail === 'MAZE_BUILDING') {
                this.startBuildingPhase();
            }
        });
    }

    initializeMazeInput() {
        if (this.mazeInputManager) {
            this.mazeInputManager.cleanup();
        }
        this.mazeInputManager = new MazeInputManager(
            this.scene, 
            this.camera, 
            this.renderer, 
            this.ground, 
            this.mazeState, 
            this.mazeBuilderUI
        );
    }

    initializeTowerInput() {
        if (this.inputManager) return; // Already initialized
        
        // Get current path for tower placement validation
        const currentPath = this.pathfinding.findPath(
            { x: this.enemyStartPosition.x, z: this.enemyStartPosition.z },
            { x: this.enemyEndPosition.x, z: this.enemyEndPosition.z },
            this.getAllObstacles(),
            1.0  // Use y=1.0 for single player enemies
        );
        
        this.inputManager = new InputManager(
            this.scene,
            this.camera,
            this.renderer,
            this.gameState,
            this.ground,
            currentPath,
            this.towers,
            this.mazeState
        );
        
        // Initialize basic towers
        const basicTowers = Object.values(TOWER_TYPES);
        this.towerSelectionUI.updateBasicTowerGrid(basicTowers);
        
        // Setup system callbacks
        this.towerSelectionUI.setOnTowerSelectedCallback((towerData) => {
            this.inputManager.setSelectedTowerData(towerData);
        });

        this.inputManager.setOnTowerMenuUpdateCallback(() => {
            this.towerSelectionUI.updateTowerMenu();
        });
        
        // Setup tower management callbacks
        this.inputManager.setOnTowerSelectedCallback((tower) => {
            this.towerManagementUI.showPanel(tower);
        });
        
        this.inputManager.setOnTowerDeselectedCallback((tower) => {
            this.towerManagementUI.hidePanel();
        });
        
        this.towerManagementUI.setOnTowerUpgradeCallback((tower) => {
            this.towerSelectionUI.updateTowerMenu();
        });
        
        this.towerManagementUI.setOnTowerDestroyCallback((tower) => {
            this.destroyTower(tower);
        });
    }

    destroyTower(tower) {
        // Remove tower from arrays and scene
        const index = this.towers.indexOf(tower);
        if (index > -1) {
            this.towers.splice(index, 1);
            this.scene.remove(tower.mesh);
            
            // Clean up tower resources
            tower.mesh.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
        
        // Update UI
        this.towerSelectionUI.updateTowerMenu();
    }

    getAllObstacles() {
        const obstacles = [];
        
        // Add maze blocks
        const mazeObstacles = this.mazeState.getObstacles();
        obstacles.push(...mazeObstacles);
        
        // Add towers
        for (const tower of this.towers) {
            const pos = tower.getPosition();
            obstacles.push({ x: pos.x, z: pos.z });
        }
        
        return obstacles;
    }

    startDefensePhase() {
        console.log('Starting defense phase...');
        
        // Calculate initial path
        const obstacles = this.getAllObstacles();
        const initialPath = this.pathfinding.findPath(
            { x: this.enemyStartPosition.x, z: this.enemyStartPosition.z },
            { x: this.enemyEndPosition.x, z: this.enemyEndPosition.z },
            obstacles,
            1.0  // Use y=1.0 for single player enemies
        );

        // Check if there's a valid path before starting defense phase
        if (!initialPath) {
            console.error('No valid path exists from start to end! Cannot start defense phase.');
            alert('Cannot start defense phase: No valid path exists from start to end. Please ensure there is a path through your maze.');
            return;
        }
        
        // Transition game state
        this.gameState.startDefensePhase();
        
        // Hide maze builder UI
        this.mazeBuilderUI.hide();
        
        // Show tower selection UI and add single-player class
        this.towerSelectionUI.show();
        document.getElementById('basic-tower-menu').classList.add('single-player');
        
        // Cleanup maze input and initialize tower input
        if (this.mazeInputManager) {
            this.mazeInputManager.cleanup();
            this.mazeInputManager = null;
        }
        
        this.initializeTowerInput();
        
        // Update path visualization with the valid path
        this.updatePathVisualization(initialPath);
        
        // Initialize environment with obstacles and spawn points
        this.environmentManager.initializeEnvironment(obstacles, this.enemyStartPosition, this.enemyEndPosition);

        // Start first wave with countdown
        this.gameState.startFirstWaveCountdown();
        
        console.log('Defense phase started');
    }

    startBuildingPhase() {
        console.log('Starting building phase...');
        
        // Hide tower selection UI and remove single-player class
        this.towerSelectionUI.hide();
        document.getElementById('basic-tower-menu').classList.remove('single-player');
        
        // Prepare maze state for building
        this.mazeState.prepareForBuilding();
        
        // Show maze builder UI
        this.mazeBuilderUI.show();
        
        // Cleanup tower input and initialize maze input
        if (this.inputManager) {
            this.inputManager.destroy();
            this.inputManager = null;
        }
        
        this.initializeMazeInput();
        
        // Update path visualization
        const obstacles = this.getAllObstacles();
        const currentPath = this.pathfinding.findPath(
            { x: this.enemyStartPosition.x, z: this.enemyStartPosition.z },
            { x: this.enemyEndPosition.x, z: this.enemyEndPosition.z },
            obstacles,
            1.0  // Use y=1.0 for single player enemies
        );
        this.updatePathVisualization(currentPath);
        
        // Show message to player using modal only every 5 waves
        if (this.gameState.wave > 1 && this.gameState.wave % 5 === 0) {
            const modalContent = `
                <div class="modal-info">
                    <div class="modal-section">
                        <h3>🎉 Wave ${this.gameState.wave} Complete!</h3>
                        <p>Congratulations, Commander! You've survived ${this.gameState.wave} waves.</p>
                        <p>You've reached a milestone! As a reward, you can now add a new shape to strengthen your maze.</p>
                        <p>Use <span class="key">T</span> to select shape type and <span class="key">R</span> to rotate it.</p>
                    </div>
                </div>
            `;
            this.infoModal.show('New Shape Available', modalContent);
        }
        
        console.log('Building phase started');
    }

    updatePathVisualization(waypoints) {
        // Remove existing path line
        if (this.pathLine) {
            this.scene.remove(this.pathLine);
            this.pathLine.geometry.dispose();
            this.pathLine.material.dispose();
            this.pathLine = null;
        }

        // Only create new path line if waypoints exist
        if (waypoints && waypoints.length > 0) {
            // Extract just the position vectors from the waypoints
            const positions = waypoints.map(waypoint => {
                // Handle both simple Vector3 waypoints and complex waypoints with turn info
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
            // Required for dashed lines to appear
            this.pathLine.computeLineDistances();
            this.scene.add(this.pathLine);
        }
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.animationId = requestAnimationFrame(() => this.gameLoop());
        
        const currentTime = Date.now();
        
        // Update wave countdown if in cooldown
        if (this.gameState.isWaveCoolingDown()) {
            const timeLeft = (this.gameState.getWaveCooldownEnd() - currentTime) / 1000; // Convert to seconds
            this.waveCountdownUI.show(timeLeft);
        } else {
            this.waveCountdownUI.hide();
        }

        // Animate dashed line
        if (this.pathLine) {
            // Move dash offset to create motion illusion
            this.pathLine.material.dashOffset -= 0.02;
        }

        // Display path continuously during maze building
        if (this.gameState.isMazeBuilding()) {
            const obstacles = this.getAllObstacles();
            const currentPath = this.pathfinding.findPath(
                { x: this.enemyStartPosition.x, z: this.enemyStartPosition.z },
                { x: this.enemyEndPosition.x, z: this.enemyEndPosition.z },
                obstacles,
                1.0  // Use y=1.0 for single player enemies
            );
            this.updatePathVisualization(currentPath);
        }

        // Only spawn enemies during defense phase
        if (this.gameState.isDefensePhase() && currentTime - this.lastEnemySpawn > this.enemySpawnInterval && this.gameState.canSpawnMore()) {
            const currentWave = this.gameState.getWave();
            
            // Calculate path considering all current obstacles
            const obstacles = this.getAllObstacles();
            const path = this.pathfinding.findPath(
                { x: this.enemyStartPosition.x, z: this.enemyStartPosition.z },
                { x: this.enemyEndPosition.x, z: this.enemyEndPosition.z },
                obstacles,
                1.0  // Use y=1.0 for single player enemies
            );
            
            // Only spawn enemy and update visualization if a valid path exists
            if (path) {
                // Update path visualization
                this.updatePathVisualization(path);
                
                // Create enemy with calculated path
                const enemy = new Enemy(path, currentWave);
                this.enemies.push(enemy);
                this.scene.add(enemy.mesh);
                this.lastEnemySpawn = currentTime;
                this.gameState.addEnemy();
            } else {
                // If no valid path exists, clear path visualization
                if (this.pathLine) {
                    this.scene.remove(this.pathLine);
                    this.pathLine = null;
                }
            }
        }

        this.updateEnemies();
        this.updateTowers();
        this.updateProjectiles();

        // Update controls
        if (this.controls) {
            this.controls.update();
        }

        // Update renderers
        this.renderer.render(this.scene, this.camera);
        if (this.labelRenderer) {
            this.labelRenderer.render(this.scene, this.camera);
        }
    }

    updateEnemies() {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update();

            // Check if enemy reached end
            if (enemy.hasReachedEnd()) {
                console.log('Enemy reached end! Health lost.');
                enemy.cleanup();
                this.scene.remove(enemy.mesh);
                this.enemies.splice(i, 1);
                
                this.gameState.loseHealth(10);
                this.gameState.removeEnemy();
                
                // Check if game over
                if (this.gameState.health <= 0) {
                    console.log('Game Over!');
                    this.handleGameOver(false); // Game over - defeat
                }
                
                continue;
            }

            // Check if enemy is dead
            if (!enemy.isAlive()) {
                // Create death particles
                this.particleSystem.createExplosion(enemy.mesh.position, 0.8, new THREE.Color(0xff3300));
                
                console.log('Enemy defeated! Score increased.');
                enemy.cleanup();
                this.scene.remove(enemy.mesh);
                this.enemies.splice(i, 1);
                this.gameState.addScore(10);
                this.gameState.addMoney(5);
                this.gameState.removeEnemy();

                // Check if wave is complete and no more enemies can spawn
                if (this.enemies.length === 0 && !this.gameState.canSpawnMore()) {
                    // Check if player has survived all waves (e.g., 10 waves)
                    if (this.gameState.wave >= 10) {
                        this.handleGameOver(true); // Victory!
                    }
                }
                continue;
            }
        }
    }

    updateTowers() {
        for (const tower of this.towers) {
            // Handle different tower types
            if (tower.type === 'area') {
                // Area tower logic - pass all enemies for area effect
                if (tower.canShoot()) {
                    const deadEnemies = tower.shoot(this.enemies);
                    if (deadEnemies && deadEnemies.length > 0) {
                        // Remove dead enemies
                        for (const deadEnemy of deadEnemies) {
                            const index = this.enemies.indexOf(deadEnemy);
                            if (index !== -1) {
                                deadEnemy.cleanup();
                                this.scene.remove(deadEnemy.mesh);
                                this.enemies.splice(index, 1);
                                this.gameState.removeEnemy();
                                this.gameState.addMoney(10);
                                this.gameState.addScore(100);
                            }
                        }
                    }
                }
            } else {
                // Regular tower logic
                const target = tower.findTarget(this.enemies);
                if (target && tower.canShoot()) {
                    const projectile = tower.shoot(target);
                    if (projectile) {
                        this.scene.add(projectile.mesh);
                    }
                }
            }
        }
    }

    updateProjectiles() {
        const activeProjectiles = objectPool.getActiveProjectiles();
        for (let i = activeProjectiles.length - 1; i >= 0; i--) {
            const projectile = activeProjectiles[i];
            projectile.update();
            
            const hit = projectile.hasHitTarget();
            const shouldRemove = hit || projectile.shouldRemove();
            
            if (shouldRemove) {
                if (hit) {
                    const target = projectile.target;
                    if (target && target.isAlive()) {
                        // Apply damage to main target
                        const isDead = target.takeDamage(projectile.damage);
                        
                        if (isDead) {
                            const index = this.enemies.indexOf(target);
                            if (index !== -1) {
                                // Create death effect before cleanup
                                const enemyPos = target.mesh.position;
                                this.particleSystem.createExplosion(enemyPos, 0.8, new THREE.Color(0xff3300));
                                
                                target.cleanup();
                                this.scene.remove(target.mesh);
                                this.enemies.splice(index, 1);
                                this.gameState.removeEnemy();
                                this.gameState.addMoney(10);
                                this.gameState.addScore(100);
                            }
                        }
                        
                        // Handle splash damage if applicable
                        const splashTargets = projectile.getSplashTargets(this.enemies);
                        for (const splashTarget of splashTargets) {
                            const isDead = splashTarget.takeDamage(projectile.damage * 0.5);
                            
                            if (isDead) {
                                const index = this.enemies.indexOf(splashTarget);
                                if (index !== -1) {
                                    // Create death effect for splash target
                                    const splashPos = splashTarget.mesh.position;
                                    this.particleSystem.createExplosion(splashPos, 0.6, new THREE.Color(0xff3300));
                                    
                                    splashTarget.cleanup();
                                    this.scene.remove(splashTarget.mesh);
                                    this.enemies.splice(index, 1);
                                    this.gameState.removeEnemy();
                                    this.gameState.addMoney(10);
                                    this.gameState.addScore(100);
                                }
                            }
                        }
                    }
                }
                
                // Remove from scene and return to pool
                this.scene.remove(projectile.mesh);
                objectPool.returnProjectile(projectile);
            }
        }
    }

    onWindowResize() {
        if (this.sceneSetup) {
            this.sceneSetup.onWindowResize();
        }
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        console.log('Single player game stopped');
    }

    handleGameOver(isVictory) {
        // Stop the game
        this.stop();

        // Get final stats
        const stats = {
            wave: this.gameState.wave,
            score: this.gameState.score,
            money: this.gameState.money,
            health: this.gameState.health
        };

        // Show game summary
        this.gameSummaryUI.show(stats, isVictory);
    }

    cleanup() {
        this.stop();
        
        // Cleanup UI
        if (this.mazeBuilderUI) this.mazeBuilderUI.cleanup?.();
        if (this.towerSelectionUI) this.towerSelectionUI.cleanup?.();
        if (this.towerManagementUI) this.towerManagementUI.cleanup?.();
        if (this.loadingScreen) this.loadingScreen.cleanup?.();
        if (this.gameSummaryUI) {
            this.gameSummaryUI.cleanup();
            this.gameSummaryUI = null;
        }
        if (this.infoModal) {
            this.infoModal.destroy();
            this.infoModal = null;
        }
        if (this.waveCountdownUI) {
            this.waveCountdownUI.cleanup();
            this.waveCountdownUI = null;
        }
        
        // Cleanup input managers
        if (this.inputManager) this.inputManager.destroy?.();
        if (this.mazeInputManager) this.mazeInputManager.cleanup();
        
        // Cleanup scene
        if (this.sceneSetup) {
            this.sceneSetup.dispose();
        }
        
        // Clear arrays
        this.enemies.length = 0;
        this.towers.length = 0;
        
        console.log('Single player game cleaned up');
    }
} 