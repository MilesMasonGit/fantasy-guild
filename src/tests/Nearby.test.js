import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { neighboursOf, neighboursOfFootprint } from '../systems/board/adjacency.js';
import {
    nearby, tokensWithin, tokensAround, positionOf, nearRadius
} from '../systems/board/nearby.js';
import { TILE_COUNT, tileCentre, footprintCentre, tileFootprint } from '../config/boardGeometry.js';
import { setMatTuning, resetMatTuning, matTuning, matTuningDefault } from '../config/matTuning.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { REACH } from '../config/registries/reachRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { idAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * **`nearby()` — reach as a distance** (Free Playmat slices 1.2, 1.6b).
 *
 * FP-56: every passive reader is a centre-to-centre distance query. Since slice
 * 1.6b the readers take and answer **instance ids**; these tests lay Tokens out
 * on the old tile centres and translate ids back to tiles (`near`, below) so the
 * familiar ring geometry can still be pinned exactly.
 *
 * FP-41: a 2×2 Token, measured from its footprint centre, reaches the 8
 * side-touching tiles and loses the 4 corner-diagonal ones (at 272 u).
 *
 * 6×6 board, row-major:
 * ```
 *    0  1  2  3  4  5
 *    6  7  8  9 10 11
 *   12 13 14 15 16 17
 *   18 19 20 21 22 23
 *   24 25 26 27 28 29
 *   30 31 32 33 34 35
 * ```
 */

const LARGE_BUFF = 'fixture_nearby_large_buff';
const SMALL = 'fixture_producer';
const BUFF = 'fixture_buff_yield';     // +5% YIELD, default (adjacent) reach

registerTokenTypes({
    [LARGE_BUFF]: {
        id: LARGE_BUFF, name: LARGE_BUFF, tokenType: 'buff', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 'skill_nature', size: 2, requiresHero: false, config: null,
        statements: [{
            id: `stm_${LARGE_BUFF}`, keyword: 'provides',
            to: { mode: 'all', value: '' },
            payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.05 }
        }]
    }
});

const sorted = (list) => [...list].sort((a, b) => a - b);

/** Ids → the tiles those Tokens stand on (test layout). */
const tilesOf = (ids) => ids.map(id => BoardState.tileOfToken(id));

/** `nearby` asked of the Token covering `tile`, answered as tiles. */
const near = (tile, ...rest) => tilesOf(nearby(idAt(tile), ...rest));

function put(tile, typeId) {
    BoardState.setToken(tile, BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)));
}

function clearBoard() {
    for (const [index] of BoardState.occupiedTiles()) BoardState.setToken(index, null);
}

/** Fill every tile not covered by `taken` with a 1×1 Token, in ascending tile order. */
function fillAround(taken = []) {
    const skip = new Set(taken);
    for (let i = 0; i < TILE_COUNT; i++) if (!skip.has(i)) put(i, SMALL);
}

const yieldAt = (tile) => TileModifiers.resolveAxis(idAt(tile), EFFECT_TYPES.YIELD, 100);

beforeEach(() => {
    GameState.initNew();
    clearBoard();
    TileModifiers.clearAll();
    resetMatTuning();
    // ⚠️ This file pins the geometry of the 8-tile ring, so Near is set to 272 u
    // explicitly. It has shipped at 164 u since FP-75 — see the FP-75 block below.
    setMatTuning('nearRadius', 272);
});

afterEach(() => {
    TileModifiers.teardown();
    resetMatTuning();
});

describe('mat positions', () => {
    it('a tile step is 160 u and a 1×1 centre is its tile centre', () => {
        expect(tileCentre(0)).toEqual({ x: 64, y: 64 });
        expect(tileCentre(1).x - tileCentre(0).x).toBe(160);
        expect(tileCentre(6).y - tileCentre(0).y).toBe(160);
        put(14, SMALL);
        expect(positionOf(14)).toEqual(tileCentre(14));
    });

    it('a 2×2 Token\'s centre is the centre of its footprint, from any of its tiles', () => {
        put(7, LARGE_BUFF);
        expect(footprintCentre(7, 2)).toEqual({ x: 304, y: 304 });
        for (const t of tileFootprint(7, 2)) expect(positionOf(t)).toEqual({ x: 304, y: 304 });
    });

    it('Near defaults to 164 u (FP-75, was 272 u under FP-65)', () => {
        resetMatTuning();
        expect(nearRadius()).toBe(164);
        expect(matTuningDefault('nearRadius')).toBe(164);
    });
});

describe('⭐ at the shipped 164 u Near is the four side neighbours (FP-75)', () => {
    beforeEach(() => resetMatTuning());

    it('flag radius and Near both ship at 164 u', () => {
        expect(matTuningDefault('flagRadius')).toBe(164);
        expect(matTuningDefault('nearRadius')).toBe(164);
        expect(matTuning('flagRadius')).toBe(164);
    });

    it('on a board full of 1×1 Tokens — corners 2, edges 3, centre 4, never a diagonal', () => {
        fillAround();
        const counts = new Set();
        for (let i = 0; i < TILE_COUNT; i++) {
            const col = i % 6;
            const sides = [i - 6, i + 6, col > 0 ? i - 1 : -1, col < 5 ? i + 1 : -1]
                .filter(t => t >= 0 && t < TILE_COUNT);
            expect(sorted(near(i)), `tile ${i}`).toEqual(sorted(sides));
            counts.add(sides.length);
        }
        expect(sorted(counts)).toEqual([2, 3, 4]);
    });

    it('a 2×2 Token reaches nothing and nothing reaches it', () => {
        put(7, LARGE_BUFF);
        fillAround(tileFootprint(7, 2));
        expect(near(7)).toEqual([]);
        for (const t of [1, 2, 6, 9, 12, 15, 19, 20]) expect(near(t)).not.toContain(7);
    });

    it('a Provides buff from a 1×1 Token reaches its side neighbours, not its diagonals', () => {
        put(14, BUFF);
        fillAround([14]);
        TileModifiers.rebuildAll();
        for (const t of [8, 13, 15, 20]) expect(yieldAt(t), `tile ${t}`).toBeCloseTo(105);
        for (const t of [7, 9, 19, 21]) expect(yieldAt(t), `tile ${t}`).toBeCloseTo(100);
    });
});

describe('⭐ at 272 u Near is exactly today\'s 8-tile ring for every 1×1 tile', () => {
    it('measured from a point: the Tokens within 272 u of each tile centre are its ring', () => {
        fillAround();
        for (let i = 0; i < TILE_COUNT; i++) {
            const within = tilesOf(tokensWithin(tileCentre(i), 272, idAt(i)));
            expect(sorted(within), `tile ${i}`).toEqual(sorted(neighboursOf(i)));
        }
    });

    it('as Tokens, on a board full of 1×1 Tokens — corners 3, edges 5, centre 8', () => {
        fillAround();
        const counts = new Set();
        for (let i = 0; i < TILE_COUNT; i++) {
            const ring = near(i);
            expect(sorted(ring), `tile ${i}`).toEqual(sorted(neighboursOf(i)));
            counts.add(ring.length);
        }
        expect(sorted(counts)).toEqual([3, 5, 8]);
    });

    it('self, self_and_adjacent and board are unchanged', () => {
        fillAround();
        expect(near(14, REACH.SELF)).toEqual([14]);
        expect(near(14, REACH.SELF_AND_ADJACENT)).toEqual([14, ...sorted(neighboursOf(14))]);
        expect(nearby(idAt(14), REACH.BOARD)).toHaveLength(TILE_COUNT);
    });

    it('a Token not on the mat reaches nothing', () => {
        fillAround();
        expect(nearby('tok_not_on_the_mat')).toEqual([]);
        expect(nearby(null)).toEqual([]);
    });
});

describe('⚠️ a 2×2 Token reaches less, measured from its centre (FP-41)', () => {
    it('an interior 2×2 reaches its 8 side-touching tiles, not the 4 corner diagonals (12 → 8)', () => {
        put(7, LARGE_BUFF);
        fillAround(tileFootprint(7, 2));

        expect(neighboursOfFootprint(tileFootprint(7, 2))).toHaveLength(12);   // the old ring
        expect(near(7)).toEqual([1, 2, 6, 9, 12, 15, 19, 20]);
        expect(near(14)).toEqual([1, 2, 6, 9, 12, 15, 19, 20]);              // from a non-anchor tile
        for (const corner of [0, 3, 18, 21]) expect(near(7)).not.toContain(corner);
    });

    it('a corner 2×2 reaches 4 instead of 5', () => {
        put(0, LARGE_BUFF);
        fillAround(tileFootprint(0, 2));

        expect(neighboursOfFootprint(tileFootprint(0, 2))).toEqual([2, 8, 12, 13, 14]);
        expect(near(0)).toEqual([2, 8, 12, 13]);
    });

    it('tiles near a 2×2 measure to its centre too, so the relation is symmetric', () => {
        put(7, LARGE_BUFF);
        fillAround(tileFootprint(7, 2));

        expect(near(21)).not.toContain(7);    // corner diagonal
        expect(near(20)).toContain(7);        // side-touching
    });

    it('two 2×2 Tokens side by side are 320 u apart and do not reach each other', () => {
        put(0, LARGE_BUFF);
        put(2, LARGE_BUFF);
        expect(near(0)).toEqual([]);
    });
});

describe('a larger radius widens the set', () => {
    it('400 u adds the straight and knight\'s-move tiles two steps out', () => {
        fillAround();
        const wide = near(14, REACH.ADJACENT, 400);
        expect(wide).toHaveLength(20);
        for (const n of neighboursOf(14)) expect(wide).toContain(n);
        expect(wide).toContain(12);             // 320 u
        expect(wide).toContain(1);              // 358 u
        expect(wide).not.toContain(0);          // 453 u
    });

    it('follows the live Mat Tuner value, clamped to its range', () => {
        fillAround();
        setMatTuning('nearRadius', 400);
        expect(near(14)).toHaveLength(20);
        setMatTuning('nearRadius', 5000);
        expect(matTuning('nearRadius')).toBe(600);
        resetMatTuning();
        expect(near(14)).toHaveLength(4);      // the shipped 164 u (FP-75)
    });
});

describe('⭐ a Provides buff reaches exactly the Near set', () => {
    it('from a 1×1 Token: its 8 neighbours and nothing else', () => {
        put(14, BUFF);
        fillAround([14]);
        TileModifiers.rebuildAll();

        const ring = new Set(neighboursOf(14));
        for (let t = 0; t < TILE_COUNT; t++) {
            if (t === 14) continue;
            expect(yieldAt(t), `tile ${t}`).toBeCloseTo(ring.has(t) ? 105 : 100);
        }
    });

    it('from a 2×2 Token: the 8 side-touching tiles, and not the 4 corner diagonals', () => {
        put(7, LARGE_BUFF);
        fillAround(tileFootprint(7, 2));
        TileModifiers.rebuildAll();

        for (const t of [1, 2, 6, 9, 12, 15, 19, 20]) expect(yieldAt(t), `tile ${t}`).toBeCloseTo(105);
        for (const t of [0, 3, 18, 21]) expect(yieldAt(t), `tile ${t}`).toBeCloseTo(100);
    });

    it('filterTargets (triggered statuses, damage, counts) names the same set, by id', () => {
        put(7, LARGE_BUFF);
        fillAround(tileFootprint(7, 2));
        const statement = { keyword: 'applies', to: { mode: 'all', value: '' } };

        expect(tilesOf(TileModifiers.filterTargets(idAt(7), statement))).toEqual([1, 2, 6, 9, 12, 15, 19, 20]);

        clearBoard();
        fillAround();
        expect(sorted(tilesOf(TileModifiers.filterTargets(idAt(14), statement)))).toEqual(sorted(neighboursOf(14)));
        setMatTuning('nearRadius', 400);
        expect(TileModifiers.filterTargets(idAt(14), statement)).toHaveLength(20);
    });
});

describe('rebuild coverage follows the radius', () => {
    it('tokensAround covers every Token within Near + 144 u of the point, and nothing further', () => {
        fillAround();
        const origin = tileCentre(14);
        const reach = 272 + 144;
        const expected = [];
        for (let t = 0; t < TILE_COUNT; t++) {
            const c = tileCentre(t);
            if (Math.hypot(c.x - origin.x, c.y - origin.y) <= reach) expected.push(t);
        }
        expect(sorted(tilesOf(tokensAround([origin])))).toEqual(expected);
        // Always at least the Token itself and its whole ring.
        for (const t of [14, ...neighboursOf(14)]) expect(expected).toContain(t);
    });

    it('several points: the union of what each would cover', () => {
        fillAround();
        const a = tilesOf(tokensAround([tileCentre(0)]));
        const b = tilesOf(tokensAround([tileCentre(35)]));
        expect(sorted(tilesOf(tokensAround([tileCentre(0), tileCentre(35)]))))
            .toEqual(sorted([...new Set([...a, ...b])]));
        expect(tokensAround([null, undefined])).toEqual([]);
    });

    it('at 400 u, placing a buff reaches a Token two tiles away with only rebuildAround', () => {
        setMatTuning('nearRadius', 400);
        put(12, SMALL);
        TileModifiers.rebuildAll();
        expect(yieldAt(12)).toBeCloseTo(100);

        put(14, BUFF);                          // 320 u from tile 12
        TileModifiers.rebuildAround([tileCentre(14)]);
        expect(yieldAt(12)).toBeCloseTo(105);

        BoardState.setToken(14, null);
        TileModifiers.rebuildAround([tileCentre(14)]);
        expect(yieldAt(12)).toBeCloseTo(100);
    });

    it('removing a 2×2 clears its buff when rebuilt around a point near where it stood', () => {
        put(7, LARGE_BUFF);
        put(1, SMALL);                           // side-touching, 253 u from the 2×2 centre
        TileModifiers.rebuildAll();
        expect(yieldAt(1)).toBeCloseTo(105);

        BoardState.setToken(7, null);
        TileModifiers.rebuildAround([tileCentre(14)]);   // a non-anchor tile's centre, 113 u off its centre
        expect(yieldAt(1)).toBeCloseTo(100);
    });

    it('rebuildAround refuses a tile number rather than silently rebuilding nothing', () => {
        expect(() => TileModifiers.rebuildAround(14)).toThrow(TypeError);
    });

    it('changing the radius rebuilds every Token, with no board event', () => {
        TileModifiers.init();
        put(12, SMALL);
        put(14, BUFF);
        TileModifiers.rebuildAll();
        expect(yieldAt(12)).toBeCloseTo(100);

        setMatTuning('nearRadius', 400);
        expect(yieldAt(12)).toBeCloseTo(105);

        resetMatTuning();
        expect(yieldAt(12)).toBeCloseTo(100);
    });
});
