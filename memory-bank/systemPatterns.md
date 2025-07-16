# System Patterns

## Architecture Overview

### Core Systems
1. **Game State Management**
   - Centralized state in `GameState.js`
   - Tracks money, score, waves, and enemies
   - Manages game progression

2. **Tower System**
   - Base `Tower` class in `Tower.js`
   - Tower type configurations in `TowerTypes.js`
   - Modular design for easy tower addition
   - Components:
     - Mesh rendering
     - Target acquisition
     - Attack mechanics
     - Range visualization

3. **Enemy System**
   - Enemy class with health and movement
   - Waypoint-based pathfinding
   - Automatic spawning system
   - Death and cleanup handling

4. **Projectile System**
   - Projectile class for tower attacks
   - Collision detection
   - Damage application
   - Visual effects

## Design Patterns

### Component-Based Architecture
- Each game entity (Tower, Enemy, Projectile) is a self-contained class
- Clear separation of concerns
- Modular and extensible design

### Observer Pattern
- Game state updates trigger UI refreshes
- Tower targeting system observes enemy positions
- Event-based interactions between systems

### Factory Pattern
- Tower creation based on type configurations
- Enemy spawning system
- Projectile generation

### Singleton Pattern
- Game state management
- Scene management
- Resource tracking

## Technical Implementation

### Three.js Integration
- Scene setup and management
- Camera controls
- Lighting and shadows
- Mesh management

### Performance Optimizations
- Object pooling ready
- Automatic cleanup of destroyed objects
- Optimized collision detection
- Shadow mapping configuration

### Event Handling
- Mouse interaction for tower placement
- Keyboard controls
- Window resize handling
- Touch support ready

## File Structure
```
src/
├── main.js         # Game loop and setup
├── Enemy.js        # Enemy behavior
├── Tower.js        # Tower mechanics
├── Projectile.js   # Projectile physics
├── GameState.js    # State management
└── TowerTypes.js   # Tower configurations
``` 