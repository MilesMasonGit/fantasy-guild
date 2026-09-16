import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as RecipeResolver from '../systems/board/RecipeResolver.js';
import * as Managers from '../systems/board/Managers.js';
import * as Restrictions from '../systems/board/Restrictions.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as Charges from '../systems/board/Charges.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { nearby, neighbourIds, centreOf, tokensAround } from '../systems/board/nearby.js';
import { footprintCentre } from '../config/boardGeometry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { registerTokenTypes, getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { placeAt, clearMat, SPACING, idAt, anchorOf } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Free Playmat slice 1.6b part 1 — the engine readers by instance id and
 * mat point.**
 *
 * The owner's framing rule: *there are no Tiles.* These tests lay Tokens out at
 * mat points with the test helper (`placeAt`) and ask the readers by **instance
 * id** and **point**. Where a test compares with "today's answer" it lays the
 * Tokens on today's 160 u step (`P(col, row)`, test layout only) so the old
 * tile algorithm can be written out beside the new reader.
 */

const LARGE_BUFF = 'fixture_free_large_buff';
const BOARD_BUFF = 'fixture_free_board_buff';

registerTokenTypes({
    [LARGE_BUFF]: {
        id: LARGE_BUFF, name: 'Free Large Buff', tokenType: 'buff', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 'skill_nature', size: 2, requiresHero: false,
        statements: [{
            id: 'stm_free_large_buff', keyword: 'provides', to: { mode: 'all' },
            payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.05 }
        }]
    },
    [BOARD_BUFF]: {
        id: BOARD_BUFF, name: 'Free Board Buff', tokenType: 'buff', rarity: 'rare', theme: 'fixture',
        uses: null, sprite: 'skill_occult',
        statements: [{
            id: 'stm_free_board_buff', keyword: 'provides', reach: 'board', to: { mode: 'all' },
            payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.05 }
        }]
    }
});

/** Today's 160 u step, as a mat point (test layout only). */
// Measured from tile 0's centre, which moved with the old area's corner (FP-92).
const P = (col, row) => ({ x: footprintCentre(0, 1).x + col * SPACING, y: footprintCentre(0, 1).y + row * SPACING });
const at = (typeIdOrInstance, point) => placeAt(typeIdOrInstance, point.x, point.y);
const yieldOf = (instance) => TileModifiers.resolveAxis(instance.id, EFFECT_TYPES.YIELD, 100);
const sortedIds = (ids) => [...ids].sort();

function hero(id, skills = { logging: 50 }) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    clearMat();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [hero('h1')];
});

afterEach(() => resetMatTuning());

// ---------------------------------------------------------------------------
// Stale buffs — the slice's top risk
// ---------------------------------------------------------------------------

describe('⭐ a moved buff Token: its old neighbours lose it AND its new neighbours gain it', () => {
    beforeAll(() => {
        // The engine's own ADJACENCY_DIRTY listener, for the Placement path.
        BoardRunner.init();
    });

    /** A +5% buff at A with four side neighbours, three more around B, one far away. */
    function layout() {
        const A = P(2, 2);
        const B = P(5, 4);
        const oldSides = [P(1, 2), P(3, 2), P(2, 1), P(2, 3)].map(p => at('fixture_producer', p));
        const newSides = [P(4, 4), P(5, 3), P(5, 5)].map(p => at('fixture_producer', p));
        const far = at('fixture_producer', P(0, 5));
        const buff = at('fixture_buff_yield', A);
        TileModifiers.rebuildAll();
        for (const s of oldSides) expect(yieldOf(s)).toBeCloseTo(105);
        for (const s of newSides) expect(yieldOf(s)).toBeCloseTo(100);
        return { A, B, oldSides, newSides, far, buff };
    }

    it('rebuildAround([departure, arrival]) refreshes both neighbourhoods', () => {
        const { B, oldSides, newSides, far, buff } = layout();

        const departure = centreOf(buff);
        BoardState.setTokenPoint(buff.id, B.x, B.y);
        TileModifiers.rebuildAround([departure, B]);

        for (const s of oldSides) expect(yieldOf(s), 'old neighbour keeps a stale buff').toBeCloseTo(100);
        for (const s of newSides) expect(yieldOf(s), 'new neighbour misses the buff').toBeCloseTo(105);
        expect(yieldOf(far)).toBeCloseTo(100);
    });

    it('through Placement.moveToken and the engine listener', () => {
        const { oldSides, newSides, far, buff } = layout();

        const from = anchorOf(buff.id);
        const to = 4 * 6 + 5;                       // P(5, 4) in today's layout
        expect(Placement.moveToken(from, to).success).toBe(true);
        expect(centreOf(BoardState.getTokenById(buff.id))).toEqual(P(5, 4));

        for (const s of oldSides) expect(yieldOf(s)).toBeCloseTo(100);
        for (const s of newSides) expect(yieldOf(s)).toBeCloseTo(105);
        expect(yieldOf(far)).toBeCloseTo(100);
    });
});

// ---------------------------------------------------------------------------
// nearby(id) gives today's tile answer
// ---------------------------------------------------------------------------

describe('⭐ nearby(id) at today\'s spacing equals the old tile reader, on a mixed board with 2×2s', () => {
    const sizeOf = (instance) => getTokenType(instance.typeId)?.size || 1;

    /** The pre-1.6b tile reader, written out: other anchors whose footprint centres are within the radius. */
    function oldNearbyTiles(tile, radius) {
        const occ = BoardState.getOccupyingToken(tile);
        if (!occ) return [];
        const origin = footprintCentre(occ.anchorIndex, sizeOf(occ.instance));
        return BoardState.occupiedTiles()
            .filter(([anchor, instance]) => {
                if (anchor === occ.anchorIndex) return false;
                const c = footprintCentre(anchor, sizeOf(instance));
                return Math.hypot(c.x - origin.x, c.y - origin.y) <= radius;
            })
            .map(([anchor]) => anchor)
            .sort((a, b) => a - b);
    }

    function mixedBoard() {
        BoardState.setToken(7, BoardState.createTokenInstance(LARGE_BUFF, null));    // 2×2 on 7, 8, 13, 14
        BoardState.setToken(22, BoardState.createTokenInstance(LARGE_BUFF, null));   // 2×2 on 22, 23, 28, 29
        for (const t of [0, 3, 5, 12, 15, 16, 19, 20, 26, 30, 33, 35]) {
            BoardState.setToken(t, BoardState.createTokenInstance('fixture_producer', 5000));
        }
    }

    for (const radius of [164, 272, 400]) {
        it(`at ${radius} u, for every Token`, () => {
            mixedBoard();
            setMatTuning('nearRadius', radius);
            const anchors = BoardState.occupiedTiles().map(([a]) => a);
            expect(anchors).toContain(7);
            for (const anchor of anchors) {
                const id = idAt(anchor);
                const answer = nearby(id).map(n => anchorOf(n)).sort((a, b) => a - b);
                expect(answer, `Token on ${anchor}`).toEqual(oldNearbyTiles(anchor, radius));
            }
        });
    }
});

// ---------------------------------------------------------------------------
// Managers — by spot point
// ---------------------------------------------------------------------------

describe('⭐ Managers restock the exact spot, nearest first, then the earlier-placed Manager', () => {
    it('lands at the exact spot point — even one that is no tile centre', () => {
        const spot = { x: 450, y: 333 };
        at('fixture_manager', { x: 600, y: 333 });          // 150 u
        BoardState.setVacancyAt(spot, 'fixture_producer');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        const spotId = BoardState.spotIdAt(spot.x, spot.y);

        expect(Managers.restockSpot(spotId)).toBe('restocked');
        expect(BoardState.tokensAtPoint(spot.x, spot.y).map(t => t.typeId)).toEqual(['fixture_producer']);
        expect(BoardState.vacancyAt(spotId)).toBeNull();
    });

    it('the nearest Manager wins; on equal distance, the one placed first', () => {
        const spot = { x: 800, y: 800 };
        const east = at('fixture_manager', { x: 950, y: 800 });   // 150 u, placed first
        const west = at('fixture_manager', { x: 650, y: 800 });   // 150 u, placed second
        expect(Managers.managerFor(spot, 'fixture_producer')).toEqual([east.id, 'fixture_manager']);

        const nearer = at('fixture_manager', { x: 800, y: 900 }); // 100 u, placed last
        expect(Managers.managerFor(spot, 'fixture_producer')[0]).toBe(nearer.id);

        BoardState.removeToken(nearer.id);
        BoardState.removeToken(east.id);
        expect(Managers.managerFor(spot, 'fixture_producer')[0]).toBe(west.id);
    });
});

// ---------------------------------------------------------------------------
// Restrictions — the projected view
// ---------------------------------------------------------------------------

describe('⭐ Restrictions on a projected view (place / remove / move) give today\'s refusals', () => {
    /** The restricted Coast at P(2,2), exactly at its limit of 2 Coasts within Near (164 u). */
    function atLimit() {
        const coast = at('fixture_coast', P(2, 2));
        const left = at('fixture_plain_coast', P(1, 2));
        const right = at('fixture_plain_coast', P(3, 2));
        return { coast, left, right };
    }

    it('a third Coast beside it is refused on the view, and nudged clear through Placement (FP-88)', () => {
        atLimit();
        const refusal = Restrictions.checkPlacement(P(2, 1), 'fixture_plain_coast');
        expect(refusal.ok).toBe(false);
        expect(refusal.violatingTypeId).toBe('fixture_coast');

        // ⭐ The VIEW still says no to that exact point — but since FP-88 the
        // engine does not refuse the drop, it moves it to the nearest point that
        // obeys the rule. Either way the board is never left illegal.
        const res = Placement.placeToken(8, BoardState.createTokenInstance('fixture_plain_coast', 500));
        expect(res.success).toBe(true);
        expect(res.nudged).toBe(true);
        expect(Restrictions.violations()).toEqual([]);

        // A diagonal (226 u) is not near at the shipped 164 u.
        expect(Restrictions.checkPlacement(P(3, 3), 'fixture_plain_coast').ok).toBe(true);
    });

    it('remove: a Token leaving does not count', () => {
        const { left } = atLimit();
        expect(Restrictions.checkPlacement(P(2, 1), 'fixture_plain_coast', { remove: [left.id] }).ok).toBe(true);
    });

    it('move: a Token moved out of reach stops counting; one moved into reach starts', () => {
        const { left } = atLimit();
        expect(Restrictions.checkPlacement(P(2, 1), 'fixture_plain_coast', { move: [{ id: left.id, ...P(0, 2) }] }).ok).toBe(true);

        const stray = at('fixture_plain_coast', P(5, 5));
        const shove = Restrictions.checkPlacement(P(0, 5), 'fixture_producer', { move: [{ id: stray.id, ...P(2, 3) }] });
        expect(shove.ok).toBe(false);
        expect(shove.violatingTypeId).toBe('fixture_coast');
    });

    it('a check moves nothing on the real board', () => {
        const { coast, left, right } = atLimit();
        Restrictions.checkPlacement(P(2, 1), 'fixture_plain_coast', { remove: [left.id], move: [{ id: right.id, ...P(5, 5) }] });
        expect([coast, left, right].map(centreOf)).toEqual([P(2, 2), P(1, 2), P(3, 2)]);
        expect(BoardState.tokens()).toHaveLength(3);
    });
});

// ---------------------------------------------------------------------------
// The neighbour-id cache (RecipeResolver / Charges)
// ---------------------------------------------------------------------------

describe('⭐ the per-instance neighbour cache drops on add, move, remove and a Near change', () => {
    it('stays correct through every kind of change', () => {
        const station = at('fixture_tool_gated', P(2, 2));
        const tiers = () => RecipeResolver.contextTiersAround(station.id);

        // Cached: asking twice without a change gives the very same list.
        const first = neighbourIds(station.id);
        expect(neighbourIds(station.id)).toBe(first);
        expect(tiers()).toEqual({});

        const tool = at('fixture_tool', P(3, 2));                       // add
        expect(tiers()).toEqual({ ctx_fixture_tool: 1 });
        expect(RecipeResolver.resolveRecipe(station.id, station).status).toBe(RecipeResolver.RECIPE.OK);

        BoardState.setTokenPoint(tool.id, P(3, 3).x, P(3, 3).y);        // move to a diagonal, 226 u
        expect(tiers()).toEqual({});
        expect(RecipeResolver.resolveRecipe(station.id, station).status).toBe(RecipeResolver.RECIPE.NONE);

        setMatTuning('nearRadius', 272);                                // Near change
        expect(tiers()).toEqual({ ctx_fixture_tool: 1 });

        BoardState.removeToken(tool.id);                                // remove
        expect(tiers()).toEqual({});
    });

    it('a new board (a load) starts a fresh cache', () => {
        const station = at('fixture_tool_gated', P(2, 2));
        at('fixture_tool', P(3, 2));
        expect(RecipeResolver.contextTiersAround(station.id)).toEqual({ ctx_fixture_tool: 1 });

        GameState.state.board = { ...GameState.state.board, tokens: { [station.id]: station } };
        expect(RecipeResolver.contextTiersAround(station.id)).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// Flags — claims and waits by id; the Token under a point
// ---------------------------------------------------------------------------

describe('⭐ flags claim by instance id and wait by spot id', () => {
    beforeAll(() => Flags.init());
    afterAll(() => Flags.teardown());

    it('a claim names the instance, and follows its point when it moves (FP-68)', () => {
        const forest = at('fixture_producer', P(2, 2));
        Flags.plant('h1', P(2, 2));

        expect(BoardState.claimOfHero('h1')).toEqual({ instanceId: forest.id, typeId: 'fixture_producer', ...P(2, 2) });
        expect(BoardState.workTokenOf('h1')).toBe(forest.id);
        expect(BoardState.workerOf(forest.id)).toBe('h1');

        BoardState.setTokenPoint(forest.id, P(4, 4).x, P(4, 4).y);
        Flags.assign(0);
        expect(BoardState.claimOfHero('h1')).toMatchObject({ instanceId: forest.id, ...P(4, 4) });
        expect(BoardState.workTokenOf('h1')).toBe(forest.id);
        expect(BoardState.displayPointOf('h1')).toEqual(P(4, 4));
    });

    it('a hero whose Token ran dry waits on its spot by id, then claims the restock there (FP-70)', () => {
        const spot = P(2, 2);
        at('fixture_manager', P(3, 2));
        const forest = at(BoardState.createTokenInstance('fixture_producer', 1), spot);
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        Flags.plant('h1', spot);
        expect(BoardState.workTokenOf('h1')).toBe(forest.id);

        Charges.destroyToken(forest, { heroId: 'h1' });
        Flags.assign(0);

        const spotId = BoardState.spotIdAt(spot.x, spot.y);
        expect(BoardState.waitOfHero('h1')).toEqual({ spotId, typeId: 'fixture_producer', ...spot });
        expect(BoardState.workerOf(forest.id)).toBeNull();
        expect(BoardState.displayPointOf('h1')).toEqual(spot);

        Managers.sweep();
        Flags.assign(0);
        const restocked = BoardState.tokensAtPoint(spot.x, spot.y)[0];
        expect(restocked.id).not.toBe(forest.id);
        expect(BoardState.workTokenOf('h1')).toBe(restocked.id);
    });

    it('setDisallowed takes an instance id', () => {
        const forest = at('fixture_producer', P(2, 2));
        expect(Flags.setDisallowed(forest.id, true).success).toBe(true);
        expect(forest.disallowed).toBe(true);
        expect(Flags.setDisallowed('tok_nope', true).success).toBe(false);
    });
});

describe('⭐ the Token under a point: inside its art circle, nearest centre wins where circles overlap', () => {
    it('1×1 Tokens 80 u apart', () => {
        const a = placeAt('fixture_producer', 100, 100);
        const b = placeAt('fixture_producer', 180, 100);     // art circles (64 u) overlap

        expect(Flags.pointOnToken(a, { x: 164, y: 100 })).toBe(true);    // exactly on the rim
        expect(Flags.pointOnToken(a, { x: 165, y: 100 })).toBe(false);

        expect(Flags.tokenAtPoint({ x: 130, y: 100 })).toBe(a);   // 30 u vs 50 u
        expect(Flags.tokenAtPoint({ x: 150, y: 100 })).toBe(b);   // 50 u vs 30 u
        expect(Flags.tokenAtPoint({ x: 140, y: 100 })).toBe(a);   // 40 u each: the earlier-placed
        expect(Flags.tokenAtPoint({ x: 100, y: 300 })).toBeNull();
    });

    it('a 1×1 inside a 2×2\'s wider circle (144 u)', () => {
        const big = placeAt(LARGE_BUFF, 600, 600);
        const small = placeAt('fixture_producer', 720, 600);

        expect(Flags.pointOnToken(big, { x: 744, y: 600 })).toBe(true);
        expect(Flags.pointOnToken(big, { x: 745, y: 600 })).toBe(false);
        expect(Flags.tokenAtPoint({ x: 700, y: 600 })).toBe(small);   // 20 u vs 100 u
        expect(Flags.tokenAtPoint({ x: 620, y: 600 })).toBe(big);
    });
});

// ---------------------------------------------------------------------------
// Board reach
// ---------------------------------------------------------------------------

describe('⭐ a board-reach rule still rebuilds every Token', () => {
    it('arriving and leaving reach a Token far outside the local rebuild', () => {
        const far = at('fixture_producer', P(5, 5));
        TileModifiers.rebuildAll();
        expect(yieldOf(far)).toBeCloseTo(100);

        const buff = at(BOARD_BUFF, P(0, 0));
        expect(tokensAround([P(0, 0)])).not.toContain(far.id);   // not in the local coverage
        TileModifiers.rebuildAround([P(0, 0)]);
        expect(yieldOf(far)).toBeCloseTo(105);

        const where = centreOf(buff);
        BoardState.removeToken(buff.id);
        TileModifiers.rebuildAround([where]);
        expect(yieldOf(far)).toBeCloseTo(100);
    });
});

// Keep the helper import honest: every id the readers hand back is a real Token.
describe('ids, not tiles', () => {
    it('nearby and neighbourIds answer instance ids that getTokenById finds', () => {
        const a = at('fixture_producer', P(1, 1));
        const b = at('fixture_producer', P(2, 1));
        expect(sortedIds(nearby(a.id))).toEqual([b.id]);
        expect(neighbourIds(a.id).map(id => BoardState.getTokenById(id))).toEqual([b]);
        expect(tokenStartingUses('fixture_producer')).toBe(5000);
    });
});
