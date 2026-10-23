import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as FixedTokens from '../systems/board/FixedTokens.js';
import * as Placement from '../systems/board/Placement.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { QUEST_TOKEN_TYPE } from '../config/registries/engineTokens.js';
import { matW, matH } from '../config/matGeometry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Fixed and movable Tokens** (Atlas D-6 B): map nodes, planted trees and the endgame sites
 * stay where they are. Nothing drags, bins or pushes them. Everything bought or built moves;
 * enemies and quests move as they always have.
 * The Guild Hall is the exception to D-6 (T-148): the player drags it like a bought Token, but nothing else ever pushes it, and it never leaves the mat or is demolished.
 */

const base = { tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_nature', uses: null };
registerTokenTypes({
    fx_sapling: { ...base, id: 'fx_sapling', name: 'Fx Sapling', grows: { into: 'fx_tree', afterMs: 30000 } },
    fx_tree: { ...base, id: 'fx_tree', name: 'Fx Tree', uses: 5 },
    fx_landmark: { ...base, id: 'fx_landmark', name: 'Fx Site', landmark: true },
    fx_enemy: { ...base, id: 'fx_enemy', name: 'Fx Goblin', tokenType: 'enemy', enemy: { level: 1, style: 'melee' } },
    fx_big: { ...base, id: 'fx_big', name: 'Fx Big', size: 2 }
});

/** A spawned Token, straight onto the mat (no rules). */
function spawnedAt(typeId, x, y) {
    return BoardState.addToken(BoardState.createTokenInstance(typeId, null, null, BoardState.ORIGIN.SPAWNED), x, y);
}

/** A map's node: placed, with the fixture mark. */
function fixtureAt(typeId, x, y) {
    const instance = BoardState.createTokenInstance(typeId, 5, null, BoardState.ORIGIN.PLACED);
    instance.fixture = true;
    instance.biome = 'forest';
    return BoardState.addToken(instance, x, y);
}

const spawnStatement = (typeId, placement) => ({
    ...makeStatement(KEYWORD.SPAWNS), payload: { typeId, placement }
});
const pointOf = (t) => ({ x: t.x, y: t.y });

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

describe('⭐ what is fixed (D-6 B)', () => {
    it('a map node and a landmark are fixed; the Guild Hall is not', () => {
        expect(FixedTokens.isFixed(fixtureAt('fixture_producer', 300, 300))).toBe(true);
        expect(FixedTokens.isFixed(placeAt('fx_landmark', 1200, 300))).toBe(true);
        expect(FixedTokens.isFixed(placeAt('token_guild_hall', 800, 600))).toBe(false);
    });

    it('a planted Token is fixed: spawned, and growing or grown', () => {
        expect(FixedTokens.isFixed(spawnedAt('fx_sapling', 300, 300))).toBe(true);
        expect(FixedTokens.isFixed(spawnedAt('fx_tree', 600, 300))).toBe(true);
        expect(FixedTokens.isPlanted(spawnedAt('fx_tree', 900, 300))).toBe(true);
    });

    it('bought or built Tokens are movable, a placed tree among them', () => {
        expect(FixedTokens.isFixed(placeAt('fixture_producer', 300, 300))).toBe(false);
        expect(FixedTokens.isFixed(placeAt('fx_sapling', 600, 300))).toBe(false);
        expect(FixedTokens.isFixed(placeAt('fx_tree', 900, 300))).toBe(false);
    });

    it('a spawned Token outside a growth chain is movable (an ore vein, a goblin, a quest)', () => {
        expect(FixedTokens.isFixed(spawnedAt('fixture_producer', 300, 300))).toBe(false);
        expect(FixedTokens.isFixed(spawnedAt('fx_enemy', 600, 300))).toBe(false);
        expect(FixedTokens.isFixed(spawnedAt(QUEST_TOKEN_TYPE, 900, 300))).toBe(false);
    });
});

describe('⭐ a fixed Token refuses a drag', () => {
    it.each([
        ['a map node', () => fixtureAt('fixture_producer', 400, 400)],
        ['a landmark', () => placeAt('fx_landmark', 400, 400)],
        ['a planted Sapling', () => spawnedAt('fx_sapling', 400, 400)]
    ])('%s does not move, by the engine or by a drop on the mat', (_, make) => {
        const t = make();
        const res = Placement.moveTokenTo(t.id, { x: 900, y: 700 });
        expect(res.success).toBe(false);
        expect(pointOf(t)).toEqual({ x: 400, y: 400 });

        const dropped = dropOnMat({ kind: DRAG_KIND.TOKEN, typeId: t.typeId, from: { instanceId: t.id } }, { x: 900, y: 700 });
        expect(dropped.success).toBe(false);
        expect(pointOf(t)).toEqual({ x: 400, y: 400 });
    });

    it('a map node cannot go in the bin', () => {
        const node = fixtureAt('fixture_producer', 400, 400);
        // The bin is gone (A3b); demolition refuses map nodes in Demolition.test.js.
        expect(BoardState.getTokenById(node.id)).toBeTruthy();
    });

    it('a bought Token still moves', () => {
        const t = placeAt('fixture_producer', 400, 400);
        expect(Placement.moveTokenTo(t.id, { x: 900, y: 700 }).success).toBe(true);
        expect(pointOf(t)).toEqual({ x: 900, y: 700 });
    });
});

describe('⭐ the Guild Hall moves, but only by the player (T-148)', () => {
    it('it moves, by the engine and by a drop on the mat', () => {
        const hall = placeAt('token_guild_hall', 400, 400);
        expect(Placement.moveTokenTo(hall.id, { x: 900, y: 700 }).success).toBe(true);
        expect(pointOf(hall)).toEqual({ x: 900, y: 700 });
        const dropped = dropOnMat({ kind: DRAG_KIND.TOKEN, typeId: hall.typeId, from: { instanceId: hall.id } }, { x: 1200, y: 500 });
        expect(dropped.success).toBe(true);
        expect(pointOf(hall)).toEqual({ x: 1200, y: 500 });
    });

    it('it still refuses demolition and removal', () => {
        const hall = placeAt('token_guild_hall', 400, 400);
        expect(Demolition.canDemolish(hall)).toBe(false);
        expect(Placement.removePlacedToken(hall.id).success).toBe(false);
        expect(BoardState.getTokenById(hall.id)).toBeTruthy();
    });

    it('no push moves it: it is among the ids nothing may push', () => {
        const hall = placeAt('token_guild_hall', 400, 400);
        expect(FixedTokens.fixedTokenIds()).toContain(hall.id);
        expect(FixedTokens.unpushableIds()).toContain(hall.id);
    });

    it('a spawn that replaces its bearer never removes the Hall standing on the same point', () => {
        const bearer = spawnedAt('fixture_passive', 600, 600);
        const hall = placeAt('token_guild_hall', 600, 600);
        expect(EffectActions.spawn(spawnStatement('fixture_passive', PLACEMENT.HERE), { self: bearer.id })).toBeNull();
        expect(BoardState.getTokenById(hall.id)).toBeTruthy();
    });

    it('landmarks, map nodes and planted Tokens stay fixed', () => {
        expect(FixedTokens.isFixed(placeAt('fx_landmark', 300, 300))).toBe(true);
        expect(FixedTokens.isFixed(fixtureAt('fixture_producer', 600, 300))).toBe(true);
        expect(FixedTokens.isFixed(spawnedAt('fx_tree', 900, 300))).toBe(true);
    });
});

describe('⭐ no push moves a fixed Token', () => {
    /** Every `random_free` dart lands in the middle of the mat. */
    const middle = () => 0.5;
    const centre = () => ({ x: 0.5 * matW(), y: 0.5 * matH() });

    it('a random_free spawn lands beside a planted Sapling rather than shoving it', () => {
        const bearer = placeAt('fixture_producer', 200, 200);
        const c = centre();
        const sapling = spawnedAt('fx_sapling', c.x + 10, c.y);
        const before = pointOf(sapling);

        const result = EffectActions.spawn(spawnStatement('fixture_passive', PLACEMENT.RANDOM_FREE), { self: bearer.id }, middle);

        expect(result).not.toBeNull();
        expect(pointOf(sapling)).toEqual(before);
    });

    it('a crowded nearest_free spawn never pushes a ring of planted trees', () => {
        setMatTuning('nudgeReach', 0);
        const bearer = placeAt('fixture_producer', 400.4, 400.4);
        const ring = [];
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            ring.push(spawnedAt('fx_tree', bearer.x + Math.cos(a) * 100, bearer.y + Math.sin(a) * 100));
        }
        const before = ring.map(pointOf);

        EffectActions.spawn(spawnStatement('fixture_passive', PLACEMENT.NEAREST_FREE), { self: bearer.id });

        expect(ring.map(pointOf)).toEqual(before);
    });

    it('a Transforms statement does not push a map node, a landmark or the Hall', () => {
        const gap = Math.ceil(MatPlacement.minGap('fixture_passive', 'fixture_producer')) + 1;
        expect(gap).toBeLessThan(MatPlacement.minGap('fx_big', 'fixture_producer'));
        for (const [make, typeId] of [[fixtureAt, 'fixture_producer'], [placeAt, 'fx_landmark'], [placeAt, 'token_guild_hall']]) {
            clearMat();
            const bearer = spawnedAt('fixture_passive', 600, 600);
            const neighbour = make(typeId, 600 + gap, 600);
            const before = pointOf(neighbour);
            EffectActions.transform(
                { ...makeStatement(KEYWORD.TRANSFORMS), payload: { typeId: 'fx_big' } },
                { self: bearer.id }
            );
            expect(pointOf(neighbour)).toEqual(before);
        }
    });

    it('a Transforms statement still pushes a bought Token, as it always has', () => {
        const gap = Math.ceil(MatPlacement.minGap('fixture_passive', 'fixture_producer')) + 1;
        const bearer = spawnedAt('fixture_passive', 600, 600);
        const neighbour = placeAt('fixture_producer', 600 + gap, 600);
        EffectActions.transform(
            { ...makeStatement(KEYWORD.TRANSFORMS), payload: { typeId: 'fx_big' } },
            { self: bearer.id }
        );
        expect(pointOf(neighbour)).not.toEqual({ x: 600 + gap, y: 600 });
    });

    it('a spawn that replaces its bearer never removes a fixed Token standing on the same point', () => {
        const bearer = spawnedAt('fixture_passive', 600, 600);
        const node = fixtureAt('fixture_producer', 600, 600);

        const result = EffectActions.spawn(spawnStatement('fixture_passive', PLACEMENT.HERE), { self: bearer.id });

        expect(result).toBeNull();
        expect(BoardState.getTokenById(node.id)).toBeTruthy();
    });

    it('a growth or a build (fixPlaced) does not push a planted tree; a spawned ore vein still makes way', () => {
        const gap = Math.ceil(MatPlacement.minGap('fixture_passive', 'fx_tree')) + 1;
        expect(gap).toBeLessThan(MatPlacement.minGap('fx_big', 'fx_tree'));

        const plot = placeAt('fixture_passive', 600, 600);
        const tree = spawnedAt('fx_tree', 600 + gap, 600);
        EffectActions.transformInstance(plot, 'fx_big', { fixPlaced: true });
        expect(pointOf(tree)).toEqual({ x: 600 + gap, y: 600 });

        clearMat();
        const plot2 = placeAt('fixture_passive', 600, 600);
        const vein = spawnedAt('fixture_producer', 600 + gap, 600);
        EffectActions.transformInstance(plot2, 'fx_big', { fixPlaced: true });
        expect(pointOf(vein)).not.toEqual({ x: 600 + gap, y: 600 });
    });

    it('what no growth or build may push: placed Tokens and planted ones, never the one changing', () => {
        const plot = placeAt('fixture_passive', 600, 600);
        const tree = spawnedAt('fx_tree', 900, 600);
        const vein = spawnedAt('fixture_producer', 1200, 600);
        const ids = FixedTokens.unpushableIds(plot.id);
        expect(ids).toContain(tree.id);
        expect(ids).not.toContain(vein.id);
        expect(ids).not.toContain(plot.id);
    });
});

describe('⭐ a fixed Token keeps its mark through a transform', () => {
    it('a map node turned by a Transforms statement is still a fixed map node', () => {
        const node = fixtureAt('fixture_producer', 600, 600);
        EffectActions.transform(
            { ...makeStatement(KEYWORD.TRANSFORMS), payload: { typeId: 'fixture_passive' } },
            { self: node.id }
        );
        const [now] = BoardState.tokensAtPoint(600, 600);
        expect(now.typeId).toBe('fixture_passive');
        expect(FixedTokens.isFixed(now)).toBe(true);
    });

    it('a planted Sapling that grows is a planted, fixed tree', () => {
        const sapling = spawnedAt('fx_sapling', 600, 600);
        const tree = EffectActions.transformInstance(sapling, 'fx_tree', { fixPlaced: true });
        expect(tree.typeId).toBe('fx_tree');
        expect(FixedTokens.isFixed(tree)).toBe(true);
    });
});

describe('Placement reads it', () => {
    it('Placement.isFixed is the same reader', () => {
        expect(Placement.isFixed).toBe(FixedTokens.isFixed);
    });
});
