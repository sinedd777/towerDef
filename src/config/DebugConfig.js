// Debug configuration system
export const DEBUG_CONFIG = {
    // Enable/disable debug features
    ENABLE_DEBUG_BUTTONS: true,
    ENABLE_WAVE_SKIP: true,
    ENABLE_DEBUG_LABELS: true,
    ENABLE_CONSOLE_LOGGING: true,
    
    // Debug button settings
    WAVE_SKIP_AMOUNT: 5,
    
    // Console logging levels
    LOG_TOWER_PLACEMENT: true,
    LOG_ENEMY_SPAWNING: false,
    LOG_PROJECTILE_HITS: false,
    LOG_UI_INTERACTIONS: true
};

// Helper function to check if debug features are enabled
export function isDebugEnabled(feature) {
    return DEBUG_CONFIG[feature] === true;
}

// Helper function for conditional console logging
export function debugLog(message, category = 'GENERAL') {
    if (!DEBUG_CONFIG.ENABLE_CONSOLE_LOGGING) return;
    
    const categoryEnabled = DEBUG_CONFIG[`LOG_${category}`];
    if (categoryEnabled !== undefined && !categoryEnabled) return;
    
    console.log(`[DEBUG ${category}]`, message);
} 