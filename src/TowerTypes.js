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
        color: 0x4444ff,
        range: 4.0,
        damage: 12,
        fireRate: 1.0,
        model: {
            base: {
                geometry: new THREE.CylinderGeometry(0.3, 0.4, 1.0, 8),
                material: new THREE.MeshStandardMaterial({ map: BRICK_TEX, roughness: 0.9 })
            },
            barrel: {
                geometry: new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6),
                material: new THREE.MeshStandardMaterial({ map: METAL_TEX, metalness: 0.6, roughness: 0.3 })
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
        damage: 20,
        fireRate: 0.5,
        model: {
            base: {
                geometry: new THREE.CylinderGeometry(0.25, 0.35, 1.5, 8),
                material: new THREE.MeshStandardMaterial({ map: BRICK_TEX, roughness: 0.8 })
            },
            barrel: {
                geometry: new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6),
                material: new THREE.MeshStandardMaterial({ map: METAL_TEX, metalness: 0.7, roughness: 0.2 })
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
        damage: 6,
        fireRate: 3.0,
        model: {
            base: {
                geometry: new THREE.CylinderGeometry(0.35, 0.45, 0.8, 8),
                material: new THREE.MeshStandardMaterial({ map: BRICK_TEX, roughness: 0.85 })
            },
            barrel: {
                geometry: new THREE.CylinderGeometry(0.12, 0.12, 0.6, 6),
                material: new THREE.MeshStandardMaterial({ map: METAL_TEX, metalness: 0.6, roughness: 0.25 })
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
        damage: 8,
        fireRate: 2.0,
        splashRadius: 3.5,
        model: {
            base: {
                geometry: new THREE.CylinderGeometry(0.4, 0.5, 0.9, 8),
                material: new THREE.MeshStandardMaterial({ map: BRICK_TEX, roughness: 0.8 })
            },
            barrel: {
                geometry: new THREE.CylinderGeometry(0.15, 0.15, 0.5, 6),
                material: new THREE.MeshStandardMaterial({ map: METAL_TEX, metalness: 0.7, roughness: 0.3 })
            }
        }
    }
}; 