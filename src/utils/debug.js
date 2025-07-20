// Debug utility for tracking enemy generation and multiplayer issues
export const DEBUG_CONFIG = {
    // Enemy generation logging
    ENEMY_SPAWN_SERVER: true,    // Server-side enemy creation
    ENEMY_SPAWN_CLIENT: true,    // Client-side enemy reception
    ENEMY_UPDATES: true,         // Enemy movement and state updates
    ENEMY_BROADCAST: true,       // Network broadcasting
    
    // Game loop logging
    GAME_LOOP: true,            // Game loop status
    STATE_SYNC: true,           // State synchronization
    
    // Network logging
    NETWORK_EVENTS: true,       // Socket.IO events
    
    // Scene management
    SCENE_OBJECTS: true         // Three.js scene object tracking
};

// Helper function to conditionally log
export function debugLog(category, ...args) {
    if (DEBUG_CONFIG[category]) {
        console.log(...args);
    }
}

// Enemy generation summary function
export function logEnemyGenerationStatus(context = '') {
    console.log(`🔍 === ENEMY GENERATION DEBUG SUMMARY ${context} ===`);
    console.log('📋 This logs help track if enemies are being generated properly in multiplayer mode');
    console.log('🎯 Server logs: Look for "ENEMY SPAWN ATTEMPT" and "Broadcasting new enemy"');
    console.log('📨 Client logs: Look for "ENEMY SPAWN EVENT RECEIVED" and "CLIENT ENEMY CREATION"');
    console.log('🔄 Update logs: Look for "ENEMY UPDATE SUMMARY" every 60 frames');
    console.log('⚠️ If you see server spawn logs but no client creation logs, check network connection');
    console.log('⚠️ If you see client creation logs but no enemies visible, check scene rendering');
    console.log('🔍 ==========================================');
}

// Export for use in other files
export default {
    DEBUG_CONFIG,
    debugLog,
    logEnemyGenerationStatus
}; 