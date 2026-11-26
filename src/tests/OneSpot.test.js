import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as Placement from '../systems/board/Placement.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Growth from '../systems/board/Growth.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Foundations from '../systems/board/Foundations.js';
import * as FixedTokens from '../systems/board/FixedTokens.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { artRadiusOf } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { clearMat, placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ One spot for a Token's whole cycle. A Stump and a Sapling are drawn small but take the room of
 * the Tree they become, and a Foundation the room of the largest Token it can build, for every
 * placement and every push: so nothing can be put down tight against the small form, and a tree
 * that grows back or a building that finishes stands exactly where its small form stood.
 * Content-free: its own types, the real rules.
 */

const base = (id, extra) => ({ id, name: id, tokenType: 'resource', rarity: 'common', theme: 't', uses: null, sprite: 's_nature', requiresHero: false, ...extra });
const STUMP = 'os_stump', SAPLING = 'os_sapling', TREE = 'os_tree';
const BIG_STUMP = 'os_big_stump', BIG_TREE = 'os_big_tree';
const FURNACE = 'os_furnace', PLAIN = 'os_plain';
const FOUNDATION = 'os_foundation', SHED_FOUNDATION = 'os_shed_foundation', BIG_HALL = 'os_big_hall', SHED = 'os_shed';

beforeAll(() => {
    registerTokenTypes({
        [TREE]: base(TREE, { staysPut: true, uses: 1, respawn: { mode: 'regrow', into: STUMP } }),
        [STUMP]: base(STUMP, { artSize: 'small', staysPut: true, grows: { into: SAPLING, afterMs: 1000 } }),
        [SAPLING]: base(SAPLING, { artSize: 'small', grows: { into: TREE, afterMs: 1000 } }),
        [BIG_TREE]: base(BIG_TREE, { staysPut: true, size: 2 }),
        [BIG_STUMP]: base(BIG_STUMP, { artSize: 'small', staysPut: true, grows: { into: BIG_TREE, afterMs: 1000 } }),
        [FURNACE]: base(FURNACE, { tokenType: 'station' }),
        [PLAIN]: base(PLAIN),
        [FOUNDATION]: base(FOUNDATION, { uses: 1, foundation: { kind: 'os_stone', skill: 'construction' } }),
        [SHED_FOUNDATION]: base(SHED_FOUNDATION, { uses: 1, foundation: { kind: 'os_wood', skill: 'construction' } }),
        [BIG_HALL]: base(BIG_HALL, { tokenType: 'station', size: 2 }),
        [SHED]: base(SHED, { tokenType: 'station' })
    });
    const build = (id, tokenId, kinds) => ({
        id, name: id, levelRequirement: 1, foundationKinds: kinds, inputs: [],
        outputs: [{ tokenId, chance: 100, minQty: 1, maxQty: 1 }], durationMs: 1000, xp: 1
    });
    registerRecipePools({
        construction: [
            build('os_build_shed', SHED, ['os_stone', 'os_wood']),
            build('os_build_big_hall', BIG_HALL, ['os_stone'])
        ]
    });
});

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    Growth.resetGrowthAlerts();
    clearMat();
});
afterEach(() => { clearMat(); resetMatTuning(); });

const gapTo = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pointOf = (t) => ({ x: t.x, y: t.y });
const tick = (ms, step = 100) => { for (let t = 0; t < ms; t += step) TimedChanges.tick(step); };
const only = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);
const drop = (typeId, point) => Placement.placeTokenAt(BoardState.createTokenInstance(typeId, null, null, BoardState.ORIGIN.PLACED), point);
/** Put a Token down as the game does: on the mat, the neighbourhood rebuilt round it. */
const arrive = (typeId, x, y) => {
    const t = placeAt(typeId, x, y);
    TileModifiers.rebuildAround([{ x, y }]);
    return t;
};

describe('⭐ the room a Token takes is the largest body of its whole cycle', () => {
    it('a Stump and a Sapling take their Tree\'s room, though they are drawn small', () => {
        expect(artRadiusOf(STUMP)).toBe(artRadiusOf(TREE) / 2);
        expect(MatPlacement.roomRadiusOf(STUMP)).toBe(artRadiusOf(TREE));
        expect(MatPlacement.roomRadiusOf(SAPLING)).toBe(artRadiusOf(TREE));
        expect(MatPlacement.hitRadiusOf(STUMP)).toBe(MatPlacement.hitRadiusOf(TREE));
        expect(MatPlacement.minGap(FURNACE, STUMP)).toBe(MatPlacement.minGap(FURNACE, TREE));
    });

    it('a Stump that grows into a large tree takes the large tree\'s room', () => {
        expect(MatPlacement.roomRadiusOf(BIG_STUMP)).toBe(artRadiusOf(BIG_TREE));
    });

    it('a Foundation takes the room of the largest Token it can build; one building only ordinary Tokens, its own', () => {
        expect(MatPlacement.roomRadiusOf(FOUNDATION)).toBe(artRadiusOf(BIG_HALL));
        expect(MatPlacement.roomRadiusOf(SHED_FOUNDATION)).toBe(artRadiusOf(SHED_FOUNDATION));
    });

    it('a Token that neither grows nor builds takes its own room', () => {
        expect(MatPlacement.roomRadiusOf(FURNACE)).toBe(artRadiusOf(FURNACE));
        expect(MatPlacement.roomRadiusOf(BIG_TREE)).toBe(artRadiusOf(BIG_TREE));
    });
});

describe('⭐ a drop tight against a growing Token keeps its grown room', () => {
    // At the default tuning a Furnace may stand 60.9 u from a Stump's drawn body, 81.2 u from a Tree.
    const CLEAR_OF_DRAWN_STUMP = 65;

    it('a Furnace let go at a Stump\'s small gap is nudged out to the Tree\'s gap', () => {
        const stump = arrive(STUMP, 800, 500);
        const res = drop(FURNACE, { x: 800 + CLEAR_OF_DRAWN_STUMP, y: 500 });
        expect(res.success).toBe(true);
        expect(res.nudged).toBe(true);
        expect(gapTo(res, stump)).toBeGreaterThanOrEqual(MatPlacement.minGap(FURNACE, TREE) - 1e-6);
    });

    it('a drop with no room for the grown form within nudge reach is refused', () => {
        arrive(STUMP, 800, 500);
        // Clear of the Stump's drawn body, but the Tree's room is further than an 8 u nudge.
        const res = MatPlacement.dropAt({ typeId: FURNACE }, { x: 800 + CLEAR_OF_DRAWN_STUMP, y: 500 }, { reach: 8 });
        expect(res.status).toBe('full');
        expect(res.reason).toBe(MatPlacement.NO_ROOM);
    });

    it('beside a Stump of a large tree, the large tree\'s room is kept', () => {
        const stump = arrive(BIG_STUMP, 800, 500);
        const res = drop(FURNACE, { x: 850, y: 500 });
        expect(res.success).toBe(true);
        expect(gapTo(res, stump)).toBeGreaterThanOrEqual(MatPlacement.minGap(FURNACE, BIG_TREE) - 1e-6);
    });

    it('a Sapling put down by hand at the mat\'s edge keeps its Tree inside the mat', () => {
        expect(MatPlacement.insideMat(SAPLING, { x: 40, y: 500 })).toBe(false);
        const res = drop(SAPLING, { x: 40, y: 500 });
        expect(res.success).toBe(true);
        expect(res.x).toBeGreaterThanOrEqual(artRadiusOf(TREE) - 1e-6);
    });

    it('an arrival that is nobody\'s drop (a purchase, a recipe\'s Token) keeps the room too', () => {
        const stump = arrive(STUMP, 800, 500);
        const res = Placement.placeArrivalNear(BoardState.createTokenInstance(FURNACE, null, null, BoardState.ORIGIN.PLACED), { x: 830, y: 500 });
        expect(res.success).toBe(true);
        expect(gapTo(res, stump)).toBeGreaterThanOrEqual(MatPlacement.minGap(FURNACE, TREE) - 1e-6);
    });
});

describe('⭐ a tree that grows back stands exactly where it stood', () => {
    it('felled, a Stump, a Sapling, a Tree: every form on the same point, the Furnace beside it unmoved', () => {
        const tree = arrive(TREE, 800, 500);
        const furnace = drop(FURNACE, { x: 850, y: 500 });
        expect(furnace.success).toBe(true);
        const furnaceAt = pointOf(only(FURNACE)[0]);

        // Fell it, then a Furnace dropped tight against the Stump.
        tree.usesRemaining = 0;
        tick(100);
        expect(only(STUMP).map(pointOf)).toEqual([{ x: 800, y: 500 }]);
        const second = drop(FURNACE, { x: 800, y: 435 });
        expect(second.success).toBe(true);
        expect(gapTo(second, { x: 800, y: 500 })).toBeGreaterThanOrEqual(MatPlacement.minGap(FURNACE, TREE) - 1e-6);

        tick(1100);
        expect(only(SAPLING).map(pointOf)).toEqual([{ x: 800, y: 500 }]);
        tick(1100);
        expect(only(TREE).map(pointOf)).toEqual([{ x: 800, y: 500 }]);
        expect(pointOf(only(FURNACE)[0])).toEqual(furnaceAt);
        expect(only(FURNACE)).toHaveLength(2);
    });

    it('a large tree grows from its small Stump on the Stump\'s own point', () => {
        arrive(BIG_STUMP, 800, 500);
        expect(drop(FURNACE, { x: 850, y: 500 }).success).toBe(true);
        expect(drop(FURNACE, { x: 760, y: 470 }).success).toBe(true);
        tick(1100);
        expect(only(BIG_TREE).map(pointOf)).toEqual([{ x: 800, y: 500 }]);
    });
});

describe('⭐ a Foundation finishes in place', () => {
    it('a Furnace dropped tight against a Foundation keeps room for its largest build, which then stands on the Foundation\'s point', () => {
        const foundation = arrive(FOUNDATION, 800, 500);
        const res = drop(FURNACE, { x: 890, y: 500 });
        expect(res.success).toBe(true);
        expect(gapTo(res, foundation)).toBeGreaterThanOrEqual(MatPlacement.minGap(FURNACE, BIG_HALL) - 1e-6);

        expect(StationRecipe.setSelectedRecipe(foundation, 'os_build_big_hall')).toBe(true);
        expect(Foundations.hasRoomToBuild(foundation, BIG_HALL)).toBe(true);
        const built = Foundations.buildInPlace(foundation, BIG_HALL);
        expect(pointOf(built)).toEqual({ x: 800, y: 500 });
        expect(pointOf(only(FURNACE)[0])).toEqual({ x: res.x, y: res.y });
    });

    it('a Foundation that builds only ordinary Tokens keeps its ordinary room', () => {
        const foundation = arrive(SHED_FOUNDATION, 800, 500);
        // Just past edges touching (128 u), well inside a 2×2's room (208 u).
        const res = drop(FURNACE, { x: 930, y: 500 });
        expect(res.success).toBe(true);
        expect(res.nudged).toBe(false);
        expect(gapTo(res, foundation)).toBeLessThan(MatPlacement.minGap(FURNACE, BIG_HALL));
    });
});

describe('⭐ a push keeps a growing Token\'s grown room', () => {
    it('a Token shoved toward a Stump stops at the Tree\'s gap, or the push is not made', () => {
        const stump = arrive(STUMP, 400, 500);
        // The newcomer shoves it to about 463 u: clear of the Stump's drawn body, inside the Tree's room.
        placeAt(BoardState.createTokenInstance(PLAIN, null, null, BoardState.ORIGIN.SPAWNED), 490, 500);
        const where = MatPlacement.forceSpot(PLAIN, { x: 545, y: 500 }, { fixedIds: FixedTokens.unpushableIds() });
        expect(where).not.toBeNull();
        const need = MatPlacement.minGap(PLAIN, TREE) - 1e-6;
        for (const p of where.pushed) expect(gapTo(p, stump)).toBeGreaterThanOrEqual(need);
        expect(gapTo(where, stump)).toBeGreaterThanOrEqual(need);
    });

    it('a spawn beside its bearer, next to a Stump, keeps the Tree\'s room', () => {
        const stump = arrive(STUMP, 800, 500);
        const spot = MatPlacement.findSpot(PLAIN, { x: 830, y: 500 });
        expect(spot).not.toBeNull();
        expect(gapTo(spot, stump)).toBeGreaterThanOrEqual(MatPlacement.minGap(PLAIN, TREE) - 1e-6);
        expect(getTokenType(STUMP).artSize).toBe('small');
    });
});
