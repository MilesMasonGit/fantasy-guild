
import { useEffect, useRef, useState, useCallback } from 'react';
import isEqual from 'fast-deep-equal/es6';
import { EventBus } from '../../../systems/core/EventBus.js';

/**
 * One EventBus subscription per event type, however many Tokens are drawn.
 * The mat draws a component per Token, and several want the same events (progress, alerts,
 * charges, effect text). Subscribing each directly means every subscription runs on every
 * `board:progress` tick only to compare an id and return.
 * So this is a switchboard: the first listener for an event type opens the one bus
 * subscription; the payload's `instanceId` picks a `Set` out of a `Map`, so a progress tick
 * wakes only the Token it is about. The last listener to leave closes the bus subscription,
 * which keeps 'no subscriptions left behind on unmount' true.
 * ⚠️ A payload with no `instanceId` (a spot that ran dry, a refused drop) reaches nobody here
 * by design: it belongs to no drawn Token. Those are said at their mat point by
 * `CalloutLayer`, which listens to the bus itself.
 */

/** `field + event` → `{ unsub, handlers: Map<key, Set<handler>> }`. */
const routes = new Map();

/**
 * Call `handler` when `event` happens with `payload[field] === key`: one bus subscription per
 * (event, field) however many listeners. `instanceId` is the usual field; `heroId` routes a
 * hero's events to the one Token they work (`HERO_MOVED` names the Token a hero goes TO, never
 * the one they left).
 * @returns {() => void} unsubscribe
 */
export function subscribeBy(event, field, key, handler) {
    if (!event || !field || !key || typeof handler !== 'function') return () => {};

    const routeKey = `${field}|${event}`;
    let route = routes.get(routeKey);
    if (!route) {
        const handlers = new Map();
        const unsub = EventBus.subscribe(event, (payload) => {
            const k = payload?.[field];
            const set = k ? handlers.get(k) : null;
            if (!set || set.size === 0) return;
            // A copy: a handler may unsubscribe itself while being told.
            for (const fn of [...set]) fn(payload);
        });
        route = { unsub, handlers };
        routes.set(routeKey, route);
    }

    let set = route.handlers.get(key);
    if (!set) {
        set = new Set();
        route.handlers.set(key, set);
    }
    set.add(handler);

    return () => {
        const live = routes.get(routeKey);
        if (live !== route) return;
        const bucket = route.handlers.get(key);
        if (!bucket) return;
        bucket.delete(handler);
        if (bucket.size === 0) route.handlers.delete(key);
        if (route.handlers.size === 0) {
            route.unsub?.();
            routes.delete(routeKey);
        }
    };
}

/**
 * Call `handler` when `event` happens to Token `instanceId`.
 * @returns {() => void} unsubscribe
 */
export function subscribeToken(event, instanceId, handler) {
    return subscribeBy(event, 'instanceId', instanceId, handler);
}

/**
 * The hook form. The handler is read through a ref, so a component may rebuild it on every
 * render without touching the subscription: the deps are the event and the Token, and nothing
 * else.
 */
export function useTokenEvent(event, instanceId, handler) {
    const live = useRef(handler);
    live.current = handler;

    useEffect(() => {
        if (!instanceId) return undefined;
        return subscribeToken(event, instanceId, (payload) => live.current?.(payload));
    }, [event, instanceId]);
}

/**
 * A Token's state, woken only by events about that Token.
 * `useGameState` subscribes each caller to the whole event; with one caller per drawn Token,
 * every `TILE_CHANGED` would re-run a selector per Token to change one. This runs `selector`
 * only when an event routed to this Token arrives:
 * * `byId`: events whose payload's `instanceId` is this Token;
 * * `byKey`: `{ event, field, key }`: events whose `payload[field] === key` (e.g. the hero
 * working it, by `heroId`). A null key is skipped;
 * * `broadcast`: events that wake it whatever they name. For the few Tokens whose state reads
 * OTHER Tokens (a spawner counts its family), and for `GAME_RESET`.
 * `routesOf(state)` gives these from the current state, so a route can follow it (the hero
 * working the Token changes). Several events in one task run the selector once (a microtask,
 * as `useGameState` does). The selector must return a flat projection (see `useGameState`'s
 * selector contract): it is compared by value and never cloned.
 * ⚠️ A lost route is a Token that silently stops updating. `TokenDetailRoutes.test.js` drives
 * every `MatToken` field through the real engine command that changes it; add a test there
 * with any new field.
 */
export function useTokenState(id, selector, routesOf) {
    const live = useRef(selector);
    live.current = selector;
    const [state, setState] = useState(() => selector());
    // Compared before `setState`, so an event that changed nothing never makes
    // React call the component (an updater returning the old state still did).
    const lastRef = useRef(state);

    const queued = useRef(false);
    const refresh = useCallback(() => {
        if (queued.current) return;
        queued.current = true;
        queueMicrotask(() => {
            queued.current = false;
            const next = live.current();
            if (isEqual(lastRef.current, next)) return;
            lastRef.current = next;
            setState(next);
        });
    }, []);

    const routes = routesOf(state) || {};
    const key = JSON.stringify([id, routes]);

    useEffect(() => {
        const offs = [];
        for (const event of routes.byId || []) offs.push(subscribeBy(event, 'instanceId', id, refresh));
        for (const r of routes.byKey || []) if (r?.key) offs.push(subscribeBy(r.event, r.field, r.key, refresh));
        for (const event of routes.broadcast || []) offs.push(EventBus.subscribe(event, refresh));
        return () => offs.forEach(off => off());
        // `key` is `id` + `routes`, by value.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, refresh]);

    // A new id, or anything that changed between the first read and the
    // subscription above: read once more.
    useEffect(() => { refresh(); }, [id, refresh]);

    return state;
}
