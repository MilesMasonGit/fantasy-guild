import { useEffect, useRef } from 'react';
import { useEngine } from './useEngine.js';

/**
 * useGameTick
 * A specialized hook designed exclusively for high-frequency, read-only visual elements (like progress bars).
 * Bypasses React's render lifecycle entirely by subscribing directly to engine events and executing a callback
 * with uncloned, raw state references (O(1) overhead).
 * 
 * @param {Function} callback - Function to execute on tick. Receives (GameState, eventData)
 * @param {Array<string>} events - List of EventBus events to listen to
 */
export const useGameTick = (callback, events = ['cards_progress_updated']) => {
    const { GameState, EventBus } = useEngine();
    
    // Use a ref to store the latest callback so we don't have to re-subscribe
    // every time the component renders and creates a new callback reference.
    const callbackRef = useRef(callback);
    
    useEffect(() => {
        callbackRef.current = callback;
    });

    useEffect(() => {
        const handleTick = (eventData) => {
            // Execute the callback with raw GameState (no cloning, O(1))
            if (callbackRef.current) {
                callbackRef.current(GameState, eventData);
            }
        };

        const unsubs = events.map(eventName => EventBus.subscribe(eventName, handleTick));

        // Fire once immediately for initial setup
        handleTick(null);

        return () => {
            unsubs.forEach(unsub => unsub());
        };
    }, [GameState, EventBus, events]);
};
