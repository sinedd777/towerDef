# Three.js Tower Defense Game

A simple but fully functional tower defense game built with Three.js and modern web technologies.

## Features

✅ **Complete Project Setup**
- Modern bundler (Vite) with hot reload
- ES6 modules and clean project structure
- Optimized Three.js integration

✅ **3D Scene & Visualization**
- Perspective camera with proper controls
- Dynamic lighting with shadows
- Responsive design that adapts to window resizing
- Grid-based playing field with visual path

✅ **Enemy System**
- Enemies spawn automatically every 2 seconds
- Smooth movement along predefined waypoints
- Visual health feedback when taking damage
- Automatic cleanup when reaching the end

✅ **Tower Defense Mechanics**
- Click-to-place tower system with grid snapping
- Range visualization for each tower
- Automatic target acquisition (closest enemy priority)
- Rotating barrels that aim at targets
- Shooting with cooldown and fire rate

✅ **Projectile System**
- Homing projectiles with target prediction
- Collision detection and damage application
- Visual feedback and particle effects
- Automatic cleanup for performance

✅ **Game Management**
- Money system ($20 per tower, $10 per kill)
- Score tracking (100 points per enemy)
- Wave progression (every 10 kills)
- Real-time HUD updates

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone and setup:**
```bash
# Install dependencies
npm install
```

2. **Run development server:**
```bash
npm run dev
```

3. **Open your browser:**
   - Navigate to `http://localhost:3000`
   - The game should load automatically

### Build for Production
```bash
npm run build
npm run preview
```

## How to Play

1. **Objective**: Prevent enemies (red spheres) from reaching the end of the path
2. **Placing Towers**: Click on any grid position to place a blue tower ($20 each)
3. **Strategy**: Place towers within range of the enemy path (green circles show range)
4. **Progression**: Earn money by destroying enemies, unlock new waves
5. **Tips**: 
   - Towers automatically target the closest enemy in range
   - Plan your tower placement to maximize coverage
   - Save money for strategic tower placement

## Project Structure

```
three-tower-defense/
├── src/
│   ├── main.js         # Main game loop and scene setup
│   ├── Enemy.js        # Enemy movement and behavior
│   ├── Tower.js        # Tower targeting and shooting
│   ├── Projectile.js   # Bullet physics and collision
│   └── GameState.js    # Game data and HUD management
├── index.html          # HTML template with embedded CSS
├── package.json        # Dependencies and scripts
├── vite.config.js      # Build configuration
└── README.md          # This file
```

## Technical Details

- **Engine**: Three.js for 3D rendering
- **Bundler**: Vite for fast development and building
- **Physics**: Custom collision detection optimized for tower defense
- **Performance**: Object pooling ready, shadow mapping enabled
- **Compatibility**: Modern browsers with WebGL support

## Development

### Adding New Features

The codebase is modular and easy to extend:

- **New Enemy Types**: Extend the `Enemy` class
- **Tower Varieties**: Create new classes inheriting from `Tower`
- **Power-ups**: Add new projectile types in `Projectile.js`
- **UI Elements**: Modify the HUD in `GameState.js`

### Performance Notes

- Enemies and projectiles are cleaned up automatically
- Shadow mapping is optimized for the scene size
- Object pooling can be added for better performance with many objects

## License

MIT License - feel free to use this as a learning resource or starting point for your own games! 