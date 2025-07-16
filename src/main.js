import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { Tower } from './Tower.js';
import { Projectile } from './Projectile.js';
import { GameState } from './GameState.js';
import { TOWER_TYPES } from './TowerTypes.js';
import { ELEMENTS, getElementalDamage, getTowerById, getUpgradeOptions } from './Elements.js';
import { ElementManager } from './ElementManager.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { TowerSelectionUI } from './ui/TowerSelectionUI.js';
import { InputManager } from './input/InputManager.js';
import { isDebugEnabled, debugLog } from './config/DebugConfig.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Set background color to dark blue for visibility
renderer.setClearColor(0x001133);

// CSS2D renderer setup (conditionally for debug labels)
let labelRenderer = null;
if (isDebugEnabled('ENABLE_DEBUG_LABELS')) {
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.body.appendChild(labelRenderer.domElement);
}

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Game state
const gameState = new GameState();

// Element Manager - Initialize after gameState
const elementManager = new ElementManager(gameState, scene);

// UI System initialization
const towerSelectionUI = new TowerSelectionUI(gameState);

// Initialize basic towers
const basicTowers = Object.values(TOWER_TYPES);
towerSelectionUI.updateBasicTowerGrid(basicTowers);

// Listen for tower updates
document.addEventListener('towersUpdated', (event) => {
    towerSelectionUI.updateTowerSelectionUI(event.detail.availableTowers, event.detail.unlockedElements);
});

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 5);
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

// Camera position
camera.position.set(0, 12, 8);
camera.lookAt(0, 0, 0);

// Path waypoints (hardcoded for simplicity)
const pathWaypoints = [
    new THREE.Vector3(-8, 0.1, -8),
    new THREE.Vector3(-8, 0.1, 0),
    new THREE.Vector3(0, 0.1, 0),
    new THREE.Vector3(0, 0.1, 4),
    new THREE.Vector3(8, 0.1, 4),
    new THREE.Vector3(8, 0.1, 8)
];

// Visualize path
const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathWaypoints);
const pathMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
const pathLine = new THREE.Line(pathGeometry, pathMaterial);
scene.add(pathLine);

// Grid visualization (for tower placement)
const gridSize = 20;
const gridDivisions = 20;
const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0x444444);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// Arrays to hold game objects
const enemies = [];
const towers = [];
const projectiles = [];

// Enemy spawning
let lastEnemySpawn = 0;
const enemySpawnInterval = 2000; // 2 seconds

// Input Manager - Initialize after scene and UI setup
const inputManager = new InputManager(scene, camera, renderer, gameState, ground, pathWaypoints, towers);

// Setup system callbacks
towerSelectionUI.setOnTowerSelectedCallback((towerData) => {
    inputManager.setSelectedTowerData(towerData);
});

inputManager.setOnTowerMenuUpdateCallback(() => {
    towerSelectionUI.updateTowerMenu();
});



// Game loop
function animate() {
    requestAnimationFrame(animate);
    
    const currentTime = Date.now();
    
    // Spawn enemies
    if (currentTime - lastEnemySpawn > enemySpawnInterval) {
        const currentWave = gameState.getWave();
        const enemy = new Enemy(pathWaypoints, currentWave);
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
    
    // Update towers (check for targets and shoot)
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
        
        // Check collision with target
        if (projectile.hasHitTarget()) {
            // Handle splash damage for area towers
            if (projectile.splashRadius > 0) {
                const splashTargets = projectile.getSplashTargets(enemies);
                for (const splashTarget of splashTargets) {
                    // Apply splash damage with elemental effects
                    projectile.applyDamage(splashTarget);
                    if (!splashTarget.isAlive()) {
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
            
            // Handle direct hit with elemental effects
            const enemyIndex = enemies.indexOf(projectile.target);
            if (enemyIndex !== -1) {
                // Apply damage and elemental effects
                projectile.applyDamage(projectile.target);
                if (!projectile.target.isAlive()) {
                    projectile.target.cleanup();
                    scene.remove(projectile.target.mesh);
                    enemies.splice(enemyIndex, 1);
                    gameState.removeEnemy();
                    gameState.addMoney(10);
                    gameState.addScore(100);
                }
            }
            
            // Create impact effect
            const impactEffect = projectile.createImpactEffect();
            if (impactEffect) {
                scene.add(impactEffect);
            }
            
            // Remove projectile
            scene.remove(projectile.mesh);
            projectiles.splice(i, 1);
        } else if (projectile.shouldRemove()) {
            // Remove projectile if it's gone too far
            scene.remove(projectile.mesh);
            projectiles.splice(i, 1);
        }
    }
    
    // Update HUD and tower menu
    gameState.updateHUD();
    towerSelectionUI.updateTowerMenu();
    
    // Render scene and labels
    renderer.render(scene, camera);
    if (labelRenderer) {
        labelRenderer.render(scene, camera);
    }
}

// Start the game
animate(); 