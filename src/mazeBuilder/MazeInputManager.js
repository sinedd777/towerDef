import * as THREE from 'three';

export class MazeInputManager {
    constructor(scene, camera, renderer, ground, mazeState, mazeBuilderUI) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.ground = ground;
        this.mazeState = mazeState;
        this.mazeBuilderUI = mazeBuilderUI;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('click', this.onClick.bind(this));
        window.addEventListener('keydown', this.onKeyDown.bind(this));
    }

    onKeyDown(event) {
        if (event.key.toLowerCase() === 't') {
            // Select the first available shape from hand
            if (this.mazeState.currentShapeHand.length > 0) {
                const nextShape = this.mazeState.currentShapeHand[0];
                this.mazeState.selectShape(nextShape);
                this.mazeBuilderUI.updateShapeSelection(nextShape);
            }
        } else if (event.key.toLowerCase() === 'r') {
            this.mazeState.rotateSelectedShape();
        }
    }

    onMouseMove(event) {
        // Skip if clicking on UI elements
        if (event.target.closest('#maze-builder-panel')) {
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
        // Skip if clicking on UI elements
        if (event.target.closest('#maze-builder-panel')) {
            return;
        }

        if (!this.mazeState.selectedShape) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            
            // Try to place the shape
            if (this.mazeState.placeShape(point.x, point.z)) {
                // Shape placed successfully
                this.mazeBuilderUI.onShapePlaced();
                console.log(`Placed ${this.mazeState.selectedShape?.name || 'shape'} at (${Math.round(point.x)}, ${Math.round(point.z)})`);
            } else {
                // Invalid placement
                console.log('Cannot place shape here!');
                this.flashInvalidPlacement();
            }
        }
    }

    flashInvalidPlacement() {
        // Create a visual feedback for invalid placement
        if (this.mazeState.shapePreview) {
            const originalColor = this.mazeState.selectedShape.color;
            
            // Flash red
            this.mazeState.shapePreview.children.forEach(block => {
                block.material.color.setHex(0xff0000);
                block.material.opacity = 0.8;
            });
            
            // Return to original color after a short delay
            setTimeout(() => {
                if (this.mazeState.shapePreview) {
                    this.mazeState.shapePreview.children.forEach(block => {
                        block.material.color.setHex(originalColor);
                        block.material.opacity = 0.6;
                    });
                }
            }, 200);
        }
    }
} 