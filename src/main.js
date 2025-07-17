import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Enemy } from './Enemy.js';
import { GameState } from './GameState.js';
import { InputManager } from './input/InputManager.js';
import { MazeState } from './mazeBuilder/MazeState.js';
import { MazeBuilderUI } from './mazeBuilder/MazeBuilderUI.js';
import { MazeInputManager } from './mazeBuilder/MazeInputManager.js';
import { Pathfinding } from './Pathfinding.js';
import { TowerSelectionUI } from './ui/TowerSelectionUI.js';
import { TOWER_TYPES } from './TowerTypes.js';
import { loadTexture } from './utils/textureLoader.js';
import { assetManager } from './managers/AssetManager.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { EnvironmentManager } from './managers/EnvironmentManager.js';
import { objectPool } from './managers/ObjectPool.js';
import { ParticleSystem } from './effects/ParticleSystem.js';

// Initialize loading screen
const loadingScreen = new LoadingScreen();
loadingScreen.show();

// Preload all assets before starting the game
async function initializeGame() {
    try {
        loadingScreen.setStatus('Loading 3D models...');
        
        // Preload essential assets
        await assetManager.preloadEssentialAssets((loaded, total, currentAsset) => {
            loadingScreen.updateProgress(loaded, total, currentAsset);
        });
        
        loadingScreen.setStatus('Initializing game systems...');
        loadingScreen.updateProgress(100, 100, 'Complete!');
        
        // Small delay to show completion
        setTimeout(() => {
            loadingScreen.hide();
            startGame();
        }, 500);
        
    } catch (error) {
        console.error('Failed to load game assets:', error);
        loadingScreen.setStatus('Failed to load game assets. Please refresh the page.');
    }
}

// Start the actual game after assets are loaded
function startGame() {
    initializeGameSystems();
}

// Initialize all game systems
function initializeGameSystems() {
// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Enhanced shadow and rendering settings
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.6; // Increased for brighter overall appearance

// Enable depth testing and writing
renderer.sortObjects = true;
renderer.setClearColor(0x000000, 1); // Black background
document.body.appendChild(renderer.domElement);

// CSS2D renderer for labels
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

// Camera setup
camera.position.set(0, 20, 15);
camera.lookAt(0, 0, 0);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 5;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI / 2.1; // Prevent camera from going below ground
controls.update();

// Game state
const gameState = new GameState();

// Maze Builder System
const mazeState = new MazeState(scene, 20);
const mazeBuilderUI = new MazeBuilderUI(mazeState, gameState);

// Input Managers
let inputManager = null;
let mazeInputManager = null;

// Pathfinding system
const pathfinding = new Pathfinding(20);

// UI System initialization
const towerSelectionUI = new TowerSelectionUI(gameState);

// Listen for tower updates
document.addEventListener('towersUpdated', (event) => {
    towerSelectionUI.updateTowerMenu();
});

// Enhanced lighting setup for 3D models - much brighter for Kenney assets
const ambientLight = new THREE.AmbientLight(0x606060, 0.8); // Increased for brighter overall lighting
scene.add(ambientLight);

// Main directional light (sun) - increased intensity
const mainLight = new THREE.DirectionalLight(0xffffff, 1.4);
mainLight.position.set(10, 15, 8);
mainLight.castShadow = true;

// Enhanced shadow settings
mainLight.shadow.mapSize.width = 4096;
mainLight.shadow.mapSize.height = 4096;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 50;
mainLight.shadow.camera.left = -25;
mainLight.shadow.camera.right = 25;
mainLight.shadow.camera.top = 25;
mainLight.shadow.camera.bottom = -25;
mainLight.shadow.bias = -0.0001;
mainLight.shadow.normalBias = 0.02;

scene.add(mainLight);

// Secondary fill light for softer shadows - increased intensity
const fillLight = new THREE.DirectionalLight(0x4444ff, 0.3); // Subtle blue tint
fillLight.position.set(-8, 8, -8);
scene.add(fillLight);

// Rim light for model definition - increased intensity
const rimLight = new THREE.DirectionalLight(0xffd700, 0.4); // Golden rim light, brighter
rimLight.position.set(0, 5, -10);
scene.add(rimLight);

// Point light for dynamic illumination near spawn points
const spawnLight = new THREE.PointLight(0x00ff00, 0.5, 10);
spawnLight.position.set(-8, 2, -8); // Near enemy spawn
scene.add(spawnLight);

const endLight = new THREE.PointLight(0xff0000, 0.5, 10);
endLight.position.set(8, 2, 8); // Near enemy end
scene.add(endLight);

// Ground plane
const groundGeometry = new THREE.PlaneGeometry(20, 20);
// Use a seamless grass texture from the web (small size, CORS-enabled)
const grassTexture = loadTexture('https://threejs.org/examples/textures/terrain/grasslight-big.jpg', 10, 10);
const groundMaterial = new THREE.MeshLambertMaterial({ map: grassTexture });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Enemy spawn and end positions
const enemyStartPosition = new THREE.Vector3(-8, 0.1, -8);
const enemyEndPosition = new THREE.Vector3(8, 0.1, 8);

// Path visualization
let pathLine = null;
function updatePathVisualization(waypoints) {
    // Remove existing path line
    if (pathLine) {
        scene.remove(pathLine);
        pathLine.geometry.dispose();
        pathLine.material.dispose();
        pathLine = null;
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
            dashSize: 0.4,
            gapSize: 0.4,
            transparent: true,
            opacity: 0.8
        });

        pathLine = new THREE.Line(pathGeometry, pathMaterial);
        // Required for dashed lines to appear
        pathLine.computeLineDistances();
        scene.add(pathLine);
    }
}

// // Grid visualization (for tower placement)
// const gridSize = 20;
// const gridDivisions = 20;
// const gridHelper = new THREE.GridHelper(gridSize, gridDivisions);
// gridHelper.position.y = 0.01;
// scene.add(gridHelper);

// Arrays to hold game objects
const enemies = [];
const towers = [];

// Environment manager
const environmentManager = new EnvironmentManager(scene, 20);

// Particle system for visual effects
const particleSystem = new ParticleSystem(scene);

// Enemy spawning
let lastEnemySpawn = 0;
const enemySpawnInterval = 2000; // 2 seconds

// Get all obstacles (maze blocks and towers)
function getAllObstacles() {
    const obstacles = [];
    
    // Add maze blocks
    const mazeObstacles = mazeState.getObstacles();
    obstacles.push(...mazeObstacles);
    
    // Add towers
    for (const tower of towers) {
        const pos = tower.getPosition();
        obstacles.push({ x: pos.x, z: pos.z });
    }
    
    return obstacles;
}

// Phase transition function
function startDefensePhase() {
    console.log('Starting defense phase...');
    
    // Calculate initial path
    const obstacles = getAllObstacles();
    const initialPath = pathfinding.findPath(
        { x: enemyStartPosition.x, z: enemyStartPosition.z },
        { x: enemyEndPosition.x, z: enemyEndPosition.z },
        obstacles
    );

    // Check if there's a valid path before starting defense phase
    if (!initialPath) {
        console.error('No valid path exists from start to end! Cannot start defense phase.');
        alert('Cannot start defense phase: No valid path exists from start to end. Please ensure there is a path through your maze.');
        return;
    }
    
    // Transition game state
    gameState.startDefensePhase();
    
    // Hide maze builder UI
    mazeBuilderUI.hide();
    
    // Show tower selection UI
    towerSelectionUI.show();
    
    // Cleanup maze input and initialize tower input
    if (mazeInputManager) {
        mazeInputManager.cleanup();
        mazeInputManager = null;
    }
    
    initializeTowerInput();
    
    // Update path visualization with the valid path
    updatePathVisualization(initialPath);
    
    // Initialize environment with obstacles and spawn points
    environmentManager.initializeEnvironment(obstacles, enemyStartPosition, enemyEndPosition);
    
    console.log('Defense phase started');
}

// Initialize maze input manager initially
function initializeMazeInput() {
    if (mazeInputManager) {
        mazeInputManager.cleanup();
    }
    mazeInputManager = new MazeInputManager(scene, camera, renderer, ground, mazeState, mazeBuilderUI);
}

// Initialize tower input manager for defense phase
function initializeTowerInput() {
    if (inputManager) return; // Already initialized
    
    // Get current path for tower placement validation
    const currentPath = pathfinding.findPath(
        { x: enemyStartPosition.x, z: enemyStartPosition.z },
        { x: enemyEndPosition.x, z: enemyEndPosition.z },
        getAllObstacles()
    );
    
    inputManager = new InputManager(
        scene,
        camera,
        renderer,
        gameState,
        ground,
        currentPath, // Pass current path waypoints
        towers,
        mazeState // Allow tower validation against maze blocks
    );
    
    // Initialize basic towers
    const basicTowers = Object.values(TOWER_TYPES);
    towerSelectionUI.updateBasicTowerGrid(basicTowers);
    
    // Setup system callbacks
    towerSelectionUI.setOnTowerSelectedCallback((towerData) => {
        inputManager.setSelectedTowerData(towerData);
    });

    inputManager.setOnTowerMenuUpdateCallback(() => {
        towerSelectionUI.updateTowerMenu();
    });
}

// Setup maze builder callbacks
mazeBuilderUI.setOnStartDefenseCallback(() => {
    startDefensePhase();
});

// Start with maze building phase
initializeMazeInput();

// Hide tower selection UI initially (show only during defense phase)
towerSelectionUI.hide();

// Game loop
function animate() {
    requestAnimationFrame(animate);
    
    const currentTime = Date.now();
    
    // Animate dashed line
    if (pathLine) {
        // Move dash offset to create motion illusion
        pathLine.material.dashOffset -= 0.02;
    }

    // Display path continuously during maze building
    if (gameState.isMazeBuilding()) {
        const obstacles = getAllObstacles();
        const currentPath = pathfinding.findPath(
            { x: enemyStartPosition.x, z: enemyStartPosition.z },
            { x: enemyEndPosition.x, z: enemyEndPosition.z },
            obstacles
        );
        updatePathVisualization(currentPath);
    }

    // Only spawn enemies during defense phase
    if (gameState.isDefensePhase() && currentTime - lastEnemySpawn > enemySpawnInterval && gameState.canSpawnMore()) {
        const currentWave = gameState.getWave();
        
        // Calculate path considering all current obstacles
        const obstacles = getAllObstacles();
        const path = pathfinding.findPath(
            { x: enemyStartPosition.x, z: enemyStartPosition.z },
            { x: enemyEndPosition.x, z: enemyEndPosition.z },
            obstacles
        );
        
        // Only spawn enemy and update visualization if a valid path exists
        if (path) {
            // Update path visualization
            updatePathVisualization(path);
            
            // Create enemy with calculated path
            const enemy = new Enemy(path, currentWave);
            enemies.push(enemy);
            scene.add(enemy.mesh);
            lastEnemySpawn = currentTime;
            gameState.addEnemy();
        } else {
            // If no valid path exists, clear path visualization
            if (pathLine) {
                scene.remove(pathLine);
                pathLine = null;
            }
        }
    }
    
    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(enemies); // Pass all enemies for collision avoidance
        
        // Remove enemies that reached the end
        if (enemy.hasReachedEnd()) {
            enemy.cleanup(); // Clean up debug label
            scene.remove(enemy.mesh);
            enemies.splice(i, 1);
            gameState.removeEnemy();
        }
    }
    
    // Update towers
    for (const tower of towers) {
        // Handle different tower types
        if (tower.type === 'area') {
            // Area tower logic - pass all enemies for area effect
            if (tower.canShoot()) {
                const deadEnemies = tower.shoot(enemies);
                if (deadEnemies && deadEnemies.length > 0) {
                    // Remove dead enemies
                    for (const deadEnemy of deadEnemies) {
                        const index = enemies.indexOf(deadEnemy);
                        if (index !== -1) {
                            deadEnemy.cleanup();
                            scene.remove(deadEnemy.mesh);
                            enemies.splice(index, 1);
                            gameState.removeEnemy();
                            gameState.addMoney(10);
                            gameState.addScore(100);
                        }
                    }
                }
            }
        } else {
            // Regular tower logic
            const target = tower.findTarget(enemies);
            if (target && tower.canShoot()) {
                const projectile = tower.shoot(target);
                if (projectile) {
                    scene.add(projectile.mesh);
                }
            }
        }
    }
    
    // Update projectiles using object pool
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
                        const index = enemies.indexOf(target);
                        if (index !== -1) {
                            // Create death effect before cleanup
                            const enemyPos = target.getPosition();
                            const enemySize = 1.0; // Consistent particle effect size
                            particleSystem.createDeathEffect(enemyPos, enemySize);
                            
                            target.cleanup();
                            scene.remove(target.mesh);
                            enemies.splice(index, 1);
                            gameState.removeEnemy();
                            gameState.addMoney(10);
                            gameState.addScore(100);
                        }
                    }
                    
                    // Handle splash damage if applicable
                    const splashTargets = projectile.getSplashTargets(enemies);
                    for (const splashTarget of splashTargets) {
                        const isDead = splashTarget.takeDamage(projectile.damage * 0.5); // 50% splash damage
                        
                        if (isDead) {
                            const index = enemies.indexOf(splashTarget);
                            if (index !== -1) {
                                // Create death effect for splash target
                                const splashPos = splashTarget.getPosition();
                                const splashSize = 0.8; // Consistent smaller particle effect for splash
                                particleSystem.createDeathEffect(splashPos, splashSize);
                                
                                splashTarget.cleanup();
                                scene.remove(splashTarget.mesh);
                                enemies.splice(index, 1);
                                gameState.removeEnemy();
                                gameState.addMoney(10);
                                gameState.addScore(100);
                            }
                        }
                    }
                }
                
                // Create impact effect and sparks
                const impact = projectile.createImpactEffect();
                if (impact) {
                    scene.add(impact);
                }
                
                // Create impact sparks
                const impactPos = projectile.mesh.position.clone();
                const impactDirection = projectile.direction.clone().negate();
                particleSystem.createImpactSparks(impactPos, impactDirection, projectile.towerType);
            }
            
            // Remove from scene and return to pool
            scene.remove(projectile.mesh);
            objectPool.returnProjectile(projectile);
        }
    }
    
    // Update environment animations
    environmentManager.update();
    
    // Update renderers
    renderer.render(scene, camera);
    if (labelRenderer) {
        labelRenderer.render(scene, camera);
    }
}

// Start the game loop
animate();
} // Close initializeGameSystems function

// Start the initialization process
initializeGame(); 