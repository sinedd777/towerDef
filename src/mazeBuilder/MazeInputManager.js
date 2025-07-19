import * as THREE from 'three';

export class MazeInputManager {
    constructor(scene, camera, renderer, ground, mazeState, mazeBuilderUI) {
        console.log('MazeInputManager created at:', Date.now());
        
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.ground = ground;
        this.mazeState = mazeState;
        this.mazeBuilderUI = mazeBuilderUI;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Add debouncing for key presses and clicks
        this.lastKeyPress = 0;
        this.lastClick = 0;
        this.keyDebounceTime = 200; // 200ms debounce
        this.clickDebounceTime = 300; // 300ms debounce for clicks
        
        // Store bound event handlers for cleanup
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundClick = this.onClick.bind(this);
        this.boundKeyDown = this.onKeyDown.bind(this);
        
        this.setupEventListeners();
        console.log('MazeInputManager setup complete');
    }

    setupEventListeners() {
        window.addEventListener('mousemove', this.boundMouseMove);
        window.addEventListener('click', this.boundClick);
        window.addEventListener('keydown', this.boundKeyDown);
    }

    cleanup() {
        console.log('MazeInputManager cleanup called at:', Date.now());
        // Remove event listeners
        window.removeEventListener('mousemove', this.boundMouseMove);
        window.removeEventListener('click', this.boundClick);
        window.removeEventListener('keydown', this.boundKeyDown);
        console.log('MazeInputManager event listeners removed');
        
        // Clear any preview shapes if they exist
        if (this.mazeState.shapePreview) {
            this.scene.remove(this.mazeState.shapePreview);
            this.mazeState.shapePreview = null;
        }
    }

    onKeyDown(event) {
        const currentTime = Date.now();
        if (currentTime - this.lastKeyPress < this.keyDebounceTime) {
            console.log('Key press ignored due to debouncing');
            return;
        }
        this.lastKeyPress = currentTime;
        
        if (event.key.toLowerCase() === 't') {
            // Select the first available shape from hand
            console.log('T pressed! Current hand:', this.mazeState.currentShapeHand.map(s => s.name));
            console.log('Currently selected shape:', this.mazeState.selectedShape?.name);
            if (this.mazeState.currentShapeHand.length > 0) {
                const nextShape = this.mazeState.currentShapeHand[0];
                console.log('Selecting shape:', nextShape.name, 'with cells:', nextShape.cells);
                this.mazeState.selectShape(nextShape);
                this.mazeBuilderUI.updateShapeSelection(nextShape);
            }
        } else if (event.key.toLowerCase() === 'r') {
            console.log('R pressed for rotation. Current selected shape:', this.mazeState.selectedShape?.name);
            this.mazeState.rotateSelectedShape();
        }
    }

    onMouseMove(event) {
        // Skip if clicking on UI elements
        if (event.target.closest('#card-container')) {
            return;
        }
        
        // Update mouse position
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update preview position if shape is selected
        if (this.mazeState.selectedShape) {
            this.updatePreviewPosition();
        }
    }

    updatePreviewPosition() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.mazeState.updatePreview(point.x, point.z);
        }
    }

    onClick(event) {
        // Prevent any event bubbling that might cause multiple triggers
        event.preventDefault();
        event.stopPropagation();
        
        const clickTime = Date.now();
        console.log('Click event triggered at:', clickTime, 'Last click was:', this.lastClick, 'Diff:', clickTime - this.lastClick);
        
        // Add click debouncing
        if (clickTime - this.lastClick < this.clickDebounceTime) {
            console.log('Click ignored due to debouncing (too soon after last click)');
            return;
        }
        this.lastClick = clickTime;
        
        // Skip if clicking on UI elements
        if (event.target.closest('#card-container')) {
            console.log('Click on UI element, ignoring');
            return;
        }

        if (!this.mazeState.selectedShape) {
            console.log('No shape selected, ignoring click');
            return;
        }
        
        console.log('Processing click for shape:', this.mazeState.selectedShape.name, 'at time:', clickTime);
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            
            // Store shape name before placement (since it gets cleared)
            const shapeName = this.mazeState.selectedShape.name;
            
            console.log('Attempting to place', shapeName, 'at', point.x, point.z, 'at time:', clickTime);
            
            // Try to place the shape
            if (this.mazeState.placeShape(point.x, point.z)) {
                // Shape placed successfully
                console.log('Shape placed successfully, calling UI update');
                this.mazeBuilderUI.onShapePlaced();
                console.log(`Placed ${shapeName} at (${Math.round(point.x)}, ${Math.round(point.z)})`);
                
                // Important: Update the click debounce time after successful placement
                this.lastClick = Date.now();
                console.log('Updated lastClick to:', this.lastClick);
            } else {
                // Invalid placement
                console.log('Cannot place shape here!');
                this.flashInvalidPlacement();
            }
        } else {
            console.log('No intersection with ground found');
        }
    }

    flashInvalidPlacement() {
        // Create a visual feedback for invalid placement
        if (this.mazeState.shapePreview) {
            const originalColor = this.mazeState.selectedShape.color;
            
            // Flash red
            this.mazeState.shapePreview.material.color.setHex(0xff0000);
            this.mazeState.shapePreview.material.opacity = 0.8;
            
            // Return to original color after a short delay
            setTimeout(() => {
                if (this.mazeState.shapePreview) {
                    this.mazeState.shapePreview.material.color.setHex(originalColor);
                    this.mazeState.shapePreview.material.opacity = 0.6;
                }
            }, 200);
        }
    }
} 