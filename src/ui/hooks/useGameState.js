import { useState, useEffect, useRef } from 'react';
import { useEngine } from './useEngine';
import isEqual from 'fast-deep-equal/es6';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';

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
 *   2. Pass `{ deepClone: true }` when you genuinely need a whole subtree.
 *      Costs a structuredClone per evaluation — fine for small slices, not
 *      for per-tick data.
 *
 *   3. Return a derived SIGNATURE string for "did this list change" checks:
 *        state => deckSlots.map(s => s.templateId).join(',')           ✔
 *
 * THE CANONICAL EXAMPLE is `DockHeroFigure`'s hero (CR3-300): a flat
 * projection of exactly the fields it draws, `hp` rebuilt from primitives.
 *
 * ANTI-PATTERN — returning a live object and reading nested fields off it:
 *        state => state.heroes.find(h => h.id === id)                  �’
 *      This is the CR-044 footgun; it appears to work until the only thing
 *      that changes is nested (vitals, xp, equipped items…).
 *
 * `{ bypassClone: true }` hands back the raw reference (O(1)) and never
 * re-renders on mutation — use only with an explicit `_rev`-style trigger.
 *
 * ## Also part of the contract (CR3-310)
 * * ⚠️ **`events` and `options` are read once, at mount.** A caller that
 *   passes a different `events` list later is silently still subscribed to
 *   the first one. (The selector and the filter function are re-read every
 *   render.)
 * * **Name the specific events.** The default, `state_changed`, is the
 *   catch-all being retired (CR3-305); a surface that reads state no specific
 *   event names listens to `GAME_RESET` as well.
 * * Several events in one task run the selector once (a microtask), and the
 *   result is compared with the last value BEFORE React is asked to render,
 *   so an event that changed nothing costs one selector call and no render.
 * * A slice for ONE mat Token belongs in `useTokenState` (`tokenEvents.js`),
 *   which wakes only that Token (CR3-304).
 *
 * @param {Function} selector - Extracts a slice of state, per the contract above
 * @param {Array<string>} [events=['state_changed']] - EventBus events that trigger re-evaluation
 * @param {Function|null} [eventFilter=null] - Optional payload filter; return false to skip
 * @param {Object} [options] - { shallow, deepClone, bypassClone, deps }
 * @returns {any} The selected slice
 */
export const useGameState = (selector = (state) => state, events = [ENGINE_EVENTS.STATE_CHANGED], eventFilter = null, options = {}) => {
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
    // The value last handed to React. Compared HERE, before `setState`, so an
    // event that changed nothing never asks React to render (CR3-008): an
    // updater that returns the old state still made React call the component
    // once before bailing out, which the Perf HUD counted as a MatBoard render
    // on walking steps that changed nothing.
    const lastRef = useRef(state);

    // Standard Subscription Effect
    useEffect(() => {
        let updateQueued = false;
        const handleStateChange = (eventData) => {
            if (eventFilterRef.current && !eventFilterRef.current(eventData)) return;
            if (updateQueued) return;
            updateQueued = true;
            queueMicrotask(() => {
                updateQueued = false;
                const prevState = lastRef.current;
                const newStateSlice = selectorRef.current(GameState);
                if (prevState === newStateSlice) return;
                if (newStateSlice !== null && typeof newStateSlice === 'object' && isEqual(prevState, newStateSlice)) return;
                const next = (newStateSlice !== null && typeof newStateSlice === 'object') ? safeClone(newStateSlice) : newStateSlice;
                lastRef.current = next;
                setState(next);
            });
        };
        const cleanupFns = eventsRef.current.map(event => EventBus.subscribe(event, handleStateChange));
        return () => cleanupFns.forEach(cleanup => cleanup());
    }, [EventBus, GameState]);

    // Prop-Driven Sync Effect (The Fix for Modal Trigger)
    // Runs when props like 'heroId' change, ensuring we don't wait for a Game Event.
    useEffect(() => {
        const currentSlice = selectorRef.current(GameState);
        const prev = lastRef.current;
        if (prev !== currentSlice && !isEqual(prev, currentSlice)) {
            const next = safeClone(currentSlice);
            lastRef.current = next;
            setState(next);
        }
    }, options.deps || []); 

    return state;
};
