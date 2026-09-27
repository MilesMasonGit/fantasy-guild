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
import { pointerToMat } from '../ui/components/board/matPoint.js';
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
 *
 * * The mat is 1760 × 1126 u (FP-92).
 * * A screen pointer becomes a mat point by the mat's on-screen scale.
 * * Everything dropped on the playmat goes through `dropOnMat(payload, point)`:
 *   a flag stands at the raw point (FP-94), a Map lies free, and any other Token
 *   lands **exactly where it was let go** — nothing snaps (slice 1.6d-1).
 *
 * ⭐ **Test layout only** (slice 1.6d-2): `C(i)` names spots on a 160 u lattice
 * so a drop can be aimed near a known point. The game has no tiles.
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

    it('adds the grab offset, and refuses a missing pointer or rect', () => {
        const rect = { left: 0, top: 0, width: matW() };
        expect(pointerToMat({ x: 10, y: 20 }, rect, { x: 5, y: -5 })).toEqual({ x: 15, y: 15 });
        expect(pointerToMat(null, rect)).toBeNull();
        expect(pointerToMat({ x: 1, y: 1 }, null)).toBeNull();
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
            { id: 'h1', name: 'h1', status: 'idle', level: 50, skills: { logging: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }
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
     * ⭐ A board drawn smaller than its natural size (the mat fits the window,
     * FP-99) converts a pointer by **its own** on-screen size before calling
     * this same function. A pointer a given fraction across a small board
     * therefore means the very same mat point as one that far across a big one.
     * (First written for the Tray's mini mat, FP-97, retired in slice 1.9.)
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

    // Maps used to lie loose on the mat in a box of their own (D-155) until
    // the Map bursts retired (Token Lifecycle 9.1). A Map is an ordinary Token.
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
     * ⭐ The FP-93 practice area is gone with the snapping (slice 1.6d-1). A
     * Token dropped far from where the old 6×6 board used to be is no longer
     * refused — the whole mat is the play area now.
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
