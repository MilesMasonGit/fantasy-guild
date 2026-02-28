import { useState, useEffect, useCallback, useRef } from 'react';
import { useEngine } from './useEngine';

/**
 * Custom hook to subscribe to the legacy GameState via the EventBus.
 * It uses a selector to grab a specific slice of state, deeply cloning it
 * to ensure React recognizes the new memory reference and re-renders properly.
 * 
 * @param {Function} selector - A function to extract a specific slice of state (e.g., state => state.heroes)
 * @param {Array<string>} [events=['state_changed']] - The EventBus events that should trigger a re-render
 * @returns {any} The deeply cloned slice of state
 */
export const useGameState = (selector = (state) => state, events = ['state_changed']) => {
    const { GameState, EventBus } = useEngine();

    // Use refs to store the latest selector/events without triggering useEffect re-runs
    const selectorRef = useRef(selector);
    const eventsRef = useRef(events);

    useEffect(() => {
        selectorRef.current = selector;
        eventsRef.current = events;
    });

    // Initialize state
    const [state, setState] = useState(() => {
        const initialSlice = selector(GameState);
        return initialSlice !== undefined ? structuredClone(initialSlice) : undefined;
    });

    useEffect(() => {
        const handleStateChange = () => {
            const newStateSlice = selectorRef.current(GameState);
            if (newStateSlice === undefined) return;

            setState(prevState => {
                const nextState = structuredClone(newStateSlice);
                // Deep equality check to prevent unnecessary renders if the data hasn't physically changed
                if (JSON.stringify(prevState) === JSON.stringify(nextState)) {
                    return prevState;
                }
                return nextState;
            });
        };

        // Subscribe using the ref's current values
        const cleanupFns = eventsRef.current.map(event => EventBus.subscribe(event, handleStateChange));

        // Initial fetch to sync up if it changed before the effect ran
        handleStateChange();

        return () => {
            // Execute all unsubscribe functions on unmount
            cleanupFns.forEach(cleanup => cleanup());
        };
    }, [EventBus, GameState]); // Only re-run if the core engine objects change

    return state;
};
