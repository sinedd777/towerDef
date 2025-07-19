import * as THREE from 'three';

export class SpectatorOverlay {
    constructor() {
        this.overlayElement = null;
        this.miniCanvas = null;
        this.miniRenderer = null;
        this.miniCamera = null;
        this.miniScene = null;
        this.isVisible = false;
        
        this.createOverlay();
        this.setupMiniRenderer();
    }
    
    createOverlay() {
        // Create overlay container
        this.overlayElement = document.createElement('div');
        this.overlayElement.className = 'spectator-overlay';
        this.overlayElement.innerHTML = `
            <div class="spectator-header">
                <h3>Opponent's Game</h3>
                <button class="toggle-btn">📺</button>
            </div>
            <div class="spectator-content">
                <canvas class="mini-canvas"></canvas>
                <div class="spectator-stats">
                    <div class="stat">Health: <span id="opponent-health">100</span></div>
                    <div class="stat">Score: <span id="opponent-score">0</span></div>
                    <div class="stat">Wave: <span id="opponent-wave">1</span></div>
                    <div class="stat">Money: <span id="opponent-money">$150</span></div>
                </div>
            </div>
        `;
        
        // Add CSS styles
        const style = document.createElement('style');
        style.textContent = `
            .spectator-overlay {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 200px;
                max-height: 180px;
                background: rgba(0, 0, 0, 0.8);
                border: 1px solid #4CAF50;
                border-radius: 6px;
                color: white;
                font-family: Arial, sans-serif;
                font-size: 11px;
                z-index: 1000;
                transition: all 0.3s ease;
            }
            
            .spectator-overlay.minimized {
                height: 30px;
                overflow: hidden;
            }
            
            .spectator-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 5px 8px;
                background: rgba(76, 175, 80, 0.1);
                border-bottom: 1px solid #4CAF50;
            }
            
            .spectator-header h3 {
                margin: 0;
                font-size: 11px;
                color: #4CAF50;
            }
            
            .toggle-btn {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 12px;
                padding: 1px 4px;
                border-radius: 2px;
            }
            
            .toggle-btn:hover {
                background: rgba(255, 255, 255, 0.1);
            }
            
            .spectator-content {
                padding: 6px;
            }
            
            .mini-canvas {
                width: 100%;
                height: 80px;
                border: 1px solid #555;
                border-radius: 3px;
                background: #222;
            }
            
            .spectator-stats {
                margin-top: 6px;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 3px;
            }
            
            .stat {
                font-size: 10px;
                padding: 2px 4px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 2px;
                text-align: center;
            }
        `;
        document.head.appendChild(style);
        
        // Add event listeners
        const toggleBtn = this.overlayElement.querySelector('.toggle-btn');
        toggleBtn.addEventListener('click', () => this.toggle());
        
        // Add to page
        document.body.appendChild(this.overlayElement);
        this.miniCanvas = this.overlayElement.querySelector('.mini-canvas');
    }
    
    setupMiniRenderer() {
        // Create mini renderer for opponent's game view
        this.miniRenderer = new THREE.WebGLRenderer({ 
            canvas: this.miniCanvas,
            antialias: false,
            alpha: true
        });
        this.miniRenderer.setSize(188, 80); // Adjusted for smaller size
        this.miniRenderer.setClearColor(0x87CEEB, 1);
        
        // Create mini camera
        this.miniCamera = new THREE.PerspectiveCamera(60, 188/80, 0.1, 1000);
        this.miniCamera.position.set(0, 30, 25); // Adjusted for better overview
        this.miniCamera.lookAt(0, 0, 0);
        
        // Create mini scene
        this.miniScene = new THREE.Scene();
        this.miniScene.background = new THREE.Color(0x87CEEB);
        
        // Add basic lighting
        const ambientLight = new THREE.AmbientLight(0x606060, 0.6);
        this.miniScene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        this.miniScene.add(directionalLight);
        
        // Create ground for opponent's view
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2D1B32  // Purple for opponent
        });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        this.miniScene.add(ground);
    }
    
    toggle() {
        this.overlayElement.classList.toggle('minimized');
        this.isVisible = !this.overlayElement.classList.contains('minimized');
    }
    
    show() {
        this.overlayElement.style.display = 'block';
        this.overlayElement.classList.remove('minimized');
        this.isVisible = true;
    }
    
    hide() {
        this.overlayElement.style.display = 'none';
        this.isVisible = false;
    }
    
    updateOpponentStats(stats) {
        const healthEl = this.overlayElement.querySelector('#opponent-health');
        const scoreEl = this.overlayElement.querySelector('#opponent-score');
        const waveEl = this.overlayElement.querySelector('#opponent-wave');
        const moneyEl = this.overlayElement.querySelector('#opponent-money');
        
        if (healthEl) healthEl.textContent = stats.health || '100';
        if (scoreEl) scoreEl.textContent = stats.score || '0';
        if (waveEl) waveEl.textContent = stats.wave || '1';
        if (moneyEl) moneyEl.textContent = `$${stats.money || '150'}`;
    }
    
    updateOpponentGameState(gameData) {
        if (!this.isVisible || !this.miniRenderer) return;
        
        // Clear existing objects (except ground and lights)
        const objectsToRemove = [];
        this.miniScene.traverse((object) => {
            if (object.userData.isOpponentObject) {
                objectsToRemove.push(object);
            }
        });
        objectsToRemove.forEach(obj => this.miniScene.remove(obj));
        
        // Add opponent's maze blocks
        if (gameData.mazeBlocks) {
            gameData.mazeBlocks.forEach(block => {
                const geometry = new THREE.BoxGeometry(1, 0.5, 1);
                const material = new THREE.MeshLambertMaterial({ color: 0xff4444 });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(block.x, 0.25, block.z);
                mesh.userData.isOpponentObject = true;
                this.miniScene.add(mesh);
            });
        }
        
        // Add opponent's towers
        if (gameData.towers) {
            gameData.towers.forEach(tower => {
                const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 8);
                const material = new THREE.MeshLambertMaterial({ color: 0x4444ff });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(tower.x, 0.5, tower.z);
                mesh.userData.isOpponentObject = true;
                this.miniScene.add(mesh);
            });
        }
        
        // Add opponent's enemies
        if (gameData.enemies) {
            gameData.enemies.forEach(enemy => {
                const geometry = new THREE.SphereGeometry(0.2, 8, 6);
                const material = new THREE.MeshLambertMaterial({ color: 0xff8800 });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(enemy.x, 0.3, enemy.z);
                mesh.userData.isOpponentObject = true;
                this.miniScene.add(mesh);
            });
        }
        
        // Render the mini scene
        this.miniRenderer.render(this.miniScene, this.miniCamera);
    }
    
    cleanup() {
        if (this.miniRenderer) {
            this.miniRenderer.dispose();
        }
        
        if (this.overlayElement && this.overlayElement.parentNode) {
            this.overlayElement.parentNode.removeChild(this.overlayElement);
        }
    }
} 