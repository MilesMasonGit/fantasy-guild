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
import { tokenCardModel, CARD_BLOCK } from '../ui/components/board/tokenCard.js';
import { setUpLuckyScene, luckyReadout, QA_LUCKY } from '../ui/dev/luckyDev.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The QA panel's Lucky button (brief 590 P3): the owner's way to see, by clicking, rare finds that
 * twinkle off a vein a Lucky building raises, a vein a Lucky Hall star raises, and an enemy the star
 * raises too; and the rare finds with their chances on each Token's card.
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
const instanceOf = (typeId) => BoardState.tokens().find(t => t.typeId === typeId);

describe('the Lucky scene', () => {
    it('raises each table as it says, and finds land and twinkle on both veins and the Goblin', () => {
        expect(setUpLuckyScene()).toEqual({ ok: true });
        for (const typeId of [QA_LUCKY.NEAR_VEIN, QA_LUCKY.STAR_VEIN, QA_LUCKY.CHARM, QA_LUCKY.GOBLIN]) {
            expect(instanceOf(typeId), typeId).toBeDefined();
        }
        run(240_000);
        const [near, star, goblin, twinkles] = luckyReadout();
        expect(near).toMatch(/rare table 5 %, 50 % with Lucky \(the Charm beside it\)/);
        expect(star).toMatch(/rare table 10 %, 20 % with Lucky \(the QA Lucky Finds star, rank 1\)/);
        expect(goblin).toMatch(/rare table 25 %, 50 % with Lucky \(the QA Lucky Finds star, rank 1\)/);
        for (const line of [near, star, goblin]) expect(numberIn(line, /, (\d+) rare finds/), line).toBeGreaterThan(0);
        expect(numberIn(goblin, /; (\d+) kills/)).toBeGreaterThan(3);
        const finds = [near, star, goblin].reduce((sum, line) => sum + numberIn(line, /, (\d+) rare finds/), 0);
        expect(numberIn(twinkles, /: (\d+)$/)).toBe(finds);
    });

    it('each Token\'s card lists its rare finds with their chances, Lucky counted', () => {
        expect(setUpLuckyScene()).toEqual({ ok: true });
        const near = instanceOf(QA_LUCKY.NEAR_VEIN);
        const makes = tokenCardModel(near.typeId, near.id).blocks.find(b => b.id === CARD_BLOCK.RECIPE).makes;
        expect(makes.map(m => [m.itemId, m.chance, !!m.rare])).toEqual([
            ['item_copper_ore', null, false],
            ['item_quartz', 37.5, true],
            ['item_gold_ore', 12.5, true]
        ]);
        const goblin = instanceOf(QA_LUCKY.GOBLIN);
        const drops = tokenCardModel(goblin.typeId, goblin.id).blocks.find(b => b.id === CARD_BLOCK.DROPS).drops;
        expect(drops.map(d => [d.itemId, d.chance])).toEqual([['item_bones', 100], ['item_quartz', 37.5], ['item_gold_ore', 12.5]]);
        // Off the mat (the Encyclopedia's card, a picker), the table's own chance.
        const plain = tokenCardModel(QA_LUCKY.STAR_VEIN).blocks.find(b => b.id === CARD_BLOCK.RECIPE).makes;
        expect(plain.filter(m => m.rare).map(m => m.chance)).toEqual([7.5, 2.5]);
    });
});
