import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * The part of a tick left over after a cycle finished inside it is handed to the cycle that starts
 * on the next tick, by Token and by hero (`BoardRunner`). It belongs to the board it was made on: a
 * new game, a load or a journey to another Region starts with none. A hero keeps their id across all
 * three, and a load brings back the same Token ids, so a leftover kept past the board it was made on
 * would start the first cycle on the new one part-done.
 */

const TREE = 'carry_board_tree';
const POINT = { x: 700, y: 500 };

registerTokenTypes({
    [TREE]: {
        id: TREE, name: 'Carry Board Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_nature', requiresHero: true, staysPut: true,
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 2500, xp: 0, inputs: [],
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }] }
    }
});

let completed = [];

/** A fresh game: one forester ordered onto one 2.5 s tree. */
function newGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [forester] = fixtures.makeHeroes(1, { forestry: 1 });
    const tree = fixtures.placeAt(TREE, POINT.x, POINT.y);
    fixtures.orderAt(forester.id, POINT);
    TileModifiers.rebuildAll();
    return tree;
}

const tick = (n = 1) => { for (let i = 0; i < n; i++) GameLoop.runHandlers(1000); };

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
    // No perk may change the tree's 2.5 s.
    registerSkillPerks({ forestry: { perks: [] } });
    EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => completed.push(p.instanceId));
});

beforeEach(() => {
    completed = [];
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a leftover stays on the board it was made on', () => {
    it('is handed on within one board: the next cycle starts 500 ms in', () => {
        const tree = newGame();
        tick(3);                  // 3000 ms ≥ 2500: done, 500 left over
        expect(completed).toEqual([tree.id]);
        tick();
        expect(BoardState.getTokenById(tree.id).cycleElapsedMs).toBe(1500);
    });

    it('a new game starts with none, though its hero has the same id', () => {
        newGame();
        tick(3);                  // the forester finishes a cycle with 500 ms left over
        const tree = newGame();
        tick();
        expect(BoardState.getTokenById(tree.id).cycleElapsedMs).toBe(1000);
    });

    it('a load starts with none, though its Token has the same id', () => {
        const tree = newGame();
        const saved = JSON.stringify(GameState.state);
        tick(3);                  // done, 500 left over, on this board
        expect(completed).toEqual([tree.id]);
        GameState.state = JSON.parse(saved);
        TileModifiers.rebuildAll();
        tick();
        expect(BoardState.getTokenById(tree.id).cycleElapsedMs).toBe(1000);
    });
});
