import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { Tower } from './Tower.js';
import { Projectile } from './Projectile.js';
import { GameState } from './GameState.js';

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

// Mouse click handler for tower placement
function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(ground);

    if (intersects.length > 0 && gameState.money >= 20) {
        const point = intersects[0].point;
        // Snap to grid
        const gridX = Math.round(point.x);
        const gridZ = Math.round(point.z);
        
        // Check if position is valid (not on path, not occupied)
        if (isValidTowerPosition(gridX, gridZ)) {
            const tower = new Tower(gridX, 0.5, gridZ);
            towers.push(tower);
            scene.add(tower.mesh);
            gameState.spendMoney(20);
        }
    }
}

function isValidTowerPosition(x, z) {
    // Check if too close to path waypoints
    for (const waypoint of pathWaypoints) {
        const distance = Math.sqrt((x - waypoint.x) ** 2 + (z - waypoint.z) ** 2);
        if (distance < 1.5) return false;
    }
    
    // Check if position is occupied by another tower
    for (const tower of towers) {
        if (Math.abs(tower.position.x - x) < 0.5 && Math.abs(tower.position.z - z) < 0.5) {
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
        const target = tower.findTarget(enemies);
        if (target && tower.canShoot()) {
            const projectile = tower.shoot(target);
            projectiles.push(projectile);
            scene.add(projectile.mesh);
        }
    }
    
    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.update();
        
        // Check collision with target
        if (projectile.hasHitTarget()) {
            // Remove enemy
            const enemyIndex = enemies.indexOf(projectile.target);
            if (enemyIndex !== -1) {
                scene.remove(projectile.target.mesh);
                enemies.splice(enemyIndex, 1);
                gameState.removeEnemy();
                gameState.addMoney(10);
                gameState.addScore(100);
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
    
    // Update HUD
    gameState.updateHUD();
    
    renderer.render(scene, camera);
}

// Event listeners
window.addEventListener('resize', onWindowResize);
window.addEventListener('click', onMouseClick);

// Start the game
animate(); 