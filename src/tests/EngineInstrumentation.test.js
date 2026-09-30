import { describe, it, expect, afterEach } from 'vitest';
import { GameLoop } from '../systems/core/GameLoop.js';
import { EventBus } from '../systems/core/EventBus.js';

/**
 * The bench and the Perf HUD watch the engine from outside (CR3-566).
 *
 * Neither tool edits engine code. `bench/lib/harness.mjs` and
 * `src/ui/dev/perf/perfHarness.js` time and count the engine by **replacing
 * methods on the two singletons** and by wrapping each tick handler's function:
 *
 * - `GameLoop.runHandlers` — reassigned on the instance (the HUD), and called
 *   by `tick()` through `this`, so the replacement sees every real tick;
 * - `GameLoop.tickHandlers` — an array of `{ name, handler }` objects whose
 *   `handler` the bench swaps for a timed wrapper;
 * - `EventBus.publish` — reassigned on the instance (both tools);
 * - `EventBus.subscribers` — a `Map` of event name → listeners (the bench
 *   reads `.get(name).size` to count listener calls).
 *
 * A rewrite to private fields (`#subscribers`), a frozen instance, or a
 * `tick()` that stopped going through `this.runHandlers` would blind both tools
 * without a single error. This file is that contract, pinned.
 */
describe('the engine stays observable from outside (CR3-566)', () => {
    const ownPublish = Object.prototype.hasOwnProperty.call(EventBus, 'publish');
    const originalPublish = EventBus.publish;
    const ownRun = Object.prototype.hasOwnProperty.call(GameLoop, 'runHandlers');
    const originalRun = GameLoop.runHandlers;

    afterEach(() => {
        if (ownPublish) EventBus.publish = originalPublish; else delete EventBus.publish;
        if (ownRun) GameLoop.runHandlers = originalRun; else delete GameLoop.runHandlers;
    });

    it('GameLoop.tickHandlers is an array of { name, handler } entries', () => {
        expect(Array.isArray(GameLoop.tickHandlers)).toBe(true);
        const name = 'cr3_566_probe';
        const handler = () => {};
        GameLoop.onTick(name, handler);
        try {
            const entry = GameLoop.tickHandlers.find(h => h.name === name);
            expect(entry).toBeDefined();
            expect(entry.handler).toBe(handler);
        } finally {
            GameLoop.offTick(name);
        }
    });

    it('EventBus.subscribers is a Map of event name → listeners', () => {
        expect(EventBus.subscribers).toBeInstanceOf(Map);
        const listener = () => {};
        const off = EventBus.subscribe('cr3_566_probe', listener);
        try {
            expect(EventBus.subscribers.get('cr3_566_probe')?.size).toBe(1);
        } finally {
            if (typeof off === 'function') off(); else EventBus.unsubscribe('cr3_566_probe', listener);
        }
    });

    it('replacing EventBus.publish on the instance intercepts a publish, and the original still delivers', () => {
        expect(typeof EventBus.publish).toBe('function');
        const seen = [];
        const delivered = [];
        const off = EventBus.subscribe('cr3_566_probe', p => delivered.push(p));
        const original = EventBus.publish.bind(EventBus);
        EventBus.publish = (name, payload) => { seen.push(name); return original(name, payload); };
        try {
            EventBus.publish('cr3_566_probe', { n: 1 });
            expect(seen).toEqual(['cr3_566_probe']);
            expect(delivered).toEqual([{ n: 1 }]);
        } finally {
            if (typeof off === 'function') off();
        }
    });

    it('replacing GameLoop.runHandlers on the instance sees the ticks tick() delivers', () => {
        expect(typeof GameLoop.runHandlers).toBe('function');
        const deltas = [];
        GameLoop.runHandlers = (delta) => { deltas.push(delta); };
        // tick() only runs while the loop is running; flip the flag rather than
        // start() it, so no interval is left behind.
        const wasRunning = GameLoop.isRunning;
        GameLoop.isRunning = true;
        try {
            GameLoop.tick();
        } finally {
            GameLoop.isRunning = wasRunning;
        }
        expect(deltas).toHaveLength(1);
    });

    it('a wrapped tick handler function is the one runHandlers calls', () => {
        const name = 'cr3_566_wrap';
        const calls = [];
        GameLoop.onTick(name, () => calls.push('original'));
        try {
            const entry = GameLoop.tickHandlers.find(h => h.name === name);
            const original = entry.handler;
            entry.handler = (d, c) => { calls.push('wrapper'); return original(d, c); };
            GameLoop.runHandlers(100);
            expect(calls).toEqual(['wrapper', 'original']);
        } finally {
            GameLoop.offTick(name);
        }
    });
});
