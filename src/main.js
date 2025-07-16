import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { Tower } from './Tower.js';
import { Projectile } from './Projectile.js';
import { GameState } from './GameState.js';
import { TOWER_TYPES } from './TowerTypes.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Game state
const gameState = new GameState();

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

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Enemy spawning
let lastEnemySpawn = 0;
const enemySpawnInterval = 2000; // 2 seconds

// Tower placement preview
let previewTower = null;
let isDragging = false;
let selectedTowerType = null;

// Add destroy mode state
let isDestroyMode = false;

// Add destroy button to UI
const destroyButton = document.createElement('button');
destroyButton.id = 'destroy-button';
destroyButton.innerHTML = '🗑️ Destroy Tower';
destroyButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 20px;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.3s;
`;
document.body.appendChild(destroyButton);

// Add hover style
destroyButton.addEventListener('mouseover', () => {
    destroyButton.style.background = '#ff6666';
});
destroyButton.addEventListener('mouseout', () => {
    destroyButton.style.background = '#ff4444';
});

// Toggle destroy mode
destroyButton.addEventListener('click', () => {
    isDestroyMode = !isDestroyMode;
    destroyButton.style.background = isDestroyMode ? '#ff6666' : '#ff4444';
    document.body.style.cursor = isDestroyMode ? 'crosshair' : 'default';
    
    // Also update cursor style when clicking on canvas
    renderer.domElement.style.cursor = isDestroyMode ? 'crosshair' : 'default';
});

// Update cursor style when moving between canvas and UI
renderer.domElement.addEventListener('mouseenter', () => {
    if (isDestroyMode) {
        renderer.domElement.style.cursor = 'crosshair';
    }
});

// Add debug wave button
const debugWaveButton = document.createElement('button');
debugWaveButton.id = 'debug-wave-button';
debugWaveButton.innerHTML = '🌊 +5 Waves (Debug)';
debugWaveButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 180px;
    padding: 10px 20px;
    background: #8844ff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.3s;
`;
document.body.appendChild(debugWaveButton);

// Add hover style
debugWaveButton.addEventListener('mouseover', () => {
    debugWaveButton.style.background = '#9955ff';
});
debugWaveButton.addEventListener('mouseout', () => {
    debugWaveButton.style.background = '#8844ff';
});

// Handle wave increment
debugWaveButton.addEventListener('click', () => {
    for (let i = 0; i < 5; i++) {
        gameState.wave++;
    }
    gameState.updateHUD();
    
    // Visual feedback
    debugWaveButton.style.transform = 'scale(1.1)';
    setTimeout(() => {
        debugWaveButton.style.transform = 'scale(1)';
    }, 100);
});

// Update tower menu UI based on available money
function updateTowerMenu() {
    const money = gameState.money;
    document.querySelectorAll('.tower-item').forEach(item => {
        const towerType = TOWER_TYPES[item.dataset.tower.toUpperCase()];
        if (money < towerType.cost) {
            item.classList.add('cannot-afford');
        } else {
            item.classList.remove('cannot-afford');
        }
    });
}

// Tower drag start
document.querySelectorAll('.tower-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
        const towerType = item.dataset.tower;
        const towerConfig = TOWER_TYPES[towerType.toUpperCase()];
        
        if (gameState.money >= towerConfig.cost) {
            isDragging = true;
            selectedTowerType = towerType;
            item.classList.add('dragging');
            
            // Create preview tower
            if (previewTower) {
                scene.remove(previewTower.mesh);
            }
            previewTower = new Tower(0, 0.5, 0, towerType);
            previewTower.mesh.material.opacity = 0.5;
            previewTower.mesh.material.transparent = true;
            scene.add(previewTower.mesh);
            
            // Show range indicator
            previewTower.showRangeIndicator();
        }
    });
});

// Mouse move handler
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (isDragging && previewTower) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(ground);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            // Snap to grid
            const gridX = Math.round(point.x);
            const gridZ = Math.round(point.z);
            
            previewTower.mesh.position.set(gridX, 0.5, gridZ);
            
            // Update preview appearance based on valid placement
            if (isValidTowerPosition(gridX, gridZ)) {
                previewTower.mesh.material.color.setHex(0x00ff00);
            } else {
                previewTower.mesh.material.color.setHex(0xff0000);
            }
        }
    }
}

// Mouse up handler
function onMouseUp(event) {
    if (isDragging && previewTower) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(ground);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            const gridX = Math.round(point.x);
            const gridZ = Math.round(point.z);
            
            if (isValidTowerPosition(gridX, gridZ)) {
                const towerConfig = TOWER_TYPES[selectedTowerType.toUpperCase()];
                if (gameState.money >= towerConfig.cost) {
                    // Place the actual tower
                    const tower = new Tower(gridX, 0.5, gridZ, selectedTowerType);
                    towers.push(tower);
                    scene.add(tower.mesh);
                    gameState.spendMoney(towerConfig.cost);
                    updateTowerMenu();
                }
            }
        }
        
        // Clean up preview
        scene.remove(previewTower.mesh);
        previewTower = null;
        isDragging = false;
        selectedTowerType = null;
        
        // Remove dragging class from all tower items
        document.querySelectorAll('.tower-item').forEach(item => {
            item.classList.remove('dragging');
        });
    }
}

// Right click to cancel placement
function onRightClick(event) {
    event.preventDefault();
    if (isDragging && previewTower) {
        scene.remove(previewTower.mesh);
        previewTower = null;
        isDragging = false;
        selectedTowerType = null;
        
        document.querySelectorAll('.tower-item').forEach(item => {
            item.classList.remove('dragging');
        });
    }
}

// Update mouse click handler for tower destruction
function onMouseClick(event) {
    if (!isDestroyMode || isDragging) return; // Only work in destroy mode and not while placing towers
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Check for intersections with tower meshes
    const towerMeshes = towers.map(tower => tower.mesh);
    const intersects = raycaster.intersectObjects(towerMeshes);
    
    if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        const towerIndex = towers.findIndex(tower => tower.mesh === clickedMesh);
        
        if (towerIndex !== -1) {
            // Remove tower from scene and arrays
            const tower = towers[towerIndex];
            scene.remove(tower.mesh);
            towers.splice(towerIndex, 1);
            
            // Play destruction effect
            const destroyEffect = new THREE.Mesh(
                new THREE.SphereGeometry(0.5, 8, 8),
                new THREE.MeshBasicMaterial({ 
                    color: 0xff0000,
                    transparent: true,
                    opacity: 0.5
                })
            );
            destroyEffect.position.copy(tower.getPosition());
            scene.add(destroyEffect);
            
            // Remove effect after animation
            setTimeout(() => {
                scene.remove(destroyEffect);
            }, 300);
        }
    }
}

function isValidTowerPosition(x, z) {
    // Check if position is occupied by another tower
    for (const tower of towers) {
        if (Math.abs(tower.position.x - x) < 0.5 && Math.abs(tower.position.z - z) < 0.5) {
            return false;
        }
    }
    
    // Check distance to path segments
    const minPathDistance = 1.5; // Minimum distance from path
    
    for (let i = 0; i < pathWaypoints.length - 1; i++) {
        const start = pathWaypoints[i];
        const end = pathWaypoints[i + 1];
        
        // Calculate distance from point to line segment
        const pathSegment = end.clone().sub(start);
        const pointToStart = new THREE.Vector3(x, 0.1, z).sub(start);
        
        // Project point onto line segment
        const segmentLength = pathSegment.length();
        const t = Math.max(0, Math.min(1, pointToStart.dot(pathSegment) / segmentLength ** 2));
        
        const projection = start.clone().add(pathSegment.multiplyScalar(t));
        const distance = new THREE.Vector3(x, 0.1, z).distanceTo(projection);
        
        if (distance < minPathDistance) {
            return false;
        }
    }
    
    return true;
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

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
            scene.remove(enemy.mesh);
            enemies.splice(i, 1);
            gameState.removeEnemy();
        }
    }
    
    // Update towers (check for targets and shoot)
    for (const tower of towers) {
        if (tower.type === 'area') {
            if (tower.canShoot()) {
                const deadEnemies = tower.shoot(enemies); // Get list of enemies that died
                // Handle dead enemies
                for (const deadEnemy of deadEnemies) {
                    const index = enemies.indexOf(deadEnemy);
                    if (index !== -1) {
                        scene.remove(deadEnemy.mesh);
                        enemies.splice(index, 1);
                        gameState.removeEnemy();
                        gameState.addMoney(10);
                        gameState.addScore(100);
                    }
                }
            }
        } else {
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
                    splashTarget.takeDamage(projectile.damage * 0.5); // 50% damage for splash
                    if (!splashTarget.isAlive()) {
                        const index = enemies.indexOf(splashTarget);
                        if (index !== -1) {
                            scene.remove(splashTarget.mesh);
                            enemies.splice(index, 1);
                            gameState.removeEnemy();
                            gameState.addMoney(10);
                            gameState.addScore(100);
                        }
                    }
                }
            }
            
            // Handle direct hit
            const enemyIndex = enemies.indexOf(projectile.target);
            if (enemyIndex !== -1) {
                // Apply damage and check if enemy died
                projectile.target.takeDamage(projectile.damage);
                if (!projectile.target.isAlive()) {
                    scene.remove(projectile.target.mesh);
                    enemies.splice(enemyIndex, 1);
                    gameState.removeEnemy();
                    gameState.addMoney(10);
                    gameState.addScore(100);
                }
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
    updateTowerMenu();
    
    renderer.render(scene, camera);
}

// Event listeners
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);
window.addEventListener('click', onMouseClick);
window.addEventListener('contextmenu', onRightClick);
window.addEventListener('resize', onWindowResize);

// Start the game
animate(); 