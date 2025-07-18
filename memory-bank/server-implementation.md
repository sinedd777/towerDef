# Server Implementation Documentation

## Overview
The multiplayer server has been fully implemented using Node.js + Express + Socket.IO architecture. The server provides authoritative game state management, real-time communication, and comprehensive player/session management.

## Server Architecture

### Core Components

#### 1. Main Server (`server/index.js`)
- **Port**: 4000 (configurable via PORT env var)
- **CORS**: Configured for development (localhost:3000, localhost:5173, localhost:4000)
- **Health Check**: `GET /health` - Returns server status and metrics
- **Metrics**: `GET /metrics` - Detailed server performance data

#### 2. Game Session Management (`server/game/GameSession.js`)
- **Session Lifecycle**: waiting → ready → active → paused → ended
- **Player Capacity**: 2 players + unlimited spectators
- **Game Loop**: 60 ticks/second for real-time updates
- **State Management**: Delta-based updates for efficiency
- **Auto-cleanup**: Sessions cleaned up after inactivity

#### 3. Game State Authority (`server/game/GameState.js`)
- **Authoritative Control**: Server validates all actions
- **Dual Maps**: Player 1 at (-12.5,0,0), Player 2 at (12.5,0,0)
- **Map Bounds**: 20x20 units per player
- **Entity Management**: Towers, enemies, projectiles, maze pieces
- **Health System**: 100 HP, 10 damage per escaped enemy

#### 4. Game Logic Validation (`server/game/GameLogic.js`)
- **Rate Limiting**: Prevents spam/cheating
- **Action Validation**: All player actions validated
- **Cost Management**: Tower costs, upgrades, selling
- **Phase Control**: Building → Defense phase transitions

### Event System

#### Session Events
```javascript
// Client → Server
'session:create'        // Create new game session
'session:join'          // Join existing session
'session:leave'         // Leave current session
'session:list'          // Get available sessions
'game:start'            // Start game (host only)
'game:ready'            // Mark player as ready

// Server → Client
'session:created'       // Session created successfully
'session:joined'        // Joined session successfully
'session:ready'         // All players ready
'game:start'            // Game started
'game:end'              // Game ended
```

#### Gameplay Events
```javascript
// Client → Server
'tower:place'           // Place tower
'tower:upgrade'         // Upgrade tower
'tower:sell'            // Sell tower
'maze:place'            // Place maze piece
'maze:remove'           // Remove maze piece
'game:phase_transition' // Switch game phase

// Server → Client
'tower:placed'          // Tower placed successfully
'tower:upgraded'        // Tower upgraded
'maze:placed'           // Maze piece placed
'game:state_update'     // Real-time state sync
'player:action'         // Other player's action
```

### Security & Anti-Cheat

#### Rate Limiting
- **Tower placement**: Max 10 per 100ms
- **Tower upgrades**: Max 5 per 200ms
- **Maze placement**: Max 20 per 50ms

#### Validation Layers
1. **Data validation**: Type checking, range validation
2. **Game rules**: Phase restrictions, resource checks
3. **Spatial validation**: Boundary checks, collision detection
4. **Player ownership**: Can only modify own objects

### Performance Features

#### Network Optimization
- **Delta Updates**: Only send changed data
- **Compression**: Efficient state representation
- **Batching**: Group related events
- **Priority Updates**: Critical events first

#### Memory Management
- **Session Cleanup**: Automatic removal of inactive sessions
- **Player Cleanup**: Remove disconnected players
- **Object Pooling**: Reuse game objects when possible

## Client Integration Guide

### Required Dependencies
Add to client package.json:
```json
{
  "socket.io-client": "^4.7.4"
}
```

### NetworkManager Structure
The client needs to implement:

```javascript
// src/multiplayer/NetworkManager.js
class NetworkManager {
    constructor() {
        this.socket = null;
        this.sessionId = null;
        this.playerId = null;
        this.connected = false;
        this.reconnectAttempts = 0;
    }
    
    connect(serverUrl = 'http://localhost:4000') {
        // Initialize Socket.IO connection
    }
    
    createSession(playerName, maxPlayers = 2) {
        // Create new game session
    }
    
    joinSession(sessionId, playerName) {
        // Join existing session
    }
    
    sendAction(action, data) {
        // Send game action to server
    }
    
    onStateUpdate(callback) {
        // Register for state updates
    }
    
    onGameEvent(event, callback) {
        // Register for specific game events
    }
}
```

### Scene Layout Requirements

#### Dual Map Setup
```javascript
// Player 1 Map: Center at (-12.5, 0, 0)
// Player 2 Map: Center at (12.5, 0, 0)
// Gap: 5 units between maps
// Map Size: 20x20 units each

const player1Ground = createGround(-12.5, 0, 0);
const player2Ground = createGround(12.5, 0, 0);
```

#### Camera Configuration
```javascript
// Wide view to see both maps
camera.position.set(0, 25, 20);
camera.lookAt(0, 0, 0);

// Or player-specific cameras
const player1Camera = new Camera();
player1Camera.position.set(-12.5, 20, 15);
player1Camera.lookAt(-12.5, 0, 0);
```

### UI Components Needed

#### Unified Status Bar
- Display both players' stats simultaneously
- Health, money, score, wave progress
- Connection status indicator
- Session ID display

#### Private Control Panels
- Maze builder (private to each player)
- Tower selection (private to each player)
- Current phase indicator
- Player's current money

#### Input Boundaries
```javascript
const playerBounds = {
    player1: { minX: -22.5, maxX: -2.5, minZ: -10, maxZ: 10 },
    player2: { minX: 2.5, maxX: 22.5, minZ: -10, maxZ: 10 }
};
```

## Testing the Server

### Starting the Server
```bash
# Install dependencies
npm install

# Start server
npm run server

# Or with auto-restart
npm run server:dev
```

### Health Check
```bash
curl http://localhost:4000/health
```

### WebSocket Testing
Use browser console to test basic connection:
```javascript
const socket = io('http://localhost:4000');
socket.on('connect', () => console.log('Connected:', socket.id));
socket.emit('session:create', { playerName: 'Test Player' });
```

## Configuration Options

### Environment Variables
- `PORT`: Server port (default: 4000)
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level (debug/info/warn/error)

### Customizable Settings
- `MAX_PLAYERS`: Players per session (default: 2)
- `TICK_RATE`: Game loop frequency (default: 60 FPS)
- `SESSION_TIMEOUT`: Inactive session cleanup (default: 30 min)
- `MATCHMAKING_TIMEOUT`: Queue timeout (default: 30 sec)

## Known Limitations

### Current Implementation
1. **In-Memory Storage**: Sessions stored in memory (not persistent)
2. **Single Server**: No horizontal scaling yet
3. **Basic Matchmaking**: Simple compatibility matching
4. **No Database**: Player stats not persisted

### Future Enhancements
1. **Redis Integration**: For session persistence
2. **Database**: For player profiles and statistics
3. **Load Balancing**: Multiple server instances
4. **Advanced Matchmaking**: ELO-based matching

## Error Handling

### Common Error Scenarios
1. **Session Not Found**: Player tries to join non-existent session
2. **Session Full**: Player tries to join full session (becomes spectator)
3. **Rate Limited**: Player sends too many actions
4. **Invalid Action**: Action doesn't pass validation
5. **Disconnection**: Player loses connection during game

### Client Error Handling
The client should handle these events:
- `session:error` - Session-related errors
- `game:error` - Game-related errors
- `tower:place_failed` - Action failures
- `disconnect` - Connection lost

## Next Steps for UI Implementation

1. **Create NetworkManager** - Socket.IO client wrapper
2. **Build MultiplayerScene** - Dual-map 3D scene
3. **Implement UI Components** - Status bar and controls
4. **Add Input Handling** - Player-specific boundaries
5. **Integrate State Sync** - Real-time updates
6. **Test Multiplayer Flow** - End-to-end gameplay

The server is ready and waiting for client connections. All the foundational multiplayer infrastructure is in place. 