import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import {
    nearby, tokensWithin, tokensAround, nearRadius
} from '../systems/board/nearby.js';
import { setMatTuning, resetMatTuning, matTuning, matTuningDefault } from '../config/matTuning.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { REACH } from '../config/registries/reachRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

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
 * FP-56: every passive reader is a centre-to-centre distance query, and since
 * slice 1.6b the readers take and answer **instance ids**.
 *
 * FP-41: a 2×2 Token, measured from its own centre, reaches the 8 side-touching
 * spots and loses the 4 corner-diagonal ones (at 272 u).
 *
 * ## ⭐ Test layout only (Free Playmat slice 1.6d-2)
 * The game has no tiles. The scene below is a 6 × 6 lattice of mat points 160 u
 * apart — the step the old board had — so the familiar ring geometry can still
 * be pinned exactly: a side neighbour is 160 u, a diagonal 226 u, and a 2×2's
 * centre sits half a step in from its anchor spot, putting it 253 u from a
 * side-touching spot and 339 u from a corner-diagonal one.
 *
 * ```
 *    0  1  2  3  4  5
 *    6  7  8  9 10 11
 *   12 13 14 15 16 17
 *   18 19 20 21 22 23
 *   24 25 26 27 28 29
 *   30 31 32 33 34 35
 * ```
 *
 * ⚠️ The blocks that pinned `tileCentre`, `footprintCentre`, `positionOf` and
 * `adjacency.js` were **deleted** with those functions in slice 1.6d-2 — they
 * asserted the shape of the grid itself, which no longer exists. What survives
 * here is the live behaviour: what `nearby`, `tokensWithin`, `tokensAround` and
 * `filterTargets` actually answer.
 */

const COLS = 6;
const ROWS = 6;
const SPOTS = COLS * ROWS;

/** A spot on the lattice. Rows start at y = 200 so all 36 fit on the mat. */
const C = (i) => ({ x: 400 + (i % COLS) * 160, y: 200 + Math.floor(i / COLS) * 160 });

/** The four spots a 2×2 anchored at `i` covers — test layout, for laying scenes out. */
const footprintOf = (i) => [i, i + 1, i + COLS, i + COLS + 1];

/** The eight spots surrounding `i` — the old ring, computed here rather than imported. */
function ringOf(i) {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const out = [];
    for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        out.push(r * COLS + c);
    }
    return out;
}

const LARGE_BUFF = 'fixture_nearby_large_buff';
const SMALL = 'fixture_producer';
const BUFF = 'fixture_buff_yield';     // +5% YIELD, default (nearby) reach

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

/** Which spot a Token stands on, by instance id — a 2×2 answers with its anchor. */
function spotOf(id) {
    const instance = BoardState.getTokenById(id);
    if (!instance) return null;
    const off = ((getTokenType(instance.typeId)?.size || 1) - 1) * 80;
    const col = Math.round((instance.x - off - 400) / 160);
    const row = Math.round((instance.y - off - 200) / 160);
    return row * COLS + col;
}

/** Ids → the spots those Tokens stand on (test layout). */
const spotsOf = (ids) => ids.map(id => spotOf(id));

/** The instance id standing on spot `i`, whatever its size. */
const idAt = (i) => BoardState.tokens().find(t => spotOf(t.id) === i)?.id ?? null;

/** `nearby` asked of the Token on spot `i`, answered as spots. */
const near = (i, ...rest) => spotsOf(nearby(idAt(i), ...rest));

/** Put a Token on the mat with no rules — a 2×2 at the centre of its four spots. */
function put(i, typeId) {
    const off = ((getTokenType(typeId)?.size || 1) - 1) * 80;
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    BoardState.addToken(instance, C(i).x + off, C(i).y + off);
    return instance;
}

function clearBoard() {
    for (const token of BoardState.tokens()) BoardState.removeToken(token.id);
}

/** Fill every spot not covered by `taken` with a 1×1 Token, in ascending spot order. */
function fillAround(taken = []) {
    const skip = new Set(taken);
    for (let i = 0; i < SPOTS; i++) if (!skip.has(i)) put(i, SMALL);
}

const yieldAt = (i) => TileModifiers.resolveAxis(idAt(i), EFFECT_TYPES.YIELD, 100);

beforeEach(() => {
    GameState.initNew();
    clearBoard();
    TileModifiers.clearAll();
    resetMatTuning();
    // ⚠️ This file pins the geometry of the 8-spot ring, so Near is set to 272 u
    // explicitly. It has shipped at 164 u since FP-75 — see the FP-75 block below.
    setMatTuning('nearRadius', 272);
});

afterEach(() => {
    TileModifiers.teardown();
    resetMatTuning();
});

describe('the Near radius', () => {
    it('defaults to 164 u (FP-75, was 272 u under FP-65)', () => {
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

    it('on a mat full of 1×1 Tokens — corners 2, edges 3, centre 4, never a diagonal', () => {
        fillAround();
        const counts = new Set();
        for (let i = 0; i < SPOTS; i++) {
            const col = i % COLS;
            const sides = [i - COLS, i + COLS, col > 0 ? i - 1 : -1, col < COLS - 1 ? i + 1 : -1]
                .filter(t => t >= 0 && t < SPOTS);
            expect(sorted(near(i)), `spot ${i}`).toEqual(sorted(sides));
            counts.add(sides.length);
        }
        expect(sorted(counts)).toEqual([2, 3, 4]);
    });

    it('a 2×2 Token reaches nothing and nothing reaches it', () => {
        put(7, LARGE_BUFF);
        fillAround(footprintOf(7));
        expect(near(7)).toEqual([]);
        for (const t of [1, 2, 6, 9, 12, 15, 19, 20]) expect(near(t)).not.toContain(7);
    });

    it('a Provides buff from a 1×1 Token reaches its side neighbours, not its diagonals', () => {
        put(14, BUFF);
        fillAround([14]);
        TileModifiers.rebuildAll();
        for (const t of [8, 13, 15, 20]) expect(yieldAt(t), `spot ${t}`).toBeCloseTo(105);
        for (const t of [7, 9, 19, 21]) expect(yieldAt(t), `spot ${t}`).toBeCloseTo(100);
    });
});

describe('⭐ at 272 u Near is exactly the old 8-spot ring for every 1×1 Token', () => {
    it('measured from a point: the Tokens within 272 u of each spot are its ring', () => {
        fillAround();
        for (let i = 0; i < SPOTS; i++) {
            const within = spotsOf(tokensWithin(C(i), 272, idAt(i)));
            expect(sorted(within), `spot ${i}`).toEqual(sorted(ringOf(i)));
        }
    });

    it('as Tokens, on a mat full of 1×1 Tokens — corners 3, edges 5, centre 8', () => {
        fillAround();
        const counts = new Set();
        for (let i = 0; i < SPOTS; i++) {
            const ring = near(i);
            expect(sorted(ring), `spot ${i}`).toEqual(sorted(ringOf(i)));
            counts.add(ring.length);
        }
        expect(sorted(counts)).toEqual([3, 5, 8]);
    });

    it('self, self_and_nearby and board are unchanged', () => {
        fillAround();
        expect(near(14, REACH.SELF)).toEqual([14]);
        expect(near(14, REACH.SELF_AND_NEARBY)).toEqual([14, ...sorted(ringOf(14))]);
        expect(nearby(idAt(14), REACH.BOARD)).toHaveLength(SPOTS);
    });

    it('a Token not on the mat reaches nothing', () => {
        fillAround();
        expect(nearby('tok_not_on_the_mat')).toEqual([]);
        expect(nearby(null)).toEqual([]);
    });
});

describe('⚠️ a 2×2 Token reaches less, measured from its centre (FP-41)', () => {
    it('an interior 2×2 reaches its 8 side-touching spots, not the 4 corner diagonals', () => {
        put(7, LARGE_BUFF);
        fillAround(footprintOf(7));

        expect(near(7)).toEqual([1, 2, 6, 9, 12, 15, 19, 20]);
        for (const corner of [0, 3, 18, 21]) expect(near(7)).not.toContain(corner);
    });

    it('a corner 2×2 reaches 4', () => {
        put(0, LARGE_BUFF);
        fillAround(footprintOf(0));

        expect(near(0)).toEqual([2, 8, 12, 13]);
    });

    it('spots near a 2×2 measure to its centre too, so the relation is symmetric', () => {
        put(7, LARGE_BUFF);
        fillAround(footprintOf(7));

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
    it('400 u adds the straight and knight\'s-move spots two steps out', () => {
        fillAround();
        const wide = near(14, REACH.NEARBY, 400);
        expect(wide).toHaveLength(20);
        for (const n of ringOf(14)) expect(wide).toContain(n);
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

        const ring = new Set(ringOf(14));
        for (let t = 0; t < SPOTS; t++) {
            if (t === 14) continue;
            expect(yieldAt(t), `spot ${t}`).toBeCloseTo(ring.has(t) ? 105 : 100);
        }
    });

    it('from a 2×2 Token: the 8 side-touching spots, and not the 4 corner diagonals', () => {
        put(7, LARGE_BUFF);
        fillAround(footprintOf(7));
        TileModifiers.rebuildAll();

        for (const t of [1, 2, 6, 9, 12, 15, 19, 20]) expect(yieldAt(t), `spot ${t}`).toBeCloseTo(105);
        for (const t of [0, 3, 18, 21]) expect(yieldAt(t), `spot ${t}`).toBeCloseTo(100);
    });

    it('filterTargets (triggered statuses, damage, counts) names the same set, by id', () => {
        put(7, LARGE_BUFF);
        fillAround(footprintOf(7));
        const statement = { keyword: 'applies', to: { mode: 'all', value: '' } };

        expect(spotsOf(TileModifiers.filterTargets(idAt(7), statement))).toEqual([1, 2, 6, 9, 12, 15, 19, 20]);

        clearBoard();
        fillAround();
        expect(sorted(spotsOf(TileModifiers.filterTargets(idAt(14), statement)))).toEqual(sorted(ringOf(14)));
        setMatTuning('nearRadius', 400);
        expect(TileModifiers.filterTargets(idAt(14), statement)).toHaveLength(20);
    });
});

describe('rebuild coverage follows the radius', () => {
    it('tokensAround covers every Token within Near + 144 u of the point, and nothing further', () => {
        fillAround();
        const origin = C(14);
        const reach = 272 + 144;
        const expected = [];
        for (let t = 0; t < SPOTS; t++) {
            const c = C(t);
            if (Math.hypot(c.x - origin.x, c.y - origin.y) <= reach) expected.push(t);
        }
        expect(sorted(spotsOf(tokensAround([origin])))).toEqual(expected);
        // Always at least the Token itself and its whole ring.
        for (const t of [14, ...ringOf(14)]) expect(expected).toContain(t);
    });

    it('several points: the union of what each would cover', () => {
        fillAround();
        const a = spotsOf(tokensAround([C(0)]));
        const b = spotsOf(tokensAround([C(35)]));
        expect(sorted(spotsOf(tokensAround([C(0), C(35)]))))
            .toEqual(sorted([...new Set([...a, ...b])]));
        expect(tokensAround([null, undefined])).toEqual([]);
    });

    it('at 400 u, placing a buff reaches a Token two steps away with only rebuildAround', () => {
        setMatTuning('nearRadius', 400);
        put(12, SMALL);
        TileModifiers.rebuildAll();
        expect(yieldAt(12)).toBeCloseTo(100);

        put(14, BUFF);                          // 320 u from spot 12
        TileModifiers.rebuildAround([C(14)]);
        expect(yieldAt(12)).toBeCloseTo(105);

        BoardState.removeToken(idAt(14));
        TileModifiers.rebuildAround([C(14)]);
        expect(yieldAt(12)).toBeCloseTo(100);
    });

    it('removing a 2×2 clears its buff when rebuilt around a point near where it stood', () => {
        put(7, LARGE_BUFF);
        put(1, SMALL);                           // side-touching, 253 u from the 2×2 centre
        TileModifiers.rebuildAll();
        expect(yieldAt(1)).toBeCloseTo(105);

        BoardState.removeToken(idAt(7));
        TileModifiers.rebuildAround([C(14)]);    // a nearby spot, 113 u off its centre
        expect(yieldAt(1)).toBeCloseTo(100);
    });

    it('rebuildAround refuses a bare number rather than silently rebuilding nothing', () => {
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
