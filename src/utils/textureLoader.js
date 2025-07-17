// Texture loading utility with basic caching support for Three.js
// Usage: const texture = loadTexture(url, repeatX, repeatY);
import * as THREE from 'three';

// Simple in-memory cache so we don't fetch the same image multiple times
const textureCache = new Map();

/**
 * Load (and cache) a texture.
 * @param {string} url - Image URL to load.
 * @param {number} [repeatX=1] - How many times to repeat horizontally.
 * @param {number} [repeatY=1] - How many times to repeat vertically.
 * @returns {THREE.Texture}
 */
export function loadTexture(url, repeatX = 1, repeatY = 1) {
    if (textureCache.has(url)) return textureCache.get(url);

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';

    const texture = loader.load(url, (tex) => {
        // Ensure the texture can tile nicely if requested
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
    });

    textureCache.set(url, texture);
    return texture;
} 