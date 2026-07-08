// Fantasy Guild - EventBus
// Phase 4: Core Systems

/**
 * EventBus - Central pub/sub system for game events
 * 
 * Events are for NOTIFICATIONS and SIDE EFFECTS, not core game logic.
 * Systems publish events after state changes; UI subscribes to update.
 */

class EventBusClass {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this.subscribers = new Map();
        this.eventLog = [];
        this.logEnabled = false;
        /**
         * Optional batch capture hook (Deck Loop rework, Phase 3 §3H).
         * Set by EventBatch while a batch is open; returns true when it
         * captured the event (publish is deferred to the batch flush).
         * @type {?(eventName: string, payload: Object) => boolean}
         */
        this.batchSink = null;
    }

    /**
     * Install/remove the batch capture hook (see EventBatch.js).
     * @param {?Function} sink
     */
    setBatchSink(sink) {
        this.batchSink = sink;
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Function to call when event fires
     * @returns {Function} Unsubscribe function
     */
    subscribe(eventName, callback) {
        if (!this.subscribers.has(eventName)) {
            this.subscribers.set(eventName, new Set());
        }
        this.subscribers.get(eventName).add(callback);

        // Return unsubscribe function
        return () => this.unsubscribe(eventName, callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName - Name of the event
     * @param {Function} callback - The callback to remove
     */
    unsubscribe(eventName, callback) {
        const subs = this.subscribers.get(eventName);
        if (subs) {
            subs.delete(callback);
        }
    }

    /**
     * Publish an event to all subscribers
     * @param {string} eventName - Name of the event
     * @param {Object} payload - Event data (optional)
     */
    publish(eventName, payload = {}) {
        // Batch capture (Phase 3 §3H): during a LoopRunner tick, whitelisted
        // broadcast events are coalesced and fired once at the end of the tick.
        if (this.batchSink && this.batchSink(eventName, payload)) {
            return;
        }

        if (this.logEnabled) {
            this.eventLog.push({
                time: Date.now(),
                event: eventName,
                payload
            });
            if (this.eventLog.length > 100) {
                this.eventLog.shift();
            }
        }

        const subs = this.subscribers.get(eventName);
        if (subs) {
            subs.forEach(callback => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`EventBus: Error in subscriber for "${eventName}"`, error);
                }
            });
        }
    }

    /**
     * Check if an event has subscribers
     * @param {string} eventName - Name of the event
     * @returns {boolean}
     */
    hasSubscribers(eventName) {
        const subs = this.subscribers.get(eventName);
        return subs ? subs.size > 0 : false;
    }

    /**
     * Get subscriber count for an event
     * @param {string} eventName - Name of the event
     * @returns {number}
     */
    getSubscriberCount(eventName) {
        const subs = this.subscribers.get(eventName);
        return subs ? subs.size : 0;
    }

    /**
     * Clear all subscribers (useful for testing)
     */
    clear() {
        this.subscribers.clear();
        this.eventLog = [];
    }

    /**
     * Enable/disable event logging (for debugging)
     * @param {boolean} enabled
     */
    setLogging(enabled) {
        this.logEnabled = enabled;
        if (!enabled) {
            this.eventLog = [];
        }
    }

    /**
     * Get recent event log (for debugging)
     * @param {number} count - Max events to return
     * @returns {Array}
     */
    getEventLog(count = 50) {
        return this.eventLog.slice(-count);
    }
}

// Export singleton instance
export const EventBus = new EventBusClass();
