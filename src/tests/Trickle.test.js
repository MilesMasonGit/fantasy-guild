import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * Token Lifecycle slice 3.4 — **the trickle** (SP-66, §3.1): items into the
 * Bank on a clock per line, no hero needed.
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
    fixture_tr_seed: item('fixture_tr_seed', 'Fixture Trickle Seed'),
    fixture_tr_wood: item('fixture_tr_wood', 'Fixture Trickle Wood')
});

registerTokenTypes({
    /** A Hall stand-in: a seed every 5 min, 2 wood every 90 s. */
    fixture_tr_hall: {
        id: 'fixture_tr_hall', name: 'Fixture Trickle Hall', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        trickle: [
            { itemId: 'fixture_tr_seed', quantity: 1, everyMs: 300000 },
            { itemId: 'fixture_tr_wood', quantity: 2, everyMs: 90000 }
        ]
    },
    /** Lines the engine must skip rather than choke on. */
    fixture_tr_broken: {
        id: 'fixture_tr_broken', name: 'Fixture Broken Trickle', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        trickle: [
            { itemId: 'fixture_tr_seed', quantity: 1, everyMs: 0 },
            { itemId: 'fixture_tr_seed', quantity: 0, everyMs: 1000 },
            { quantity: 1, everyMs: 1000 },
            { itemId: 'fixture_tr_wood', quantity: 1, everyMs: 1000 }
        ]
    }
});

const seeds = () => InventoryManager.getItemCount('fixture_tr_seed');
const wood = () => InventoryManager.getItemCount('fixture_tr_wood');
const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
    clearMat();
});

afterEach(() => {
    TileModifiers.teardown();
    resetMatTuning();
});

describe('⭐ a Token with a trickle fills the Bank on its own clock, no hero', () => {
    it('each line at its own rate', () => {
        const hall = placeAt('fixture_tr_hall', 800, 500);

        run(89900);
        expect(wood()).toBe(0);
        run(100);
        expect(wood()).toBe(2);
        expect(seeds()).toBe(0);

        run(300000 - 90000);   // 5 min in
        expect(seeds()).toBe(1);
        expect(wood()).toBe(6);   // 3 laps of 90 s
        expect(hall.clocks.trickle).toEqual([0, 30000]);
    });

    it('fast-forwards by delta: one 30-minute tick grants what 30 minutes of small ticks do', () => {
        placeAt('fixture_tr_hall', 800, 500);
        run(30 * 60000, 1000);
        const small = { seeds: seeds(), wood: wood() };

        GameState.initNew();
        InventoryManager.init();
        GameState.state.inventory.maxSlots = 50;
        clearMat();
        const hall = placeAt('fixture_tr_hall', 800, 500);
        TimedChanges.tick(30 * 60000);
        const big = { seeds: seeds(), wood: wood() };

        expect(big).toEqual(small);
        expect(small).toEqual({ seeds: 6, wood: 40 });   // 30/5 and 2 × 30/1.5
        expect(hall.clocks.trickle).toEqual([0, 0]);
    });

    it('the clocks are saved', () => {
        const hall = placeAt('fixture_tr_hall', 800, 500);
        run(60000);

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);
        InventoryManager.init();

        expect(BoardState.getTokenById(hall.id).clocks.trickle).toEqual([60000, 60000]);
        run(29900);
        expect(wood()).toBe(0);
        run(100);
        expect(wood()).toBe(2);
    });

    it('skips lines it cannot honour and keeps the rest running', () => {
        const broken = placeAt('fixture_tr_broken', 800, 500);
        run(5000);
        expect(seeds()).toBe(0);
        expect(wood()).toBe(5);
        expect(broken.clocks.trickle).toHaveLength(4);
    });

    it('a Token without a trickle gets no trickle clock', () => {
        const plain = placeAt('fixture_producer', 800, 500);
        run(5000);
        expect(plain.clocks).toBeUndefined();
    });

    it('⚠️ a full Bank overflows as usual (D-138) rather than losing the items', () => {
        GameState.state.inventory.maxSlots = 0;
        const overflow = [];
        const off = EventBus.subscribe('inventory_overflow', p => overflow.push(p));
        try {
            placeAt('fixture_tr_hall', 800, 500);
            run(90000);
        } finally {
            off?.();
        }
        expect(wood()).toBe(0);
        expect(overflow).toEqual([{ itemId: 'fixture_tr_wood', amount: 2 }]);
    });

    it('advanceTrickle reports what it granted', () => {
        const hall = placeAt('fixture_tr_hall', 800, 500);
        expect(SpawnerSystem.advanceTrickle(hall, 600000)).toBe(2 + 12);
    });
});
