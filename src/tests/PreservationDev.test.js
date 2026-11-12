import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Flags from '../systems/board/Flags.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { setUpPreservationForges, setUpPreservationArcher, preservationReadout, QA_PRESERVATION } from '../ui/dev/preservationDev.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The QA panel's Preservation buttons (brief 590 P1): the owner's way to see, by clicking, a Bank
 * count that does not drop: the Copper Ore of a forge beside a Preservation building, about half the
 * Stone of a forge a Preservation star reaches, and an archer's arrows beside a Quiver Post.
 */

beforeAll(() => { BoardRunner.init(); Flags.init(); LoadoutMoments.init(); });
afterAll(() => { Flags.teardown(); LoadoutMoments.teardown(); resetMatTuning(); });

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    registerHallSky(null);
    HallRules.apply({});
});

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const numberIn = (line, pattern) => Number(line.match(pattern)[1]);

describe('the Preservation scenes', () => {
    it('the Cellar\'s forge never takes its Copper Ore; the star\'s forge takes Stone on some cycles only', () => {
        expect(setUpPreservationForges()).toEqual({ ok: true });
        for (const typeId of [QA_PRESERVATION.NEAR_FORGE, QA_PRESERVATION.STAR_FORGE, QA_PRESERVATION.CELLAR]) {
            expect(BoardState.tokens().some(t => t.typeId === typeId), typeId).toBe(true);
        }
        const ore = InventoryManager.getItemCount('item_copper_ore');
        const stone = InventoryManager.getItemCount('item_stone');
        run(30_000);
        const [near, star, ingots] = preservationReadout();
        expect(near).toMatch(/Preservation 100 % \(the Cellar beside it\)/);
        expect(numberIn(near, /(\d+) cycles/)).toBeGreaterThanOrEqual(5);
        expect(InventoryManager.getItemCount('item_copper_ore')).toBe(ore);
        expect(star).toMatch(/Preservation 50 % \(the QA Thrifty Hands star, rank 1\)/);
        const starCycles = numberIn(star, /(\d+) cycles/);
        expect(starCycles).toBeGreaterThanOrEqual(5);
        const stonePaid = (stone - InventoryManager.getItemCount('item_stone')) / 2;
        expect(stonePaid).toBeLessThan(starCycles);
        expect(numberIn(ingots, /: (\d+)$/)).toBeGreaterThanOrEqual(10);
    });

    it('the archer\'s arrows never drop', () => {
        expect(setUpPreservationArcher()).toEqual({ ok: true });
        run(20_000);
        const line = preservationReadout().find(l => l.startsWith('QA Archer'));
        expect(numberIn(line, /(\d+) shots/)).toBeGreaterThan(2);
        expect(line).toContain('QA Arrows in the Bank 40 of 40');
        expect(line).toContain('Preservation on Ammo 100 %');
    });
});
