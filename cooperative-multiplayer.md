# Cooperative Multiplayer Implementation Plan

## Executive Summary

**Objective:** Transform the current competitive dual-map multiplayer into a cooperative single-map experience where two players work together using shared resources to defend against enemy waves.

**Key Changes:**
- Single shared 20x20 map (instead of dual maps)
- Turn-based placement system (eliminates concurrency issues)
- Shared resources (health, money, score)
- Automatic phase transitions
- Dual enemy spawn points with single exit point

**Target Timeline:** 4-6 weeks

---

## Current State vs Target State

| **Current Multiplayer** | **Target Cooperative** |
|---|---|
| 2 separate 20x20 maps at (-12.5,0,0) and (12.5,0,0) | 1 shared 20x20 map at (0,0,0) |
| Competitive gameplay | Cooperative gameplay |
| Individual player resources | Shared health (100), money ($150), score |
| Real-time placement with conflicts | Turn-based placement system |
| Complex UI synchronization | Simple turn indicators |
| Player-specific enemy spawning | Shared enemy defense with dual spawn points |

---

## Technical Architecture

### Game State Structure
```javascript
CooperativeGameState {
    // Shared resources
    sharedResources: {
        health: 100,
        money: 150, 
        score: 0,
        wave: 1
    },
    
    // Turn management
    gamePhase: 'building' | 'defense',
    currentTurn: 'player1' | 'player2',
    
    // Shape placement tracking
    shapesPlaced: {
        player1: 0,  // max 10
        player2: 0   // max 10
    },
    
    // Single shared board
    gameBoard: {
        mazePieces: Map(),
        towers: Map(),
        enemies: Map(),
        projectiles: Map()
    },
    
    // Dual spawn system
    spawnPoints: [
        {x: -8, z: -8, id: 'spawn1'},  // Northwest
        {x: -8, z: 8, id: 'spawn2'}    // Southwest
    ],
    exitPoint: {x: 8, z: 0}  // East center
}
```

### Game Flow
```
Phase 1: Building (20 turns total)
├── Turn 1: Player1 places shape 1/10
├── Turn 2: Player2 places shape 1/10
├── Turn 3: Player1 places shape 2/10
├── ...
├── Turn 19: Player1 places shape 10/10
└── Turn 20: Player2 places shape 10/10 → AUTO-START DEFENSE

Phase 2: Defense (unlimited turns)
├── Turn 1: Player1 places/upgrades tower
├── Turn 2: Player2 places/upgrades tower
└── Continue while enemies spawn...
```

---

## Implementation Plan

### Phase 1: Core Architecture (Week 1)

#### Task 1.1: Scene Architecture Changes
**Files to modify:**
- `src/multiplayer/MultiplayerScene.js`

**Specific changes:**
- [ ] Remove dual map system from `setupMainGameArea()`
- [ ] Create single 20x20 grid centered at origin (0,0,0)
- [ ] Update `getPlayerArea()` to return same bounds for both players
- [ ] Add spawn point indicators at (-8,-8) and (-8,8)
- [ ] Add exit point indicator at (8,0)
- [ ] Remove player-specific positioning logic

**Success criteria:**
- Both players see identical game area
- Spawn/exit points visible in scene
- No player-specific map positioning

#### Task 1.2: Server State Management
**Files to create/modify:**
- `server/game/CooperativeGameState.js` (new)
- `server/game/GameSession.js` (modify)

**Specific changes:**
- [ ] Create `CooperativeGameState` class with shared resources
- [ ] Implement turn management system
- [ ] Add shape placement counting (max 10 per player)
- [ ] Implement automatic defense phase transition
- [ ] Remove player-specific map bounds validation
- [ ] Update `GameSession` to use cooperative state

**Success criteria:**
- Server tracks shared resources correctly
- Turn switching works properly
- Phase transition triggers at 20 total shapes

#### Task 1.3: Network Protocol Updates
**Files to modify:**
- `src/network/NetworkManager.js`
- `server/handlers/` (various)

**Specific changes:**
- [ ] Update message format for turn-based actions
- [ ] Add turn validation in server handlers
- [ ] Implement state synchronization for shared resources
- [ ] Remove player-specific area restrictions
- [ ] Add cooperative game state broadcasting

**Success criteria:**
- Turn-based messages work correctly
- State syncs between both clients
- No race conditions in message handling

### Phase 2: Building Phase Implementation (Week 2)

#### Task 2.1: Turn-Based Shape Placement
**Files to modify:**
- `src/modes/MultiplayerGame.js`
- `src/mazeBuilder/MazeInputManager.js`
- `server/game/GameLogic.js`

**Specific changes:**
- [ ] Modify shape placement to check current turn
- [ ] Disable interaction when not player's turn
- [ ] Implement client-side path validation before server call
- [ ] Add turn switching after successful placement
- [ ] Update UI to show whose turn it is

**Success criteria:**
- Only current turn player can place shapes
- Path validation prevents invalid placements
- Turns switch automatically after placement
- Clear visual feedback for turn state

#### Task 2.2: Shape Hand Management
**Files to modify:**
- `src/mazeBuilder/MazeBuilderUI.js`
- `src/mazeBuilder/MazeState.js`

**Specific changes:**
- [ ] Track shapes remaining per player
- [ ] Hide shape selection UI when not player's turn
- [ ] Show countdown (e.g., "Shapes: 7/10")
- [ ] Disable shape selection for non-active player

**Success criteria:**
- Shape UI only active during player's turn
- Accurate shape counters displayed
- Smooth UI state transitions

#### Task 2.3: Automatic Defense Transition
**Files to modify:**
- `server/game/CooperativeGameState.js`
- `src/modes/MultiplayerGame.js`

**Specific changes:**
- [ ] Count total shapes placed across both players
- [ ] Trigger defense phase when count reaches 20
- [ ] Switch UI from maze building to tower building
- [ ] Reset turn to player1 for defense phase
- [ ] Broadcast phase change to both clients

**Success criteria:**
- Defense phase starts automatically after 20 shapes
- UI transitions smoothly to tower building mode
- Both players see defense phase simultaneously

### Phase 3: Defense Phase Implementation (Week 3)

#### Task 3.1: Turn-Based Tower Operations
**Files to modify:**
- `src/modes/MultiplayerGame.js`
- `src/ui/TowerSelectionUI.js`
- `server/game/GameLogic.js`

**Specific changes:**
- [ ] Implement turn-based tower placement
- [ ] Add turn-based tower upgrading
- [ ] Add turn-based tower selling
- [ ] Block tower UI when not player's turn
- [ ] Update shared money after tower operations

**Success criteria:**
- Only active player can perform tower operations
- Shared money updates correctly
- Turn switches after each tower action
- No ghost modes or complex locking needed

#### Task 3.2: Dual Spawn Point System
**Files to modify:**
- `src/Pathfinding.js`
- `server/game/CooperativeGameState.js`
- `src/Enemy.js`

**Specific changes:**
- [ ] Extend pathfinding to handle multiple spawn points
- [ ] Calculate paths from both spawn points to exit
- [ ] Validate at least one viable path exists
- [ ] Update enemy spawning for dual spawn points
- [ ] Ensure enemies can spawn from either viable spawn

**Success criteria:**
- Pathfinding works with 2 spawn points + 1 exit
- Enemies spawn from viable spawn points only
- Path validation prevents completely blocked scenarios
- Visual path indicators show both possible routes

#### Task 3.3: Shared Resource Management
**Files to modify:**
- `src/GameState.js`
- `src/ui/` (various UI files)

**Specific changes:**
- [ ] Update all UI to show shared resources
- [ ] Implement shared money for tower purchases
- [ ] Add shared health loss when enemies escape
- [ ] Update shared score when enemies are killed
- [ ] Remove player-specific resource tracking

**Success criteria:**
- UI shows shared resources for both players
- Money deductions work from shared pool
- Health loss affects both players equally
- Score increases benefit both players

### Phase 4: UI and Polish (Week 4)

#### Task 4.1: Turn Indicator System
**Files to create/modify:**
- `src/ui/TurnIndicatorUI.js` (new)
- `src/modes/MultiplayerGame.js`

**Specific changes:**
- [ ] Create clear turn indicator UI component
- [ ] Show "Your Turn" vs "Player2's Turn" states
- [ ] Add waiting indicators and animations
- [ ] Display shapes remaining counters
- [ ] Add phase transition notifications

**Success criteria:**
- Clear visual indication of whose turn it is
- Smooth transitions between turn states
- Progress indicators for game phases
- Professional, polished appearance

#### Task 4.2: Interaction Blocking
**Files to modify:**
- `src/ui/` (all interactive UI components)

**Specific changes:**
- [ ] Disable shape cards when not player's turn
- [ ] Disable tower buttons when not player's turn
- [ ] Add visual "blocked" states (grayed out, disabled)
- [ ] Show helpful messages ("Wait for Player2...")
- [ ] Implement smooth enable/disable transitions

**Success criteria:**
- No confusion about when interaction is allowed
- Clear visual feedback for blocked states
- Helpful messaging for waiting players
- No accidental invalid actions possible

#### Task 4.3: Error Handling and Edge Cases
**Files to modify:**
- `src/network/NetworkManager.js`
- `server/handlers/` (various)

**Specific changes:**
- [ ] Handle player disconnection during turn
- [ ] Implement graceful reconnection with state sync
- [ ] Add timeout handling for unresponsive players (optional)
- [ ] Handle invalid actions with clear error messages
- [ ] Add state validation and recovery mechanisms

**Success criteria:**
- Graceful handling of network issues
- Clear error messages for invalid actions
- Robust state synchronization
- Game continues smoothly after reconnection

---

## File Modifications Required

### New Files to Create
```
server/game/CooperativeGameState.js     - Main cooperative game state
src/ui/TurnIndicatorUI.js              - Turn management UI
cooperative-multiplayer.md             - This documentation
```

### Existing Files to Modify
```
Core Architecture:
├── src/multiplayer/MultiplayerScene.js        - Single map, spawn points
├── src/modes/MultiplayerGame.js               - Cooperative game logic
├── src/network/NetworkManager.js              - Turn-based messaging
└── server/game/GameSession.js                 - Use cooperative state

Building Phase:
├── src/mazeBuilder/MazeInputManager.js        - Turn-based shape placement
├── src/mazeBuilder/MazeBuilderUI.js           - Turn-aware UI
└── src/mazeBuilder/MazeState.js               - Shape hand management

Defense Phase:
├── src/ui/TowerSelectionUI.js                 - Turn-based tower operations
├── src/Pathfinding.js                         - Dual spawn pathfinding
├── src/Enemy.js                               - Multi-spawn enemy creation
└── server/game/GameLogic.js                   - Cooperative validation

Resources & UI:
├── src/GameState.js                           - Shared resources
├── src/ui/MultiplayerStatusUI.js              - Shared resource display
└── server/handlers/GameEventHandler.js        - Cooperative events
```

---

## Testing Checklist

### Phase 1 Testing
- [ ] Both players connect to same game session
- [ ] Both players see identical single map
- [ ] Server tracks turn state correctly
- [ ] Basic state synchronization works

### Phase 2 Testing  
- [ ] Shape placement alternates between players
- [ ] Non-active player cannot place shapes
- [ ] Path validation prevents blocking all routes
- [ ] Defense phase starts automatically after 20 shapes

### Phase 3 Testing
- [ ] Tower operations alternate between players
- [ ] Shared money updates correctly
- [ ] Enemies spawn from both viable spawn points
- [ ] Path recalculation works when towers placed

### Phase 4 Testing
- [ ] Turn indicators clear and accurate
- [ ] UI blocking prevents invalid actions
- [ ] Error handling works for edge cases
- [ ] Full game playable end-to-end

---

## Success Criteria

### Functional Requirements
- ✅ Two players can play cooperatively on shared map
- ✅ Turn-based system prevents concurrency issues
- ✅ Shared resources (health, money, score) work correctly
- ✅ Building phase → Defense phase transition is automatic
- ✅ Dual spawn points create strategic complexity
- ✅ No race conditions or synchronization issues

### User Experience Requirements
- ✅ Clear indication of whose turn it is
- ✅ Intuitive UI that blocks invalid actions
- ✅ Smooth transitions between game phases
- ✅ Helpful feedback messages
- ✅ Professional, polished appearance

### Technical Requirements
- ✅ Robust state synchronization
- ✅ Graceful error handling
- ✅ Network disconnection recovery
- ✅ No performance degradation vs single player
- ✅ Maintainable, well-documented code

---

## Development Notes

### Key Design Decisions
1. **Turn-based over real-time:** Eliminates 80% of concurrency complexity
2. **Automatic phase transition:** No player coordination needed for phase changes
3. **No ghost modes:** Simple UI blocking instead of complex preview synchronization
4. **Shared everything:** Resources, map, objectives all shared between players
5. **Client-side validation:** Path validation happens client-side before server call

### Potential Challenges
1. **Dual spawn pathfinding:** Need to ensure at least one spawn point remains viable
2. **UI state management:** Keep turn indicators and blocking in sync
3. **Network edge cases:** Handle disconnections gracefully during turns
4. **Player balance:** Ensure both players contribute equally to strategy

### Future Enhancements (Post-MVP)
- Spectator mode for additional players
- Turn timer for competitive play
- Replay system for reviewing strategies
- Multiple difficulty levels with different spawn/exit configurations
- Chat system for player coordination

---

## Contact & Updates

This document should be updated as implementation progresses. Key changes should be documented with dates and reasoning.

**Last Updated:** [Date]
**Version:** 1.0
**Status:** Planning Phase 