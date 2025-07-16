import * as THREE from 'three';
import { ELEMENTS } from './Elements.js';

export const TOWER_TYPES = {
    BASIC: {
        id: 'basic',
        name: 'Basic Tower',
        description: 'Balanced tower with medium range and damage',
        cost: 20,
        color: 0x4444ff,
        range: 4.0,
        damage: 15,
        fireRate: 1.0,
        element: null, // Can be upgraded with any element
        model: {
            base: {
                geometry: new THREE.CylinderGeometry(0.3, 0.4, 1.0, 8),
                material: new THREE.MeshPhongMaterial({ color: 0x4444ff })
            },
            barrel: {
                geometry: new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6),
                material: new THREE.MeshPhongMaterial({ color: 0x333333 })
            }
        }
    },
    
    SNIPER: {
        id: 'sniper',
        name: 'Sniper Tower',
        description: 'Long range, high damage, slow fire rate',
        cost: 40,
        color: 0xffff00,
        range: 8.0,
        damage: 30,
        fireRate: 0.5,
        element: null, // Can be upgraded with any element
        model: {
            base: {
                geometry: new THREE.CylinderGeometry(0.25, 0.35, 1.5, 8),
                material: new THREE.MeshPhongMaterial({ color: 0xffff00 })
            },
            barrel: {
                geometry: new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6),
                material: new THREE.MeshPhongMaterial({ color: 0x333333 })
            }
        }
    },
    
    RAPID: {
        id: 'rapid',
        name: 'Rapid Tower',
        description: 'Fast firing, low damage, short range',
        cost: 30,
        color: 0x00ff00,
        range: 3.0,
        damage: 8,
        fireRate: 3.0,
        element: null, // Can be upgraded with any element
        model: {
            base: {
                geometry: new THREE.CylinderGeometry(0.35, 0.45, 0.8, 8),
                material: new THREE.MeshPhongMaterial({ color: 0x00ff00 })
            },
            barrel: {
                geometry: new THREE.CylinderGeometry(0.12, 0.12, 0.6, 6),
                material: new THREE.MeshPhongMaterial({ color: 0x333333 })
            }
        }
    },
    
    AREA: {
        id: 'area',
        name: 'Area Tower',
        description: 'Deals periodic area damage to all enemies in range',
        cost: 35,
        color: 0xff00ff,
        range: 3.5,
        damage: 12,
        fireRate: 2.0,
        element: null, // Can be upgraded with any element
        splashRadius: 3.5,
        model: {
            base: {
                geometry: new THREE.CylinderGeometry(0.4, 0.5, 0.9, 8),
                material: new THREE.MeshPhongMaterial({ color: 0xff00ff })
            },
            barrel: {
                geometry: new THREE.CylinderGeometry(0.15, 0.15, 0.5, 6),
                material: new THREE.MeshPhongMaterial({ color: 0x333333 })
            }
        }
    }
};

// Function to create an elemental variant of a tower
export function createElementalTower(baseType, element) {
    if (!TOWER_TYPES[baseType] || !ELEMENTS[element]) {
        return null;
    }

    const baseTower = TOWER_TYPES[baseType];
    const elementConfig = ELEMENTS[element];

    // Create a new tower configuration with elemental properties
    const elementalTower = {
        ...baseTower,
        id: `${baseTower.id}_${elementConfig.id}`,
        name: `${elementConfig.name} ${baseTower.name}`,
        description: `${baseTower.description} infused with ${elementConfig.name} element`,
        cost: Math.floor(baseTower.cost * 1.5), // Elemental towers cost more
        color: elementConfig.color,
        element: element,
        // Apply elemental damage multiplier
        damage: Math.floor(baseTower.damage * elementConfig.damageMultiplier),
        model: {
            base: {
                geometry: baseTower.model.base.geometry,
                material: new THREE.MeshPhongMaterial({ 
                    color: elementConfig.color,
                    emissive: elementConfig.color,
                    emissiveIntensity: 0.3
                })
            },
            barrel: baseTower.model.barrel ? {
                geometry: baseTower.model.barrel.geometry,
                material: new THREE.MeshPhongMaterial({ 
                    color: 0x333333,
                    emissive: elementConfig.color,
                    emissiveIntensity: 0.2
                })
            } : null
        }
    };

    return elementalTower;
} 