import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { Tower } from './Tower.js';
import { Projectile } from './Projectile.js';
import { GameState } from './GameState.js';
import { TOWER_TYPES } from './TowerTypes.js';
import { ELEMENTS, getElementalDamage, getTowerById, getUpgradeOptions } from './Elements.js';
import { ElementManager } from './ElementManager.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Set background color to dark blue for visibility
renderer.setClearColor(0x001133);

// CSS2D renderer setup for debug labels
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Game state
const gameState = new GameState();

// Element Manager - Initialize after gameState
const elementManager = new ElementManager(gameState, scene);

// Listen for tower updates
document.addEventListener('towersUpdated', (event) => {
    updateTowerSelectionUI(event.detail.availableTowers, event.detail.unlockedElements);
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

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Enemy spawning
let lastEnemySpawn = 0;
const enemySpawnInterval = 2000; // 2 seconds

// Tower placement preview
let previewTower = null;
let isDragging = false;
let selectedTowerData = null;

// Add destroy mode state
let isDestroyMode = false;

// Add upgrade mode state
let isUpgradeMode = false;
let selectedTowerForUpgrade = null;
let upgradeModal = null;

// Create upgrade modal
function createUpgradeModal() {
    upgradeModal = document.createElement('div');
    upgradeModal.id = 'upgrade-modal';
    upgradeModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: #222;
        border: 2px solid #444;
        border-radius: 10px;
        padding: 30px;
        max-width: 700px;
        color: white;
        text-align: center;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    const title = document.createElement('h2');
    title.textContent = 'Upgrade Tower';
    title.style.cssText = `
        margin: 0 0 20px 0;
        color: #ffdd44;
    `;
    modalContent.appendChild(title);
    
    const currentTowerInfo = document.createElement('div');
    currentTowerInfo.id = 'current-tower-info';
    currentTowerInfo.style.cssText = `
        background: #333;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 20px;
    `;
    modalContent.appendChild(currentTowerInfo);
    
    const upgradeOptionsContainer = document.createElement('div');
    upgradeOptionsContainer.id = 'upgrade-options';
    upgradeOptionsContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
    `;
    modalContent.appendChild(upgradeOptionsContainer);
    
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
        background: #666;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 10px 20px;
        cursor: pointer;
        font-size: 16px;
    `;
    closeButton.addEventListener('click', hideUpgradeModal);
    modalContent.appendChild(closeButton);
    
    upgradeModal.appendChild(modalContent);
    document.body.appendChild(upgradeModal);
}

function showUpgradeModal(tower) {
    if (!upgradeModal) createUpgradeModal();
    
    selectedTowerForUpgrade = tower;
    const unlockedElements = elementManager.getUnlockedElements();
    
    // Update current tower info
    const currentInfo = document.getElementById('current-tower-info');
    currentInfo.innerHTML = `
        <h3 style="color: #${tower.data.color.toString(16).padStart(6, '0')}; margin: 0 0 10px 0;">
            ${tower.data.name}
        </h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 14px;">
            <div>Damage: ${tower.data.damage}</div>
            <div>Range: ${tower.data.range}</div>
            <div>Fire Rate: ${tower.data.fireRate}</div>
            <div>Tier: ${tower.data.tier}</div>
            <div style="grid-column: 1 / -1;">Elements: ${tower.data.elements.map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(' + ')}</div>
        </div>
    `;
    
    // Get upgrade options
    const upgradeOptions = getUpgradeOptions(tower.data, unlockedElements);
    const optionsContainer = document.getElementById('upgrade-options');
    optionsContainer.innerHTML = '';
    
    if (upgradeOptions.length === 0) {
        optionsContainer.innerHTML = `
            <div style="color: #888; text-align: center; padding: 20px; font-style: italic; grid-column: 1 / -1;">
                No upgrades available. ${tower.data.tier >= 3 ? 'This tower is already at maximum tier!' : 'Unlock more elements to access upgrades!'}
            </div>
        `;
    } else {
        upgradeOptions.forEach(upgrade => {
            const upgradeOption = document.createElement('div');
            upgradeOption.className = 'upgrade-option';
            upgradeOption.style.cssText = `
                background: linear-gradient(145deg, #${upgrade.color.toString(16).padStart(6, '0')}, #333);
                border: 2px solid #${upgrade.color.toString(16).padStart(6, '0')};
                border-radius: 8px;
                padding: 20px;
                cursor: pointer;
                transition: all 0.3s;
            `;
            
            const canAfford = gameState.canAfford(upgrade.cost);
            if (!canAfford) {
                upgradeOption.style.opacity = '0.5';
                upgradeOption.style.cursor = 'not-allowed';
            }
            
            upgradeOption.innerHTML = `
                <h4 style="margin: 0 0 10px 0; color: white;">${upgrade.name}</h4>
                <div style="font-size: 12px; margin-bottom: 10px; line-height: 1.3;">${upgrade.description}</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; margin-bottom: 10px;">
                    <div>Damage: ${upgrade.damage} (+${upgrade.damage - tower.data.damage})</div>
                    <div>Range: ${upgrade.range} (${upgrade.range > tower.data.range ? '+' : ''}${(upgrade.range - tower.data.range).toFixed(1)})</div>
                    <div>Fire Rate: ${upgrade.fireRate} (${upgrade.fireRate > tower.data.fireRate ? '+' : ''}${(upgrade.fireRate - tower.data.fireRate).toFixed(1)})</div>
                    <div>Tier: ${upgrade.tier}</div>
                </div>
                <div style="font-size: 11px; margin-bottom: 15px;">
                    Elements: ${upgrade.elements.map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(' + ')}
                </div>
                <div style="background: rgba(0,0,0,0.5); padding: 8px; border-radius: 4px; font-weight: bold;">
                    Cost: $${upgrade.cost} ${!canAfford ? '(Cannot afford)' : ''}
                </div>
            `;
            
            if (canAfford) {
                upgradeOption.addEventListener('mouseenter', () => {
                    upgradeOption.style.transform = 'scale(1.02)';
                    upgradeOption.style.boxShadow = `0 0 15px #${upgrade.color.toString(16).padStart(6, '0')}66`;
                });
                
                upgradeOption.addEventListener('mouseleave', () => {
                    upgradeOption.style.transform = 'scale(1)';
                    upgradeOption.style.boxShadow = 'none';
                });
                
                upgradeOption.addEventListener('click', () => {
                    upgradeTower(tower, upgrade);
                });
            }
            
            optionsContainer.appendChild(upgradeOption);
        });
    }
    
    upgradeModal.style.display = 'flex';
}

function hideUpgradeModal() {
    if (upgradeModal) {
        upgradeModal.style.display = 'none';
        selectedTowerForUpgrade = null;
    }
}

function upgradeTower(tower, upgradeData) {
    if (!gameState.spendMoney(upgradeData.cost)) {
        return false;
    }
    
    // Update tower properties
    tower.data = upgradeData;
    tower.range = upgradeData.range;
    tower.damage = upgradeData.damage;
    tower.fireRate = upgradeData.fireRate;
    
    // Update tower visual appearance
    tower.mesh.material.color.setHex(upgradeData.color);
    tower.mesh.material.emissive.setHex(upgradeData.color);
    tower.mesh.material.emissiveIntensity = 0.3;
    
    // Show upgrade effect
    const upgradeEffect = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 16, 16),
        new THREE.MeshBasicMaterial({ 
            color: upgradeData.color,
            transparent: true,
            opacity: 0.6
        })
    );
    upgradeEffect.position.copy(tower.mesh.position);
    scene.add(upgradeEffect);
    
    // Animate upgrade effect
    let scale = 0;
    const upgradeAnimation = () => {
        scale += 0.1;
        upgradeEffect.scale.setScalar(scale);
        upgradeEffect.material.opacity = 0.6 - (scale * 0.1);
        
        if (scale < 6) {
            requestAnimationFrame(upgradeAnimation);
        } else {
            scene.remove(upgradeEffect);
        }
    };
    upgradeAnimation();
    
    hideUpgradeModal();
    updateTowerMenu();
    
    console.log(`Tower upgraded to ${upgradeData.name}!`);
    return true;
}

// Create tower selection UI
function createTowerSelectionUI() {
    // Create basic tower menu
    const basicTowerMenu = document.getElementById('basic-tower-menu');
    if (!basicTowerMenu) {
        console.error('Basic tower menu not found');
        return;
    }

    // Create elemental tower menu
    const elementalTowerMenu = document.getElementById('elemental-tower-menu');
    if (!elementalTowerMenu) {
        console.error('Elemental tower menu not found');
        return;
    }

    // Get available towers
    const basicTowers = Object.values(TOWER_TYPES);
    updateBasicTowerGrid(basicTowers);

    // Initial update of elemental towers (empty at start)
    updateElementalTowerGrid([]);

    // Add CSS styles for tower slots
    const style = document.createElement('style');
    style.textContent = `
        .tower-icon {
            width: 40px;
            height: 40px;
            border-radius: 6px;
            position: relative;
        }
    `;
    document.head.appendChild(style);
}

function updateBasicTowerGrid(basicTowers) {
    const menu = document.getElementById('basic-tower-menu');
    if (!menu) return;
    
    menu.innerHTML = '';
    
    basicTowers.forEach(tower => {
        const slot = createTowerSlot(tower);
        menu.appendChild(slot);
    });
}

function updateElementalTowerGrid(elementalTowers) {
    const menu = document.getElementById('elemental-tower-menu');
    if (!menu) return;
    
    menu.innerHTML = '';
    
    if (elementalTowers.length === 0) {
        const message = document.createElement('div');
        message.style.cssText = `
            grid-column: 1 / -1;
            color: #888;
            text-align: center;
            padding: 20px;
            font-style: italic;
        `;
        message.textContent = 'Reach wave 5 to unlock your first element!';
        menu.appendChild(message);
        return;
    }
    
    elementalTowers.forEach(tower => {
        const slot = createTowerSlot(tower);
        menu.appendChild(slot);
    });
}

function createTowerSlot(tower) {
    console.log('Creating tower slot for:', tower);
    const slot = document.createElement('div');
    slot.className = 'tower-slot';
    slot.dataset.towerId = tower.id;
    
    // Create tower icon
    const icon = document.createElement('div');
    icon.className = 'tower-icon';
    icon.style.backgroundColor = '#' + tower.color.toString(16).padStart(6, '0');
    
    // Add cost badge
    const cost = document.createElement('div');
    cost.className = 'tower-cost';
    cost.textContent = tower.cost;
    icon.appendChild(cost);
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'tower-tooltip';
    
    const tooltipHeader = document.createElement('div');
    tooltipHeader.className = 'tower-tooltip-header';
    tooltipHeader.innerHTML = `
        <div class="tower-tooltip-name">${tower.name}</div>
    `;
    
    const tooltipDescription = document.createElement('div');
    tooltipDescription.className = 'tower-tooltip-description';
    tooltipDescription.textContent = tower.description;
    
    const tooltipStats = document.createElement('div');
    tooltipStats.className = 'tower-tooltip-stats';
    tooltipStats.innerHTML = `
        <div>Range: ${tower.range}</div>
        <div>Damage: ${tower.damage}</div>
        <div>Rate: ${tower.fireRate}/s</div>
        ${tower.element ? `<div>Element: ${tower.element}</div>` : ''}
    `;
    
    tooltip.appendChild(tooltipHeader);
    tooltip.appendChild(tooltipDescription);
    tooltip.appendChild(tooltipStats);
    
    // Assembly
    slot.appendChild(icon);
    slot.appendChild(tooltip);
    
    // Add click selection functionality
    slot.addEventListener('click', (e) => {
        // Prevent the click from reaching the canvas
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Tower slot clicked:', tower);
        
        // Check if we can afford the tower
        if (gameState.getMoney() < tower.cost) {
            console.log(`Not enough money for tower: ${tower.name} (Cost: ${tower.cost}, Money: ${gameState.getMoney()})`);
            return;
        }
        
        // If this tower is already selected, deselect it
        if (selectedTowerData && selectedTowerData.id === tower.id) {
            selectedTowerData = null;
            if (previewTower) {
                scene.remove(previewTower.mesh);
                scene.remove(previewTower.rangeIndicator);
                previewTower = null;
            }
            e.currentTarget.classList.remove('selected');
            return;
        }
        
        // Deselect any previously selected tower
        document.querySelectorAll('.tower-slot.selected').forEach(slot => {
            slot.classList.remove('selected');
        });
        
        // Select this tower
        e.currentTarget.classList.add('selected');
        selectedTowerData = { ...tower }; // Create a copy of the tower data
        console.log('Selected tower data:', selectedTowerData);
        
        // Clean up any existing preview
        if (previewTower) {
            scene.remove(previewTower.mesh);
            scene.remove(previewTower.rangeIndicator);
        }
        
        // Create new preview tower
        previewTower = createPreviewTower(selectedTowerData);
        if (previewTower) {
            scene.add(previewTower.mesh);
            scene.add(previewTower.rangeIndicator);
            console.log('Preview tower created');
            
            // Immediately update preview position to mouse location
            const rect = renderer.domElement.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
            const intersects = raycaster.intersectObject(ground);
            
            if (intersects.length > 0) {
                const point = intersects[0].point;
                const gridX = Math.round(point.x);
                const gridZ = Math.round(point.z);
                previewTower.mesh.position.set(gridX, 0.5, gridZ);
                previewTower.rangeIndicator.position.set(gridX, 0.01, gridZ);
            }
        } else {
            console.error('Failed to create preview tower');
        }
    });
    
    // Update appearance based on affordability
    if (gameState.getMoney() < tower.cost) {
        slot.classList.add('cannot-afford');
    }
    
    return slot;
}

function updateTowerSelectionUI(availableTowers, unlockedElements) {
    // Split towers into basic and elemental
    const basicTowers = availableTowers.filter(t => !t.elements || t.elements.length === 0);
    const elementalTowers = availableTowers.filter(t => t.elements && t.elements.length > 0);
    
    updateBasicTowerGrid(basicTowers);
    updateElementalTowerGrid(elementalTowers);
}

function attachTowerItemListeners() {
    document.querySelectorAll('.tower-item').forEach(item => {
        item.addEventListener('mousedown', (e) => {
            const towerId = item.dataset.towerId;
            const towerData = getTowerById(towerId);
            
            if (!towerData) {
                console.warn(`No tower data found for id: ${towerId}`);
                return;
            }
            
            if (gameState.getMoney() >= towerData.cost) {
                isDragging = true;
                selectedTowerData = towerData;
                item.classList.add('dragging');
                
                // Create preview tower using new tower data
                if (previewTower) {
                    scene.remove(previewTower.mesh);
                    scene.remove(previewTower.rangeIndicator);
                }
                previewTower = createPreviewTower(towerData);
                scene.add(previewTower.mesh);
                scene.add(previewTower.rangeIndicator);
            } else {
                console.log(`Not enough money for tower: ${towerData.name} (Cost: ${towerData.cost}, Money: ${gameState.getMoney()})`);
            }
        });
    });
}

function createPreviewTower(towerData) {
    console.log('Creating preview tower for:', towerData);
    // Create a simple preview mesh
    const geometry = new THREE.CylinderGeometry(0.3, 0.4, 1.0, 8);
    const material = new THREE.MeshPhongMaterial({ 
        color: towerData.color,
        transparent: true,
        opacity: 0.5
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0.5, 0);
    mesh.castShadow = true;
    
    // Add range indicator
    const rangeGeometry = new THREE.RingGeometry(towerData.range - 0.1, towerData.range, 32);
    const rangeMaterial = new THREE.MeshBasicMaterial({ 
        color: towerData.color,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
    });
    
    const rangeIndicator = new THREE.Mesh(rangeGeometry, rangeMaterial);
    rangeIndicator.rotation.x = -Math.PI / 2;
    rangeIndicator.position.y = 0.01;
    
    return {
        mesh: mesh,
        rangeIndicator: rangeIndicator
    };
}

// Add destroy button to UI
const destroyButton = document.createElement('button');
destroyButton.id = 'destroy-button';
destroyButton.innerHTML = '🗑️ Destroy';
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

// Add upgrade button to UI
const upgradeButton = document.createElement('button');
upgradeButton.id = 'upgrade-button';
upgradeButton.innerHTML = '⚡ Upgrade';
upgradeButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 140px;
    padding: 10px 20px;
    background: #44aaff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.3s;
`;
document.body.appendChild(upgradeButton);

// Add hover styles
destroyButton.addEventListener('mouseover', () => {
    destroyButton.style.background = '#ff6666';
});
destroyButton.addEventListener('mouseout', () => {
    destroyButton.style.background = isDestroyMode ? '#ff6666' : '#ff4444';
});

upgradeButton.addEventListener('mouseover', () => {
    upgradeButton.style.background = '#55bbff';
});
upgradeButton.addEventListener('mouseout', () => {
    upgradeButton.style.background = isUpgradeMode ? '#55bbff' : '#44aaff';
});

// Toggle destroy mode
destroyButton.addEventListener('click', () => {
    isDestroyMode = !isDestroyMode;
    isUpgradeMode = false; // Disable upgrade mode
    
    destroyButton.style.background = isDestroyMode ? '#ff6666' : '#ff4444';
    upgradeButton.style.background = '#44aaff';
    document.body.style.cursor = isDestroyMode ? 'crosshair' : 'default';
    
    // Also update cursor style when clicking on canvas
    renderer.domElement.style.cursor = isDestroyMode ? 'crosshair' : 'default';
});

// Toggle upgrade mode
upgradeButton.addEventListener('click', () => {
    isUpgradeMode = !isUpgradeMode;
    isDestroyMode = false; // Disable destroy mode
    
    upgradeButton.style.background = isUpgradeMode ? '#55bbff' : '#44aaff';
    destroyButton.style.background = '#ff4444';
    document.body.style.cursor = isUpgradeMode ? 'crosshair' : 'default';
    
    // Also update cursor style when clicking on canvas
    renderer.domElement.style.cursor = isUpgradeMode ? 'crosshair' : 'default';
});

// Update cursor style when moving between canvas and UI
renderer.domElement.addEventListener('mouseenter', () => {
    if (isDestroyMode || isUpgradeMode) {
        renderer.domElement.style.cursor = 'crosshair';
    }
});

// Add debug wave button for testing
const debugWaveButton = document.createElement('button');
debugWaveButton.id = 'debug-wave-button';
debugWaveButton.innerHTML = '🌊 +5 Waves (Debug)';
debugWaveButton.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
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
        gameState.checkElementUnlock();
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
    const money = gameState.getMoney();
    document.querySelectorAll('.tower-slot').forEach(slot => {
        const towerId = slot.dataset.towerId;
        const towerData = getTowerById(towerId);
        if (!towerData) {
            console.warn(`No tower data found for id: ${towerId}`);
            return;
        }
        if (money < towerData.cost) {
            slot.classList.add('cannot-afford');
        } else {
            slot.classList.remove('cannot-afford');
        }
    });
}

// Mouse move handler for tower placement preview
function onMouseMove(event) {
    // Update mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update preview tower position if one is selected
    if (selectedTowerData && previewTower) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(ground);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const gridX = Math.round(point.x);
            const gridZ = Math.round(point.z);
            
            // Update preview tower position
            previewTower.mesh.position.set(gridX, 0.5, gridZ);
            previewTower.rangeIndicator.position.set(gridX, 0.01, gridZ);
            
            // Update preview color based on position validity
            const isValid = isValidTowerPosition(gridX, gridZ);
            const canAfford = gameState.getMoney() >= selectedTowerData.cost;
            
            const color = !canAfford ? 0xff0000 : (isValid ? selectedTowerData.color : 0xff0000);
            const opacity = !canAfford ? 0.3 : (isValid ? 0.5 : 0.3);
            
            previewTower.mesh.material.color.setHex(color);
            previewTower.mesh.material.opacity = opacity;
            previewTower.rangeIndicator.material.color.setHex(color);
            previewTower.rangeIndicator.material.opacity = opacity * 0.4;
        }
    }
}

// Mouse click handler for tower interactions
function onMouseClick(event) {
    // Ignore clicks on UI elements
    if (event.target.closest('.tower-slot')) {
        return;
    }
    
    console.log('Mouse clicked!', event);
    if (event.button !== 0) return; // Only handle left click
    
    // Update mouse coordinates for raycaster
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    console.log('Mouse coordinates:', mouse.x, mouse.y);
    
    raycaster.setFromCamera(mouse, camera);
    
    // Handle tower placement if a tower is selected
    if (selectedTowerData && previewTower) {
        console.log('Attempting to place tower:', selectedTowerData);
        const intersects = raycaster.intersectObject(ground);
        console.log('Ground intersects:', intersects);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const gridX = Math.round(point.x);
            const gridZ = Math.round(point.z);
            console.log('Grid position:', gridX, gridZ);
            
            if (isValidTowerPosition(gridX, gridZ)) {
                console.log('Position is valid');
                if (gameState.getMoney() >= selectedTowerData.cost) {
                    console.log('Creating tower at:', gridX, gridZ);
                    // Create new tower using the Tower class
                    const tower = new Tower(
                        gridX,
                        0.5,
                        gridZ,
                        selectedTowerData.id,
                        selectedTowerData.element
                    );
                    
                    if (tower) {
                        towers.push(tower);
                        scene.add(tower.mesh);
                        gameState.spendMoney(selectedTowerData.cost);
                        gameState.placeTower();
                        updateTowerMenu();
                        console.log('Tower created successfully');
                        
                        // Clean up preview and selection
                        scene.remove(previewTower.mesh);
                        scene.remove(previewTower.rangeIndicator);
                        previewTower = null;
                        selectedTowerData = null;
                        
                        // Remove selected class from all tower slots
                        document.querySelectorAll('.tower-slot.selected').forEach(slot => {
                            slot.classList.remove('selected');
                        });
                    } else {
                        console.error('Failed to create tower');
                    }
                } else {
                    console.log('Not enough money');
                }
            } else {
                console.log('Invalid position');
            }
        } else {
            console.log('No ground intersection');
        }
        return;
    }
    
    // Handle tower destruction and upgrades
    if (!isDestroyMode && !isUpgradeMode) return; // Only check for tower clicks in destroy/upgrade mode
    
    // Check for intersections with tower meshes
    const towerMeshes = towers.map(tower => tower.mesh);
    const intersects = raycaster.intersectObjects(towerMeshes);
    
    if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        const towerIndex = towers.findIndex(tower => tower.mesh === clickedMesh);
        
        if (towerIndex !== -1) {
            const tower = towers[towerIndex];
            
            if (isDestroyMode) {
                // Remove tower from scene and arrays
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
                destroyEffect.position.copy(tower.mesh.position);
                scene.add(destroyEffect);
                
                // Remove effect after animation
                setTimeout(() => {
                    scene.remove(destroyEffect);
                }, 300);
                
            } else if (isUpgradeMode) {
                // Show upgrade modal for this tower
                showUpgradeModal(tower);
            }
        }
    }
}

// Right click handler to cancel tower placement
function onRightClick(event) {
    event.preventDefault();
    
    if (selectedTowerData && previewTower) {
        // Clean up preview and selection
        scene.remove(previewTower.mesh);
        scene.remove(previewTower.rangeIndicator);
        previewTower = null;
        selectedTowerData = null;
        
        // Remove selected class from all tower slots
        document.querySelectorAll('.tower-slot.selected').forEach(slot => {
            slot.classList.remove('selected');
        });
    }
}

function isValidTowerPosition(x, z) {
    // Check if position is occupied by another tower
    for (const tower of towers) {
        const pos = tower.getPosition();
        if (pos.x === x && pos.z === z) {
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
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
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
    updateTowerMenu();
    
    // Render scene and labels
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

// Mouse up handler
function onMouseUp(event) {
    isDragging = false;
}

// Event listeners
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);
window.addEventListener('click', onMouseClick);
window.addEventListener('contextmenu', onRightClick);
window.addEventListener('resize', onWindowResize);

// Initialize the game
createTowerSelectionUI();

// Start the game
animate(); 