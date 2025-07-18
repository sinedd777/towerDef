import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { loadTexture } from '../utils/textureLoader.js';

export class SceneSetup {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.labelRenderer = null;
        this.controls = null;
        this.ground = null;
    }

    /**
     * Initialize the complete scene setup
     * @param {boolean} enableControls - Whether to enable orbit controls (false for multiplayer)
     * @returns {Object} - Contains scene, camera, renderer, labelRenderer, controls, ground
     */
    initialize(enableControls = true) {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createLabelRenderer();
        this.setupLighting();
        this.createGround();
        
        if (enableControls) {
            this.createControls();
        }

        return {
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer,
            labelRenderer: this.labelRenderer,
            controls: this.controls,
            ground: this.ground
        };
    }

    createScene() {
        this.scene = new THREE.Scene();
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 20, 15);
        this.camera.lookAt(0, 0, 0);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Enhanced shadow and rendering settings
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.6;
        this.renderer.sortObjects = true;
        this.renderer.setClearColor(0x000000, 1);
        
        document.body.appendChild(this.renderer.domElement);
    }

    createLabelRenderer() {
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        document.body.appendChild(this.labelRenderer.domElement);
    }

    createControls() {
        if (!this.camera || !this.renderer) {
            throw new Error('Camera and renderer must be created before controls');
        }

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 20;
        this.controls.maxPolarAngle = Math.PI / 2.1; // Prevent camera from going below ground
        this.controls.update();
    }

    setupLighting() {
        // Enhanced lighting setup for 3D models - much brighter for Kenney assets
        const ambientLight = new THREE.AmbientLight(0x606060, 0.8);
        this.scene.add(ambientLight);

        // Main directional light (sun)
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.4);
        mainLight.position.set(10, 15, 8);
        mainLight.castShadow = true;

        // Enhanced shadow settings
        mainLight.shadow.mapSize.width = 4096;
        mainLight.shadow.mapSize.height = 4096;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 50;
        mainLight.shadow.camera.left = -25;
        mainLight.shadow.camera.right = 25;
        mainLight.shadow.camera.top = 25;
        mainLight.shadow.camera.bottom = -25;
        mainLight.shadow.bias = -0.0001;
        mainLight.shadow.normalBias = 0.02;

        this.scene.add(mainLight);

        // Secondary fill light for softer shadows
        const fillLight = new THREE.DirectionalLight(0x4444ff, 0.3);
        fillLight.position.set(-8, 8, -8);
        this.scene.add(fillLight);

        // Rim light for model definition
        const rimLight = new THREE.DirectionalLight(0xffd700, 0.4);
        rimLight.position.set(0, 5, -10);
        this.scene.add(rimLight);

        // Point lights for dynamic illumination near spawn points
        const spawnLight = new THREE.PointLight(0x00ff00, 0.5, 10);
        spawnLight.position.set(-8, 2, -8); // Near enemy spawn
        this.scene.add(spawnLight);

        const endLight = new THREE.PointLight(0xff0000, 0.5, 10);
        endLight.position.set(8, 2, 8); // Near enemy end
        this.scene.add(endLight);
    }

    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const snowTexture = loadTexture('/assets/textures/snow01.png', 10, 10);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            map: snowTexture,
            color: 0x1B4332 // Dark green color to match oklch(44.8% 0.119 151.328)
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        if (this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }

        if (this.renderer) {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }

        if (this.labelRenderer) {
            this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.controls) {
            this.controls.dispose();
        }

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }

        if (this.labelRenderer) {
            if (this.labelRenderer.domElement.parentNode) {
                this.labelRenderer.domElement.parentNode.removeChild(this.labelRenderer.domElement);
            }
        }

        if (this.ground) {
            this.ground.geometry.dispose();
            this.ground.material.dispose();
        }
    }
} 