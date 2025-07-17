import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AssetManager {
    constructor() {
        this.loader = new GLTFLoader();
        this.cache = new Map();
        this.loadingPromises = new Map();
        this.basePath = '/kenney_tower-defense-kit/Models/GLB format/';
        
        // Asset definitions organized by category
        this.assetDefinitions = {
            enemies: {
                'ufo-a': 'enemy-ufo-a.glb',
                'ufo-b': 'enemy-ufo-b.glb', 
                'ufo-c': 'enemy-ufo-c.glb',
                'ufo-d': 'enemy-ufo-d.glb',
                'ufo-a-weapon': 'enemy-ufo-a-weapon.glb',
                'ufo-b-weapon': 'enemy-ufo-b-weapon.glb',
                'ufo-c-weapon': 'enemy-ufo-c-weapon.glb',
                'ufo-d-weapon': 'enemy-ufo-d-weapon.glb',
                'ufo-beam': 'enemy-ufo-beam.glb',
                'ufo-beam-burst': 'enemy-ufo-beam-burst.glb'
            },
            towers: {
                // Bases
                'tower-round-base': 'tower-round-base.glb',
                'tower-square-base': 'tower-square-bottom-a.glb',
                
                // Round tower parts
                'tower-round-bottom-a': 'tower-round-bottom-a.glb',
                'tower-round-bottom-b': 'tower-round-bottom-b.glb',
                'tower-round-bottom-c': 'tower-round-bottom-c.glb',
                'tower-round-middle-a': 'tower-round-middle-a.glb',
                'tower-round-middle-b': 'tower-round-middle-b.glb',
                'tower-round-middle-c': 'tower-round-middle-c.glb',
                'tower-round-top-a': 'tower-round-top-a.glb',
                'tower-round-top-b': 'tower-round-top-b.glb',
                'tower-round-top-c': 'tower-round-top-c.glb',
                'tower-round-roof-a': 'tower-round-roof-a.glb',
                'tower-round-roof-b': 'tower-round-roof-b.glb',
                'tower-round-roof-c': 'tower-round-roof-c.glb',
                'tower-round-crystals': 'tower-round-crystals.glb',
                
                // Square tower parts
                'tower-square-bottom-a': 'tower-square-bottom-a.glb',
                'tower-square-bottom-b': 'tower-square-bottom-b.glb',
                'tower-square-bottom-c': 'tower-square-bottom-c.glb',
                'tower-square-middle-a': 'tower-square-middle-a.glb',
                'tower-square-middle-b': 'tower-square-middle-b.glb',
                'tower-square-middle-c': 'tower-square-middle-c.glb',
                'tower-square-top-a': 'tower-square-top-a.glb',
                'tower-square-top-b': 'tower-square-top-b.glb',
                'tower-square-top-c': 'tower-square-top-c.glb',
                'tower-square-roof-a': 'tower-square-roof-a.glb',
                'tower-square-roof-b': 'tower-square-roof-b.glb',
                'tower-square-roof-c': 'tower-square-roof-c.glb',
                
                // Build states for construction animation
                'tower-round-build-a': 'tower-round-build-a.glb',
                'tower-round-build-b': 'tower-round-build-b.glb',
                'tower-round-build-c': 'tower-round-build-c.glb',
                'tower-round-build-d': 'tower-round-build-d.glb',
                'tower-round-build-e': 'tower-round-build-e.glb',
                'tower-round-build-f': 'tower-round-build-f.glb',
                'tower-square-build-a': 'tower-square-build-a.glb',
                'tower-square-build-b': 'tower-square-build-b.glb',
                'tower-square-build-c': 'tower-square-build-c.glb',
                'tower-square-build-d': 'tower-square-build-d.glb',
                'tower-square-build-e': 'tower-square-build-e.glb',
                'tower-square-build-f': 'tower-square-build-f.glb'
            },
            weapons: {
                'turret': 'weapon-turret.glb',
                'ballista': 'weapon-ballista.glb',
                'cannon': 'weapon-cannon.glb',
                'catapult': 'weapon-catapult.glb'
            },
            projectiles: {
                'bullet': 'weapon-ammo-bullet.glb',
                'arrow': 'weapon-ammo-arrow.glb',
                'cannonball': 'weapon-ammo-cannonball.glb',
                'boulder': 'weapon-ammo-boulder.glb'
            },
            environment: {
                'tree': 'detail-tree.glb',
                'tree-large': 'detail-tree-large.glb',
                'rocks': 'detail-rocks.glb',
                'rocks-large': 'detail-rocks-large.glb',
                'crystal': 'detail-crystal.glb',
                'crystal-large': 'detail-crystal-large.glb',
                'dirt': 'detail-dirt.glb',
                'dirt-large': 'detail-dirt-large.glb',
                'spawn-round': 'spawn-round.glb',
                'spawn-square': 'spawn-square.glb',
                'tile': 'tile.glb',
                'tile-straight': 'tile-straight.glb'
            }
        };
    }

    /**
     * Load a single asset by key
     * @param {string} category - Asset category (enemies, towers, weapons, etc.)
     * @param {string} key - Asset key within category
     * @returns {Promise<THREE.Group>} - Loaded model
     */
    async loadAsset(category, key) {
        const assetId = `${category}:${key}`;
        
        // Return cached asset if available
        if (this.cache.has(assetId)) {
            return this.cache.get(assetId).clone();
        }
        
        // Return existing loading promise if already loading
        if (this.loadingPromises.has(assetId)) {
            const cached = await this.loadingPromises.get(assetId);
            return cached.clone();
        }
        
        // Check if asset definition exists
        if (!this.assetDefinitions[category] || !this.assetDefinitions[category][key]) {
            throw new Error(`Asset not found: ${category}:${key}`);
        }
        
        const filename = this.assetDefinitions[category][key];
        const path = this.basePath + filename;
        
        // Create loading promise
        const loadingPromise = new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Setup shadows for all meshes
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Ensure materials have proper settings
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(mat => {
                                        mat.needsUpdate = true;
                                    });
                                } else {
                                    child.material.needsUpdate = true;
                                }
                            }
                        }
                    });
                    
                    // Cache the original model
                    this.cache.set(assetId, model);
                    this.loadingPromises.delete(assetId);
                    resolve(model);
                },
                (progress) => {
                    // Optional: emit progress events
                    console.log(`Loading ${assetId}: ${(progress.loaded / progress.total * 100)}%`);
                },
                (error) => {
                    console.error(`Failed to load asset ${assetId}:`, error);
                    this.loadingPromises.delete(assetId);
                    reject(error);
                }
            );
        });
        
        this.loadingPromises.set(assetId, loadingPromise);
        const cached = await loadingPromise;
        return cached.clone();
    }

    /**
     * Preload multiple assets
     * @param {Array} assetList - Array of {category, key} objects
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<void>}
     */
    async preloadAssets(assetList, onProgress = null) {
        const total = assetList.length;
        let loaded = 0;
        
        const loadPromises = assetList.map(async ({category, key}) => {
            try {
                await this.loadAsset(category, key);
                loaded++;
                if (onProgress) {
                    onProgress(loaded, total, `${category}:${key}`);
                }
            } catch (error) {
                console.error(`Failed to preload ${category}:${key}:`, error);
                loaded++;
                if (onProgress) {
                    onProgress(loaded, total, `${category}:${key} (failed)`);
                }
            }
        });
        
        await Promise.all(loadPromises);
    }

    /**
     * Preload essential game assets
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<void>}
     */
    async preloadEssentialAssets(onProgress = null) {
        const essentialAssets = [
            // Enemy models
            { category: 'enemies', key: 'ufo-a' },
            { category: 'enemies', key: 'ufo-b' },
            { category: 'enemies', key: 'ufo-c' },
            { category: 'enemies', key: 'ufo-d' },
            
            // Tower bases and components
            { category: 'towers', key: 'tower-round-base' },
            { category: 'towers', key: 'tower-square-base' },
            { category: 'towers', key: 'tower-round-bottom-a' },
            { category: 'towers', key: 'tower-round-middle-a' },
            { category: 'towers', key: 'tower-round-top-a' },
            { category: 'towers', key: 'tower-square-bottom-a' },
            { category: 'towers', key: 'tower-square-middle-a' },
            { category: 'towers', key: 'tower-square-top-a' },
            { category: 'towers', key: 'tower-round-crystals' },
            
            // Weapons
            { category: 'weapons', key: 'turret' },
            { category: 'weapons', key: 'ballista' },
            { category: 'weapons', key: 'cannon' },
            { category: 'weapons', key: 'catapult' },
            
            // Projectiles
            { category: 'projectiles', key: 'bullet' },
            { category: 'projectiles', key: 'arrow' },
            { category: 'projectiles', key: 'cannonball' },
            { category: 'projectiles', key: 'boulder' },
            
            // Environment
            { category: 'environment', key: 'spawn-round' },
            { category: 'environment', key: 'tree' },
            { category: 'environment', key: 'rocks' },
            { category: 'environment', key: 'crystal' }
        ];
        
        await this.preloadAssets(essentialAssets, onProgress);
    }

    /**
     * Create a complete tower model by assembling parts
     * @param {string} towerType - Tower type configuration
     * @returns {Promise<THREE.Group>}
     */
    async createTowerModel(towerType) {
        const group = new THREE.Group();
        
        try {
            switch (towerType) {
                case 'basic':
                    const basicBase = await this.loadAsset('towers', 'tower-round-base');
                    const basicBottom = await this.loadAsset('towers', 'tower-round-bottom-a');
                    const basicMiddle = await this.loadAsset('towers', 'tower-round-middle-a');
                    const basicWeapon = await this.loadAsset('weapons', 'turret');
                    
                    group.add(basicBase);
                    basicBottom.position.y = 0.2;
                    group.add(basicBottom);
                    basicMiddle.position.y = 0.4;
                    group.add(basicMiddle);
                    basicWeapon.position.y = 0.8;
                    group.add(basicWeapon);
                    break;
                    
                case 'sniper':
                    const sniperBase = await this.loadAsset('towers', 'tower-square-base');
                    const sniperMiddle = await this.loadAsset('towers', 'tower-square-middle-a');
                    const sniperWeapon = await this.loadAsset('weapons', 'ballista');
                    
                    group.add(sniperBase);
                    sniperMiddle.position.y = 0.5;
                    group.add(sniperMiddle);
                    sniperWeapon.position.y = 1.0;
                    group.add(sniperWeapon);
                    break;
                    
                case 'rapid':
                    const rapidBase = await this.loadAsset('towers', 'tower-round-base');
                    const rapidBottom = await this.loadAsset('towers', 'tower-round-bottom-b');
                    const rapidTop = await this.loadAsset('towers', 'tower-round-top-a');
                    const rapidWeapon = await this.loadAsset('weapons', 'turret');
                    
                    group.add(rapidBase);
                    rapidBottom.position.y = 0.2;
                    group.add(rapidBottom);
                    rapidTop.position.y = 0.4;
                    group.add(rapidTop);
                    rapidWeapon.position.y = 0.7;
                    rapidWeapon.scale.set(0.8, 0.8, 0.8); // Smaller for rapid fire
                    group.add(rapidWeapon);
                    break;
                    
                case 'area':
                    const areaModel = await this.loadAsset('towers', 'tower-round-crystals');
                    group.add(areaModel);
                    break;
                    
                default:
                    throw new Error(`Unknown tower type: ${towerType}`);
            }
        } catch (error) {
            console.error(`Failed to create tower model for type ${towerType}:`, error);
            // Fallback to a simple base
            try {
                const fallbackBase = await this.loadAsset('towers', 'tower-round-base');
                group.add(fallbackBase);
            } catch (fallbackError) {
                console.error('Failed to load fallback tower model:', fallbackError);
            }
        }
        
        return group;
    }

    /**
     * Get projectile model for tower type
     * @param {string} towerType - Tower type
     * @returns {Promise<THREE.Group>}
     */
    async getProjectileModel(towerType) {
        const projectileMap = {
            'basic': 'bullet',
            'sniper': 'arrow', 
            'rapid': 'bullet',
            'area': 'boulder'
        };
        
        const projectileKey = projectileMap[towerType] || 'bullet';
        return await this.loadAsset('projectiles', projectileKey);
    }

    /**
     * Get enemy model for wave/type
     * @param {number} wave - Current wave number
     * @returns {Promise<THREE.Group>}
     */
    async getEnemyModel(wave) {
        const enemyTypes = ['ufo-a', 'ufo-b', 'ufo-c', 'ufo-d'];
        const typeIndex = Math.min(Math.floor((wave - 1) / 5), enemyTypes.length - 1);
        const enemyType = enemyTypes[typeIndex];
        
        return await this.loadAsset('enemies', enemyType);
    }

    /**
     * Clear cache to free memory
     */
    clearCache() {
        this.cache.clear();
        this.loadingPromises.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object}
     */
    getCacheStats() {
        return {
            cachedAssets: this.cache.size,
            loadingAssets: this.loadingPromises.size,
            categories: Object.keys(this.assetDefinitions)
        };
    }
}

// Export singleton instance
export const assetManager = new AssetManager(); 