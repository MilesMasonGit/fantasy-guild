import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * The nine tick handlers used to run in registration order only because every
 * one defaulted to `GameLoop.onTick`'s priority of 100 and
 * `Array.prototype.sort` happens to be stable — true, but accidental, and a
 * future ninth-and-a-half handler inserted in the wrong place could silently
 * change behaviour.
 *
 * A permutation spike (R1, same seed, 4,000 S2 ticks, a uses/Bank/XP
 * fingerprint) found every reordering of the nine gives an identical result
 * **except one**: `quest_manager` running before `board_runner` draws a
 * bounty Token's spawn one tick earlier, consuming the shared random stream
 * in a different order. `EngineBootstrap._registerTickHandlers` now gives
 * each handler an explicit priority reproducing today's order, with that one
 * relation called out in its own comment.
 */
describe('tick handlers have explicit priorities that reproduce today\'s order (CR3-031)', () => {
    const NAMES = [
        'time_tracking', 'live_effects', 'regen_system', 'board_runner',
        'quest_manager', 'sprite_layer', 'wounded_system', 'status_effects'
    ];

    beforeAll(() => {
        GameState.initNew();
        EngineBootstrap.init();
        GameLoop.stop();
    });

    afterAll(() => {
        for (const name of NAMES) GameLoop.offTick(name);
    });

    it('registers all nine handlers, each with its own non-default priority', () => {
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

    it('⚠️ board_runner always runs before quest_manager (the one relation that changes the result, R1)', () => {
        const order = GameLoop.tickHandlers.map(h => h.name);
        expect(order.indexOf('board_runner')).toBeLessThan(order.indexOf('quest_manager'));
    });
});
