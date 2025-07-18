# Multiplayer UI Design Documentation

## Overview
This document outlines the multiplayer user interface design for the tower defense game, featuring a competitive dual-map layout where two players compete side-by-side with private controls and unified status display.

## Core Design Philosophy
- **Private Gameplay**: Each player has their own 20x20 map with private controls
- **Competitive View**: Both maps visible simultaneously for strategic observation
- **Unified Status**: Shared display of player statistics for competitive comparison
- **Independent Control**: Maze building and tower selection remain private to each player

## 3D Scene Layout

### Map Positioning
```
World Coordinate System (Top View):

    Player 1 Map                    Player 2 Map
┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │
│  (-22.5, 0, -10)    │     │   (2.5, 0, -10)     │
│         ┌─────────────────────────┐         │
│         │                         │         │
│         │    5-unit gap           │         │
│         │                         │         │
│         └─────────────────────────┘         │
│                     │     │                     │
│  (-22.5, 0, 10)     │     │   (2.5, 0, 10)      │
└─────────────────────┘     └─────────────────────┘

Center: (-12.5, 0, 0)        Center: (12.5, 0, 0)
Size: 20x20 units           Size: 20x20 units
Gap: 5 units between maps
```

### Camera Configuration
- **Wide View Camera**: Position (0, 25, 20) looking at (0, 0, 0)
- **Player-Specific Cameras**: 
  - Player 1: Position (-12.5, 20, 15) looking at (-12.5, 0, 0)
  - Player 2: Position (12.5, 20, 15) looking at (12.5, 0, 0)

## UI Layout Design

### Full Screen Layout
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  UNIFIED STATUS BAR                                                             │
│  Player 1: ❤️100/100  💰$150  🏆2,500  │  Player 2: ❤️85/100  💰$200  🏆3,200   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│     PLAYER 1 MAP                    GAP                    PLAYER 2 MAP         │
│  ┌─────────────────────┐         ┌─────┐         ┌─────────────────────┐       │
│  │                     │         │     │         │                     │       │
│  │   Your Game Area    │         │     │         │  Opponent's Area    │       │
│  │                     │         │     │         │                     │       │
│  │  [3D Tower Defense] │         │ 5   │         │ [3D Tower Defense]  │       │
│  │                     │         │unit │         │                     │       │
│  │  - Your towers      │         │gap  │         │ - Opponent towers   │       │
│  │  - Your enemies     │         │     │         │ - Opponent enemies  │       │
│  │  - Your maze        │         │     │         │ - Opponent maze     │       │
│  │                     │         │     │         │                     │       │
│  └─────────────────────┘         └─────┘         └─────────────────────┘       │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  YOUR PRIVATE CONTROLS                                                          │
│  Maze Builder: [🧱] [🔳] [🔲] [🔺]     Tower Selection: [💠] [🗼] [⚡] [🏹]      │
│  Current Phase: Building Maze          Money: $150     Wave: 3                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### Scene Management
```javascript
// src/multiplayer/MultiplayerScene.js
class MultiplayerScene {
    constructor() {
        this.scene = new THREE.Scene();
        
        // Create two separate game areas
        this.player1Area = new GameArea(-12.5, 0, 0, 20); // Left map
        this.player2Area = new GameArea(12.5, 0, 0, 20);  // Right map
        
        this.setupMaps();
        this.setupVisualSeparation();
    }
    
    setupMaps() {
        // Player 1 ground (left)
        const ground1 = this.createGround(-12.5, 0, 0);
        ground1.userData.owner = 'player1';
        this.scene.add(ground1);
        
        // Player 2 ground (right)  
        const ground2 = this.createGround(12.5, 0, 0);
        ground2.userData.owner = 'player2';
        this.scene.add(ground2);
    }
    
    setupVisualSeparation() {
        // Optional: Add visual separator in the gap
        const separatorGeometry = new THREE.PlaneGeometry(1, 20);
        const separatorMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x444444, 
            transparent: true, 
            opacity: 0.3 
        });
        const separator = new THREE.Mesh(separatorGeometry, separatorMaterial);
        separator.rotation.x = -Math.PI / 2;
        separator.position.set(0, 0.01, 0); // Center between maps
        this.scene.add(separator);
    }
    
    createGround(x, y, z) {
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            map: this.loadTexture('/assets/textures/snow01.png'),
            color: 0x1B4332 
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(x, y, z);
        ground.receiveShadow = true;
        return ground;
    }
}
```

### Camera Management
```javascript
// src/rendering/MultiplayerCamera.js
class MultiplayerCamera {
    constructor() {
        // Wide camera to see both maps
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Position camera to see both maps
        this.camera.position.set(0, 25, 20);  // Centered between both maps
        this.camera.lookAt(0, 0, 0);          // Look at center point
        
        // Or for player-specific views:
        this.playerCameras = {
            player1: this.createPlayerCamera(-12.5), // Focus on left map
            player2: this.createPlayerCamera(12.5)   // Focus on right map
        };
    }
    
    createPlayerCamera(xOffset) {
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(xOffset, 20, 15);
        camera.lookAt(xOffset, 0, 0);
        return camera;
    }
}
```

### Input Management (Player-Specific)
```javascript
// src/multiplayer/MultiplayerInputManager.js
class MultiplayerInputManager {
    constructor(scene, camera, renderer, gameState, localPlayerId) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.gameState = gameState;
        this.localPlayerId = localPlayerId; // 'player1' or 'player2'
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Define interaction boundaries for each player
        this.playerBounds = {
            player1: { minX: -22.5, maxX: -2.5, minZ: -10, maxZ: 10 },
            player2: { minX: 2.5, maxX: 22.5, minZ: -10, maxZ: 10 }
        };
        
        this.setupEventListeners();
    }
    
    handleClick(event) {
        this.updateMousePosition(event);
        
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        for (const intersect of intersects) {
            const point = intersect.point;
            
            // Only allow interaction with own map area
            if (this.isInPlayerArea(point, this.localPlayerId)) {
                this.processInteraction(intersect);
                break;
            }
        }
    }
    
    isInPlayerArea(point, playerId) {
        const bounds = this.playerBounds[playerId];
        return point.x >= bounds.minX && point.x <= bounds.maxX &&
               point.z >= bounds.minZ && point.z <= bounds.maxZ;
    }
    
    processInteraction(intersect) {
        // Only process interactions on the player's own map
        if (this.gameState.isMazeBuilding()) {
            this.handleMazePlacement(intersect);
        } else if (this.gameState.isDefensePhase()) {
            this.handleTowerPlacement(intersect);
        }
    }
}
```

## UI Components

### Unified Status Display
```javascript
// src/ui/MultiplayerStatusUI.js
class MultiplayerStatusUI {
    constructor() {
        this.createStatusBar();
    }
    
    createStatusBar() {
        this.statusContainer = document.createElement('div');
        this.statusContainer.className = 'multiplayer-status-bar';
        this.statusContainer.innerHTML = `
            <div class="status-bar">
                <div class="player-stats player1-stats">
                    <span class="player-name">Player 1 (You)</span>
                    <span class="health">❤️ <span id="p1-health">100</span>/100</span>
                    <span class="money">💰 $<span id="p1-money">150</span></span>
                    <span class="score">🏆 <span id="p1-score">2500</span></span>
                    <span class="wave">Wave: <span id="p1-wave">1</span></span>
                </div>
                
                <div class="game-info">
                    <span class="session-id">Session: #AB4D2F</span>
                    <span class="connection">●●●○ 45ms</span>
                </div>
                
                <div class="player-stats player2-stats">
                    <span class="player-name">Player 2 (Opponent)</span>
                    <span class="health">❤️ <span id="p2-health">85</span>/100</span>
                    <span class="money">💰 $<span id="p2-money">200</span></span>
                    <span class="score">🏆 <span id="p2-score">3200</span></span>
                    <span class="wave">Wave: <span id="p2-wave">1</span></span>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.statusContainer);
    }
    
    updatePlayerStats(playerId, stats) {
        document.getElementById(`${playerId}-health`).textContent = stats.health;
        document.getElementById(`${playerId}-money`).textContent = stats.money;
        document.getElementById(`${playerId}-score`).textContent = stats.score;
        document.getElementById(`${playerId}-wave`).textContent = stats.wave;
    }
}
```

### Private Control Panels
```javascript
// src/ui/PrivateControlPanel.js
class PrivateControlPanel {
    constructor(playerId, gameState) {
        this.playerId = playerId;
        this.gameState = gameState;
        this.createPrivateUI();
    }
    
    createPrivateUI() {
        this.container = document.createElement('div');
        this.container.className = 'private-controls';
        this.container.innerHTML = `
            <div class="control-panel">
                <div class="maze-controls" id="maze-controls-${this.playerId}">
                    <h3>Your Maze Builder</h3>
                    <div class="shape-selector">
                        <!-- Tetris shapes for this player only -->
                    </div>
                </div>
                
                <div class="tower-controls" id="tower-controls-${this.playerId}">
                    <h3>Your Towers</h3>
                    <div class="tower-selector">
                        <button class="tower-btn" data-tower="basic">💠 Basic ($20)</button>
                        <button class="tower-btn" data-tower="sniper">🗼 Sniper ($30)</button>
                        <button class="tower-btn" data-tower="cannon">⚡ Cannon ($40)</button>
                        <button class="tower-btn" data-tower="missile">🏹 Missile ($50)</button>
                    </div>
                </div>
                
                <div class="phase-info">
                    <span class="current-phase">Phase: <span id="phase-${this.playerId}">Building</span></span>
                    <span class="your-money">Your Money: $<span id="money-${this.playerId}">150</span></span>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
    }
}
```

## CSS Styling

### Status Bar Styling
```css
/* src/styles/multiplayer.css */
.multiplayer-status-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    border-bottom: 2px solid #0f3460;
    z-index: 1000;
}

.status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 100%;
    padding: 0 20px;
    color: white;
}

.player-stats {
    display: flex;
    gap: 15px;
    align-items: center;
}

.player1-stats {
    border-left: 4px solid #4CAF50;
    padding-left: 10px;
}

.player2-stats {
    border-right: 4px solid #F44336;
    padding-right: 10px;
}

.game-info {
    text-align: center;
    font-size: 14px;
    opacity: 0.8;
}
```

### Control Panel Styling
```css
.private-controls {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 120px;
    background: rgba(26, 26, 46, 0.95);
    border-top: 2px solid #0f3460;
    z-index: 1000;
}

.control-panel {
    display: flex;
    justify-content: space-around;
    align-items: center;
    height: 100%;
    padding: 0 20px;
}

.tower-btn {
    background: linear-gradient(145deg, #2d3748, #4a5568);
    border: none;
    border-radius: 8px;
    color: white;
    padding: 8px 12px;
    margin: 0 5px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.tower-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.tower-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.maze-controls, .tower-controls {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px;
    backdrop-filter: blur(10px);
}

.phase-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
    text-align: center;
    color: white;
}
```

## Visual Features

### Player Identification
- **Tower Color Coding**: 
  - Player 1: Green highlights (#4CAF50)
  - Player 2: Red highlights (#F44336)
- **Map Boundaries**: Subtle visual separators
- **Name Tags**: Floating labels above player objects
- **Action Indicators**: Real-time visual feedback for opponent actions

### Connection Status Indicators
```
Connection Quality:
●●●● Excellent (0-50ms)
●●●○ Good (51-100ms)  
●●○○ Fair (101-200ms)
●○○○ Poor (201ms+)
```

## Network Synchronization

### Synchronized Data
1. **Tower placements** (position, type, level)
2. **Enemy spawns and movements** 
3. **Health/damage events**
4. **Score/money updates**
5. **Phase transitions** (maze → defense)

### Private Data (Not Synchronized)
- Maze building UI state
- Tower selection UI state
- Player's current money display
- Individual control inputs
- UI interaction states

## Responsive Design

### Desktop Layout (1920x1080+)
- Full dual-map view
- Complete status bar
- Expanded control panels

### Tablet Layout (768x1024)
- Compressed dual-map view
- Condensed status bar
- Collapsible control panels

### Mobile Layout (375x667)
- Single-map focus with toggle
- Minimal status indicators
- Bottom sheet controls

## Accessibility Features

### Visual Accessibility
- **Colorblind Support**: Alternative visual indicators beyond colors
- **High Contrast Mode**: Enhanced visibility options
- **Text Scaling**: Adjustable UI size for different screen sizes

### Input Accessibility
- **Keyboard Navigation**: Full keyboard support for all multiplayer functions
- **Touch Gestures**: Mobile-friendly touch controls
- **Voice Commands**: Optional voice control integration

## Performance Considerations

### Rendering Optimization
- **LOD System**: Level-of-detail for distant objects
- **Culling**: Hide objects outside view frustum
- **Instanced Rendering**: Efficient tower/enemy rendering

### Network Optimization
- **Delta Compression**: Only send changed data
- **Prediction**: Client-side prediction for smooth gameplay
- **Interpolation**: Smooth animation between network updates

## Testing Strategy

### UI Testing
- Multi-resolution testing
- Cross-browser compatibility
- Touch device testing
- Accessibility compliance

### Network Testing
- High latency scenarios
- Packet loss simulation
- Connection interruption recovery
- Synchronization accuracy 