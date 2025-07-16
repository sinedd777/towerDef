import * as THREE from 'three';

export const TOWER_TYPES = {
    BASIC: {
        id: 'basic',
        name: 'Basic Tower',
        description: 'Balanced tower with medium range and damage',
        cost: 20,
        color: 0x4444ff,
        range: 4.0, // Increased from 3.0
        damage: 15, // Decreased from 50
        fireRate: 1.0,
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
        range: 8.0, // Increased from 6.0
        damage: 30, // Decreased from 100
        fireRate: 0.5,
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
        range: 3.0, // Increased from 2.0
        damage: 8, // Decreased from 25
        fireRate: 3.0,
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
        range: 3.5, // Increased from 2.5
        damage: 12, // Decreased from 30
        fireRate: 2.0, // Changed to control pulse rate
        splashRadius: 3.5, // Same as range for full-area effect
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