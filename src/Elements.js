import * as THREE from 'three';
import { TOWER_TYPES } from './TowerTypes.js';

// Base element definitions
export const ELEMENTS = {
    FIRE: {
        id: 'fire',
        name: 'Fire',
        color: 0xff4400,
        description: 'Aggressive element focused on high damage'
    },
    WATER: {
        id: 'water',
        name: 'Water',
        color: 0x0088ff,
        description: 'Defensive element with slowing effects'
    },
    NATURE: {
        id: 'nature',
        name: 'Nature',
        color: 0x00ff44,
        description: 'Utility element with control effects'
    },
    LIGHT: {
        id: 'light',
        name: 'Light',
        color: 0xffffaa,
        description: 'Precision element with piercing abilities'
    },
    DARKNESS: {
        id: 'darkness',
        name: 'Darkness',
        color: 0x660066,
        description: 'Debuff element with damage over time'
    },
    EARTH: {
        id: 'earth',
        name: 'Earth',
        color: 0x884400,
        description: 'Tank element with splash damage'
    }
};

// Elemental damage multipliers
const ELEMENTAL_MULTIPLIERS = {
    fire: {
        nature: 1.5,    // Fire strong against Nature
        water: 0.5,     // Fire weak against Water
        earth: 0.75     // Fire slightly weak against Earth
    },
    water: {
        fire: 1.5,      // Water strong against Fire
        earth: 0.75,    // Water slightly weak against Earth
        light: 0.75     // Water slightly weak against Light
    },
    nature: {
        earth: 1.5,     // Nature strong against Earth
        fire: 0.5,      // Nature weak against Fire
        darkness: 0.75  // Nature slightly weak against Darkness
    },
    light: {
        darkness: 2.0,  // Light very strong against Darkness
        earth: 0.75,    // Light slightly weak against Earth
        water: 0.75     // Light slightly weak against Water
    },
    darkness: {
        light: 0.5,     // Darkness weak against Light
        nature: 1.25,   // Darkness slightly strong against Nature
        fire: 0.75      // Darkness slightly weak against Fire
    },
    earth: {
        water: 1.25,    // Earth slightly strong against Water
        nature: 0.5,    // Earth weak against Nature
        fire: 1.25      // Earth slightly strong against Fire
    }
};

// Calculate elemental damage based on attacker and defender elements
export function getElementalDamage(baseDamage, attackerElement, defenderElement) {
    // If either element is missing, return base damage
    if (!attackerElement || !defenderElement) {
        return baseDamage;
    }

    // Convert element IDs to lowercase for consistency
    const attacker = attackerElement.toLowerCase();
    const defender = defenderElement.toLowerCase();

    // Get the multiplier from the table, default to 1.0 if no specific interaction
    const multiplier = ELEMENTAL_MULTIPLIERS[attacker]?.[defender] || 1.0;

    return baseDamage * multiplier;
}

// Complete tower data following the tier system
export const TOWER_DATA = {
    // Tier 1 - Single Element Towers (6)
    single: [
        {
            id: 'flame_spitter',
            name: 'Flame Spitter',
            elements: ['fire'],
            description: 'Short-range burst of flame; high DPS, no crowd control.',
            cost: 100,
            range: 3.0,
            damage: 25,
            fireRate: 2.0,
            color: 0xff4400,
            effects: ['burn'],
            tier: 1
        },
        {
            id: 'frost_sprayer',
            name: 'Frost Sprayer',
            elements: ['water'],
            description: 'Medium-range spray that slows enemies on hit.',
            cost: 100,
            range: 4.0,
            damage: 18,
            fireRate: 1.5,
            color: 0x0088ff,
            effects: ['slow'],
            tier: 1
        },
        {
            id: 'vine_snare',
            name: 'Vine Snare',
            elements: ['nature'],
            description: 'Long-range snare shot that roots enemies for 1s.',
            cost: 100,
            range: 6.0,
            damage: 15,
            fireRate: 1.0,
            color: 0x00ff44,
            effects: ['root'],
            tier: 1
        },
        {
            id: 'laser_beacon',
            name: 'Laser Beacon',
            elements: ['light'],
            description: 'Precision laser beam; pierces targets, high single-target damage.',
            cost: 100,
            range: 5.0,
            damage: 30,
            fireRate: 1.2,
            color: 0xffffaa,
            effects: ['pierce'],
            tier: 1
        },
        {
            id: 'shadow_caster',
            name: 'Shadow Caster',
            elements: ['darkness'],
            description: 'Launches a curse orb that leeches health over time.',
            cost: 100,
            range: 4.5,
            damage: 20,
            fireRate: 1.3,
            color: 0x660066,
            effects: ['leech', 'dot'],
            tier: 1
        },
        {
            id: 'rock_launcher',
            name: 'Rock Launcher',
            elements: ['earth'],
            description: 'Hurls boulders with splash damage in a small radius.',
            cost: 100,
            range: 4.0,
            damage: 22,
            fireRate: 1.1,
            color: 0x884400,
            effects: ['splash'],
            splashRadius: 2.0,
            tier: 1
        }
    ],

    // Tier 2 - Dual Element Towers (15)
    dual: [
        {
            id: 'steam_turbine',
            name: 'Steam Turbine',
            elements: ['fire', 'water'],
            description: 'Mid-range steam blast; moderate damage + 25% slow.',
            cost: 250,
            range: 4.5,
            damage: 35,
            fireRate: 1.8,
            color: 0x888888,
            effects: ['burn', 'slow'],
            tier: 2
        },
        {
            id: 'blight_burner',
            name: 'Blight Burner',
            elements: ['fire', 'nature'],
            description: 'Poisonous flame; damage over time in an AOE.',
            cost: 250,
            range: 3.5,
            damage: 30,
            fireRate: 1.6,
            color: 0x888800,
            effects: ['burn', 'poison', 'aoe'],
            splashRadius: 2.5,
            tier: 2
        },
        {
            id: 'solar_flare',
            name: 'Solar Flare',
            elements: ['fire', 'light'],
            description: 'Charges a blinding flare; stuns enemies briefly.',
            cost: 250,
            range: 5.0,
            damage: 40,
            fireRate: 1.2,
            color: 0xffaa00,
            effects: ['burn', 'stun'],
            tier: 2
        },
        {
            id: 'hellfire_grimoire',
            name: 'Hellfire Grimoire',
            elements: ['fire', 'darkness'],
            description: 'Curse-infused fireball; pierces and burns over time.',
            cost: 250,
            range: 5.5,
            damage: 38,
            fireRate: 1.4,
            color: 0x884488,
            effects: ['burn', 'pierce', 'curse'],
            tier: 2
        },
        {
            id: 'magma_mortar',
            name: 'Magma Mortar',
            elements: ['fire', 'earth'],
            description: 'Launches molten rocks; large AOE on impact.',
            cost: 250,
            range: 6.0,
            damage: 45,
            fireRate: 1.0,
            color: 0xaa4400,
            effects: ['burn', 'splash'],
            splashRadius: 3.5,
            tier: 2
        },
        {
            id: 'swamp_mist',
            name: 'Swamp Mist',
            elements: ['water', 'nature'],
            description: 'Mist cloud; slows and damages enemies over time.',
            cost: 250,
            range: 4.0,
            damage: 25,
            fireRate: 2.0,
            color: 0x004422,
            effects: ['slow', 'poison', 'aoe'],
            splashRadius: 3.0,
            tier: 2
        },
        {
            id: 'prismatic_beam',
            name: 'Prismatic Beam',
            elements: ['water', 'light'],
            description: 'High-velocity beam; extra damage to dark enemies.',
            cost: 250,
            range: 6.5,
            damage: 42,
            fireRate: 1.3,
            color: 0x88aaff,
            effects: ['pierce', 'anti_dark'],
            tier: 2
        },
        {
            id: 'abyssal_torrent',
            name: 'Abyssal Torrent',
            elements: ['water', 'darkness'],
            description: 'Dark waters; heavy slow + leech healing to tower.',
            cost: 250,
            range: 4.5,
            damage: 32,
            fireRate: 1.7,
            color: 0x004466,
            effects: ['slow', 'leech', 'heal_tower'],
            tier: 2
        },
        {
            id: 'mud_cannon',
            name: 'Mud Cannon',
            elements: ['water', 'earth'],
            description: 'Shoots mud balls; high slow, low damage.',
            cost: 250,
            range: 4.0,
            damage: 20,
            fireRate: 2.2,
            color: 0x664422,
            effects: ['slow', 'heavy_slow'],
            tier: 2
        },
        {
            id: 'sunblade_grove',
            name: 'Sunblade Grove',
            elements: ['nature', 'light'],
            description: 'Emits solar-charged vines; moderate damage & stun.',
            cost: 250,
            range: 5.0,
            damage: 35,
            fireRate: 1.5,
            color: 0x88ff88,
            effects: ['root', 'stun', 'solar'],
            tier: 2
        },
        {
            id: 'deathbloom',
            name: 'Deathbloom',
            elements: ['nature', 'darkness'],
            description: 'Necrotic vines; high DOT and small fear effect.',
            cost: 250,
            range: 4.5,
            damage: 28,
            fireRate: 1.8,
            color: 0x442244,
            effects: ['poison', 'fear', 'necrotic'],
            tier: 2
        },
        {
            id: 'thorn_fortress',
            name: 'Thorn Fortress',
            elements: ['nature', 'earth'],
            description: 'Erupting brambles; spikes damage nearby creeps.',
            cost: 250,
            range: 3.5,
            damage: 30,
            fireRate: 1.6,
            color: 0x446622,
            effects: ['root', 'thorns', 'passive_damage'],
            tier: 2
        },
        {
            id: 'void_prism',
            name: 'Void Prism',
            elements: ['light', 'darkness'],
            description: 'Fires dark laser; high raw damage, ignores armor.',
            cost: 250,
            range: 7.0,
            damage: 50,
            fireRate: 1.0,
            color: 0x888888,
            effects: ['pierce', 'armor_ignore', 'void'],
            tier: 2
        },
        {
            id: 'luminescent_obelisk',
            name: 'Luminescent Obelisk',
            elements: ['light', 'earth'],
            description: 'Beacon that buffs nearby towers fire rate.',
            cost: 250,
            range: 5.0,
            damage: 25,
            fireRate: 1.2,
            color: 0xffffcc,
            effects: ['pierce', 'buff_nearby', 'beacon'],
            buffRadius: 4.0,
            tier: 2
        },
        {
            id: 'grave_quake',
            name: 'Grave Quake',
            elements: ['darkness', 'earth'],
            description: 'Quakes ground with shadow force; large AOE stun.',
            cost: 250,
            range: 5.0,
            damage: 40,
            fireRate: 1.1,
            color: 0x442200,
            effects: ['stun', 'quake', 'aoe'],
            splashRadius: 4.0,
            tier: 2
        }
    ],

    // Tier 3 - Triple Element Towers (20) - First few examples
    triple: [
        {
            id: 'geyser_of_decay',
            name: 'Geyser of Decay',
            elements: ['fire', 'water', 'nature'],
            description: 'Erupts scalding poison geysers; heavy DOT & slow.',
            cost: 600,
            range: 5.0,
            damage: 60,
            fireRate: 1.5,
            color: 0x664433,
            effects: ['burn', 'poison', 'slow', 'geyser'],
            splashRadius: 3.5,
            tier: 3
        },
        {
            id: 'photon_steam_cannon',
            name: 'Photon Steam Cannon',
            elements: ['fire', 'water', 'light'],
            description: 'Charged steam-laser shots; splash + pierce.',
            cost: 600,
            range: 6.0,
            damage: 70,
            fireRate: 1.2,
            color: 0xaabbcc,
            effects: ['burn', 'pierce', 'splash', 'charged'],
            splashRadius: 2.5,
            tier: 3
        },
        {
            id: 'eclipse_cannon',
            name: 'Eclipse Cannon',
            elements: ['fire', 'light', 'darkness'],
            description: 'Dark sunbeam; extreme single-target damage.',
            cost: 600,
            range: 8.0,
            damage: 100,
            fireRate: 0.8,
            color: 0x664422,
            effects: ['burn', 'pierce', 'eclipse', 'extreme_damage'],
            tier: 3
        }
        // More triple towers would be added here following the same pattern
    ]
};

// Helper functions
export function getAvailableTowers(unlockedElements) {
    const available = [];
    
    // Add single element towers
    for (const tower of TOWER_DATA.single) {
        if (tower.elements.every(element => unlockedElements.includes(element))) {
            available.push(tower);
        }
    }
    
    // Add dual element towers if player has 2+ elements
    if (unlockedElements.length >= 2) {
        for (const tower of TOWER_DATA.dual) {
            if (tower.elements.every(element => unlockedElements.includes(element))) {
                available.push(tower);
            }
        }
    }
    
    // Add triple element towers if player has 3+ elements
    if (unlockedElements.length >= 3) {
        for (const tower of TOWER_DATA.triple) {
            if (tower.elements.every(element => unlockedElements.includes(element))) {
                available.push(tower);
            }
        }
    }
    
    return available;
}

export function getTowerById(towerId) {
    // Check basic tower types first
    for (const type in TOWER_TYPES) {
        if (TOWER_TYPES[type].id === towerId) {
            return TOWER_TYPES[type];
        }
    }
    
    // Check for elemental towers
    const [baseId, elementId] = towerId.split('_');
    if (elementId) {
        const baseTower = Object.values(TOWER_TYPES).find(t => t.id === baseId);
        if (baseTower && ELEMENTS[elementId]) {
            return createElementalTower(baseTower.id, elementId);
        }
    }
    
    // Check tower data for more complex towers
    const allTowers = [...TOWER_DATA.single, ...TOWER_DATA.dual, ...TOWER_DATA.triple];
    return allTowers.find(tower => tower.id === towerId);
}

export function canUpgradeTower(currentTower, targetTower, unlockedElements) {
    // Check if target tower requires more elements than current
    if (targetTower.tier <= currentTower.tier) {
        return false;
    }
    
    // Check if player has all required elements for target tower
    return targetTower.elements.every(element => unlockedElements.includes(element));
}

export function getUpgradeOptions(currentTower, unlockedElements) {
    const upgrades = [];
    
    // Get towers of next tier that include current tower's elements
    const nextTier = currentTower.tier + 1;
    let nextTierTowers = [];
    
    switch (nextTier) {
        case 2:
            nextTierTowers = TOWER_DATA.dual;
            break;
        case 3:
            nextTierTowers = TOWER_DATA.triple;
            break;
        default:
            return upgrades;
    }
    
    for (const tower of nextTierTowers) {
        // Check if this tower contains all of the current tower's elements
        const hasCurrentElements = currentTower.elements.every(element => 
            tower.elements.includes(element)
        );
        
        // Check if player has all required elements
        const hasAllElements = tower.elements.every(element => 
            unlockedElements.includes(element)
        );
        
        if (hasCurrentElements && hasAllElements) {
            upgrades.push(tower);
        }
    }
    
    return upgrades;
} 