import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Orders from '../systems/board/Orders.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Flags from '../systems/board/Flags.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as GroundRules from '../systems/board/GroundRules.js';
import * as Fishing from '../systems/board/Fishing.js';
import * as FishingSpots from '../systems/board/FishingSpots.js';
import * as EventClock from '../systems/events/EventClock.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { setEventsForTests, resetEventsForTests } from '../config/registries/eventRegistry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { spotOf, isSpotKind, WATER_KIND } from '../config/registries/fishingSpots.js';
import { catchPoolsOf, poolsAt } from '../config/registries/catchPools.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { standOnWater, SEA_POINT, LAKE_POINT, LAND_POINT } from './fixtures/fishingWater.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Fishing spots (brief 850 F1, plan points 16, 17, 20, 21). Water is ground: a **spot kind** (a
 * Token type with a `spot` block) arrives on its own on water cells of its kinds, in a Region of its
 * biomes, about every so many minutes and never more than its most at once on a mat. It moves on by
 * a **chance per catch** (no counter), or drifts off after a while with nobody working it. It never
 * counts toward the Token cap. Its catch comes from the water it sits on plus the Region's biome
 * (catch pools may name both); a rare kind's catch is fixed (pools that name neither).
 */

const material = (id, name, extra = {}) => ({ id, name, type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw', ...extra });

registerItems({
    fs_trout: material('fs_trout', 'Trout'),
    fs_cod: material('fs_cod', 'Cod'),
    fs_tropical: material('fs_tropical', 'Tropical Fish'),
    fs_oyster: material('fs_oyster', 'Oyster'),
    fs_bait: material('fs_bait', 'Bait', { equipSlot: 'consumable', sprite: 'i_fish_bait' }),
    fs_rod: { id: 'fs_rod', name: 'Rod', type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_rod_wood', tool: { kind: 'fishing_rod', tier: 1 } }
});

const WORK = { skill: 'fishing', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] };
const kind = (id, spot, catchPools) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 't_fish_spot', requiresHero: true,
    uses: null, standsOn: ['water'], spot, catchPools, config: { ...WORK }
});
const rodPool = (catches, tags = {}) => ({ tool: 'fishing_rod', bait: 'fs_bait', catches, ...tags });

registerTokenTypes({
    // The plain spot: its catch by the water it sits on and the Region's biome, the first pool that fits winning.
    fs_spot: kind('fs_spot', { water: ['sea', 'fresh'], everyMinutes: 1, most: 2 }, [
        rodPool([{ itemId: 'fs_trout', weight: 1 }], { water: ['fresh'] }),
        rodPool([{ itemId: 'fs_tropical', weight: 1 }], { water: ['sea'], biomes: ['coast'] }),
        rodPool([{ itemId: 'fs_cod', weight: 1 }], { water: ['sea'] })
    ]),
    // A rare kind: warm sea only, a fixed catch.
    fs_bed: kind('fs_bed', { water: ['sea'], biomes: ['coast'], everyMinutes: 10, most: 1 }, [
        rodPool([{ itemId: 'fs_oyster', weight: 1 }])
    ]),
    fs_leaver: kind('fs_leaver', { water: ['sea'], leaveChance: 50 }, [rodPool([{ itemId: 'fs_cod', weight: 1 }])]),
    fs_stayer: kind('fs_stayer', { water: ['sea'] }, [rodPool([{ itemId: 'fs_cod', weight: 1 }])]),
    fs_drifter: kind('fs_drifter', { water: ['sea'], unworkedMinutes: 2 }, [rodPool([{ itemId: 'fs_cod', weight: 1 }])]),
    fs_plain: { id: 'fs_plain', name: 'Plain', tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_nature', uses: null, requiresHero: false }
});

function hero(id) {
    const equipment = Array.from({ length: 9 }, (_, i) => (i === 0 ? 'fs_rod' : i === 1 ? 'fs_bait' : null));
    const heldCopies = equipment.map(itemId => !!itemId && getAllItems()[itemId]?.equipSlot === 'hand');
    return { id, name: id, status: 'idle', level: 10, skills: { fishing: { level: 10, xp: 0 } },
        hp: { current: 100, max: 100 }, equipment, heldCopies };
}

const spotsOf = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);
const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

/** A seeded stream (mulberry32). */
function seeded(seed = 1) {
    let s = seed;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); resetEventsForTests(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [];
    clearMat();
    standOnWater();
});

describe('a spot kind, as content', () => {
    it('reads its block: water kinds the game has, biomes, rate in minutes, most at once, leave chance, unworked time', () => {
        expect(spotOf(getTokenType('fs_bed'))).toEqual({
            water: ['sea'], biomes: ['coast'], everyMs: 600000, most: 1, leaveChance: 0, unworkedMs: 0
        });
        expect(spotOf({ spot: { water: ['sea', 'lava', 'sea'], everyMinutes: -1, most: 2.7, leaveChance: 250, unworkedMinutes: 0.5 } })).toEqual({
            water: ['sea'], biomes: [], everyMs: 0, most: 2, leaveChance: 100, unworkedMs: 30000
        });
        expect(isSpotKind(getTokenType('fs_spot'))).toBe(true);
        expect(isSpotKind(getTokenType('fs_plain'))).toBe(false);
        expect(Object.values(WATER_KIND)).toEqual(['sea', 'fresh', 'sulphur']);
    });

    it('a catch pool may name the water and the biomes it holds for; one naming neither holds everywhere', () => {
        const def = getTokenType('fs_spot');
        const fishOf = (place) => poolsAt(def, place).map(p => p.catches[0].itemId);
        expect(fishOf({ water: 'fresh', biomes: ['coast'] })).toEqual(['fs_trout']);
        expect(fishOf({ water: 'sea', biomes: ['coast'] })).toEqual(['fs_tropical', 'fs_cod']);
        expect(fishOf({ water: 'sea', biomes: ['meadow'] })).toEqual(['fs_cod']);
        expect(fishOf(null)).toEqual([]);
        expect(poolsAt(getTokenType('fs_bed'), null).map(p => p.catches[0].itemId)).toEqual(['fs_oyster']);
        // An untagged pool reads exactly as before.
        expect(catchPoolsOf(getTokenType('fs_bed'))[0]).toEqual({ tool: 'fishing_rod', bait: 'fs_bait', catches: [{ itemId: 'fs_oyster', weight: 1 }] });
        expect(catchPoolsOf(def)[0].water).toEqual(['fresh']);
    });
});

describe('water is ground: which water a point is', () => {
    it('the sea, a lake (fresh water) and dry land', () => {
        expect(GroundRules.waterKindAt(SEA_POINT.x, SEA_POINT.y)).toBe('sea');
        expect(GroundRules.waterKindAt(LAKE_POINT.x, LAKE_POINT.y)).toBe('fresh');
        expect(GroundRules.waterKindAt(LAND_POINT.x, LAND_POINT.y)).toBeNull();
    });

    it('a Region no map wrote has no water, and is meadow', () => {
        GameState.state.atlas = { activeRegionId: null, regions: {} };
        expect(GroundRules.waterKindAt(SEA_POINT.x, SEA_POINT.y)).toBeNull();
        expect(GroundRules.regionBiomes()).toEqual(['meadow']);
    });
});

describe('spots arrive on their own', () => {
    it('about every N minutes on water of their kinds, never more than their most at once', () => {
        const landed = [];
        let now = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.SPOT_LANDED, (p) => { if (p.typeId === 'fs_spot') landed.push({ ...p, at: now }); });
        let most = 0;
        try {
            for (; now < 10 * 60000;) {
                now += 100;
                BoardRunner.tick(100);
                most = Math.max(most, spotsOf('fs_spot').length);
            }
        } finally { off(); }
        // The first wait is drawn between half and one and a half of the minute.
        expect(landed[0].at).toBeGreaterThanOrEqual(30000);
        expect(landed[0].at).toBeLessThanOrEqual(90000);
        expect(landed).toHaveLength(2);
        expect(most).toBe(2);
        for (const spot of spotsOf('fs_spot')) {
            expect(['sea', 'fresh']).toContain(GroundRules.waterKindAt(spot.x, spot.y));
            expect(spot.origin).toBe('spawned');
        }
    });

    it('a rare kind lands only on its own water, in a Region of its biome', () => {
        run(60 * 60000, 1000);
        const beds = spotsOf('fs_bed');
        expect(beds).toHaveLength(1);
        expect(GroundRules.waterKindAt(beds[0].x, beds[0].y)).toBe('sea');

        clearMat();
        GameState.state.board.spotClocks = {};
        standOnWater({ biome: { meadow: 1 } });
        run(60 * 60000, 1000);
        expect(spotsOf('fs_bed')).toHaveLength(0);
    });

    it('no water, no spot, and no random number drawn: every meadow plays as before', () => {
        GameState.state.atlas = { activeRegionId: null, regions: {} };
        let draws = 0;
        const counted = () => { draws++; return 0.5; };
        for (let t = 0; t < 10 * 60000; t += 1000) FishingSpots.tick(1000, counted);
        expect(draws).toBe(0);
        expect(BoardState.tokens()).toHaveLength(0);
    });

    it('a spot stands outside the Token cap, and lands with the mat at its cap', () => {
        const plain = placeAt('fs_plain', LAND_POINT.x, LAND_POINT.y);
        setMatTuning('tokenCap', 1);
        expect(MatCap.canPlaceMore()).toBe(false);
        run(3 * 60000, 1000);
        const spots = spotsOf('fs_spot');
        expect(spots.length).toBeGreaterThan(0);
        expect(spots.every(s => !MatCap.countsTowardCap(s))).toBe(true);
        expect(MatCap.countsTowardCap(plain)).toBe(true);
        expect(MatCap.tokenCount()).toBe(1);
    });

    it('a Region\'s clocks are its own board\'s, saved with it', () => {
        run(10000, 1000);
        const clock = GameState.state.board.spotClocks.fs_spot;
        expect(clock.ms).toBe(10000);
        expect(clock.waitMs).toBeGreaterThanOrEqual(30000);
        // The rare kind's clock runs beside it on this warm sea.
        expect(Object.keys(GameState.state.board.spotClocks)).toEqual(['fs_spot', 'fs_bed']);
        expect(JSON.parse(JSON.stringify(GameState.state.board)).spotClocks).toEqual(GameState.state.board.spotClocks);
    });
});

describe('a spot\'s catch: the water it sits on plus the Region\'s biome', () => {
    it('fresh water, a warm sea, a cold sea', () => {
        GameState.state.heroes = [hero('fisher')];
        InventoryManager.addItem('fs_bait', 5);
        const lake = placeAt('fs_spot', LAKE_POINT.x, LAKE_POINT.y);
        const sea = placeAt('fs_spot', SEA_POINT.x, SEA_POINT.y);
        const def = getTokenType('fs_spot');
        const fish = (instance) => Fishing.fishingOf(def, 'fisher', instance)?.pool?.catches.map(c => c.itemId);
        expect(fish(lake)).toEqual(['fs_trout']);
        expect(fish(sea)).toEqual(['fs_tropical']);
        standOnWater({ biome: { mountain: 1 } });
        expect(fish(sea)).toEqual(['fs_cod']);
    });

    it('a worked spot lands its own catch', () => {
        GameState.state.heroes = [hero('fisher')];
        InventoryManager.addItem('fs_bait', 50);
        placeAt('fs_spot', SEA_POINT.x, SEA_POINT.y);
        expect(Orders.orderAt('fisher', SEA_POINT).success).toBe(true);
        const landed = [];
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => landed.push(...p.produced));
        try { run(5000); } finally { off(); }
        expect(landed.length).toBeGreaterThan(2);
        expect(new Set(landed)).toEqual(new Set(['fs_tropical']));
    });
});

describe('a spot moves on by chance per catch, with no counter', () => {
    it('each catch rolls the spot\'s chance once: under it the spot goes, else it stays', () => {
        const at = placeAt('fs_leaver', SEA_POINT.x, SEA_POINT.y);
        const def = getTokenType('fs_leaver');
        expect(FishingSpots.afterCatch(at, def, () => 0.5)).toBe(false);
        expect(BoardState.getTokenById(at.id)).not.toBeNull();
        expect(FishingSpots.afterCatch(at, def, () => 0.49)).toBe(true);
        expect(BoardState.getTokenById(at.id)).toBeNull();
        // A kind with no chance draws nothing.
        const stayer = placeAt('fs_stayer', SEA_POINT.x, SEA_POINT.y);
        expect(FishingSpots.afterCatch(stayer, getTokenType('fs_stayer'), () => { throw new Error('drew'); })).toBe(false);
    });

    it('worked, it goes after some catch (a different one by luck), and its hero\'s order lapses', () => {
        const caughtBeforeLeaving = [];
        for (const seed of [1, 2, 3, 4, 5, 6]) {
            clearMat();
            GameState.state.heroes = [hero('fisher')];
            InventoryManager.addItem('fs_bait', 500);
            const spot = placeAt('fs_leaver', SEA_POINT.x, SEA_POINT.y);
            expect(Orders.orderAt('fisher', SEA_POINT).success).toBe(true);
            const left = [];
            let catches = 0;
            const offs = [
                EventBus.subscribe(BOARD_EVENTS.SPOT_LEFT, (p) => left.push(p)),
                EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.instanceId === spot.id && p.produced.length) catches++; })
            ];
            const random = seeded(seed);
            const real = Math.random;
            Math.random = random;
            try { run(60000); } finally { Math.random = real; offs.forEach(off => off()); }
            expect(BoardState.getTokenById(spot.id)).toBeNull();
            expect(left).toEqual([expect.objectContaining({ instanceId: spot.id, typeId: 'fs_leaver', reason: FishingSpots.LEFT.MOVED_ON })]);
            run(200);
            const flag = BoardState.flagOf('fisher');
            expect(flag?.pinnedTo).toBeUndefined();
            expect(flag?.needsJob).toBe(true);
            caughtBeforeLeaving.push(catches);
        }
        expect(new Set(caughtBeforeLeaving).size).toBeGreaterThan(1);
    });

    it('a spot with no chance stays however much is caught', () => {
        GameState.state.heroes = [hero('fisher')];
        InventoryManager.addItem('fs_bait', 500);
        const spot = placeAt('fs_stayer', SEA_POINT.x, SEA_POINT.y);
        Orders.orderAt('fisher', SEA_POINT);
        run(60000);
        expect(BoardState.getTokenById(spot.id)).not.toBeNull();
    });
});

describe('an unworked spot drifts off after a while', () => {
    it('with nobody on it, it goes when its time is up', () => {
        const spot = placeAt('fs_drifter', SEA_POINT.x, SEA_POINT.y);
        const left = [];
        const off = EventBus.subscribe(BOARD_EVENTS.SPOT_LEFT, (p) => left.push(p));
        try {
            run(119900);
            expect(BoardState.getTokenById(spot.id)).not.toBeNull();
            run(200);
        } finally { off(); }
        expect(BoardState.getTokenById(spot.id)).toBeNull();
        expect(left).toEqual([expect.objectContaining({ instanceId: spot.id, reason: FishingSpots.LEFT.UNWORKED })]);
    });

    it('worked, its clock holds at zero; let go, it counts from then', () => {
        GameState.state.heroes = [hero('fisher')];
        InventoryManager.addItem('fs_bait', 5000);
        const spot = placeAt('fs_drifter', SEA_POINT.x, SEA_POINT.y);
        Orders.orderAt('fisher', SEA_POINT);
        run(5 * 60000);
        expect(BoardState.getTokenById(spot.id)).not.toBeNull();
        Orders.sendHome('fisher');
        run(60000);
        expect(BoardState.getTokenById(spot.id)).not.toBeNull();
        run(61000);
        expect(BoardState.getTokenById(spot.id)).toBeNull();
    });
});

describe('the QA landing and the event clock', () => {
    it('lands a kind now on its own water; refused where it has none', () => {
        const res = FishingSpots.landNow('fs_bed');
        expect(res.success).toBe(true);
        expect(GroundRules.waterKindAt(res.instance.x, res.instance.y)).toBe('sea');
        GameState.state.atlas = { activeRegionId: null, regions: {} };
        expect(FishingSpots.landNow('fs_bed').success).toBe(false);
        expect(FishingSpots.landNow('fs_plain').success).toBe(false);
    });

    it('a spot kind landed as an event leaves as a spot does, and says so as an event', () => {
        setEventsForTests({ ev_shoal: { id: 'ev_shoal', name: 'Shoal', typeId: 'fs_leaver', kind: 'node', weight: 10, ground: ['water'], biomes: [] } });
        EventClock.setEnabled(true);
        try {
            const landed = EventClock.landNow('ev_shoal', seeded(3));
            expect(landed.success).toBe(true);
            const ended = [];
            const off = EventBus.subscribe(BOARD_EVENTS.EVENT_ENDED, (p) => ended.push(p));
            try { expect(FishingSpots.afterCatch(landed.instance, getTokenType('fs_leaver'), () => 0)).toBe(true); } finally { off(); }
            expect(ended).toEqual([expect.objectContaining({ instanceId: landed.instance.id, eventId: 'ev_shoal' })]);
            expect(EventClock.eventTokenOnMat()).toBeNull();
        } finally {
            EventClock.setEnabled(false);
        }
    });
});
