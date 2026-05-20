import { useState, useEffect, useRef } from 'react';
import { useEngine } from './useEngine';
import isEqual from 'fast-deep-equal/es6';

/**
 * Custom hook to subscribe to the legacy GameState via the EventBus.
 * It uses a selector to grab a specific slice of state, deeply cloning it
 * only when the data physically changes to ensure React re-renders properly.
 * 
 * @param {Function} selector - A function to extract a specific slice of state (e.g., state => state.heroes)
 * @param {Array<string>} [events=['state_changed']] - The EventBus events that should trigger a re-render
 * @param {Function|null} [eventFilter=null] - Optional filter that receives event payload data. Return false to skip evaluation.
 * @returns {any} The deeply cloned slice of state
 */
export const useGameState = (selector = (state) => state, events = ['state_changed'], eventFilter = null, options = {}) => {
    const { GameState, EventBus } = useEngine();

    // Use refs to store the latest selector/events/filter without triggering useEffect re-runs
    const selectorRef = useRef(selector);
    const eventsRef = useRef(events);
    const eventFilterRef = useRef(eventFilter);

    useEffect(() => {
        selectorRef.current = selector;
        eventsRef.current = events;
        eventFilterRef.current = eventFilter;
    });

    // Helper to clone only if it's an object/array, otherwise return as-is.
    // Optimized: Only use structuredClone for deep trees; use shallow for flat arrays/objects.
    // bypassClone: Returns the raw reference (O(1)). Use only if you trust the UI not to mutate!
    const safeClone = (val) => {
        if (val === null || typeof val !== 'object') return val;
        
        // Zero-overhead path for trusted components
        if (options.bypassClone) return val;

        // Shallow path (O(1) for objects, O(N) for small arrays)
        if (options.shallow || Array.isArray(val)) {
            return Array.isArray(val) ? [...val] : { ...val };
        }
        
        try {
            return structuredClone(val);
        } catch (e) {
            console.error('[useGameState] Clone failed:', e, val);
            return { ...val }; // Fallback to shallow object copy
        }
    };

    // Initialize state
    const [state, setState] = useState(() => {
        const initialSlice = selector(GameState);
        return initialSlice !== undefined ? safeClone(initialSlice) : undefined;
    });

    // Standard Subscription Effect
    useEffect(() => {
        let updateQueued = false;
        const handleStateChange = (eventData) => {
            if (eventFilterRef.current && !eventFilterRef.current(eventData)) return;
            if (updateQueued) return;
            updateQueued = true;
            queueMicrotask(() => {
                updateQueued = false;
                setState(prevState => {
                    const newStateSlice = selectorRef.current(GameState);
                    if (prevState === newStateSlice) return prevState;
                    if (newStateSlice !== null && typeof newStateSlice !== 'object') {
                        if (prevState === newStateSlice) return prevState;
                        return newStateSlice;
                    }
                    if (isEqual(prevState, newStateSlice)) return prevState;
                    return safeClone(newStateSlice);
                });
            });
        };
        const cleanupFns = eventsRef.current.map(event => EventBus.subscribe(event, handleStateChange));
        return () => cleanupFns.forEach(cleanup => cleanup());
    }, [EventBus, GameState]);

    // Prop-Driven Sync Effect (The Fix for Modal Trigger)
    // Runs when props like 'heroId' change, ensuring we don't wait for a Game Event.
    useEffect(() => {
        const currentSlice = selectorRef.current(GameState);
        if (state !== currentSlice && !isEqual(state, currentSlice)) {
            setState(safeClone(currentSlice));
        }
    }, options.deps || []); 

    return state;
};
