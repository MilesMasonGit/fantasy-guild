import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Every tick handler carries an explicit priority, so the order never rests on registration order
 * and a stable sort: a handler inserted in the wrong place would otherwise change behaviour silently.
 */
describe('tick handlers have explicit priorities that reproduce today\'s order (CR3-031)', () => {
    const NAMES = [
        'time_tracking', 'live_effects', 'regen_system', 'board_runner',
        // Events: after the board; off in the tests and the bench.
        'event_clock',
        'sprite_layer', 'wounded_system'
    ];

    beforeAll(() => {
        GameState.initNew();
        EngineBootstrap.init();
        GameLoop.stop();
    });

    afterAll(() => {
        for (const name of NAMES) GameLoop.offTick(name);
    });

    it('registers every handler, each with its own non-default priority', () => {
        const byName = new Map(GameLoop.tickHandlers.map(h => [h.name, h]));
        for (const name of NAMES) expect(byName.has(name), `${name} is registered`).toBe(true);

        const priorities = NAMES.map(n => byName.get(n).priority);
        expect(priorities.every(p => typeof p === 'number' && p !== 100),
            'a handler was left on the accidental default of 100').toBe(true);
        expect(new Set(priorities).size, 'every handler has a distinct priority').toBe(priorities.length);
    });

    it('reproduces today\'s registration order exactly', () => {
        const order = GameLoop.tickHandlers.map(h => h.name).filter(n => NAMES.includes(n));
        expect(order).toEqual(NAMES);
    });
});
