/**
 * EventBus - Central pub/sub system for game events.
 *
 * Events are for NOTIFICATIONS and SIDE EFFECTS, not core game logic.
 * Systems publish events after state changes; UI subscribes to update.
 */

/**
 * `subscribe`'s third argument for a listener that only draws or tells the player. A quiet bus
 * (a catch-up) skips these; every subscription under `src/ui` passes it
 * (`UiListenersTagged.test.js`).
 */
export const UI_LISTENER = Object.freeze({ ui: true });

class EventBusClass {
    constructor() {
        /** @type {Map<string, Set<Function>>} every listener, in subscription order */
        this.subscribers = new Map();
        /** @type {Map<string, Set<Function>>} the untagged (engine) listeners only, same order */
        this.engineSubscribers = new Map();
        this.quiet = false;
        /** @type {Set<string>} events a quiet bus still delivers to everyone */
        this.quietExcept = new Set();
        this.eventLog = [];
        this.logEnabled = false;
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Function to call when event fires
     * @param {{ui?: boolean}} [options] - `UI_LISTENER` for a listener a quiet bus skips
     * @returns {Function} Unsubscribe function
     */
    subscribe(eventName, callback, { ui = false } = {}) {
        if (!this.subscribers.has(eventName)) {
            this.subscribers.set(eventName, new Set());
        }
        this.subscribers.get(eventName).add(callback);
        if (!ui) {
            if (!this.engineSubscribers.has(eventName)) {
                this.engineSubscribers.set(eventName, new Set());
            }
            this.engineSubscribers.get(eventName).add(callback);
        }

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
        this.engineSubscribers.get(eventName)?.delete(callback);
    }

    /**
     * Quiet: skip every `UI_LISTENER` listener, except on the events in `except`. For a catch-up,
     * where hours of game play in seconds with nothing on screen to update.
     * @param {boolean} on
     * @param {{except?: string[]}} [options]
     */
    setQuiet(on, { except = [] } = {}) {
        this.quiet = !!on;
        this.quietExcept = new Set(on ? except : []);
    }

    /** @returns {boolean} */
    isQuiet() {
        return this.quiet;
    }

    /**
     * Publish an event to all subscribers
     * @param {string} eventName - Name of the event
     * @param {Object} payload - Event data (optional)
     */
    publish(eventName, payload = {}) {
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

        const subs = this.quiet && !this.quietExcept.has(eventName)
            ? this.engineSubscribers.get(eventName)
            : this.subscribers.get(eventName);
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
        this.engineSubscribers.clear();
        this.eventLog = [];
    }

    /**
     * Enable/disable event logging (for debugging)
     *
     * ⚠️ No code calls this, and that is deliberate: it is a console affordance.
     * `main.jsx` puts the engine on `window.Game`, so `Game.EventBus.setLogging(true)`
     * then `Game.EventBus.getEventLog()` shows what actually fired. `hasSubscribers()`
     * is kept for the same reason. Do not delete these as dead code.
     *
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
