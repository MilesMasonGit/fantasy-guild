import { useState, useEffect, useRef } from 'react';
import { useEngine } from './useEngine';
import isEqual from 'fast-deep-equal/es6';

/**
 * Subscribe to GameState via the EventBus.
 *
 * ## THE SELECTOR CONTRACT (read this before writing a selector) — CR-044
 *
 * The engine mutates state IN PLACE (`hero.hp.current -= 5`). The default
 * clone mode is shallow, so a selector that returns a live object shares its
 * nested references with the store: the "previous" value and the "next" value
 * are then literally the same nested object, the equality check says
 * "unchanged", and **your component silently stops updating**.
 *
 * Therefore selectors MUST do one of the following:
 *
 *   1. PREFERRED — return primitives, or a flat projection built from them:
 *        state => state.heroes.find(h => h.id === id)?.hp.current      ✔
 *        state => ({ hp: h.hp.current, name: h.name })                 ✔
 *      Flat projections are rebuilt each evaluation, so the equality check
 *      compares VALUES and re-renders exactly when a value changed.
 *
 *   2. Pass `{ deepClone: true }` when you genuinely need a whole subtree
 *      (see CardsTab, which needs all of `collection`). Costs a
 *      structuredClone per evaluation — fine for small slices, not for
 *      per-tick data.
 *
 *   3. Return a derived SIGNATURE string for "did this list change" checks:
 *        state => deckSlots.map(s => s.templateId).join(',')           ✔
 *
 * ANTI-PATTERN — returning a live object and reading nested fields off it:
 *        state => state.heroes.find(h => h.id === id)                  �’
 *      This is the CR-044 footgun; it appears to work until the only thing
 *      that changes is nested (vitals, xp, equipment durability…).
 *
 * `{ bypassClone: true }` hands back the raw reference (O(1)) and never
 * re-renders on mutation — use only with an explicit `_rev`-style trigger.
 *
 * @param {Function} selector - Extracts a slice of state, per the contract above
 * @param {Array<string>} [events=['state_changed']] - EventBus events that trigger re-evaluation
 * @param {Function|null} [eventFilter=null] - Optional payload filter; return false to skip
 * @param {Object} [options] - { shallow, deepClone, bypassClone, deps }
 * @returns {any} The selected slice
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
        if (options.shallow) {
            if (Array.isArray(val)) return [...val];
            return Object.assign(Object.create(Object.getPrototypeOf(val)), val);
        }

        if (options.deepClone) {
            try {
                return structuredClone(val);
            } catch (e) {
                // Fallback to prototype-preserving shallow copy
                return Array.isArray(val) ? [...val] : Object.assign(Object.create(Object.getPrototypeOf(val)), val);
            }
        }

        // Default: Prototype-preserving shallow clone (extremely fast, no exception overhead)
        return Array.isArray(val) ? [...val] : Object.assign(Object.create(Object.getPrototypeOf(val)), val);
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
