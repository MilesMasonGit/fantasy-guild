import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { computeUpkeepSummary, formatRate, formatRunsOut } from '../systems/board/UpkeepSummary.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * Token Lifecycle slice 8.2 — the **Upkeep Summary** maths (TL-4): every
 * ongoing cost per item per minute, the Bank, a rough runs-out, who waits, and
 * the trickle's income.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const item = (id, name) => ({
    id, name, type: 'material', sprite: 'wood_oak', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({
    fixture_us_seed: item('fixture_us_seed', 'Fixture Upkeep Seed'),
    fixture_us_incense: item('fixture_us_incense', 'Fixture Upkeep Incense')
});
const SEED = 'fixture_us_seed';
const INCENSE = 'fixture_us_incense';

registerTokenTypes({
    fixture_us_sapling: {
        id: 'fixture_us_sapling', name: 'Fixture Us Sapling', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature'
    },
    /** 5 Saplings, one attempt every 20 s, a seed each = 3 seeds a minute while spawning. */
    fixture_us_forest: {
        id: 'fixture_us_forest', name: 'Fixture Us Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: {
            spawns: [{ typeId: 'fixture_us_sapling', weight: 1 }],
            allowance: 5, intervalMs: 20000,
            upkeep: [{ itemId: SEED, quantity: 1 }]
        }
    },
    /** A Shrine burning 2 incense every 30 s = 4 a minute. */
    fixture_us_shrine: {
        id: 'fixture_us_shrine', name: 'Fixture Us Shrine', tokenType: 'buff',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        statements: [{
            id: 'stm_us_aura', keyword: KEYWORD.PROVIDES, to: { mode: 'all' },
            payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 },
            upkeep: { items: [{ itemId: INCENSE, quantity: 2 }], cadenceMs: 30000 }
        }]
    },
    /** A Hall stand-in: a seed every 30 s = 2 a minute. */
    fixture_us_hall: {
        id: 'fixture_us_hall', name: 'Fixture Us Hall', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        trickle: [{ itemId: SEED, quantity: 1, everyMs: 30000 }]
    }
});

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };
const rowOf = (summary, itemId) => summary.items.find(r => r.itemId === itemId);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
    clearMat();
});

afterEach(() => {
    TriggerSystem.teardown();
    TileModifiers.teardown();
    resetMatTuning();
});

describe('⭐ spawner upkeep', () => {
    it('two Forests and no seeds: the seed is needed, 0 in the Bank, both Forests waiting', () => {
        const a = placeAt('fixture_us_forest', 500, 500);
        const b = placeAt('fixture_us_forest', 1100, 500);

        const row = rowOf(computeUpkeepSummary(), SEED);
        expect(row).toMatchObject({ name: 'Fixture Upkeep Seed', bank: 0, perMinute: 6, runsOutMs: 0 });
        expect(row.waiting.map(w => w.instanceId).sort()).toEqual([a.id, b.id].sort());
        expect(row.waiting.every(w => w.name === 'Fixture Us Forest' && w.source === 'spawner')).toBe(true);
        expect(formatRunsOut(row.runsOutMs)).toBe('empty now');
    });

    it('with stock: a per-minute rate and a runs-out estimate, nobody waiting', () => {
        InventoryManager.addItem(SEED, 30);
        placeAt('fixture_us_forest', 500, 500);
        placeAt('fixture_us_forest', 1100, 500);

        const row = rowOf(computeUpkeepSummary(), SEED);
        expect(row.perMinute).toBe(6);
        expect(row.bank).toBe(30);
        expect(row.waiting).toEqual([]);
        expect(row.runsOutMs).toBe(5 * 60000);   // 30 ÷ 6 a minute
        expect(formatRate(row.perMinute)).toBe('6');
        expect(formatRunsOut(row.runsOutMs)).toBe('~5 min');
    });

    it('a spawner at its cap consumes nothing and is listed as idle', () => {
        InventoryManager.addItem(SEED, 100);
        const forest = placeAt('fixture_us_forest', 800, 500);
        run(5 * 20000);

        const summary = computeUpkeepSummary();
        expect(rowOf(summary, SEED)).toBeUndefined();
        expect(summary.idle).toEqual([expect.objectContaining({
            instanceId: forest.id, name: 'Fixture Us Forest', state: 'at_cap', count: 5, cap: 5
        })]);
    });
});

describe('statement upkeep (BlockUpkeep)', () => {
    it('counts a costed rule at its own cadence, and lists it waiting once unpaid', () => {
        InventoryManager.addItem(INCENSE, 20);
        const shrine = placeAt('fixture_us_shrine', 800, 500);

        let row = rowOf(computeUpkeepSummary(), INCENSE);
        expect(row).toMatchObject({ perMinute: 4, bank: 20, runsOutMs: 5 * 60000, waiting: [] });
        expect(row.consumers).toEqual([expect.objectContaining({ instanceId: shrine.id, source: 'rule', perMinute: 4 })]);

        // Burn through the stock: 20 incense last 5 min, the next charge fails.
        run(5 * 60000 + 30000);
        row = rowOf(computeUpkeepSummary(), INCENSE);
        expect(row.bank).toBe(0);
        expect(row.waiting).toEqual([{ instanceId: shrine.id, name: 'Fixture Us Shrine', source: 'rule' }]);
    });
});

describe('trickle income', () => {
    it('shows income per item per minute and nets it against the cost', () => {
        placeAt('fixture_us_hall', 300, 300);
        let summary = computeUpkeepSummary();
        expect(summary.income).toEqual([{
            itemId: SEED, name: 'Fixture Upkeep Seed', perMinute: 2,
            sources: [expect.objectContaining({ name: 'Fixture Us Hall', perMinute: 2 })]
        }]);
        expect(summary.items).toEqual([]);

        // One Forest costs 3 a minute; the Hall pays 2 of it.
        InventoryManager.addItem(SEED, 10);
        placeAt('fixture_us_forest', 900, 500);
        summary = computeUpkeepSummary();
        expect(rowOf(summary, SEED)).toMatchObject({ perMinute: 3, incomePerMinute: 2, netPerMinute: 1, runsOutMs: 10 * 60000 });
    });

    it('income at or above the cost never runs out', () => {
        const row = computeUpkeepSummary({
            tokens: () => [{ id: 'f', typeId: 'fixture_us_forest' }, { id: 'h1', typeId: 'fixture_us_hall' }, { id: 'h2', typeId: 'fixture_us_hall' }],
            statusOf: (id) => (id === 'f' ? { state: 'spawning' } : null),
            bankCount: () => 5
        }).items[0];
        expect(row.netPerMinute).toBe(-1);
        expect(row.runsOutMs).toBeNull();
        expect(formatRunsOut(row.runsOutMs)).toBe('never');
    });
});

describe('formatting', () => {
    it('rates and durations read plainly', () => {
        expect(formatRate(0)).toBe('0');
        expect(formatRate(0.333333)).toBe('0.33');
        expect(formatRate(12.4)).toBe('12');
        expect(formatRunsOut(40000)).toBe('~40 s');
        expect(formatRunsOut(3.5 * 3600000)).toBe('~3.5 h');
        expect(formatRunsOut(5 * 86400000)).toBe('~5 days');
    });
});
