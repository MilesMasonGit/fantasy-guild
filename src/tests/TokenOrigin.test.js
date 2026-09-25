import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { matW, matH } from '../config/matGeometry.js';
import { matTuning, setMatTuning, resetMatTuning, MAT_TUNABLES } from '../config/matTuning.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * Token Lifecycle slice 3.1 — **origin, the mat cap and fixed pushes**
 * (roadmap DP-3, SP-67, SP-68).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const spawnStatement = (typeId, placement) => ({
    ...makeStatement(KEYWORD.SPAWNS), payload: { typeId, placement }
});

/** A spawned Token, put straight onto the mat (no rules). */
function placeSpawned(typeId, x, y) {
    const instance = BoardState.createTokenInstance(typeId, 100, null, BoardState.ORIGIN.SPAWNED);
    return BoardState.addToken(instance, x, y);
}

/** Every random dart lands in the middle of the mat. */
const middle = () => 0.5;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    clearMat();
});

afterEach(() => {
    TileModifiers.teardown();
    resetMatTuning();
});

describe('⭐ every Token instance records its origin (DP-3)', () => {
    it('a fresh instance is placed unless it says otherwise', () => {
        expect(BoardState.createTokenInstance('fixture_producer').origin).toBe('placed');
        expect(BoardState.createTokenInstance('fixture_producer', null, null, 'spawned').origin).toBe('spawned');
    });

    it('⚠️ an instance without the field reads as placed', () => {
        expect(BoardState.originOf({ typeId: 'fixture_producer' })).toBe('placed');
        expect(BoardState.originOf({ typeId: 'fixture_producer', origin: 'nonsense' })).toBe('placed');
        expect(BoardState.originOf({ typeId: 'fixture_producer', origin: 'spawned' })).toBe('spawned');
    });

    it('the opening Guild Hall is placed', () => {
        EngineBootstrap.createDefaultGameData();
        const [hall] = BoardState.tokens();
        expect(hall.typeId).toBe('token_guild_hall');
        expect(hall.origin).toBe('placed');
    });

    it('a spawn makes a spawned Token', () => {
        const bearer = placeAt('fixture_producer', 400, 400);
        const result = EffectActions.spawn(
            spawnStatement('fixture_passive', PLACEMENT.NEAREST_FREE), { self: bearer.id }
        );
        expect(result).not.toBeNull();
        expect(BoardState.getTokenById(result.instanceId).origin).toBe('spawned');
    });

    it('a transform keeps the old instance’s origin, both ways', () => {
        const placed = placeAt('fixture_producer', 400, 400);
        const spawned = placeSpawned('fixture_producer', 800, 400);

        const a = EffectActions.transformInstance(placed, 'fixture_passive');
        const b = EffectActions.transformInstance(spawned, 'fixture_passive');

        expect(a.origin).toBe('placed');
        expect(b.origin).toBe('spawned');
        // A fresh instance otherwise, at the same point.
        expect(a.id).not.toBe(placed.id);
        expect({ x: b.x, y: b.y }).toEqual({ x: 800, y: 400 });
    });

    it('the Transforms statement keeps origin too', () => {
        const spawned = placeSpawned('fixture_producer', 400, 400);
        const ok = EffectActions.transform(
            { ...makeStatement(KEYWORD.TRANSFORMS), payload: { typeId: 'fixture_passive' } },
            { self: spawned.id }
        );
        expect(ok).toBe(true);
        const [now] = BoardState.tokensAtPoint(400, 400);
        expect(now.typeId).toBe('fixture_passive');
        expect(now.origin).toBe('spawned');
    });

    it('origin survives a save and load', () => {
        placeAt('fixture_producer', 400, 400);
        const tree = placeSpawned('fixture_passive', 800, 400);
        const legacy = placeAt('fixture_producer', 1200, 400);
        delete legacy.origin;   // an instance saved before the field existed

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        const migrated = migrateState(revived.state, revived.version);
        GameState.state = migrated;

        const byType = Object.values(GameState.state.board.tokens);
        expect(byType.find(t => t.x === 400).origin).toBe('placed');
        expect(BoardState.getTokenById(tree.id).origin).toBe('spawned');
        expect(BoardState.originOf(BoardState.getTokenById(legacy.id))).toBe('placed');
    });
});

describe('⭐ the mat cap counts placed Tokens only (SP-67)', () => {
    it('is a Mat Tuner setting, 40 by default', () => {
        const row = MAT_TUNABLES.find(t => t.key === 'matCap');
        expect(row).toBeDefined();
        expect(row.def).toBe(40);
        expect(MatCap.matCap()).toBe(40);
        setMatTuning('matCap', 3);
        expect(MatCap.matCap()).toBe(3);
        expect(matTuning('matCap')).toBe(3);
    });

    it('ignores spawned Tokens and the Guild Hall', () => {
        EngineBootstrap.createDefaultGameData();   // the Hall
        placeAt('fixture_producer', 200, 200);
        placeAt('fixture_kitchen', 400, 200);
        placeSpawned('fixture_passive', 600, 200);
        placeSpawned('fixture_passive', 800, 200);
        placeSpawned('fixture_passive', 1000, 200);

        expect(BoardState.tokens()).toHaveLength(6);
        expect(MatCap.placedCount()).toBe(2);
    });

    it('canPlaceMore answers against the cap', () => {
        setMatTuning('matCap', 2);
        placeAt('fixture_producer', 200, 200);
        placeSpawned('fixture_passive', 600, 200);
        expect(MatCap.canPlaceMore()).toBe(true);
        expect(MatCap.canPlaceMore(2)).toBe(false);
        placeAt('fixture_kitchen', 400, 200);
        expect(MatCap.canPlaceMore()).toBe(false);
    });
});

describe('⭐ a spawn pushes spawned Tokens, never placed ones (SP-68)', () => {
    /**
     * Every `random_free` dart lands on the middle of the mat, where a Token
     * already sits — so the spawn must either push it or land somewhere else.
     */
    const centre = () => ({ x: 0.5 * matW(), y: 0.5 * matH() });

    it('pushes a spawned Token out of the way', () => {
        const bearer = placeAt('fixture_producer', 200, 200);
        const c = centre();
        const tree = placeSpawned('fixture_passive', c.x + 10, c.y);

        const result = EffectActions.spawn(
            spawnStatement('fixture_passive', PLACEMENT.RANDOM_FREE), { self: bearer.id }, middle
        );

        expect(result).not.toBeNull();
        // The newcomer stands where the dart landed, and the tree was shoved.
        expect(Math.round(result.x)).toBe(Math.round(Math.max(64, Math.min(matW() - 64, c.x))));
        expect(tree.x).not.toBe(c.x + 10);
        expect(Math.hypot(tree.x - result.x, tree.y - result.y))
            .toBeGreaterThanOrEqual(MatPlacement.minGap('fixture_passive', 'fixture_passive') - 1e-3);
    });

    it('never pushes a placed Token: it lands in free space instead', () => {
        const bearer = placeAt('fixture_producer', 200, 200);
        const c = centre();
        const station = placeAt('fixture_kitchen', c.x + 10, c.y);
        const before = { x: station.x, y: station.y };

        const result = EffectActions.spawn(
            spawnStatement('fixture_passive', PLACEMENT.RANDOM_FREE), { self: bearer.id }, middle
        );

        expect(result).not.toBeNull();
        expect({ x: station.x, y: station.y }).toEqual(before);
        expect(Math.hypot(station.x - result.x, station.y - result.y))
            .toBeGreaterThanOrEqual(MatPlacement.minGap('fixture_passive', 'fixture_kitchen') - 1e-3);
    });

    /**
     * `nearest_free` with no nudge: the free-spot search fails on the bearer's
     * own point, so the spawn pushes from just beside the bearer, into a ring.
     *
     * ⚠️ The bearer stands at (400.4, 400.4) on purpose. `besideBearer` rounds its
     * point, and from a whole-number bearer that rounding lands the newcomer a
     * fraction INSIDE the bearer's gap — two fixed bodies overlapping, so the
     * push can never solve and always falls back to free space. From 400.4 it
     * rounds outward and the push path really runs. (Pre-existing; reported.)
     */
    function ringAround(bearer, make) {
        const ring = [];
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            ring.push(make('fixture_kitchen', bearer.x + Math.cos(a) * 100, bearer.y + Math.sin(a) * 100));
        }
        return ring;
    }

    it('nearest_free pushes a ring of spawned Tokens', () => {
        setMatTuning('nudgeReach', 0);
        const bearer = placeAt('fixture_producer', 400.4, 400.4);
        const ring = ringAround(bearer, placeSpawned);
        const before = ring.map(t => ({ x: t.x, y: t.y }));

        const result = EffectActions.spawn(spawnStatement('fixture_passive', PLACEMENT.NEAREST_FREE), { self: bearer.id });

        expect(result).not.toBeNull();
        expect(ring.map(t => ({ x: t.x, y: t.y }))).not.toEqual(before);
        expect({ x: bearer.x, y: bearer.y }).toEqual({ x: 400.4, y: 400.4 });
    });

    it('nearest_free never pushes a ring of placed Tokens', () => {
        setMatTuning('nudgeReach', 0);
        const bearer = placeAt('fixture_producer', 400.4, 400.4);
        const ring = ringAround(bearer, placeAt);
        const before = ring.map(t => ({ x: t.x, y: t.y }));

        const result = EffectActions.spawn(spawnStatement('fixture_passive', PLACEMENT.NEAREST_FREE), { self: bearer.id });

        expect(result).not.toBeNull();   // it found free space outside the ring
        expect(ring.map(t => ({ x: t.x, y: t.y }))).toEqual(before);
        expect({ x: bearer.x, y: bearer.y }).toEqual({ x: 400.4, y: 400.4 });
    });

    it('a spawn with nowhere to go does nothing (FP-46)', () => {
        const bearer = placeAt('fixture_producer', 200, 200);
        // Fill the mat with placed Tokens at the smallest legal spacing.
        const gap = Math.ceil(MatPlacement.minGap('fixture_kitchen', 'fixture_kitchen'));
        for (let x = 64; x <= matW() - 64; x += gap) {
            for (let y = 64; y <= matH() - 64; y += gap) {
                if (Math.hypot(x - 200, y - 200) < gap) continue;
                placeAt('fixture_kitchen', x, y);
            }
        }
        const count = BoardState.tokens().length;

        const result = EffectActions.spawn(
            spawnStatement('fixture_passive', PLACEMENT.RANDOM_FREE), { self: bearer.id }, middle
        );

        expect(result).toBeNull();
        expect(BoardState.tokens()).toHaveLength(count);
    });
});
