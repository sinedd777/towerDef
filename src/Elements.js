import * as THREE from 'three';

export const ELEMENTS = {
    FIRE: {
        id: 'fire',
        name: 'Fire',
        color: 0xff4400,
        baseEffect: 'burn',
        damageMultiplier: 1.2,
        effectDuration: 3000, // milliseconds
        particleColor: 0xff6600,
        weakness: 'WATER',
        strength: 'NATURE'
    },
    WATER: {
        id: 'water',
        name: 'Water',
        color: 0x0088ff,
        baseEffect: 'slow',
        damageMultiplier: 1.0,
        effectDuration: 4000,
        particleColor: 0x00aaff,
        weakness: 'NATURE',
        strength: 'FIRE'
    },
    NATURE: {
        id: 'nature',
        name: 'Nature',
        color: 0x00ff44,
        baseEffect: 'poison',
        damageMultiplier: 1.1,
        effectDuration: 5000,
        particleColor: 0x22ff66,
        weakness: 'FIRE',
        strength: 'WATER'
    },
    LIGHT: {
        id: 'light',
        name: 'Light',
        color: 0xffffaa,
        baseEffect: 'confused',
        damageMultiplier: 1.15,
        effectDuration: 2000,
        particleColor: 0xffff77,
        weakness: 'DARKNESS',
        strength: 'EARTH',
        effectChance: 0.25 // 25% chance to confuse
    },
    DARKNESS: {
        id: 'darkness',
        name: 'Darkness',
        color: 0x660066,
        baseEffect: 'weaken',
        damageMultiplier: 1.25,
        effectDuration: 3500,
        particleColor: 0x880088,
        weakness: 'EARTH',
        strength: 'LIGHT'
    },
    EARTH: {
        id: 'earth',
        name: 'Earth',
        color: 0x884400,
        baseEffect: 'stun',
        damageMultiplier: 1.3,
        effectDuration: 1500,
        particleColor: 0xaa6622,
        weakness: 'LIGHT',
        strength: 'DARKNESS',
        effectChance: 0.20 // 20% chance to stun
    }
};

// Element combinations for advanced towers
export const ELEMENT_COMBINATIONS = {
    'FIRE_LIGHT': {
        id: 'lightning',
        name: 'Lightning Tower',
        description: 'Chain lightning attacks that can jump between enemies',
        damageMultiplier: 1.4,
        chainCount: 3, // Number of enemies the lightning can jump to
        chainDamageReduction: 0.7 // Each jump reduces damage by 30%
    },
    'WATER_NATURE': {
        id: 'acid',
        name: 'Acid Tower',
        description: 'Creates pools of acid that damage and slow enemies',
        damageMultiplier: 1.3,
        poolDuration: 5000,
        poolRadius: 2.0
    },
    'DARKNESS_EARTH': {
        id: 'gravity',
        name: 'Gravity Tower',
        description: 'Creates gravity wells that pull and crush enemies',
        damageMultiplier: 1.5,
        pullForce: 2.0,
        pullRadius: 3.0
    }
    // More combinations can be added here
};

// Helper functions for elemental system
export function getElementalDamage(baseDamage, attackerElement, targetElement) {
    let multiplier = ELEMENTS[attackerElement].damageMultiplier;
    
    // Check for weakness/strength relationships
    if (ELEMENTS[attackerElement].strength === targetElement) {
        multiplier *= 1.5; // 50% more damage to weak elements
    } else if (ELEMENTS[attackerElement].weakness === targetElement) {
        multiplier *= 0.75; // 25% less damage to strong elements
    }
    
    return baseDamage * multiplier;
}

export function canCombineElements(element1, element2) {
    const combinationKey = `${element1}_${element2}`;
    return ELEMENT_COMBINATIONS.hasOwnProperty(combinationKey);
}

export function getCombinedElement(element1, element2) {
    const combinationKey = `${element1}_${element2}`;
    return ELEMENT_COMBINATIONS[combinationKey] || null;
} 