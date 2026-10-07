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
 * Token Lifecycle slice 3.4 — **the trickle**: items on a clock per line, no
 * hero needed.
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

// the trickle pays onto the mat as loot, not into the Bank.
const seeds = () => SpriteLayer.countOnBoard('fixture_tr_seed');
const wood = () => SpriteLayer.countOnBoard('fixture_tr_wood');
const banked = (id) => InventoryManager.getItemCount(id);
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

describe('⭐ a Token with a trickle pays on its own clock, no hero', () => {
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
        SpriteLayer.init();
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

    it('⚠️ a full Bank loses nothing (D-138): the loot waits on the floor and fills in once there is room', () => {
        GameState.state.inventory.maxSlots = 0;
        placeAt('fixture_tr_hall', 800, 500);
        run(90000);
        expect(wood()).toBe(2);

        // Nothing fits: collecting leaves it where it is.
        const [sprite] = SpriteLayer.getSprites().filter(s => s.refId === 'fixture_tr_wood');
        expect(SpriteLayer.collectSprite(sprite.id)).toBe(false);
        expect(wood()).toBe(2);
        expect(banked('fixture_tr_wood')).toBe(0);

        GameState.state.inventory.maxSlots = 50;
        expect(SpriteLayer.collectSprite(sprite.id)).toBe(true);
        expect(wood()).toBe(0);
        expect(banked('fixture_tr_wood')).toBe(2);
    });

    it('advanceTrickle reports what it granted', () => {
        const hall = placeAt('fixture_tr_hall', 800, 500);
        expect(SpawnerSystem.advanceTrickle(hall, 600000)).toBe(2 + 12);
    });
});

describe('⭐ FB-53: trickle pay drops as loot beside the Token', () => {
    it('lands on the mat next to the Token, not in the Bank', () => {
        const hall = placeAt('fixture_tr_hall', 800, 500);
        run(90000);

        const drops = SpriteLayer.getSprites().filter(s => s.refId === 'fixture_tr_wood');
        expect(drops).toHaveLength(1);
        expect(drops[0]).toMatchObject({ kind: 'item', quantity: 2, fromX: hall.x, fromY: hall.y });
        // Beside the Token, within the distance a gathered output lands at.
        expect(Math.hypot(drops[0].x - hall.x, drops[0].y - hall.y)).toBeLessThan(130);
        expect(banked('fixture_tr_wood')).toBe(0);
    });

    it('collecting it banks it and announces the collection (the flight to the Hall)', () => {
        placeAt('fixture_tr_hall', 800, 500);
        run(90000);
        const collected = [];
        const off = EventBus.subscribe('board:sprite_collected', p => collected.push(p));
        try {
            const [sprite] = SpriteLayer.getSprites();
            expect(SpriteLayer.collectSprite(sprite.id)).toBe(true);
        } finally {
            off?.();
        }
        expect(banked('fixture_tr_wood')).toBe(2);
        expect(collected).toEqual([expect.objectContaining({ refId: 'fixture_tr_wood', quantity: 2, destination: 'bank' })]);
    });

    it('⚠️ in bulk: a long fast-forward drops ONE sprite per line, holding every lap', () => {
        placeAt('fixture_tr_hall', 800, 500);
        TimedChanges.tick(10 * 60 * 60000);   // ten hours in one tick

        const sprites = SpriteLayer.getSprites();
        expect(sprites).toHaveLength(2);
        expect(seeds()).toBe(120);            // 600 min / 5
        expect(wood()).toBe(800);             // 2 × 600 min / 1.5
    });

    it('⚠️ in bulk: many small ticks fold into the first stack instead of spraying new ones', () => {
        placeAt('fixture_tr_hall', 800, 500);
        run(30 * 90000, 90000);               // 30 wood laps, one per tick

        const wood30 = SpriteLayer.getSprites().filter(s => s.refId === 'fixture_tr_wood');
        // One stack; every later drop is bound for it and is absorbed on the
        // floor's own clock (SpriteLayer's usual merge).
        const stacks = wood30.filter(s => !s.targetStackId);
        expect(stacks).toHaveLength(1);
        expect(wood30.every(s => !s.targetStackId || s.targetStackId === stacks[0].id)).toBe(true);
        for (const s of wood30) if (s.targetStackId) SpriteLayer.absorbSprite(s.id);
        expect(SpriteLayer.getSprites().filter(s => s.refId === 'fixture_tr_wood')).toHaveLength(1);
        expect(wood()).toBe(60);
    });
});
