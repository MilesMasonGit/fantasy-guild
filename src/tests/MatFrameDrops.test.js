import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { matW, matH, matSteps } from '../config/matGeometry.js';
import { openingMat } from '../systems/core/EngineBootstrap.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { pointerToMat, matRectForDrag } from '../ui/components/board/matPoint.js';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { boardPointToScreen } from '../ui/components/base/ParticleOverlay.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Free Playmat slice 1.6c-1 — the mat frame and the one drop function.
 */

const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });
const big = (i) => ({ x: C(i).x + 80, y: C(i).y + 80 });

describe('the mat frame (FP-92)', () => {
    afterEach(() => resetMatTuning());

    it('is 11 steps of 160 u at a 0.64 aspect: 1760 × 1126 u', () => {
        expect(matSteps()).toBe(11);
        expect(matW()).toBe(1760);
        expect(matH()).toBe(1126);
    });

    /**
     * ⭐ Slice 1.6d-3 — the mat's size is the Mat Tuner's **Mat size** row, read
     * live. Nothing may hold it in a constant.
     */
    it('follows the Mat size row at the 0.64 aspect, in both directions', () => {
        setMatTuning('matSteps', 6);
        expect(matSteps()).toBe(6);
        expect(matW()).toBe(960);
        expect(matH()).toBe(Math.round(960 * 0.64));   // 614

        setMatTuning('matSteps', 20);
        expect(matW()).toBe(3200);
        expect(matH()).toBe(2048);

        resetMatTuning();
        expect(matW()).toBe(1760);
    });

    it('⭐ a new game stands the Guild Hall in the MIDDLE of the mat, at any size', () => {
        // Slice 1.6d-3: it used to stand at (960, 643) — half a step off centre,
        // which was the centre of the old Guild Hall tile on the deleted grid.
        const hallAt = () => {
            const hall = openingMat().find(t => t.typeId === 'token_guild_hall');
            return { x: hall.x, y: hall.y };
        };

        expect(hallAt()).toEqual({ x: 880, y: 563 });

        setMatTuning('matSteps', 6);
        expect(hallAt()).toEqual({ x: 480, y: 307 });
    });
});

describe('pointerToMat — screen pointer → mat point', () => {
    it('at scale 1 it is the offset from the mat’s corner', () => {
        const rect = { left: 40, top: 25, width: matW(), height: matH() };
        expect(pointerToMat({ x: 1000, y: 668 }, rect)).toEqual({ x: 960, y: 643 });
    });

    it('at scale 0.5 the offset is doubled, from an offset rect', () => {
        const rect = { left: 120, top: 80, width: matW() / 2, height: matH() / 2 };
        expect(pointerToMat({ x: 120 + 480, y: 80 + 321.5 }, rect)).toEqual({ x: 960, y: 643 });
    });

    // the maths holds at any mat size and zoom, because both the width and
    // the scale are read live. Pinned at the Mat Tuner's extremes.
    describe('at other mat sizes and zooms (CR3-413)', () => {
        afterEach(() => resetMatTuning());

        /** The mat's on-screen box at `fit`, with its corner at (left, top). */
        const rectAt = (fit, left = 30, top = 70) => ({ left, top, width: matW() * fit, height: matH() * fit });
        const screenOf = (p, fit, left = 30, top = 70) => ({ x: left + p.x * fit, y: top + p.y * fit });

        for (const steps of [6, 20]) {
            for (const fit of [1, 0.5, 0.1]) {
                it(`${steps} steps at fit ${fit}: the far corner and the middle map back exactly`, () => {
                    setMatTuning('matSteps', steps);
                    const corner = { x: matW(), y: matH() };
                    const middle = { x: matW() / 2, y: matH() / 2 };
                    for (const p of [corner, middle, { x: 0, y: 0 }]) {
                        const got = pointerToMat(screenOf(p, fit), rectAt(fit));
                        expect(got.x).toBeCloseTo(p.x, 9);
                        expect(got.y).toBeCloseTo(p.y, 9);
                    }
                });
            }
        }

        it('reads the width live: the same box means a different point after a resize', () => {
            const rect = { left: 0, top: 0, width: 960 };
            setMatTuning('matSteps', 6);                 // 960 u wide: scale 1
            expect(pointerToMat({ x: 480, y: 100 }, rect)).toEqual({ x: 480, y: 100 });
            setMatTuning('matSteps', 20);                // 3200 u wide: the same box is scale 0.3
            const p = pointerToMat({ x: 480, y: 100 }, rect);
            expect(p.x).toBeCloseTo(1600, 9);
            expect(p.y).toBeCloseTo(100 / 0.3, 9);
        });
    });

    it('adds the grab offset, and refuses a missing pointer or rect', () => {
        const rect = { left: 0, top: 0, width: matW() };
        expect(pointerToMat({ x: 10, y: 20 }, rect, { x: 5, y: -5 })).toEqual({ x: 15, y: 15 });
        expect(pointerToMat(null, rect)).toBeNull();
        expect(pointerToMat({ x: 1, y: 1 }, null)).toBeNull();
    });
});

describe('matRectForDrag — the mat rect read once per drag, not once per frame (CR3-403)', () => {
    const fakeMatEl = (rect) => ({ getBoundingClientRect: vi.fn(() => rect) });

    it('reads the rect once, then answers the same object for the same element + session', () => {
        const el = fakeMatEl({ left: 0, top: 0, width: 1760, height: 1126 });
        const session = {};
        const first = matRectForDrag(el, session);
        const second = matRectForDrag(el, session);
        expect(el.getBoundingClientRect).toHaveBeenCalledTimes(1);
        expect(second).toBe(first);
    });

    it('a new session (the next drag) reads fresh', () => {
        const el = fakeMatEl({ left: 0, top: 0, width: 1760, height: 1126 });
        matRectForDrag(el, {});
        matRectForDrag(el, {});
        expect(el.getBoundingClientRect).toHaveBeenCalledTimes(2);
    });

    it('a different mat element reads fresh even with the same session', () => {
        const session = {};
        const a = fakeMatEl({ left: 0, top: 0, width: 1760, height: 1126 });
        const b = fakeMatEl({ left: 0, top: 0, width: 960, height: 614 });
        matRectForDrag(a, session);
        matRectForDrag(b, session);
        expect(a.getBoundingClientRect).toHaveBeenCalledTimes(1);
        expect(b.getBoundingClientRect).toHaveBeenCalledTimes(1);
    });

    it('with no session, falls back to reading fresh (never caches wrongly)', () => {
        const el = fakeMatEl({ left: 0, top: 0, width: 1760, height: 1126 });
        matRectForDrag(el, null);
        matRectForDrag(el, null);
        expect(el.getBoundingClientRect).toHaveBeenCalledTimes(2);
    });

    it('a missing element answers null', () => {
        expect(matRectForDrag(null, {})).toBeNull();
    });
});

describe('ParticleOverlay scales board coordinates', () => {
    const boardEl = (rect, naturalWidth) => ({
        getBoundingClientRect: () => rect,
        getAttribute: (name) => (name === 'data-natural-width' && naturalWidth != null ? String(naturalWidth) : null)
    });

    it('multiplies a board point by the on-screen scale before adding the rect corner', () => {
        const el = boardEl({ left: 100, top: 50, width: matW() / 2, height: matH() / 2 }, matW());
        expect(boardPointToScreen(el, 960, 643)).toEqual({ x: 100 + 480, y: 50 + 321.5 });
    });

    it('a board with no natural width reads as unscaled', () => {
        const el = boardEl({ left: 100, top: 50, width: 500, height: 500 }, null);
        expect(boardPointToScreen(el, 10, 20)).toEqual({ x: 110, y: 70 });
    });
});

describe('dropOnMat — one drop function for the playmat', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });

    beforeEach(() => {
        vi.clearAllMocks();
        GameState.initNew();
        SpriteLayer.init();
        Flags.teardown();
        Flags.init();
        GameState.state.board.tokens = {};
        GameState.state.board.flags = {};
        GameState.state.heroes = [
            { id: 'h1', name: 'h1', status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }
        ];
        GameState.state.quests.completedTutorials = ['tutorial_5'];
        registerTokenTypes({
            fixture_map: { id: 'fixture_map', name: 'Fixture Map', tokenType: 'map', mapId: 'fixture_map_content' },
            fixture_big: {
                id: 'fixture_big', name: 'Fixture Big', tokenType: 'resource', size: 2, uses: 50,
                requiresHero: false, config: { cycleTimeMs: 12000, inputs: [], outputs: [] }
            }
        });
    });

    const instance = (typeId, uses = null) => BoardState.createTokenInstance(typeId, uses);
    const near = (tile, dx = 50, dy = -60) => ({ x: C(tile).x + dx, y: C(tile).y + dy });
    /** The one Token on the mat — these tests start from an empty one. */
    const only = () => BoardState.tokens()[0];

    it('⭐ a Token on the mat moves to the EXACT point it was dropped at, by its instance id', () => {
        const sitting = instance('fixture_producer', 100);
        BoardState.addToken(sitting, C(0).x, C(0).y);
        const id = sitting.id;
        const point = near(14);

        expect(dropOnMat({ typeId: 'fixture_producer', from: { instanceId: id } }, point).success).toBe(true);

        // Nothing snaps: it stands where the pointer was, not on a spot.
        expect({ x: BoardState.getTokenById(id).x, y: BoardState.getTokenById(id).y }).toEqual(point);
        expect(BoardState.tokensAtPoint(C(0).x, C(0).y)).toHaveLength(0);
    });

    it('a drop ON a matching copy restocks it (FP-50)', () => {
        const copy = instance('fixture_producer', 100);
        BoardState.addToken(copy, C(14).x, C(14).y);
        // ⚠️ Within the copy's art circle (64 u) — restocking is aiming AT it,
        // and since 1.6d a drop 78 u away is simply a drop beside it.
        dropOnMat({ typeId: 'fixture_producer', usesRemaining: 400 }, near(14, 20, -20));

        expect(BoardState.tokens()).toHaveLength(1);
        expect(BoardState.getTokenById(copy.id).usesRemaining).toBe(500);
    });

    it('a 2×2 lands at the point too, with no anchor to snap to', () => {
        const p = big(7);
        const point = { x: p.x + 40, y: p.y - 30 };
        dropOnMat({ typeId: 'fixture_big', usesRemaining: 50 }, point);

        expect(only().typeId).toBe('fixture_big');
        expect({ x: only().x, y: only().y }).toEqual(point);
    });

    // 'from the Vault', 'from a loot sprite on the floor' and 'a refused loot
    // sprite goes back on the floor' went with the Vault and Token loot
    // (Token Lifecycle 9.3): neither origin exists any more.

    it('a bare typeId is made on the spot', () => {
        dropOnMat({ typeId: 'fixture_producer', usesRemaining: 42 }, near(10));
        expect(only().usesRemaining).toBe(42);
    });

    /**
     * ⭐ A board drawn smaller than its natural size (the mat fits the window)
     * converts a pointer by **its own** on-screen size before calling this same
     * function. A pointer a given fraction across a small board therefore means
     * the very same mat point as one that far across a big one. (First written
     * for the Tray's mini mat, retired in slice 1.9.)
     */
    it('⭐ a scaled-down board drops at the right mat point, at its own scale', () => {
        const target = { x: 1320, y: 844.5 };   // three quarters across the mat

        // The mini mat is ~300 px wide; the playmat, here, its natural 1760.
        const mini = { left: 12, top: 30, width: 300, height: 300 * (matH() / matW()) };
        const pointer = {
            x: mini.left + (target.x / matW()) * mini.width,
            y: mini.top + (target.y / matH()) * (mini.width * (matH() / matW()))
        };

        const point = pointerToMat(pointer, mini);
        expect(point.x).toBeCloseTo(target.x, 6);
        expect(point.y).toBeCloseTo(target.y, 6);

        expect(dropOnMat({ typeId: 'fixture_producer', usesRemaining: 100 }, point).success).toBe(true);
        expect(only().x).toBeCloseTo(target.x, 6);
        expect(only().y).toBeCloseTo(target.y, 6);
    });

    // Maps used to lie loose on the mat in a box of their own until the Map
    // bursts retired (Token Lifecycle 9.1). A Map is an ordinary Token.
    it('a Map Token stands on the mat like any other Token (9.1)', () => {
        expect(dropOnMat({ typeId: 'fixture_map', usesRemaining: 1 }, { x: 1500, y: 1000 }).success).toBe(true);
        expect(BoardState.tokens().map(t => t.typeId)).toEqual(['fixture_map']);
        expect(only()).toMatchObject({ x: 1500, y: 1000 });
        expect(GameState.state.board.maps).toBeUndefined();
    });

    it('⭐ a hero from the Dock plants their flag exactly at the drop point (FP-94)', () => {
        const point = { x: 1003.5, y: 611.25 };
        expect(dropOnMat({ kind: DRAG_KIND.HERO, heroId: 'h1', from: { dock: true } }, point).success).toBe(true);
        expect(BoardState.flagOf('h1')).toMatchObject(point);
    });

    it('⭐ a dragged flag moves to the raw point, clamped to the mat (FP-94)', () => {
        dropOnMat({ kind: DRAG_KIND.HERO, heroId: 'h1', from: { dock: true } }, C(3));
        dropOnMat({ kind: DRAG_KIND.FLAG, heroId: 'h1', from: { flag: true } }, { x: 1234.5, y: 77 });
        expect(BoardState.flagOf('h1')).toMatchObject({ x: 1234.5, y: 77 });

        dropOnMat({ kind: DRAG_KIND.FLAG, heroId: 'h1', from: { flag: true } }, { x: -30, y: 9999 });
        expect(BoardState.flagOf('h1')).toMatchObject({ x: 0, y: matH() });
    });

    it('a flag drag for a hero with no flag is refused', () => {
        expect(dropOnMat({ kind: DRAG_KIND.FLAG, heroId: 'h1', from: { flag: true } }, C(3)).success).toBe(false);
        expect(BoardState.flagOf('h1')).toBeNull();
    });

    /**
     * A Token dropped far from where the old 6×6 board used to be is no
     * longer refused — the whole mat is the play area now.
     */
    it('⭐ a Token dropped far from the middle of the mat simply lands there now', () => {
        const point = { x: 100, y: 100 };

        const result = dropOnMat({ typeId: 'fixture_producer', usesRemaining: 100 }, point);

        expect(result.success).toBe(true);
        expect(result.flyBack).toBeUndefined();
        expect(NotificationSystem.warning).not.toHaveBeenCalled();
        expect({ x: only().x, y: only().y }).toEqual(point);
    });

    it('but a drop off the mat entirely is pulled back on, art and all', () => {
        expect(dropOnMat({ typeId: 'fixture_producer', usesRemaining: 100 }, { x: -400, y: 5 }).success).toBe(true);
        expect(only().x).toBeGreaterThanOrEqual(64);
        expect(only().y).toBeGreaterThanOrEqual(64);
    });
});
