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
import * as FishingSpots from '../systems/board/FishingSpots.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { idleMomentOf, momentText } from '../ui/components/board/heroSpeech.js';
import { standOnWater } from './fixtures/fishingWater.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The Fishing Hut keeps its heroes fishing (plan point 18). A hero ordered onto a spot by hand
 * stops when it goes; a hero sent to a Fishing Hut (a camp of Fishing) moves on to the next spot in
 * the Hut's reach that fits their tool and their Fishing level, nearest first, and never to one
 * beyond its reach.
 */

const fish = (id, name, terms) => ({ id, name, type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw', fish: terms });
const carried = (id, name) => ({ id, name, type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait' });
const tool = (id, name, kind) => ({ id, name, type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_rod_wood', tool: { kind, tier: 1 } });

registerItems({
    fh_trout: fish('fh_trout', 'Trout', { level: 1, cycleMs: 1000, bait: 1 }),
    fh_marlin: fish('fh_marlin', 'Marlin', { level: 40, cycleMs: 1000, bait: 1 }),
    fh_shark: fish('fh_shark', 'Shark', { level: 1, cycleMs: 1000, bait: 1 }),
    fh_bait: carried('fh_bait', 'Bait'),
    fh_marlin_lure: { ...carried('fh_marlin_lure', 'Marlin Lure'), lure: { fish: ['fh_marlin'] } },
    fh_rod: tool('fh_rod', 'Rod', 'fishing_rod')
});

const WORK = { skill: 'fishing', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] };
// Spots that never arrive or leave by themselves: each test places and removes its own.
const spotKind = (id, pools) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 't_fish_spot', requiresHero: true,
    uses: null, standsOn: ['water'], spot: { water: ['sea'] }, catchPools: pools, config: { ...WORK }
});
const pool = (toolKind, itemId) => ({ tool: toolKind, bait: 'fh_bait', catches: [{ itemId, weight: 1 }] });

registerTokenTypes({
    fh_spot: spotKind('fh_spot', [pool('fishing_rod', 'fh_trout')]),
    fh_deep_spot: spotKind('fh_deep_spot', [pool('fishing_rod', 'fh_marlin')]),
    fh_mixed_spot: spotKind('fh_mixed_spot', [{ tool: 'fishing_rod', bait: 'fh_bait', catches: [{ itemId: 'fh_trout', weight: 1 }, { itemId: 'fh_marlin', weight: 1 }] }]),
    fh_shark_spot: spotKind('fh_shark_spot', [pool('harpoon', 'fh_shark')]),
    fh_hut: {
        id: 'fh_hut', name: 'Fishing Hut', tokenType: 'camp', rarity: 'common', theme: 'fixture',
        sprite: 't_market_fish', uses: null, requiresHero: false, camp: { skill: 'fishing' }
    }
});

/** The Hut on the shore, above the sea; its reach (240) runs down onto the water. */
const HUT = { x: 960, y: 760 };
/** On the sea, in the Hut's reach, at three distances from it. */
const NEAR = { x: 960, y: 900 };
const MID = { x: 1080, y: 930 };
const FAR = { x: 840, y: 950 };
/** On the sea, beyond the Hut's reach. */
const OUT = { x: 1500, y: 980 };

function hero(id, fishing = 10, extra = []) {
    const grid = ['fh_rod', 'fh_bait', ...extra];
    const equipment = Array.from({ length: 9 }, (_, i) => grid[i] || null);
    const heldCopies = equipment.map(itemId => !!itemId && getAllItems()[itemId]?.equipSlot === 'hand');
    return { id, name: id, status: 'idle', level: 10, skills: { fishing: { level: fishing, xp: 0 } },
        hp: { current: 100, max: 100 }, equipment, heldCopies };
}

/** A spot arriving as `FishingSpots` lands one: on the mat, and said with `TILE_CHANGED`. */
function arrive(typeId, at) {
    const instance = placeAt(typeId, at.x, at.y);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId });
    return instance;
}

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };
const working = (heroId) => BoardState.workTokenOf(heroId) ?? BoardState.claimOfHero(heroId)?.instanceId ?? null;

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

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
    InventoryManager.addItem('fh_bait', 500);
});

describe('⭐ when a spot goes', () => {
    it('a hero ordered onto it by hand stops: they need a job, even with another spot beside it', () => {
        GameState.state.heroes = [hero('fisher')];
        const spot = placeAt('fh_spot', NEAR.x, NEAR.y);
        placeAt('fh_spot', MID.x, MID.y);
        expect(Orders.orderAt('fisher', NEAR).success).toBe(true);
        run(300);
        expect(working('fisher')).toBe(spot.id);
        FishingSpots.leave(spot, FishingSpots.LEFT.MOVED_ON);
        run(300);
        expect(working('fisher')).toBeNull();
        expect(BoardState.flagOf('fisher')).toEqual(expect.objectContaining({ spot: true, needsJob: true }));
    });

    it('a Fishing Hut\'s hero moves on to the next spot in its reach, nearest first, and keeps their order on the Hut', () => {
        GameState.state.heroes = [hero('fisher')];
        const hut = placeAt('fh_hut', HUT.x, HUT.y);
        const near = placeAt('fh_spot', NEAR.x, NEAR.y);
        const mid = placeAt('fh_spot', MID.x, MID.y);
        const far = placeAt('fh_spot', FAR.x, FAR.y);
        placeAt('fh_spot', OUT.x, OUT.y);
        expect(Orders.orderAt('fisher', HUT).success).toBe(true);
        run(300);
        expect(working('fisher')).toBe(near.id);

        FishingSpots.leave(near, FishingSpots.LEFT.MOVED_ON);
        run(300);
        // Nearest from where the hero stands now, by the spot that left.
        expect(working('fisher')).toBe(mid.id);
        expect(BoardState.flagOf('fisher')?.pinnedTo).toBe(hut.id);

        FishingSpots.leave(mid, FishingSpots.LEFT.UNWORKED);
        run(300);
        expect(working('fisher')).toBe(far.id);

        // The last one in reach goes: the spot beyond the reach is never theirs.
        FishingSpots.leave(far, FishingSpots.LEFT.MOVED_ON);
        run(300);
        expect(working('fisher')).toBeNull();
        expect(BoardState.flagOf('fisher')?.pinnedTo).toBe(hut.id);
        expect(BoardState.flagOf('fisher')?.needsJob).not.toBe(true);

        // A spot arriving in the reach is theirs at once.
        const fresh = arrive('fh_spot', NEAR);
        run(300);
        expect(working('fisher')).toBe(fresh.id);
    });

    it('the next spot must fit their tool and level: a rod passes a harpoon spot and one whose fish are above them', () => {
        GameState.state.heroes = [hero('fisher', 10)];
        placeAt('fh_hut', HUT.x, HUT.y);
        const first = placeAt('fh_spot', NEAR.x, NEAR.y);
        placeAt('fh_shark_spot', MID.x - 40, MID.y);
        placeAt('fh_deep_spot', MID.x, MID.y);
        const fits = placeAt('fh_spot', FAR.x, FAR.y);
        expect(Orders.orderAt('fisher', HUT).success).toBe(true);
        run(300);
        expect(working('fisher')).toBe(first.id);
        FishingSpots.leave(first, FishingSpots.LEFT.MOVED_ON);
        run(300);
        expect(working('fisher')).toBe(fits.id);
    });

    it('a lure above them keeps them off a spot that holds its fish; they fish the next spot, which lacks it', () => {
        GameState.state.heroes = [hero('fisher', 10, ['fh_marlin_lure'])];
        InventoryManager.addItem('fh_marlin_lure', 5);
        placeAt('fh_hut', HUT.x, HUT.y);
        const first = placeAt('fh_spot', NEAR.x, NEAR.y);
        placeAt('fh_mixed_spot', MID.x, MID.y);
        const plain = placeAt('fh_spot', FAR.x, FAR.y);
        expect(Orders.orderAt('fisher', HUT).success).toBe(true);
        run(300);
        expect(working('fisher')).toBe(first.id);
        FishingSpots.leave(first, FishingSpots.LEFT.MOVED_ON);
        run(300);
        expect(working('fisher')).toBe(plain.id);
    });

    it('two heroes at one Hut: the one whose spot left takes a free spot, never the other\'s', () => {
        GameState.state.heroes = [hero('ana'), hero('bo')];
        placeAt('fh_hut', HUT.x, HUT.y);
        const a = placeAt('fh_spot', NEAR.x, NEAR.y);
        placeAt('fh_spot', MID.x, MID.y);
        expect(Orders.orderAt('ana', HUT).success).toBe(true);
        run(300);
        expect(Orders.orderAt('bo', HUT).success).toBe(true);
        run(300);
        const bos = working('bo');
        expect(working('ana')).toBe(a.id);
        expect(bos).not.toBeNull();
        expect(bos).not.toBe(a.id);

        FishingSpots.leave(a, FishingSpots.LEFT.MOVED_ON);
        run(300);
        expect(working('ana')).toBeNull();
        expect(working('bo')).toBe(bos);
        const free = arrive('fh_spot', FAR);
        run(300);
        expect(working('ana')).toBe(free.id);
        expect(working('bo')).toBe(bos);
    });
});


describe('⭐ with no spot in reach', () => {
    it('a Hut hero waits silently with the idle mark, and takes the next spot as it arrives', () => {
        GameState.state.heroes = [hero('fisher')];
        placeAt('fh_hut', HUT.x, HUT.y);
        placeAt('fh_spot', OUT.x, OUT.y);
        expect(Orders.orderAt('fisher', HUT).success).toBe(true);
        run(300);
        expect(working('fisher')).toBeNull();
        const status = Flags.statusOf('fisher');
        expect(status).toMatchObject({ order: 'token', needsJob: false });
        expect(BoardRunner.isHeroIdle('fisher')).toBe(true);
        expect(idleMomentOf(null, null, { order: status.order, needsJob: status.needsJob, waitsForSpot: !!status.campId })).toBeNull();

        const fresh = arrive('fh_spot', NEAR);
        run(300);
        expect(working('fisher')).toBe(fresh.id);
    });

    it('a hero ordered onto a spot by hand still needs a job when it goes', () => {
        GameState.state.heroes = [hero('fisher')];
        const spot = placeAt('fh_spot', NEAR.x, NEAR.y);
        expect(Orders.orderAt('fisher', NEAR).success).toBe(true);
        run(300);
        FishingSpots.leave(spot, FishingSpots.LEFT.MOVED_ON);
        run(300);
        const status = Flags.statusOf('fisher');
        expect(status.needsJob).toBe(true);
        expect(idleMomentOf(null, null, { order: status.order, needsJob: status.needsJob, waitsForSpot: !!status.campId }))
            .toMatchObject({ text: momentText.needsJob() });
    });
});
