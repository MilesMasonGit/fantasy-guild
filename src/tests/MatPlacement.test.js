import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as Placement from '../systems/board/Placement.js';
import * as Restrictions from '../systems/board/Restrictions.js';
import * as Flags from '../systems/board/Flags.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { matW, matH } from '../config/matGeometry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⚠️ `Restrictions` is wrapped so the tests can count how often the expensive
 * part runs. `project()` builds a whole projected copy of the board, and the
 * performance gate below asserts that an ordinary crowded drop never builds one.
 */
vi.mock('../systems/board/Restrictions.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        project: vi.fn(actual.project),
        checkPlacement: vi.fn(actual.checkPlacement)
    };
});

/**
 * ⭐ **Free placement** (Free Playmat slice 1.6d-1) — a Token lands exactly
 * where the player lets go.
 *
 * The numbers here are the owner's, from the Stage 0 feel trial (FP-63): at an
 * 80% hitbox with 40% overlap allowed, two small Tokens may sit **61.2 u**
 * apart, a small and a large **99.6 u**, two larges **138 u**. They are asserted
 * as the boundary they are — just inside is legal, just outside is refused —
 * because a spacing rule that is merely "about right" is one nobody can tune.
 */

/** A Coast that will not sit beside ANY other Coast — the sharpest `Cannot` to test with. */
const NO_COAST_NEIGHBOURS = {
    id: 'stm_nocoast',
    keyword: KEYWORD.CANNOT,
    payload: { kind: 'adjacency_limit', max: 0 },
    to: { mode: 'tag', value: 'Coast' },
    when: null,
    upkeep: null
};

beforeEach(() => {
    GameState.initNew();
    clearMat();
    resetMatTuning();
    Restrictions.project.mockClear();
    Restrictions.checkPlacement.mockClear();

    registerTokenTypes({
        mp_small: {
            id: 'mp_small', name: 'MP Small', tokenType: 'resource',
            size: 1, uses: 100, requiresHero: false,
            config: { cycleTimeMs: 5000, inputs: [], outputs: [] }
        },
        mp_large: {
            id: 'mp_large', name: 'MP Large', tokenType: 'resource',
            size: 2, uses: 100, requiresHero: false,
            config: { cycleTimeMs: 5000, inputs: [], outputs: [] }
        },
        mp_coast: {
            id: 'mp_coast', name: 'MP Coast', tokenType: 'resource',
            size: 1, uses: 100, requiresHero: false, tags: ['Coast'],
            statements: [NO_COAST_NEIGHBOURS],
            config: { cycleTimeMs: 5000, inputs: [], outputs: [] }
        }
    });
});

afterEach(() => resetMatTuning());

const instance = (typeId, uses = 100) => BoardState.createTokenInstance(typeId, uses);
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------------------
// How close two Tokens may sit (FP-63)
// ---------------------------------------------------------------------------

describe('how close two Tokens may sit (FP-63)', () => {
    it('two small Tokens may sit 61.4 u apart, but not 61.0', () => {
        expect(MatPlacement.minGap('mp_small', 'mp_small')).toBeCloseTo(61.2, 6);

        placeAt('mp_small', 800, 600);
        expect(MatPlacement.isLegal('mp_small', { x: 800 + 61.4, y: 600 })).toBe(true);
        expect(MatPlacement.isLegal('mp_small', { x: 800 + 61.0, y: 600 })).toBe(false);
    });

    it('a small beside a large needs 99.8, not 99.4', () => {
        expect(MatPlacement.minGap('mp_small', 'mp_large')).toBeCloseTo(99.6, 6);

        placeAt('mp_large', 800, 600);
        expect(MatPlacement.isLegal('mp_small', { x: 800 + 99.8, y: 600 })).toBe(true);
        expect(MatPlacement.isLegal('mp_small', { x: 800 + 99.4, y: 600 })).toBe(false);
    });

    it('two large Tokens need 138', () => {
        expect(MatPlacement.minGap('mp_large', 'mp_large')).toBeCloseTo(138, 6);

        placeAt('mp_large', 800, 600);
        expect(MatPlacement.isLegal('mp_large', { x: 800 + 138, y: 600 })).toBe(true);
        expect(MatPlacement.isLegal('mp_large', { x: 800 + 137.5, y: 600 })).toBe(false);
    });

    it('⭐ the Mat Tuner changes the rule for the very next drop, with no reload', () => {
        placeAt('mp_small', 800, 600);
        expect(MatPlacement.isLegal('mp_small', { x: 800 + 61.0, y: 600 })).toBe(false);

        // More overlap allowed: the same spot becomes legal.
        setMatTuning('overlapPct', 70);
        expect(MatPlacement.minGap('mp_small', 'mp_small')).toBeCloseTo(30.6, 6);
        expect(MatPlacement.isLegal('mp_small', { x: 800 + 61.0, y: 600 })).toBe(true);

        // A smaller hitbox shrinks it again: 40% of a 64 u art radius is 26 u
        // (rounded), so two of them at 40% overlap need 31.2 u.
        setMatTuning('overlapPct', 40);
        setMatTuning('hitboxPct', 40);
        expect(MatPlacement.minGap('mp_small', 'mp_small')).toBeCloseTo(31.2, 6);
    });
});

// ---------------------------------------------------------------------------
// The mat's own edge
// ---------------------------------------------------------------------------

describe('a Token stays fully on the mat', () => {
    it('the ART circle must fit, not merely the centre', () => {
        expect(MatPlacement.isLegal('mp_small', { x: 64, y: 400 })).toBe(true);
        expect(MatPlacement.isLegal('mp_small', { x: 63.9, y: 400 })).toBe(false);
        expect(MatPlacement.isLegal('mp_small', { x: matW() - 64, y: 400 })).toBe(true);
        expect(MatPlacement.isLegal('mp_small', { x: matW() - 63, y: 400 })).toBe(false);
        expect(MatPlacement.isLegal('mp_small', { x: 400, y: 63.9 })).toBe(false);
        expect(MatPlacement.isLegal('mp_small', { x: 400, y: matH() - 63 })).toBe(false);
    });

    it('a large Token needs its bigger circle to fit', () => {
        expect(MatPlacement.isLegal('mp_large', { x: 144, y: 400 })).toBe(true);
        expect(MatPlacement.isLegal('mp_large', { x: 143, y: 400 })).toBe(false);
    });

    it('a drop at the very corner is pulled in far enough for the art to fit', () => {
        const res = Placement.placeTokenAt(instance('mp_small'), { x: 0, y: 0 });
        expect(res.success).toBe(true);
        expect(res.x).toBeGreaterThanOrEqual(64);
        expect(res.y).toBeGreaterThanOrEqual(64);
    });
});

// ---------------------------------------------------------------------------
// Landing, nudging and flying back
// ---------------------------------------------------------------------------

describe('where a dropped Token actually lands', () => {
    it('⭐ lands EXACTLY where it was let go when there is room', () => {
        const res = Placement.placeTokenAt(instance('mp_small'), { x: 812.5, y: 606.25 });

        expect(res).toMatchObject({ success: true, x: 812.5, y: 606.25, nudged: false });
        const [token] = BoardState.tokens();
        expect({ x: token.x, y: token.y }).toEqual({ x: 812.5, y: 606.25 });
    });

    it('a blocked drop nudges to the NEAREST legal point', () => {
        const sitting = placeAt('mp_small', 800, 600);

        // 40 u away: too close, and the nearest legal point is straight on out
        // along the same line, at the 61.2 u limit.
        const res = Placement.placeTokenAt(instance('mp_small'), { x: 840, y: 600 });

        expect(res.success).toBe(true);
        expect(res.nudged).toBe(true);
        const landed = { x: res.x, y: res.y };
        expect(gap(landed, sitting)).toBeGreaterThanOrEqual(61.2 - 1e-6);
        // Nearest means nearest: it should not have wandered past the limit.
        expect(gap(landed, sitting)).toBeLessThan(61.2 + 6);
        // And it went the way it was pushed, not backwards over the other Token.
        expect(landed.x).toBeGreaterThan(sitting.x);
    });

    it('⭐ a boxed-in drop flies back, and the Token is still where it started', () => {
        // A lattice at exactly the minimum gap has no legal point inside it: the
        // middle of any four is only 43 u from each.
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) placeAt('mp_small', 700 + c * 61.2, 500 + r * 61.2);
        }
        const before = BoardState.tokens().length;

        const homeless = instance('mp_small');
        const res = Placement.placeTokenAt(homeless, { x: 700 + 3 * 61.2, y: 500 + 3 * 61.2 });

        expect(res.success).toBe(false);
        expect(res.full).toBe(true);
        expect(res.reason).toBe(MatPlacement.NO_ROOM);
        // Nothing was placed, and nothing already down was moved.
        expect(BoardState.tokens()).toHaveLength(before);
        expect(BoardState.getTokenById(homeless.id)).toBeNull();
    });

    it('nudge reach 0 makes every crowded drop fly back', () => {
        placeAt('mp_small', 800, 600);
        setMatTuning('nudgeReach', 0);

        const res = Placement.placeTokenAt(instance('mp_small'), { x: 810, y: 600 });

        expect(res.success).toBe(false);
        expect(res.full).toBe(true);
        // An uncrowded drop still lands, so reach 0 has not broken placing.
        expect(Placement.placeTokenAt(instance('mp_small'), { x: 1200, y: 900 }).success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// FP-88 — a spot that breaks a Cannot rule is not a spot
// ---------------------------------------------------------------------------

describe('a Cannot rule is obeyed by the nudge, not just by the refusal (FP-88)', () => {
    it('skips the spots that would break it and takes the next legal one', () => {
        // Reach has to clear the Near radius (164 u) for a legal spot to exist.
        setMatTuning('nudgeReach', 400);
        const first = placeAt('mp_coast', 800, 600);

        const res = Placement.placeTokenAt(instance('mp_coast'), { x: 800, y: 600 });

        expect(res.success).toBe(true);
        expect(res.nudged).toBe(true);
        // It had to go beyond Near, not merely beyond the hitbox.
        expect(gap({ x: res.x, y: res.y }, first)).toBeGreaterThan(164);
        // And the board it left behind is legal.
        expect(Restrictions.violations()).toEqual([]);
    });

    it('flies back — naming the rule — when no spot within reach obeys it', () => {
        // ⚠️ Dropped exactly ON the Coast, so the whole 160 u reach stays inside
        // the 164 u Near radius and every candidate breaks the rule. (Dropped
        // even 10 u to one side, reach 160 would carry it 170 u away — outside
        // Near, and legal.)
        const first = placeAt('mp_coast', 800, 600);
        const homeless = instance('mp_coast');

        const res = Placement.placeTokenAt(homeless, { x: 800, y: 600 });

        expect(res.success).toBe(false);
        expect(res.full).toBe(true);
        // ⭐ Not the generic "No room there." — the rule that actually refused.
        expect(res.reason).toMatch(/nearby/i);
        expect(BoardState.tokens()).toHaveLength(1);
        expect(BoardState.tokens()[0].id).toBe(first.id);
    });
});

// ---------------------------------------------------------------------------
// FP-87 — restocking beats nudging
// ---------------------------------------------------------------------------

describe('dropping on a matching copy restocks it (FP-50, FP-87)', () => {
    it('⭐ restocks rather than nudging aside, even with room to nudge into', () => {
        const copy = placeAt(instance('mp_small', 40), 800, 600);

        const res = Placement.placeTokenAt(instance('mp_small', 50), { x: 810, y: 605 });

        expect(res).toMatchObject({ success: true, restocked: true, absorbed: true, addedCharges: 50 });
        expect(BoardState.getTokenById(copy.id).usesRemaining).toBe(90);
        expect(BoardState.tokens()).toHaveLength(1);
    });

    it('⭐ the leftover charges stay on the mat, beside the copy they filled', () => {
        const copy = placeAt(instance('mp_small', 80), 800, 600);
        const incoming = instance('mp_small', 50);

        const res = Placement.placeTokenAt(incoming, { x: 805, y: 600 });

        expect(res).toMatchObject({ success: true, restocked: true, nudgedLeftover: true, addedCharges: 20 });
        expect(BoardState.getTokenById(copy.id).usesRemaining).toBe(100);

        // Nothing lost: the remaining 30 charges are standing right next to it.
        const leftover = BoardState.getTokenById(incoming.id);
        expect(leftover.usesRemaining).toBe(30);
        expect(gap(leftover, copy)).toBeGreaterThanOrEqual(61.2 - 1e-6);
        expect(gap(leftover, copy)).toBeLessThan(120);
    });

    it('a leftover with nowhere to stand is refused and flies back — never to the Tray (FP-46)', () => {
        const copy = placeAt(instance('mp_small', 80), 800, 600);
        setMatTuning('nudgeReach', 0);
        const incoming = instance('mp_small', 50);

        const res = Placement.placeTokenAt(incoming, { x: 800, y: 600 });

        // The charges it gave stay given; the rest goes back to its source.
        expect(res).toMatchObject({ success: false, restocked: true, full: true, addedCharges: 20 });
        expect(BoardState.getTokenById(copy.id).usesRemaining).toBe(100);
        expect(BoardState.getTokenById(incoming.id)).toBeNull();
        expect(incoming.usesRemaining).toBe(30);
    });

    it('a copy already full is not a restock target — the newcomer nudges clear', () => {
        const copy = placeAt(instance('mp_small', 100), 800, 600);
        const incoming = instance('mp_small', 100);

        const res = Placement.placeTokenAt(incoming, { x: 800, y: 600 });

        expect(res.success).toBe(true);
        expect(res.restocked).toBeUndefined();
        // ⭐ The Token already down did NOT move: nothing displaces anything now.
        expect({ x: BoardState.getTokenById(copy.id).x, y: BoardState.getTokenById(copy.id).y })
            .toEqual({ x: 800, y: 600 });
        expect(gap(BoardState.getTokenById(incoming.id), copy)).toBeGreaterThanOrEqual(61.2 - 1e-6);
    });
});

// ---------------------------------------------------------------------------
// Arrivals push (FP-17, slice 1.8)
// ---------------------------------------------------------------------------

describe('an arrival pushes instead of falling back (FP-17)', () => {
    /** Every pair on the mat is at least its minimum gap apart. */
    const noOverlaps = () => {
        const all = BoardState.tokens();
        for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
                if (gap(all[i], all[j]) < MatPlacement.minGap(all[i].typeId, all[j].typeId) - 1e-6) return false;
            }
        }
        return true;
    };

    it('stands where it aimed and shoves the one Token it overlaps', () => {
        const lone = placeAt('mp_small', 1400, 300);
        const where = MatPlacement.forceSpot('mp_small', { x: 1420, y: 300 });

        // ⚠️ Asserting the AIMED point is what proves a push happened: the
        // nearest-free fallback would also give a legal, overlap-free answer.
        expect(where).toMatchObject({ x: 1420, y: 300 });
        expect(where.pushed).toEqual([{ id: lone.id, x: expect.any(Number), y: 300 }]);
        expect(1420 - where.pushed[0].x).toBeGreaterThanOrEqual(61.2);
    });

    it('settles a packed block at fractional points (rounding each pass never settled)', () => {
        const ids = [];
        for (let r = -1; r <= 1; r++) {
            for (let c = -3; c <= 3; c++) ids.push(placeAt('mp_small', 500 + c * 61.2, 800 + r * 61.2).id);
        }

        const where = MatPlacement.forceSpot('mp_small', { x: 505, y: 790 });

        expect(where).toMatchObject({ x: 505, y: 790 });
        expect(where.pushed.length).toBeGreaterThan(0);
        BoardState.applyPushes(where.pushed);
        placeAt('mp_small', where.x, where.y);
        expect(noOverlaps()).toBe(true);
        for (const t of BoardState.tokens()) expect(MatPlacement.insideMat(t.typeId, t)).toBe(true);
    });

    it('a fixed Token is never shoved — the arrival lands beside it instead', () => {
        const hall = placeAt('mp_small', 800, 600);
        const where = MatPlacement.forceSpot('mp_small', { x: 810, y: 600 }, { fixedIds: [hall.id] });

        expect(where.pushed).toEqual([]);
        expect(gap(where, hall)).toBeGreaterThanOrEqual(61.2 - 1e-6);
        expect(BoardState.getTokenById(hall.id)).toMatchObject({ x: 800, y: 600 });
    });

    it('never pushes a Token over a Cannot line — it falls back to free space', () => {
        // Two Coasts may never be Near; the only push that clears the newcomer
        // would carry this one next to the other.
        placeAt('mp_coast', 300, 300);
        const pushedOne = placeAt('mp_small', 470, 300);
        const where = MatPlacement.forceSpot('mp_coast', { x: 480, y: 300 });

        if (where.pushed.length) {
            // Whatever it moved, the board it leaves behind breaks no rule.
            const plan = { move: where.pushed };
            expect(Restrictions.checkPlacement(where, 'mp_coast', plan).ok).toBe(true);
        } else {
            expect(BoardState.getTokenById(pushedOne.id)).toMatchObject({ x: 470, y: 300 });
        }
    });
});

// ---------------------------------------------------------------------------
// Flags and the Guild Hall
// ---------------------------------------------------------------------------

describe('flags and the Guild Hall', () => {
    beforeEach(() => {
        Flags.teardown();
        Flags.init();
        GameState.state.heroes = [
            { id: 'h1', name: 'h1', status: 'idle', level: 50, skills: {}, hp: { current: 100, max: 100 } },
            { id: 'h2', name: 'h2', status: 'idle', level: 50, skills: {}, hp: { current: 100, max: 100 } }
        ];
    });

    it('⭐ two flags may stand at the very same point — flags never nudge (FP-83)', () => {
        const point = { x: 900, y: 700 };

        expect(Placement.plantFlagAt('h1', point).success).toBe(true);
        expect(Placement.plantFlagAt('h2', point).success).toBe(true);

        expect(BoardState.flagOf('h1')).toMatchObject(point);
        expect(BoardState.flagOf('h2')).toMatchObject(point);
    });

    it('the Guild Hall moves anywhere on the mat, but not off it', () => {
        const hall = placeAt('token_guild_hall', 900, 700);

        expect(Placement.moveTokenTo(hall.id, { x: 300, y: 950 }).success).toBe(true);
        expect({ x: BoardState.getTokenById(hall.id).x, y: BoardState.getTokenById(hall.id).y })
            .toEqual({ x: 300, y: 950 });

        // Dragged off the corner, it is pulled back until its art fits.
        expect(Placement.moveTokenTo(hall.id, { x: -500, y: -500 }).success).toBe(true);
        const moved = BoardState.getTokenById(hall.id);
        expect(moved.x).toBeGreaterThanOrEqual(0);
        expect(moved.y).toBeGreaterThanOrEqual(0);
    });

    it('and still refuses to be removed (the Vault it also refused went in 9.3)', () => {
        const hall = placeAt('token_guild_hall', 900, 700);

        expect(Placement.removePlacedToken(hall.id).success).toBe(false);
        expect(BoardState.getTokenById(hall.id)).not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// The performance gate (plan §G)
// ---------------------------------------------------------------------------

describe('⚠️ the cost of a crowded drop', () => {
    it('⭐ a 60-Token mat with no Cannot rules never builds a projected view', () => {
        // Sixty Tokens at 70 u — legal, but tight enough that the drop below
        // has to walk a good many rings before it finds room.
        for (let i = 0; i < 60; i++) {
            placeAt('mp_small', 500 + (i % 10) * 70, 400 + Math.floor(i / 10) * 70);
        }
        Restrictions.project.mockClear();
        Restrictions.checkPlacement.mockClear();

        // ⚠️ On the far CORNER of the block: deep inside it there is no legal
        // point at all within reach (the gaps between four Tokens are only 49 u
        // across), and that would fly back rather than exercise a long search.
        const res = Placement.placeTokenAt(instance('mp_small'), { x: 500 + 9 * 70, y: 400 + 5 * 70 });

        expect(res.success).toBe(true);
        expect(res.nudged).toBe(true);
        // ⭐ The whole point: with no restriction anywhere near, the expensive
        // path is never entered, however many candidates the search tried.
        expect(Restrictions.project).not.toHaveBeenCalled();
        expect(Restrictions.checkPlacement).not.toHaveBeenCalled();
    });

    it('but it DOES consult the rules once a Cannot Token is in range', () => {
        placeAt('mp_coast', 800, 600);
        Restrictions.checkPlacement.mockClear();

        Placement.placeTokenAt(instance('mp_small'), { x: 805, y: 600 });

        expect(Restrictions.checkPlacement).toHaveBeenCalled();
    });
});
