/**
 * Central Event Hub for managing communication between game components
 * This decouples components from knowing about each other directly
 */
export class EventHub {
    constructor() {
        this.eventCallbacks = new Map();
        this.debugMode = false; // Set to true for debugging
    }
    
    /**
     * Enable/disable debug logging
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
    
    /**
     * Emit an event to all registered listeners
     */
    emit(eventType, data = null) {
        if (this.debugMode) {
            console.log(`📡 EventHub: Emitting '${eventType}'`, data);
        }
        
        const callbacks = this.eventCallbacks.get(eventType) || [];
        
        if (callbacks.length === 0 && this.debugMode) {
            console.warn(`📡 EventHub: No listeners for '${eventType}'`);
        }
        
        callbacks.forEach((callback, index) => {
            try {
                callback(data);
            } catch (error) {
                console.error(`📡 EventHub: Error in listener ${index} for '${eventType}':`, error);
            }
        });
    }
    
    /**
     * Register a listener for an event
     */
    on(eventType, callback) {
        if (typeof callback !== 'function') {
            throw new Error(`EventHub: Callback must be a function for event '${eventType}'`);
        }
        
        if (!this.eventCallbacks.has(eventType)) {
            this.eventCallbacks.set(eventType, []);
        }
        
        this.eventCallbacks.get(eventType).push(callback);
        
        if (this.debugMode) {
            console.log(`📡 EventHub: Registered listener for '${eventType}' (total: ${this.eventCallbacks.get(eventType).length})`);
        }
    }
    
    /**
     * Remove a specific listener for an event
     */
    off(eventType, callback) {
        const callbacks = this.eventCallbacks.get(eventType);
        if (!callbacks) return;
        
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
            
            if (this.debugMode) {
                console.log(`📡 EventHub: Removed listener for '${eventType}' (remaining: ${callbacks.length})`);
            }
            
            // Clean up empty arrays
            if (callbacks.length === 0) {
                this.eventCallbacks.delete(eventType);
            }
        }
    }

    /**
     * Register a one-time listener for an event (automatically removes after first call)
     */
    once(eventType, callback) {
        const onceWrapper = (data) => {
            this.off(eventType, onceWrapper);
            callback(data);
        };
        this.on(eventType, onceWrapper);
    }
    
    /**
     * Remove all listeners for an event type
     */
    removeAllListeners(eventType) {
        if (this.eventCallbacks.has(eventType)) {
            this.eventCallbacks.delete(eventType);
            
            if (this.debugMode) {
                console.log(`📡 EventHub: Removed all listeners for '${eventType}'`);
            }
        }
    }
    
    /**
     * Get list of all registered event types (for debugging)
     */
    getRegisteredEvents() {
        return Array.from(this.eventCallbacks.keys());
    }
    
    /**
     * Get number of listeners for an event type (for debugging)
     */
    getListenerCount(eventType) {
        const callbacks = this.eventCallbacks.get(eventType);
        return callbacks ? callbacks.length : 0;
    }
    
    /**
     * Clear all event listeners (useful for cleanup)
     */
    clear() {
        this.eventCallbacks.clear();
        
        if (this.debugMode) {
            console.log('📡 EventHub: Cleared all listeners');
        }
    }
} 