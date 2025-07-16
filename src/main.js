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

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
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

// Initialize basic towers
const basicTowers = Object.values(TOWER_TYPES);
towerSelectionUI.updateBasicTowerGrid(basicTowers);

// Listen for tower updates
document.addEventListener('towersUpdated', (event) => {
    towerSelectionUI.updateTowerMenu();
});

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Ground plane
const groundGeometry = new THREE.PlaneGeometry(20, 20);
const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
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
    if (pathLine) {
        scene.remove(pathLine);
    }
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(waypoints);
    const pathMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
    pathLine = new THREE.Line(pathGeometry, pathMaterial);
    scene.add(pathLine);
}

// Grid visualization (for tower placement)
const gridSize = 20;
const gridDivisions = 20;
const gridHelper = new THREE.GridHelper(gridSize, gridDivisions);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// Arrays to hold game objects
const enemies = [];
const towers = [];
const projectiles = [];

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
    
    // Calculate initial path
    const obstacles = getAllObstacles();
    const initialPath = pathfinding.findPath(
        { x: enemyStartPosition.x, z: enemyStartPosition.z },
        { x: enemyEndPosition.x, z: enemyEndPosition.z },
        obstacles
    );
    updatePathVisualization(initialPath);
    
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
        towers
    );
    
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
    
    // Only spawn enemies during defense phase
    if (gameState.isDefensePhase() && currentTime - lastEnemySpawn > enemySpawnInterval) {
        const currentWave = gameState.getWave();
        
        // Calculate path considering all current obstacles
        const obstacles = getAllObstacles();
        const path = pathfinding.findPath(
            { x: enemyStartPosition.x, z: enemyStartPosition.z },
            { x: enemyEndPosition.x, z: enemyEndPosition.z },
            obstacles
        );
        
        // Update path visualization
        updatePathVisualization(path);
        
        // Create enemy with calculated path
        const enemy = new Enemy(path, currentWave);
        enemies.push(enemy);
        scene.add(enemy.mesh);
        lastEnemySpawn = currentTime;
        gameState.addEnemy();
    }
    
    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();
        
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
                    projectiles.push(projectile);
                    scene.add(projectile.mesh);
                }
            }
        }
    }
    
    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
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
                
                // Create impact effect
                const impact = projectile.createImpactEffect();
                if (impact) {
                    scene.add(impact);
                }
            }
            
            // Clean up projectile
            if (projectile.trail) {
                projectile.mesh.remove(projectile.trail);
            }
            scene.remove(projectile.mesh);
            projectiles.splice(i, 1);
        }
    }
    
    // Update renderers
    renderer.render(scene, camera);
    if (labelRenderer) {
        labelRenderer.render(scene, camera);
    }
}

animate(); 