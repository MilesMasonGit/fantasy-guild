import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatResize from '../systems/board/MatResize.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as Placement from '../systems/board/Placement.js';
import * as Flags from '../systems/board/Flags.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { matW, matH, matSteps, matAspect, clampToMat, MAT_ASPECT } from '../config/matGeometry.js';
import { matTuning, setMatTuning, resetMatTuning, matTuningDefault } from '../config/matTuning.js';
import { shippedMat } from '../systems/atlas/layoutInputs.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Free Playmat slice 1.6d-3 — the mat's size is live.**
 */

const MID = () => ({ x: Math.round(matW() / 2), y: Math.round(matH() / 2) });

beforeEach(() => {
    GameState.initNew();
    clearMat();
    resetMatTuning();
    vi.clearAllMocks();

    registerTokenTypes({
        rs_small: {
            id: 'rs_small', name: 'Resize Small', tokenType: 'resource',
            size: 1, uses: 100, requiresHero: false,
            config: { cycleTimeMs: 5000, inputs: [], outputs: [] }
        },
        rs_large: {
            id: 'rs_large', name: 'Resize Large', tokenType: 'resource',
            size: 2, uses: 100, requiresHero: false,
            config: { cycleTimeMs: 5000, inputs: [], outputs: [] }
        }
    });
});

afterEach(() => {
    MatResize.teardown();
    resetMatTuning();
});

// ---------------------------------------------------------------------------
// 1. The size is live
// ---------------------------------------------------------------------------

describe('⭐ the mat size is the Mat Tuner’s, read live (slice 1.6d-3)', () => {
    it('matW/matH follow matSteps at the game’s 13/24 aspect', () => {
        expect(matSteps()).toBe(12);
        expect(matW()).toBe(1920);
        expect(matH()).toBe(1040);

        setMatTuning('matSteps', 6);
        expect(matW()).toBe(960);
        expect(matH()).toBe(520);

        setMatTuning('matSteps', 20);
        expect(matW()).toBe(3200);
        expect(matH()).toBe(Math.round(3200 * 13 / 24));
    });

    it('the row is a real Mat Tuner row, 6–20, shipping at 12', () => {
        expect(matTuning('matSteps')).toBe(12);
        setMatTuning('matSteps', 99);
        expect(matSteps()).toBe(20);     // clamped to the row's max
        setMatTuning('matSteps', 1);
        expect(matSteps()).toBe(6);      // and to its min
    });

    /**
     * ⚠️ The whole point of the functions. A module that had captured the width
     * at import would still answer 1920 here, and its edge would be in the wrong
     * place for the rest of the session with nothing on screen to say so.
     */
    it('⭐ nothing caches the size: every edge rule sees the new mat at once', () => {
        const nearOldEdge = { x: 1600, y: 400 };

        expect(MatPlacement.insideMat('rs_small', nearOldEdge)).toBe(true);
        expect(MatPlacement.isLegal('rs_small', nearOldEdge)).toBe(true);
        expect(clampToMat({ x: 1700, y: 1000 })).toEqual({ x: 1700, y: 1000 });

        setMatTuning('matSteps', 6);     // 960 × 520

        expect(MatPlacement.insideMat('rs_small', nearOldEdge)).toBe(false);
        expect(MatPlacement.isLegal('rs_small', nearOldEdge)).toBe(false);
        expect(clampToMat({ x: 1700, y: 1000 })).toEqual({ x: 960, y: 520 });

        // And a real drop out there is refused rather than landing off the mat.
        const inst = BoardState.createTokenInstance('rs_small', 10);
        const res = Placement.placeTokenAt(inst, nearOldEdge);
        expect(res.success).toBe(true);
        expect(BoardState.getTokenById(inst.id).x).toBeLessThanOrEqual(960 - 64);
    });

    it('clampInside puts the ART circle inside the edge, in whole units', () => {
        setMatTuning('matSteps', 6);
        expect(MatPlacement.clampInside('rs_small', { x: 5000, y: 5000 })).toEqual({ x: 896, y: 456 });
        expect(MatPlacement.clampInside('rs_large', { x: 5000, y: 5000 })).toEqual({ x: 816, y: 376 });
        // Already inside: untouched.
        expect(MatPlacement.clampInside('rs_small', { x: 400, y: 300 })).toEqual({ x: 400, y: 300 });
    });
});

// ---------------------------------------------------------------------------
// 2. Shrinking pulls things in
// ---------------------------------------------------------------------------

describe('⭐ shrinking the mat pulls what no longer fits back inside (FP-98)', () => {
    it('a stranded Token is pulled onto the mat AND spaced clear of its neighbours', () => {
        // A Token out near the old right edge, and one already standing where
        // the clamp would put it. The stranded one must end up on the mat and
        // NOT on top of the sitting one.
        const stranded = placeAt('rs_small', 1600, 400);
        const sitting = placeAt('rs_small', 890, 400);

        setMatTuning('matSteps', 6);           // 960 × 520
        MatResize.fitToMat();

        const moved = BoardState.getTokenById(stranded.id);
        expect(MatPlacement.insideMat('rs_small', moved)).toBe(true);
        expect(Math.hypot(moved.x - sitting.x, moved.y - sitting.y))
            .toBeGreaterThanOrEqual(MatPlacement.minGap('rs_small', 'rs_small') - 1e-6);

        // The one that was already inside has not been shuffled.
        expect({ x: BoardState.getTokenById(sitting.id).x, y: BoardState.getTokenById(sitting.id).y })
            .toEqual({ x: 890, y: 400 });
    });

    it('a large Token is pulled in by its own bigger circle', () => {
        const big = placeAt('rs_large', 1700, 1000);

        setMatTuning('matSteps', 6);
        MatResize.fitToMat();

        const moved = BoardState.getTokenById(big.id);
        expect(MatPlacement.insideMat('rs_large', moved)).toBe(true);
    });

    it('⭐ a Token with nowhere clear to go is NOT lost — it stays on the mat and says so', () => {
        // The small mat, packed solid: 55 u apart is closer than two small
        // Tokens may legally sit (61.2 u), so there is no legal spot anywhere on
        // it. `placeAt` applies no rules, which is the only way to build this.
        // ⚠️ The wall is laid strictly INSIDE the legal box (a small Token's art
        // circle needs 64 u of clearance), so the only Token this resize has to
        // pull in is the stranded one below.
        setMatTuning('matSteps', 6);                       // 960 × 520
        for (let y = 64; y <= 456; y += 55) {
            for (let x = 64; x <= 896; x += 55) placeAt('rs_small', x, y);
        }
        // ...and one Token stranded off the edge, with nowhere to be pulled to.
        const stranded = placeAt('rs_small', 1700, 1000);

        const said = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, (p) => said.push(p));
        const summary = MatResize.fitToMat();
        off();

        const moved = BoardState.getTokenById(stranded.id);
        expect(moved).not.toBeNull();                                  // never removed
        expect(MatPlacement.insideMat('rs_small', moved)).toBe(true);  // and on the mat
        // Exactly where the clamp put it: on the mat, overlapping a neighbour.
        expect({ x: moved.x, y: moved.y }).toEqual(MatPlacement.clampInside('rs_small', { x: 1700, y: 1000 }));
        expect(summary.crowded).toBe(1);
        // Said as a callout over the crowded Token, never a notification.
        expect(said.filter(p => p.type === 'resize_crowded').map(p => [p.instanceId, p.title]))
            .toEqual([[stranded.id, MatResize.CROWDED_TEXT]]);
        expect(NotificationSystem.warning).not.toHaveBeenCalled();
    });

    it('a flag outside the new mat is clamped, and never nudged off another flag', () => {
        GameState.state.heroes = [{ id: 'h1', name: 'A' }, { id: 'h2', name: 'B' }];
        BoardState.setFlag('h1', { x: 1700, y: 1050, plantedAt: 1 });
        BoardState.setFlag('h2', { x: 1700, y: 1050, plantedAt: 2 });

        setMatTuning('matSteps', 6);
        MatResize.fitToMat();

        const a = BoardState.flagOf('h1');
        const b = BoardState.flagOf('h2');
        // Clamped onto the mat's own edge — flags use the whole mat, not an art circle.
        expect({ x: a.x, y: a.y }).toEqual({ x: 960, y: 520 });
        // ⭐ two flags at one point both stand there. Neither was spaced.
        expect({ x: b.x, y: b.y }).toEqual({ x: a.x, y: a.y });
    });

    it('a flag already inside the new mat is left exactly alone', () => {
        GameState.state.heroes = [{ id: 'h1', name: 'A' }];
        BoardState.setFlag('h1', { x: 300, y: 200, plantedAt: 1 });

        setMatTuning('matSteps', 6);
        MatResize.fitToMat();

        expect(BoardState.flagOf('h1')).toMatchObject({ x: 300, y: 200 });
    });

    it('announces every changed point ONCE, not once per Token', () => {
        placeAt('rs_small', 1600, 400);
        placeAt('rs_small', 1600, 900);

        const events = [];
        const off = EventBus.subscribe(BOARD_EVENTS.ADJACENCY_DIRTY, (p) => events.push(p));
        setMatTuning('matSteps', 6);
        MatResize.fitToMat();
        off();

        expect(events).toHaveLength(1);
        // Both ends of both moves: where each Token left and where it landed.
        expect(events[0].points.length).toBe(4);
    });
});

// ---------------------------------------------------------------------------
// 3. Growing changes nothing
// ---------------------------------------------------------------------------

describe('⭐ growing the mat moves nothing', () => {
    it('every Token and flag stays exactly where it was', () => {
        const a = placeAt('rs_small', 300, 300);
        const b = placeAt('rs_large', 900, 500);
        GameState.state.heroes = [{ id: 'h1', name: 'A' }];
        BoardState.setFlag('h1', { x: 700, y: 700, plantedAt: 1 });

        const events = [];
        const off = EventBus.subscribe(BOARD_EVENTS.ADJACENCY_DIRTY, (p) => events.push(p));
        setMatTuning('matSteps', 20);
        const summary = MatResize.fitToMat();
        off();

        expect(summary).toEqual({ tokensPulled: 0, flagsPulled: 0, crowded: 0 });
        expect({ x: BoardState.getTokenById(a.id).x, y: BoardState.getTokenById(a.id).y })
            .toEqual({ x: 300, y: 300 });
        expect({ x: BoardState.getTokenById(b.id).x, y: BoardState.getTokenById(b.id).y })
            .toEqual({ x: 900, y: 500 });
        expect(BoardState.flagOf('h1')).toMatchObject({ x: 700, y: 700 });
        // Nothing changed, so nothing was announced and nothing was rebuilt.
        expect(events).toHaveLength(0);
    });

    it('the mat at its shipped size leaves a full board untouched', () => {
        const middle = placeAt('rs_small', MID().x, MID().y);
        const summary = MatResize.fitToMat();
        expect(summary.tokensPulled).toBe(0);
        expect(BoardState.getTokenById(middle.id).x).toBe(MID().x);
    });
});

// ---------------------------------------------------------------------------
// 4. The tuner is wired to it
// ---------------------------------------------------------------------------

describe('the Mat size row pulls Tokens in on its own', () => {
    it('moving the slider is enough — no caller has to remember', () => {
        MatResize.init();
        const stranded = placeAt('rs_small', 1600, 400);

        setMatTuning('matSteps', 6);

        expect(MatPlacement.insideMat('rs_small', BoardState.getTokenById(stranded.id))).toBe(true);
    });

    it('teardown stops it, and init twice does not double it', () => {
        MatResize.init();
        MatResize.init();
        MatResize.teardown();

        const stranded = placeAt('rs_small', 1600, 400);
        setMatTuning('matSteps', 6);

        // Nobody is listening now, so the Token is still stranded until asked.
        expect(MatPlacement.insideMat('rs_small', BoardState.getTokenById(stranded.id))).toBe(false);
    });

    it('a pulled flag tells the board its hero moved', () => {
        MatResize.init();
        GameState.state.heroes = [{ id: 'h1', name: 'A' }];
        BoardState.setFlag('h1', { x: 1700, y: 1050, plantedAt: 1 });

        const moves = [];
        const off = EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, (p) => moves.push(p));
        setMatTuning('matSteps', 6);
        off();

        expect(moves.map(m => m.heroId)).toContain('h1');
        expect(Flags.statusOf('h1')).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------
// 5. The mat's shape is tunable too (a wider, shorter mat to try before one is chosen)
// ---------------------------------------------------------------------------

describe('the Mat shape row: the height follows the aspect, live', () => {
    it('ships at the game’s 13/24, and is a real row clamped to its range', () => {
        expect(matTuningDefault('matAspect')).toBe(MAT_ASPECT);
        expect(matAspect()).toBe(13 / 24);
        setMatTuning('matAspect', 0.1);
        expect(matAspect()).toBe(0.4);
        setMatTuning('matAspect', 2);
        expect(matAspect()).toBe(0.8);
    });

    it('moves the height and never the width: the three sizes the owner is shown', () => {
        setMatTuning('matSteps', 12);
        setMatTuning('matAspect', 7 / 12);
        expect([matW(), matH()]).toEqual([1920, 1120]);
        setMatTuning('matAspect', 13 / 24);
        expect([matW(), matH()]).toEqual([1920, 1040]);
        setMatTuning('matSteps', 13);
        setMatTuning('matAspect', 0.5);
        expect([matW(), matH()]).toEqual([2080, 1040]);
    });

    it('shortening the mat pulls a Token below the new edge back inside, on its own', () => {
        MatResize.init();
        const low = placeAt('rs_small', 800, 950);
        const high = placeAt('rs_small', 800, 300);

        setMatTuning('matAspect', 0.45);                // 1920 × 864

        const moved = BoardState.getTokenById(low.id);
        expect(MatPlacement.insideMat('rs_small', moved)).toBe(true);
        expect(moved.y).toBeLessThanOrEqual(864 - 64);
        expect({ x: BoardState.getTokenById(high.id).x, y: BoardState.getTokenById(high.id).y })
            .toEqual({ x: 800, y: 300 });
    });

    it('a settled Region is still laid out on the shipped mat, whatever this device tuned', () => {
        setMatTuning('matSteps', 13);
        setMatTuning('matAspect', 0.5);
        expect(shippedMat()).toEqual({ w: 1920, h: 1040 });
    });
});
