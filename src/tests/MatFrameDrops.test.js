import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as Flags from '../systems/board/Flags.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { MAT_W, MAT_H, MAT_STEPS } from '../config/matGeometry.js';
import { OPENING_MAT } from '../systems/core/EngineBootstrap.js';
import { resetMatTuning } from '../config/matTuning.js';
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
    it('is 11 steps of 160 u at a 0.64 aspect: 1760 × 1126 u', () => {
        expect(MAT_STEPS).toBe(11);
        expect(MAT_W).toBe(1760);
        expect(MAT_H).toBe(1126);
    });

    it('a new game stands the Guild Hall at (960, 643) — its historical opening spot', () => {
        // Half a step down and right of the mat's centre. The assertions about
        // the old landing area's corner, and `tileAtPoint` taking it back off,
        // went with the grid in slice 1.6d-2.
        const hall = OPENING_MAT.find(t => t.typeId === 'token_guild_hall');
        expect({ x: hall.x, y: hall.y }).toEqual({ x: 960, y: 643 });
    });
});

describe('pointerToMat — screen pointer → mat point', () => {
    it('at scale 1 it is the offset from the mat’s corner', () => {
        const rect = { left: 40, top: 25, width: MAT_W, height: MAT_H };
        expect(pointerToMat({ x: 1000, y: 668 }, rect)).toEqual({ x: 960, y: 643 });
    });

    it('at scale 0.5 the offset is doubled, from an offset rect', () => {
        const rect = { left: 120, top: 80, width: MAT_W / 2, height: MAT_H / 2 };
        expect(pointerToMat({ x: 120 + 480, y: 80 + 321.5 }, rect)).toEqual({ x: 960, y: 643 });
    });

    it('adds the grab offset, and refuses a missing pointer or rect', () => {
        const rect = { left: 0, top: 0, width: MAT_W };
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
        const el = boardEl({ left: 100, top: 50, width: MAT_W / 2, height: MAT_H / 2 }, MAT_W);
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
        GameState.state.board.maps = [];
        GameState.state.board.tray = [];
        GameState.state.board.tokenBank = {};
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
        BoardState.addToTray(instance('fixture_producer', 400));

        // ⚠️ Within the copy's art circle (64 u) — restocking is aiming AT it,
        // and since 1.6d a drop 78 u away is simply a drop beside it.
        dropOnMat({ typeId: 'fixture_producer', from: { traySlot: 0 } }, near(14, 20, -20));

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

    it('⚠️ from the Tray with the Tray’s real payload — `traySlot` AND `instanceId` (found in game)', () => {
        const tray = instance('fixture_producer', 100);
        BoardState.addToTray(tray);
        const point = near(9);
        const result = dropOnMat({ typeId: 'fixture_producer', instanceId: tray.id, from: { traySlot: 0, instanceId: tray.id } }, point);
        expect(result.success).toBe(true);
        expect(only().id).toBe(tray.id);
        expect({ x: only().x, y: only().y }).toEqual(point);
        expect(BoardState.getTray()).toHaveLength(0);
    });

    it('from the Tray', () => {
        BoardState.addToTray(instance('fixture_producer', 100));
        const point = near(9);
        dropOnMat({ typeId: 'fixture_producer', from: { traySlot: 0 } }, point);
        expect(only().typeId).toBe('fixture_producer');
        expect({ x: only().x, y: only().y }).toEqual(point);
        expect(BoardState.getTray()).toHaveLength(0);
    });

    it('from the Vault, straight onto the mat point', () => {
        TokenBank.deposit(instance('fixture_producer', 100));
        const point = near(8);
        dropOnMat({ typeId: 'fixture_producer', from: { vaultTypeId: 'fixture_producer' } }, point);
        expect(only().typeId).toBe('fixture_producer');
        expect({ x: only().x, y: only().y }).toEqual(point);
        expect(GameState.state.board.tokenBank.fixture_producer || []).toHaveLength(0);
    });

    it('from a loot sprite on the floor', () => {
        const sprite = SpriteLayer.addSprite('token', 'fixture_producer', 1, null, 100);
        const point = near(6);
        dropOnMat({ typeId: 'fixture_producer', from: { spriteId: sprite.id } }, point);
        expect(only().typeId).toBe('fixture_producer');
        expect({ x: only().x, y: only().y }).toEqual(point);
        expect(SpriteLayer.getSprites()).toHaveLength(0);
    });

    it('a refused loot sprite goes back on the floor at the drop point', () => {
        // Only one mythic Token of a kind may be on the board: the second is refused.
        registerTokenTypes({
            fixture_mythic_drop: {
                id: 'fixture_mythic_drop', name: 'Fixture Mythic', tokenType: 'resource', rarity: 'mythic',
                uses: 5, requiresHero: false, config: { cycleTimeMs: 12000, inputs: [], outputs: [] }
            }
        });
        BoardState.addToken(instance('fixture_mythic_drop', 5), C(0).x, C(0).y);
        const sprite = SpriteLayer.addSprite('token', 'fixture_mythic_drop', 1, null, 5);
        const point = { x: C(14).x + 33, y: C(14).y - 21 };
        expect(dropOnMat({ typeId: 'fixture_mythic_drop', from: { spriteId: sprite.id } }, point).success).toBe(false);

        const back = SpriteLayer.getSprites().filter(s => s.refId === 'fixture_mythic_drop');
        expect(back).toHaveLength(1);
        expect(back[0].fromX).toBe(point.x);
        expect(back[0].fromY).toBe(point.y);
    });

    it('a bare typeId is made on the spot', () => {
        dropOnMat({ typeId: 'fixture_producer', usesRemaining: 42 }, near(10));
        expect(only().usesRemaining).toBe(42);
    });

    /**
     * ⭐ FP-97: the Tray's mini mat is a scaled picture of the playmat, and it
     * converts a pointer by **its own** on-screen size before calling this same
     * function. A pointer a given fraction across the little board therefore
     * means the very same mat point as one that far across the big one.
     */
    it('⭐ the mini mat drops at the right mat point, at its own scale', () => {
        const target = { x: 1320, y: 844.5 };   // three quarters across the mat

        // The mini mat is ~300 px wide; the playmat, here, its natural 1760.
        const mini = { left: 12, top: 30, width: 300, height: 300 * (MAT_H / MAT_W) };
        const pointer = {
            x: mini.left + (target.x / MAT_W) * mini.width,
            y: mini.top + (target.y / MAT_H) * (mini.width * (MAT_H / MAT_W))
        };

        const point = pointerToMat(pointer, mini);
        expect(point.x).toBeCloseTo(target.x, 6);
        expect(point.y).toBeCloseTo(target.y, 6);

        BoardState.addToTray(instance('fixture_producer', 100));
        expect(dropOnMat({ typeId: 'fixture_producer', from: { traySlot: 0 } }, point).success).toBe(true);
        expect(only().x).toBeCloseTo(target.x, 6);
        expect(only().y).toBeCloseTo(target.y, 6);
    });

    it('a Map lands free, its box centred on the point — from the Tray and from the mat', () => {
        BoardState.addToTray(instance('fixture_map', 1));
        dropOnMat({ typeId: 'fixture_map', from: { traySlot: 0 } }, { x: 1500, y: 1000 });
        const [map] = GameState.state.board.maps;
        expect({ x: map.x, y: map.y }).toEqual({ x: 1436, y: 936 });
        expect(BoardState.tokens()).toHaveLength(0);

        // Well off the mat is fine for a Map; it is clamped back onto it.
        dropOnMat({ typeId: 'fixture_map', from: { boardMapId: map.id } }, { x: 5000, y: -40 });
        expect(GameState.state.board.maps[0]).toMatchObject({ id: map.id, x: MAT_W - 128, y: 0 });
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
        expect(BoardState.flagOf('h1')).toMatchObject({ x: 0, y: MAT_H });
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
        BoardState.addToTray(instance('fixture_producer', 100));
        const point = { x: 100, y: 100 };

        const result = dropOnMat({ typeId: 'fixture_producer', from: { traySlot: 0 } }, point);

        expect(result.success).toBe(true);
        expect(result.flyBack).toBeUndefined();
        expect(NotificationSystem.warning).not.toHaveBeenCalled();
        expect(BoardState.getTray()).toHaveLength(0);
        expect({ x: only().x, y: only().y }).toEqual(point);
    });

    it('but a drop off the mat entirely is pulled back on, art and all', () => {
        BoardState.addToTray(instance('fixture_producer', 100));

        expect(dropOnMat({ typeId: 'fixture_producer', from: { traySlot: 0 } }, { x: -400, y: 5 }).success).toBe(true);
        expect(only().x).toBeGreaterThanOrEqual(64);
        expect(only().y).toBeGreaterThanOrEqual(64);
    });
});
