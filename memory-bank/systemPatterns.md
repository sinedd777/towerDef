# System Patterns: Three.js Tower Defense Game

## Architecture Overview

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Input    │    │   Game Engine   │    │   Rendering     │
│                 │    │                 │    │                 │
│ • Mouse Clicks  │───▶│ • Game Loop     │───▶│ • Three.js      │
│ • Window Events │    │ • State Mgmt    │    │ • Scene Graph   │
│ • Keyboard      │    │ • Physics       │    │ • Lighting      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Game Objects  │    │   Game State    │    │   UI System     │
│                 │    │                 │    │                 │
│ • Enemies       │◄───┤ • Money/Score   │───▶│ • HUD Elements  │
│ • Towers        │    │ • Wave Progress │    │ • Instructions  │
│ • Projectiles   │    │ • Entity Lists  │    │ • Feedback      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Design Patterns

#### 1. Component Entity System (Simplified)
Each game object is a self-contained class with:
- **Data**: Position, state, properties
- **Behavior**: Update methods, interactions
- **Presentation**: Three.js mesh and materials

#### 2. Observer Pattern (Event-Driven Updates)
- GameState notifies UI elements when values change
- Automatic HUD updates without manual triggers
- Loose coupling between game logic and presentation

#### 3. Factory Pattern (Object Creation)
- Consistent object instantiation across the system
- Easy to extend with new types (tower variants, enemy types)
- Centralized parameter management

#### 4. State Machine (Implicit)
- Game progression through waves
- Tower states (idle, targeting, shooting, reloading)
- Enemy states (moving, taking damage, dying)

## Component Relationships

### Core Classes and Dependencies
```
main.js (Game Engine)
├── GameState.js (State Management)
├── Enemy.js (Game Entity)
├── Tower.js (Game Entity)
│   └── Projectile.js (Sub-Entity)
└── Three.js Scene Graph
    ├── Lighting System
    ├── Camera Controller
    └── Mesh Management
```

### Data Flow Patterns

#### 1. Game Loop Flow
```
RAF -> Update Game State -> Update Entities -> Update UI -> Render Frame
  ▲                                                                │
  └────────────────────────────────────────────────────────────────┘
```

#### 2. Input Processing Flow
```
Mouse Click -> Raycasting -> Grid Validation -> Tower Creation -> State Update
```

#### 3. Combat Resolution Flow
```
Tower Detection -> Target Acquisition -> Projectile Creation -> 
Collision Check -> Damage Application -> Entity Cleanup
```

## Key Design Decisions

### 1. Coordinate System
- **World Space**: Three.js standard (Y-up, right-handed)
- **Grid Alignment**: Integer coordinates for tower placement
- **Path Definition**: Predefined waypoints in world space
- **Camera Position**: Fixed isometric-style view for optimal gameplay

### 2. Performance Optimization Strategies
- **Object Pooling Ready**: Designed for easy pool implementation
- **Automatic Cleanup**: Dead entities removed each frame
- **Efficient Targeting**: Distance-based culling for tower AI
- **Minimal Geometry**: Simple shapes for smooth performance

### 3. Collision Detection System
- **Sphere-Sphere**: Simple distance checks for projectile hits
- **Grid-Based**: Discrete placement validation for towers
- **Path Validation**: Ensure towers don't block enemy movement
- **Range Checking**: Efficient radius-based targeting

### 4. State Management Architecture
```javascript
// Centralized state with automatic UI updates
class GameState {
    updateValue(property, newValue) {
        this[property] = newValue;
        this.updateHUD(); // Automatic UI synchronization
    }
}
```

## Modularity & Extension Points

### 1. Adding New Entity Types
```javascript
// Tower variants
class SniperTower extends Tower {
    constructor(x, y, z) {
        super(x, y, z);
        this.range = 6.0;      // Extended range
        this.fireRate = 0.3;   // Slower but powerful
        this.damage = 150;     // Higher damage
    }
}

// Enemy variants  
class FastEnemy extends Enemy {
    constructor(waypoints) {
        super(waypoints);
        this.speed = 2.0;      // Double speed
        this.health = 50;      // Less health
    }
}
```

### 2. UI Extension Pattern
```javascript
// GameState automatically handles new properties
addProperty(name, initialValue) {
    this[name] = initialValue;
    // UI elements auto-update if corresponding DOM exists
}
```

### 3. Visual Effects Extension
```javascript
// Particle system integration points
class Tower {
    shoot(target) {
        const projectile = new Projectile(/*...*/);
        this.spawnMuzzleFlash(); // Extension point
        return projectile;
    }
}
```

## Error Handling Patterns

### 1. Graceful Degradation
- Missing DOM elements don't break game logic
- Invalid positions default to safe values
- Null target checks prevent crashes

### 2. Resource Management
- Automatic mesh cleanup on entity removal
- Memory leak prevention through proper disposal
- Performance monitoring through frame rate tracking

### 3. Input Validation
- Grid snapping prevents invalid positions
- Money checks before tower placement
- Range validation for all interactions

## Testing Strategies

### 1. Component Isolation
Each class can be tested independently:
```javascript
// Enemy movement testing
const enemy = new Enemy(testWaypoints);
enemy.update(); // Deterministic movement
assert(enemy.mesh.position.equals(expectedPosition));
```

### 2. Integration Points
- Scene graph integrity
- State synchronization
- Event propagation

### 3. Performance Benchmarks
- Frame rate monitoring
- Memory usage tracking
- Entity count scaling tests

## Scalability Considerations

### 1. Performance Scaling
- Current: 50+ entities at 60 FPS
- Bottlenecks: Collision detection, rendering
- Solutions: Object pooling, LOD system, culling

### 2. Feature Scaling
- New tower types: Extend base class
- New enemy types: Polymorphic updates
- New levels: Data-driven waypoint system

### 3. Code Maintenance
- Clear separation of concerns
- Minimal interdependencies
- Comprehensive documentation 