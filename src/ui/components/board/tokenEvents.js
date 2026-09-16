// Fantasy Guild — board events routed to one Token by instance id (Free Playmat slice 1.6c)

import { useEffect, useRef } from 'react';
import { EventBus } from '../../../systems/core/EventBus.js';

/**
 * ⭐ **One EventBus subscription per event type, however many Tokens are drawn.**
 *
 * Every board event names the Token it happened to by `instanceId` (slice
 * 1.6b). The mat draws a component per Token, and several of those components
 * want the same events — progress, alerts, charges, effect text. Subscribing
 * each of them to the bus directly is what the grid renderer did, and it does
 * not survive a free mat: ~80 Tokens × four events is 320 subscriptions, and
 * **every one of them runs on every `board:progress` tick** only to compare an
 * id and return.
 *
 * So this is a switchboard. The first listener for an event type opens the one
 * bus subscription; the payload's `instanceId` picks a `Set` out of a `Map`, so
 * a progress tick wakes only the Token it is about. The last listener to leave
 * closes the bus subscription again, which is what keeps "no subscriptions left
 * behind on unmount" true.
 *
 * ⚠️ A payload with no `instanceId` — a spot that ran dry, a refused drop —
 * reaches nobody here **by design**: it belongs to no drawn Token. Those are
 * drawn at their mat point by `MatPointAlerts`, which listens to the bus itself.
 */

/** event → `{ unsub, handlers: Map<instanceId, Set<handler>> }`. */
const routes = new Map();

/**
 * Call `handler` when `event` happens to Token `instanceId`.
 * @returns {() => void} unsubscribe
 */
export function subscribeToken(event, instanceId, handler) {
    if (!event || !instanceId || typeof handler !== 'function') return () => {};

    let route = routes.get(event);
    if (!route) {
        const handlers = new Map();
        const unsub = EventBus.subscribe(event, (payload) => {
            const set = payload?.instanceId ? handlers.get(payload.instanceId) : null;
            if (!set || set.size === 0) return;
            // A copy: a handler may unsubscribe itself while being told.
            for (const fn of [...set]) fn(payload);
        });
        route = { unsub, handlers };
        routes.set(event, route);
    }

    let set = route.handlers.get(instanceId);
    if (!set) {
        set = new Set();
        route.handlers.set(instanceId, set);
    }
    set.add(handler);

    return () => {
        const live = routes.get(event);
        if (live !== route) return;
        const bucket = route.handlers.get(instanceId);
        if (!bucket) return;
        bucket.delete(handler);
        if (bucket.size === 0) route.handlers.delete(instanceId);
        if (route.handlers.size === 0) {
            route.unsub?.();
            routes.delete(event);
        }
    };
}

/**
 * The hook form. The handler is read through a ref, so a component may rebuild
 * it on every render without touching the subscription — the deps are the event
 * and the Token, and nothing else (CR2-168 item 1).
 */
export function useTokenEvent(event, instanceId, handler) {
    const live = useRef(handler);
    live.current = handler;

    useEffect(() => {
        if (!instanceId) return undefined;
        return subscribeToken(event, instanceId, (payload) => live.current?.(payload));
    }, [event, instanceId]);
}

/** How many bus subscriptions the router currently holds. For tests. */
export function openRouteCount() {
    return routes.size;
}
