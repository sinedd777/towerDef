import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class MultiplayerCamera {
    constructor(renderer) {
        this.renderer = renderer;
        this.currentCamera = null;
        this.currentControls = null;
        this.cameraMode = 'wide'; // 'wide', 'player1', 'player2'
        
        // Camera configurations
        this.cameras = {};
        this.controls = {};
        
        this.setupCameras();
        this.setupControls();
        
        // Start with wide view
        this.setCameraMode('wide');
    }
    
    setupCameras() {
        const aspect = window.innerWidth / window.innerHeight;
        
        // Wide view camera to see both maps
        this.cameras.wide = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.cameras.wide.position.set(0, 25, 20);  // Centered between both maps
        this.cameras.wide.lookAt(0, 0, 0);          // Look at center point
        
        // Player 1 focused camera (left map)
        this.cameras.player1 = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.cameras.player1.position.set(-12.5, 20, 15); // Focus on left map
        this.cameras.player1.lookAt(-12.5, 0, 0);         // Look at player 1 map center
        
        // Player 2 focused camera (right map)
        this.cameras.player2 = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.cameras.player2.position.set(12.5, 20, 15);  // Focus on right map
        this.cameras.player2.lookAt(12.5, 0, 0);          // Look at player 2 map center
        
        // Alternative strategic overview camera
        this.cameras.overview = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.cameras.overview.position.set(0, 40, 0);     // Top-down view
        this.cameras.overview.lookAt(0, 0, 0);
    }
    
    setupControls() {
        // Wide view controls
        this.controls.wide = new OrbitControls(this.cameras.wide, this.renderer.domElement);
        this.setupControlProperties(this.controls.wide, { x: 0, y: 0, z: 0 }, 15, 30);
        
        // Player 1 controls
        this.controls.player1 = new OrbitControls(this.cameras.player1, this.renderer.domElement);
        this.setupControlProperties(this.controls.player1, { x: -12.5, y: 0, z: 0 }, 8, 25);
        
        // Player 2 controls
        this.controls.player2 = new OrbitControls(this.cameras.player2, this.renderer.domElement);
        this.setupControlProperties(this.controls.player2, { x: 12.5, y: 0, z: 0 }, 8, 25);
        
        // Overview controls (more restricted)
        this.controls.overview = new OrbitControls(this.cameras.overview, this.renderer.domElement);
        this.setupControlProperties(this.controls.overview, { x: 0, y: 0, z: 0 }, 20, 50);
        this.controls.overview.maxPolarAngle = Math.PI / 3; // Limit to prevent going below ground
        
        // Disable all controls initially
        Object.values(this.controls).forEach(control => {
            control.enabled = false;
        });
    }
    
    setupControlProperties(controls, target, minDistance, maxDistance) {
        controls.target.set(target.x, target.y, target.z);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = minDistance;
        controls.maxDistance = maxDistance;
        controls.maxPolarAngle = Math.PI / 2.1; // Prevent camera from going below ground
        
        // Customize pan and zoom speeds
        controls.panSpeed = 0.8;
        controls.zoomSpeed = 1.0;
        controls.rotateSpeed = 0.5;
        
        // Limit horizontal rotation for player-specific cameras
        if (target.x !== 0) {
            controls.minAzimuthAngle = -Math.PI / 3; // 60 degrees left
            controls.maxAzimuthAngle = Math.PI / 3;  // 60 degrees right
        }
    }
    
    setCameraMode(mode) {
        if (!this.cameras[mode]) {
            console.warn(`Camera mode '${mode}' does not exist`);
            return;
        }
        
        // Disable current controls
        if (this.currentControls) {
            this.currentControls.enabled = false;
        }
        
        // Switch to new camera and controls
        this.cameraMode = mode;
        this.currentCamera = this.cameras[mode];
        this.currentControls = this.controls[mode];
        
        // Enable new controls
        this.currentControls.enabled = true;
        this.currentControls.update();
        
        console.log(`Camera mode switched to: ${mode}`);
        
        // Trigger camera change event
        this.onCameraModeChanged?.(mode);
    }
    
    // Get the currently active camera
    getCamera() {
        return this.currentCamera;
    }
    
    // Get the currently active controls
    getControls() {
        return this.currentControls;
    }
    
    // Update camera controls (call in animation loop)
    update() {
        if (this.currentControls && this.currentControls.enabled) {
            this.currentControls.update();
        }
    }
    
    // Smooth transition between camera modes
    transitionToMode(mode, duration = 1000) {
        if (!this.cameras[mode] || mode === this.cameraMode) return;
        
        const startCamera = this.currentCamera;
        const targetCamera = this.cameras[mode];
        
        // Create temporary camera for interpolation
        const tempCamera = startCamera.clone();
        
        const startPosition = startCamera.position.clone();
        const targetPosition = targetCamera.position.clone();
        const startQuaternion = startCamera.quaternion.clone();
        const targetQuaternion = targetCamera.quaternion.clone();
        
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Smooth easing function
            const easeProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
            
            // Interpolate position
            tempCamera.position.lerpVectors(startPosition, targetPosition, easeProgress);
            
            // Interpolate rotation
            tempCamera.quaternion.slerpQuaternions(startQuaternion, targetQuaternion, easeProgress);
            
            // Use the interpolated camera
            this.currentCamera = tempCamera;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Transition complete, switch to the target mode
                this.setCameraMode(mode);
            }
        };
        
        animate();
    }
    
    // Focus on a specific player's area
    focusOnPlayer(playerId, animate = true) {
        const mode = playerId === 'player1' ? 'player1' : 'player2';
        
        if (animate) {
            this.transitionToMode(mode);
        } else {
            this.setCameraMode(mode);
        }
    }
    
    // Focus on a specific world position
    focusOnPosition(position, distance = 15) {
        if (!this.currentControls) return;
        
        // Smoothly move the camera target
        const targetPosition = new THREE.Vector3(position.x, 0, position.z);
        
        // Calculate new camera position based on current angle but new target
        const currentOffset = this.currentCamera.position.clone().sub(this.currentControls.target);
        const newCameraPosition = targetPosition.clone().add(currentOffset);
        
        // Animate the transition
        this.animateToTarget(targetPosition, newCameraPosition);
    }
    
    animateToTarget(newTarget, newPosition, duration = 1000) {
        if (!this.currentControls) return;
        
        const startTarget = this.currentControls.target.clone();
        const startPosition = this.currentCamera.position.clone();
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
            
            // Interpolate target
            this.currentControls.target.lerpVectors(startTarget, newTarget, easeProgress);
            
            // Interpolate camera position
            this.currentCamera.position.lerpVectors(startPosition, newPosition, easeProgress);
            
            this.currentControls.update();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    // Handle window resize
    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        
        // Update all cameras
        Object.values(this.cameras).forEach(camera => {
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
        });
    }
    
    // Get available camera modes
    getAvailableModes() {
        return Object.keys(this.cameras);
    }
    
    // Set custom camera position and target
    setCustomView(position, target) {
        if (!this.currentCamera || !this.currentControls) return;
        
        this.currentCamera.position.copy(position);
        this.currentControls.target.copy(target);
        this.currentControls.update();
    }
    
    // Get current camera info
    getCameraInfo() {
        if (!this.currentCamera || !this.currentControls) return null;
        
        return {
            mode: this.cameraMode,
            position: this.currentCamera.position.clone(),
            target: this.currentControls.target.clone(),
            zoom: this.currentCamera.zoom,
            fov: this.currentCamera.fov
        };
    }
    
    // Reset camera to default position for current mode
    resetToDefault() {
        if (!this.currentCamera || !this.currentControls) return;
        
        // Get the default setup for current mode
        const defaultCamera = new THREE.PerspectiveCamera();
        this.setupDefaultPosition(defaultCamera, this.cameraMode);
        
        // Animate to default position
        this.animateToTarget(
            defaultCamera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-1).add(defaultCamera.position),
            defaultCamera.position
        );
    }
    
    setupDefaultPosition(camera, mode) {
        switch (mode) {
            case 'wide':
                camera.position.set(0, 25, 20);
                break;
            case 'player1':
                camera.position.set(-12.5, 20, 15);
                break;
            case 'player2':
                camera.position.set(12.5, 20, 15);
                break;
            case 'overview':
                camera.position.set(0, 40, 0);
                break;
        }
    }
    
    // Enable/disable camera controls
    setControlsEnabled(enabled) {
        if (this.currentControls) {
            this.currentControls.enabled = enabled;
        }
    }
    
    // Set camera movement boundaries
    setBoundaries(minX, maxX, minZ, maxZ) {
        Object.values(this.controls).forEach(controls => {
            // This would require custom implementation or third-party plugin
            // for boundary limiting in OrbitControls
            controls.minPolarAngle = 0;
            controls.maxPolarAngle = Math.PI / 2;
        });
    }
    
    // Create split-screen view (for advanced multiplayer viewing)
    createSplitView() {
        // This would require more complex rendering setup
        // with multiple viewports, cameras, and render targets
        console.log('Split-view rendering not implemented yet');
    }
    
    // Event callback setter
    setOnCameraModeChanged(callback) {
        this.onCameraModeChanged = callback;
    }
    
    // Cleanup
    dispose() {
        // Dispose of controls
        Object.values(this.controls).forEach(controls => {
            controls.dispose();
        });
        
        // Clear references
        this.cameras = {};
        this.controls = {};
        this.currentCamera = null;
        this.currentControls = null;
    }
} 