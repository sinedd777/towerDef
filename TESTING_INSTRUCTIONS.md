# Cooperative Multiplayer Testing Instructions

## Prerequisites
1. Start the server: `cd server && node index.js`
2. Open two browser tabs/windows for testing
3. Ensure cooperative mode is enabled (default in GameSession.js)

## Phase 1 Testing: Core Architecture

### Test 1.1: Basic Connection and Session Setup
**Expected Result:** Two players can connect and join the same cooperative session

**Steps:**
1. **Tab 1:** Open game → Select Multiplayer → Start matchmaking
2. **Tab 2:** Open game → Select Multiplayer → Start matchmaking
3. **Verify:** Both players are matched and join the same session
4. **Verify:** Both players see identical single 20x20 map centered at origin
5. **Verify:** Turn indicator shows "player1's Turn" and "Building Phase"
6. **Verify:** Spawn points visible at (-8,-8) and (-8,8), exit at (8,0)

**Success Criteria:**
- ✅ Both players connected to same session
- ✅ Single shared map displayed for both players  
- ✅ Turn indicator UI appears and shows correct initial state
- ✅ Spawn/exit points visible in scene

### Test 1.2: Shared Resources Display
**Expected Result:** Both players see the same shared resources

**Steps:**
1. **Both Tabs:** Check turn indicator displays
2. **Verify:** Health: 100, Money: $150, Score: 0, Wave: 1
3. **Verify:** Both players see identical resource values

**Success Criteria:**
- ✅ Shared resources displayed correctly for both players
- ✅ Values match between both clients

### Test 1.3: Turn System Validation
**Expected Result:** Only the active player can interact

**Steps:**
1. **Tab 1 (player1):** Should see "Your Turn!" in green
2. **Tab 1:** Select a shape and try to place it → Should work
3. **Tab 2 (player2):** Should see "player1's Turn" in blue
4. **Tab 2:** Try to select/place a shape → Should be blocked
5. **Tab 2:** Click anywhere → Should show "Wait for your turn!" message

**Success Criteria:**
- ✅ Active player can interact normally
- ✅ Non-active player interactions are blocked
- ✅ Clear visual feedback for turn state
- ✅ Helpful error messages for blocked actions

## Phase 2 Testing: Building Phase Implementation

### Test 2.1: Turn-Based Shape Placement
**Expected Result:** Shape placement alternates between players automatically

**Steps:**
1. **Tab 1 (player1):** Place first shape → Turn should switch to player2
2. **Tab 2 (player2):** Place second shape → Turn should switch back to player1
3. **Repeat:** Continue alternating for several placements
4. **Verify:** Turn indicator updates after each placement
5. **Verify:** Shape counters increment correctly (e.g., "Shapes: 4/20 (16 remaining)")

**Success Criteria:**
- ✅ Turns switch automatically after each placement
- ✅ Turn indicator updates correctly
- ✅ Shape progress displays accurately
- ✅ No race conditions or double placements

### Test 2.2: Shape Hand Management
**Expected Result:** UI shows whose turn it is and disables appropriately

**Steps:**
1. **Active Player:** Card interface should be fully interactive
2. **Non-Active Player:** Card interface should be grayed out
3. **Verify:** Hover effects work only for active player
4. **Verify:** Key presses (T, R) work only for active player

**Success Criteria:**
- ✅ UI disables for non-active player
- ✅ Visual feedback clear and immediate
- ✅ No confusion about interaction state

### Test 2.3: Automatic Defense Transition
**Expected Result:** Defense phase starts automatically after 20 total shapes

**Steps:**
1. **Both Players:** Continue placing shapes alternately
2. **Track Progress:** Watch shape counter approach 20
3. **At Shape 20:** Should see "Defense Phase Starting!" overlay
4. **Verify:** Turn indicator changes to "Defense Phase"
5. **Verify:** Maze builder UI disappears
6. **Verify:** Tower selection UI appears
7. **Verify:** Turn resets to player1 for defense

**Success Criteria:**
- ✅ Automatic transition triggers at exactly 20 shapes
- ✅ Phase transition overlay displays
- ✅ UI transitions smoothly to tower mode
- ✅ Turn system continues in defense phase

## Defense Phase Testing

### Test 3.1: Turn-Based Tower Operations
**Expected Result:** Tower placement alternates between players

**Steps:**
1. **Tab 1 (player1):** Place a tower → Should deduct from shared money
2. **Verify:** Turn switches to player2
3. **Tab 2 (player2):** Place a tower → Money deducts again
4. **Verify:** Turn switches back to player1
5. **Test:** Try placing tower without enough money → Should show error

**Success Criteria:**
- ✅ Tower placement alternates between players
- ✅ Shared money deducts correctly
- ✅ Error handling for insufficient funds
- ✅ Turn switching works in defense phase

### Test 3.2: Shared Resource Updates
**Expected Result:** All resource changes affect both players equally

**Steps:**
1. **Simulate:** Let an enemy reach the end (if possible)
2. **Verify:** Health decreases for both players
3. **Simulate:** Kill an enemy with towers
4. **Verify:** Score and money increase for both players

**Success Criteria:**
- ✅ Health loss affects both players
- ✅ Score/money gains shared between players
- ✅ UI updates immediately for both clients

## Error Handling and Edge Cases

### Test 4.1: Player Disconnection
**Expected Result:** Game handles disconnection gracefully

**Steps:**
1. **During Building:** Close one browser tab
2. **Verify:** Other player sees disconnection message
3. **Reconnect:** Refresh the closed tab
4. **Verify:** Player can rejoin and see current game state

**Success Criteria:**
- ✅ Graceful handling of disconnections
- ✅ State synchronization on reconnection
- ✅ Clear messaging about connection status

### Test 4.2: Invalid Actions
**Expected Result:** Server validates all actions and provides feedback

**Steps:**
1. **Try:** Placing shape out of bounds
2. **Try:** Placing overlapping shapes
3. **Try:** Placing tower on maze pieces
4. **Verify:** Clear error messages for each case

**Success Criteria:**
- ✅ All invalid actions rejected with helpful messages
- ✅ No client-side crashes or inconsistencies
- ✅ Game state remains synchronized

### Test 4.3: Path Validation
**Expected Result:** Players cannot completely block all paths

**Steps:**
1. **Attempt:** Build maze that blocks all paths from spawn to exit
2. **Verify:** Path validation prevents invalid configurations
3. **Verify:** Visual path indicator shows viable routes

**Success Criteria:**
- ✅ Path validation works correctly
- ✅ Visual feedback for path viability
- ✅ Defense phase only starts with valid paths

## Performance Testing

### Test 5.1: Network Performance
**Expected Result:** Smooth gameplay with minimal latency

**Steps:**
1. **Monitor:** Network tab in browser dev tools
2. **Check:** Message frequency and size
3. **Verify:** No excessive network traffic
4. **Test:** Rapid shape placement to test rate limiting

**Success Criteria:**
- ✅ Network traffic reasonable and efficient
- ✅ Rate limiting prevents abuse
- ✅ Minimal latency for turn switches

### Test 5.2: UI Responsiveness
**Expected Result:** UI updates smoothly without lag

**Steps:**
1. **Test:** Rapid turn switching
2. **Verify:** UI animations smooth
3. **Check:** No memory leaks during extended play
4. **Monitor:** Browser performance

**Success Criteria:**
- ✅ Smooth UI transitions
- ✅ No memory leaks or performance degradation
- ✅ Responsive controls throughout gameplay

## Success Summary

Once all tests pass, you should have:

✅ **Working cooperative multiplayer** with 2 players on shared map  
✅ **Turn-based shape placement** preventing concurrency issues  
✅ **Shared resources** (health, money, score) working correctly  
✅ **Automatic phase transitions** from building to defense  
✅ **Clear UI feedback** for turns and game state  
✅ **Robust error handling** with helpful messages  
✅ **Network resilience** with reconnection support  

## Common Issues and Solutions

### Issue: Turn indicator not updating
**Solution:** Check network event handlers in MultiplayerGame.js, ensure setOnTurnChanged is called

### Issue: Shape placement not working
**Solution:** Verify MazeInputManager receives networkManager parameter and turn validation logic

### Issue: Defense phase not starting
**Solution:** Check CooperativeGameState.placeMazePiece method for shape counting and phase transition

### Issue: Shared resources not syncing
**Solution:** Verify server broadcasts game:state_update events and clients handle them properly

### Issue: UI elements overlapping
**Solution:** Check z-index values in TurnIndicatorUI and other UI components

---

**Last Updated:** [Current Date]  
**Implementation Status:** Phase 1 & 2 Complete  
**Next Phase:** Phase 3 & 4 (Enhanced Defense, Polish) 