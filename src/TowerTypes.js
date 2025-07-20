import * as THREE from 'three';
import { loadTexture } from './utils/textureLoader.js';

// Preload a couple of textures (public domain assets)
const BRICK_TEX = loadTexture('https://threejs.org/examples/textures/brick_diffuse.jpg', 1, 1);
const METAL_TEX = loadTexture('https://threejs.org/examples/textures/uv_grid_opengl.jpg', 1, 1);
// Note: These remote textures are small and CORS-enabled on the threejs domain.

export const TOWER_TYPES = {
    BASIC: {
        id: 'basic',
        name: 'Basic Tower',
        description: 'Balanced tower with medium range and damage',
        cost: 20,
        color: 0x888888, // Changed to grey
        range: 4.0,
        damage: 12,
        fireRate: 1.0,
        upgrade: {
            damageMultiplier: 1.5,
            fireRateMultiplier: 1.25,
            costMultiplier: [1.5, 2.0],
            maxLevel: 3
        },
        weaponModel: 'enemy-ufo-a-weapon'
    },
    
    SNIPER: {
        id: 'sniper',
        name: 'Sniper Tower',
        description: 'Long range, high damage, slow fire rate',
        cost: 40,
        color: 0x888888,
        range: 8.0,
        damage: 20,
        fireRate: 0.5,
        upgrade: {
            damageMultiplier: 1.5,
            fireRateMultiplier: 1.25,
            costMultiplier: [1.5, 2.0],
            maxLevel: 3
        },
        weaponModel: 'weapon-ballista'
    },
    
    RAPID: {
        id: 'rapid',
        name: 'Rapid Tower',
        description: 'Fast firing, low damage, short range',
        cost: 30,
        color: 0x888888,
        range: 3.0,
        damage: 6,
        fireRate: 3.0,
        upgrade: {
            damageMultiplier: 1.5,
            fireRateMultiplier: 1.25,
            costMultiplier: [1.5, 2.0],
            maxLevel: 3
        },
        weaponModel: 'weapon-turret'
    },
    
    AREA: {
        id: 'area',
        name: 'Area Tower',
        description: 'Deals periodic area damage to all enemies in range',
        cost: 35,
        color: 0x888888,
        range: 3.5,
        damage: 8,
        fireRate: 2.0,
        splashRadius: 3.5,
        upgrade: {
            damageMultiplier: 1.5,
            fireRateMultiplier: 1.25,
            costMultiplier: [1.5, 2.0],
            maxLevel: 3
        },
        weaponModel: 'snow-detail-crystal-large'
    }
};

// Utility functions for upgrade calculations
export function calculateUpgradeCost(towerType, currentLevel) {
    const config = TOWER_TYPES[towerType.toUpperCase()];
    if (!config || !config.upgrade || currentLevel >= config.upgrade.maxLevel) {
        return null; // Cannot upgrade
    }
    
    const baseCost = config.cost;
    const multiplier = config.upgrade.costMultiplier[currentLevel - 1]; // currentLevel is 1-based
    return Math.floor(baseCost * multiplier);
}

export function calculateUpgradedStats(towerType, currentLevel) {
    const config = TOWER_TYPES[towerType.toUpperCase()];
    if (!config || !config.upgrade) {
        return null;
    }
    
    const damageUpgrade = Math.pow(config.upgrade.damageMultiplier, currentLevel - 1);
    const fireRateUpgrade = Math.pow(config.upgrade.fireRateMultiplier, currentLevel - 1);
    
    return {
        damage: Math.floor(config.damage * damageUpgrade),
        fireRate: parseFloat((config.fireRate * fireRateUpgrade).toFixed(2)),
        range: config.range, // Range doesn't change with upgrades
        splashRadius: config.splashRadius // Splash radius doesn't change
    };
}

export function calculateTotalInvestment(towerType, currentLevel) {
    const config = TOWER_TYPES[towerType.toUpperCase()];
    if (!config) return 0;
    
    let total = config.cost; // Base cost
    
    // Add upgrade costs up to current level
    for (let level = 1; level < currentLevel; level++) {
        total += calculateUpgradeCost(towerType, level);
    }
    
    return total;
}

export function calculateRefundAmount(towerType, currentLevel) {
    const total = calculateTotalInvestment(towerType, currentLevel);
    return Math.floor(total * 0.7); // 70% refund
} 