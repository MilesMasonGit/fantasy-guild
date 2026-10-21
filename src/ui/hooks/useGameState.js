import { useState, useEffect, useRef } from 'react';
import { useEngine } from './useEngine';
import isEqual from 'fast-deep-equal/es6';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { UI_LISTENER } from '../../systems/core/EventBus.js';
import { shareEqual } from './structuralShare.js';

/**
 * Subscribe to GameState via the EventBus.
 * THE SELECTOR CONTRACT (read this before writing a selector)
 * The engine mutates state IN PLACE (`hero.hp.current -= 5`). The default clone mode is
 * shallow, so a selector that returns a live object shares its nested references with the
 * store: the previous and next values are then literally the same nested object, the equality
 * check says unchanged, and **your component silently stops updating**.
 * Therefore selectors MUST do one of the following:
 *   1. PREFERRED: return primitives, or a flat projection built from them:
 *        state => state.heroes.find(h => h.id === id)?.hp.current      OK
 *        state => ({ hp: h.hp.current, name: h.name })                 OK
 *      Flat projections are rebuilt each evaluation, so the equality check compares VALUES and re-renders exactly when a value changed.
 *   2. Pass `{ deepClone: true }` when you genuinely need a whole subtree. Costs a structuredClone per evaluation: fine for small slices, not for per-tick data.
 *   3. Return a derived SIGNATURE string for 'did this list change' checks:
 *        state => deckSlots.map(s => s.templateId).join(',')           OK
 * THE CANONICAL EXAMPLE is `DockHeroFigure`'s hero: a flat projection of exactly the fields it
 * draws, `hp` rebuilt from primitives.
 * ANTI-PATTERN: returning a live object and reading nested fields off it:
 *        state => state.heroes.find(h => h.id === id)                  WRONG
 * It appears to work until the only thing that changes is nested (vitals, xp, equipped items).
 * `{ bypassClone: true }` hands back the raw reference (O(1)) and never re-renders on
 * mutation; use only with an explicit `_rev`-style trigger.
 * Also part of the contract:
 * * ⚠️ **`events` and `options` are read once, at mount.** A caller that passes a different
 * `events` list later is silently still subscribed to the first one. (The selector and the
 * filter function are re-read every render.)
 * * **Name the specific events**, and `GAME_RESET` beside them for a new game, a load or a
 * travel. With none named it hears only `GAME_RESET`.
 * * Several events in one task run the selector once (a microtask), and the result is compared
 * with the last value BEFORE React is asked to render, so an event that changed nothing costs
 * one selector call and no render.
 * * **What changed is new; what did not keeps its identity** (`shareEqual`). When one element of
 * a selected list changes, every other element is the very object handed out last time, so a
 * memoised child given an unchanged element does not draw again.
 * * A slice for ONE mat Token belongs in `useTokenState` (`tokenEvents.js`), which wakes only
 * that Token.
 * @param {Function} selector - Extracts a slice of state, per the contract above
 * @param {Array<string>} [events=['game_reset']] - EventBus events that trigger
 * re-evaluation
 * @param {Function|null} [eventFilter=null] - Optional payload filter; return false to skip
 * @param {Object} [options] - { shallow, deepClone, bypassClone, deps }
 * @returns {any} The selected slice
 */
export const useGameState = (selector = (state) => state, events = [ENGINE_EVENTS.GAME_RESET], eventFilter = null, options = {}) => {
    const { GameState, EventBus } = useEngine();

    const selectorRef = useRef(selector);
    const eventsRef = useRef(events);
    const eventFilterRef = useRef(eventFilter);

    useEffect(() => {
        selectorRef.current = selector;
        eventsRef.current = events;
        eventFilterRef.current = eventFilter;
    });

    // Clone only if it's an object/array, otherwise return as-is. bypassClone returns the raw
    // reference (O(1)); use only if you trust the UI not to mutate!
    const safeClone = (val) => {
        if (val === null || typeof val !== 'object') return val;
        
        if (options.bypassClone) return val;

        if (options.shallow) {
            if (Array.isArray(val)) return [...val];
            return Object.assign(Object.create(Object.getPrototypeOf(val)), val);
        }

        if (options.deepClone) {
            try {
                return structuredClone(val);
            } catch (e) {
                return Array.isArray(val) ? [...val] : Object.assign(Object.create(Object.getPrototypeOf(val)), val);
            }
        }

        return Array.isArray(val) ? [...val] : Object.assign(Object.create(Object.getPrototypeOf(val)), val);
    };

    // The value to hand React for a fresh read: `prev` itself when nothing changed, else the
    // new slice with its unchanged parts taken from `prev`. Never the selector's own top-level
    // object: that may be the store's.
    const settle = (prev, slice) => {
        if (prev === slice) return prev;
        if (slice === null || typeof slice !== 'object') return slice;
        if (options.bypassClone) return isEqual(prev, slice) ? prev : slice;
        const shared = shareEqual(prev, slice);
        if (shared === prev) return prev;
        if (options.deepClone) return shareEqual(prev, safeClone(slice));
        return shared === slice ? safeClone(slice) : shared;
    };

    const [state, setState] = useState(() => {
        const initialSlice = selector(GameState);
        return initialSlice !== undefined ? safeClone(initialSlice) : undefined;
    });
    // The value last handed to React. Compared HERE, before `setState`, so an event that
    // changed nothing never asks React to render: an updater that returns the old state still
    // made React call the component once before bailing out.
    const lastRef = useRef(state);

    useEffect(() => {
        let updateQueued = false;
        const handleStateChange = (eventData) => {
            if (eventFilterRef.current && !eventFilterRef.current(eventData)) return;
            if (updateQueued) return;
            updateQueued = true;
            queueMicrotask(() => {
                updateQueued = false;
                const prevState = lastRef.current;
                const next = settle(prevState, selectorRef.current(GameState));
                if (next === prevState) return;
                lastRef.current = next;
                setState(next);
            });
        };
        const cleanupFns = eventsRef.current.map(event => EventBus.subscribe(event, handleStateChange, UI_LISTENER));
        return () => cleanupFns.forEach(cleanup => cleanup());
    }, [EventBus, GameState]);

    // Prop-driven sync: runs when props like 'heroId' change, so we don't wait for a game
    // event.
    useEffect(() => {
        const prev = lastRef.current;
        const next = settle(prev, selectorRef.current(GameState));
        if (next !== prev) {
            lastRef.current = next;
            setState(next);
        }
    }, options.deps || []); 

    return state;
};
