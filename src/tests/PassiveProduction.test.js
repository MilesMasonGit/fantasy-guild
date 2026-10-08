import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as PassiveProduction from '../systems/board/PassiveProduction.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { PASSIVE_PRODUCTION_MS } from '../config/registries/tokenConstants.js';
import { resetMatTuning } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * T-099 — **Passive Production**: every line a Token pays on its own, no hero
 * needed, on ONE 5-minute timer; the Wishing Well's Water joins the Guild
 * Hall's.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const LAP = PASSIVE_PRODUCTION_MS;

const item = (id, name) => ({
    id, name, type: 'material', sprite: 'wood_oak', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({
    fixture_pp_seed: item('fixture_pp_seed', 'Fixture Passive Seed'),
    fixture_pp_wood: item('fixture_pp_wood', 'Fixture Passive Wood'),
    item_water: item('item_water', 'Water')
});

registerTokenTypes({
    /**
     * A Hall stand-in with lines authored before the shared timer: their own
     * `everyMs` (5 min, 90 s, 10 min) must be ignored.
     */
    fixture_pp_hall: {
        id: 'fixture_pp_hall', name: 'Fixture Passive Hall', tokenType: 'resource', isGuildHall: true,
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        trickle: [
            { itemId: 'fixture_pp_seed', quantity: 1, everyMs: 300000 },
            { itemId: 'fixture_pp_wood', quantity: 2, everyMs: 90000 },
            { itemId: 'fixture_pp_seed', quantity: 1, everyMs: 600000 }
        ]
    },
    /** A Hall with no lines of its own: only the Wishing Well can make it pay. */
    fixture_pp_bare_hall: {
        id: 'fixture_pp_bare_hall', name: 'Fixture Bare Hall', tokenType: 'resource', isGuildHall: true,
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature'
    },
    /** Not a Hall, with a line: pays it, never the Wishing Well's Water. */
    fixture_pp_shrine: {
        id: 'fixture_pp_shrine', name: 'Fixture Shrine', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        trickle: [{ itemId: 'fixture_pp_wood', quantity: 1 }]
    },
    /** Lines the engine must skip rather than choke on. */
    fixture_pp_broken: {
        id: 'fixture_pp_broken', name: 'Fixture Broken Passive', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        trickle: [
            { itemId: 'fixture_pp_seed', quantity: 0 },
            { quantity: 1 },
            { itemId: 'fixture_pp_wood', quantity: 1 }
        ]
    }
});

// Passive Production pays onto the mat as loot, not into the Bank.
const seeds = () => SpriteLayer.countOnBoard('fixture_pp_seed');
const wood = () => SpriteLayer.countOnBoard('fixture_pp_wood');
const water = () => SpriteLayer.countOnBoard('item_water');
const banked = (id) => InventoryManager.getItemCount(id);
const run = (ms, step = 1000) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };
const setWell = (rank) => { GameState.state.progress.guildUpgrades.wishing_well = rank; };

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

describe('⭐ one 5-minute timer pays every line at once, no hero', () => {
    it('every line pays on the same lap, whatever its old everyMs said', () => {
        const hall = placeAt('fixture_pp_hall', 800, 500);

        run(LAP - 1000);
        expect(seeds() + wood()).toBe(0);            // the 90 s line no longer pays early
        run(1000);
        expect(seeds()).toBe(2);                      // both seed lines, merged
        expect(wood()).toBe(2);
        expect(hall.clocks).toEqual({ passiveMs: 0 });

        run(LAP);                                     // the old 10-minute line pays every lap now
        expect(seeds()).toBe(4);
        expect(wood()).toBe(4);
    });

    it('fast-forwards by delta: one 30-minute tick pays what 30 minutes of small ticks do', () => {
        placeAt('fixture_pp_hall', 800, 500);
        run(30 * 60000, 1000);
        const small = { seeds: seeds(), wood: wood() };

        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        GameState.state.inventory.maxSlots = 50;
        clearMat();
        const hall = placeAt('fixture_pp_hall', 800, 500);
        TimedChanges.tick(30 * 60000);

        expect({ seeds: seeds(), wood: wood() }).toEqual(small);
        expect(small).toEqual({ seeds: 12, wood: 12 });   // 6 laps × (1 + 1) seeds, 6 × 2 wood
        expect(hall.clocks.passiveMs).toBe(0);
    });

    it('the clock is saved', () => {
        const hall = placeAt('fixture_pp_hall', 800, 500);
        run(60000);

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);
        InventoryManager.init();

        expect(BoardState.getTokenById(hall.id).clocks).toEqual({ passiveMs: 60000 });
        expect(PassiveProduction.nextInMs(BoardState.getTokenById(hall.id))).toBe(LAP - 60000);
        run(LAP - 61000);
        expect(wood()).toBe(0);
        run(1000);
        expect(wood()).toBe(2);
    });

    it('skips lines it cannot honour and keeps the rest', () => {
        placeAt('fixture_pp_broken', 800, 500);
        run(LAP);
        expect(seeds()).toBe(0);
        expect(wood()).toBe(1);
    });

    it('a Token that pays nothing gets no clock', () => {
        const plain = placeAt('fixture_producer', 800, 500);
        const bare = placeAt('fixture_pp_bare_hall', 400, 500);   // a Hall, Wishing Well rank 0
        run(5000);
        expect(plain.clocks).toBeUndefined();
        expect(bare.clocks).toBeUndefined();
    });

    it('advance reports what it paid', () => {
        const hall = placeAt('fixture_pp_hall', 800, 500);
        expect(PassiveProduction.advance(hall, 2 * LAP)).toBe(2 * (1 + 2 + 1));
    });

    it('⚠️ a full Bank loses nothing (D-138): the loot waits on the floor', () => {
        GameState.state.inventory.maxSlots = 0;
        placeAt('fixture_pp_hall', 800, 500);
        run(LAP);
        const [sprite] = SpriteLayer.getSprites().filter(s => s.refId === 'fixture_pp_wood');
        expect(SpriteLayer.collectSprite(sprite.id)).toBe(false);
        expect(wood()).toBe(2);
        GameState.state.inventory.maxSlots = 50;
        expect(SpriteLayer.collectSprite(sprite.id)).toBe(true);
        expect(banked('fixture_pp_wood')).toBe(2);
    });
});

describe('⭐ the Wishing Well joins the Guild Hall\'s timer (T-099)', () => {
    it('10 Water per rank per lap, on the Hall only, no hero', () => {
        setWell(1);
        placeAt('fixture_pp_hall', 800, 500);
        placeAt('fixture_pp_shrine', 400, 500);
        run(LAP);
        expect(water()).toBe(10);
        expect(seeds()).toBe(2);                      // on the same lap as the Hall's own lines

        setWell(3);
        run(LAP);
        expect(water()).toBe(40);
    });

    it('a rank bought mid-lap pays the new amount at the next payout; the timer is not reset', () => {
        setWell(1);
        const hall = placeAt('fixture_pp_hall', 800, 500);
        run(LAP / 2);
        setWell(2);
        expect(hall.clocks.passiveMs).toBe(LAP / 2);
        run(LAP / 2);
        expect(water()).toBe(20);
    });

    it('starts a Hall with no lines of its own paying', () => {
        const bare = placeAt('fixture_pp_bare_hall', 800, 500);
        expect(PassiveProduction.hasPassiveProduction(bare)).toBe(false);
        setWell(2);
        expect(PassiveProduction.linesOf(bare)).toEqual([{ itemId: 'item_water', quantity: 20, source: 'wishing_well' }]);
        run(LAP);
        expect(water()).toBe(20);
    });

    it('reads the Wishing Well\'s old id', () => {
        GameState.state.progress.guildUpgrades.guildmasters_banner = 2;
        const hall = placeAt('fixture_pp_hall', 800, 500);
        expect(PassiveProduction.linesOf(hall).find(l => l.itemId === 'item_water').quantity).toBe(20);
    });
});

describe('⭐ an old save mid-timer loads sensibly (T-099)', () => {
    it('per-line clocks become one: the lap resumes from the furthest-along line, wrapped to 5 minutes', () => {
        const hall = placeAt('fixture_pp_hall', 800, 500);
        // Saved under the old per-line clocks: 4 min into the seed line, 30 s into the 90 s line,
        // 7 min into the 10-minute line (2 min into a 5-minute lap).
        hall.clocks = { trickle: [240000, 30000, 420000] };

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);
        InventoryManager.init();
        const loaded = BoardState.getTokenById(hall.id);

        expect(PassiveProduction.elapsedOf(loaded)).toBe(240000);
        expect(PassiveProduction.nextInMs(loaded)).toBe(60000);
        run(59000);
        expect(seeds() + wood()).toBe(0);
        run(1000);
        expect(seeds()).toBe(2);
        expect(loaded.clocks).toEqual({ passiveMs: 0 });   // the old clocks are gone
    });

    it('an old clock past a whole lap does not pay a lap it never earned', () => {
        const hall = placeAt('fixture_pp_hall', 800, 500);
        hall.clocks = { trickle: [0, 0, 590000] };          // 9 min 50 s of a 10-minute line
        expect(PassiveProduction.elapsedOf(hall)).toBe(290000);
        run(10000);
        expect(seeds()).toBe(2);
        run(LAP - 1000);
        expect(seeds()).toBe(2);
    });
});

describe('⭐ the pay drops as loot beside the Token', () => {
    it('lands on the mat next to the Token, not in the Bank', () => {
        const hall = placeAt('fixture_pp_hall', 800, 500);
        run(LAP);
        const drops = SpriteLayer.getSprites().filter(s => s.refId === 'fixture_pp_wood');
        expect(drops).toHaveLength(1);
        expect(drops[0]).toMatchObject({ kind: 'item', quantity: 2, fromX: hall.x, fromY: hall.y });
        expect(Math.hypot(drops[0].x - hall.x, drops[0].y - hall.y)).toBeLessThan(130);
        expect(banked('fixture_pp_wood')).toBe(0);
    });

    it('collecting it banks it and announces the collection', () => {
        placeAt('fixture_pp_hall', 800, 500);
        run(LAP);
        const collected = [];
        const off = EventBus.subscribe('board:sprite_collected', p => collected.push(p));
        try {
            const [sprite] = SpriteLayer.getSprites().filter(s => s.refId === 'fixture_pp_wood');
            expect(SpriteLayer.collectSprite(sprite.id)).toBe(true);
        } finally {
            off?.();
        }
        expect(collected).toEqual([expect.objectContaining({ refId: 'fixture_pp_wood', quantity: 2, destination: 'bank' })]);
    });

    it('⚠️ in bulk: a long fast-forward drops ONE sprite per item, holding every lap', () => {
        setWell(1);
        placeAt('fixture_pp_hall', 800, 500);
        TimedChanges.tick(10 * 60 * 60000);   // ten hours in one tick

        expect(SpriteLayer.getSprites()).toHaveLength(3);
        expect(seeds()).toBe(240);            // 120 laps × 2
        expect(wood()).toBe(240);
        expect(water()).toBe(1200);
    });
});
