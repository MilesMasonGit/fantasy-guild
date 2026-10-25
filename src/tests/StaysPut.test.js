import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as FixedTokens from '../systems/board/FixedTokens.js';
import * as Placement from '../systems/board/Placement.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as Landmarks from '../systems/board/Landmarks.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
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
 * "Stays where it stands" (brief 230 S1a; owner: trees, fruit trees and veins can't be dragged):
 * a mark on the Token type that `FixedTokens.isFixed` reads, so every copy is fixed wherever it came
 * from: placed by hand or from the Shop, spawned by a Mine, or sitting in an old save. Nothing is
 * written on the instance, so a save needs nothing; a copy standing somewhere awkward stays there
 * and can still be demolished.
 */

const mining = {
    skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1,
    inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }]
};
registerTokenTypes({
    sp_vein: {
        id: 'sp_vein', name: 'SP Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        sprite: 's_industry', uses: 5, config: mining, staysPut: true
    },
    sp_loose_vein: {
        id: 'sp_loose_vein', name: 'SP Loose Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        sprite: 's_industry', uses: 5, config: mining
    },
    sp_big: {
        id: 'sp_big', name: 'SP Big', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        sprite: 's_nature', uses: null, size: 2
    }
});

const spawnedAt = (typeId, x, y) =>
    BoardState.addToken(BoardState.createTokenInstance(typeId, 5, null, BoardState.ORIGIN.SPAWNED), x, y);
const pointOf = (t) => ({ x: t.x, y: t.y });

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    clearMat();
});

afterEach(() => {
    Landmarks.setLayoutEditing(false);
    clearMat();
});

describe('⭐ the type mark fixes every copy', () => {
    it('a placed copy and a spawned copy are fixed; the same Token without the mark is not', () => {
        expect(FixedTokens.staysPut(placeAt('sp_vein', 300, 300))).toBe(true);
        expect(FixedTokens.isFixed(placeAt('sp_vein', 600, 300))).toBe(true);
        expect(FixedTokens.isFixed(spawnedAt('sp_vein', 900, 300))).toBe(true);
        expect(FixedTokens.isFixed(placeAt('sp_loose_vein', 1200, 300))).toBe(false);
        expect(FixedTokens.isFixed(spawnedAt('sp_loose_vein', 1500, 300))).toBe(false);
    });

    it('refuses a drag, by the engine and by a drop on the mat, saying it stays where it is', () => {
        const vein = placeAt('sp_vein', 400, 400);
        const res = Placement.moveTokenTo(vein.id, { x: 900, y: 700 });
        expect(res.success).toBe(false);
        expect(res.reason).toBe(Placement.FIXED_IN_PLACE);
        expect(pointOf(vein)).toEqual({ x: 400, y: 400 });

        const dropped = dropOnMat({ kind: DRAG_KIND.TOKEN, typeId: vein.typeId, from: { instanceId: vein.id } }, { x: 900, y: 700 });
        expect(dropped.success).toBe(false);
        expect(pointOf(vein)).toEqual({ x: 400, y: 400 });
    });

    it('the unmarked copy still moves', () => {
        const vein = placeAt('sp_loose_vein', 400, 400);
        expect(Placement.moveTokenTo(vein.id, { x: 900, y: 700 }).success).toBe(true);
    });

    it('nothing pushes a spawned copy: it is among the ids no growth, build or spawn may move', () => {
        const marked = spawnedAt('sp_vein', 900, 600);
        const loose = spawnedAt('sp_loose_vein', 1200, 600);
        const ids = FixedTokens.unpushableIds();
        expect(ids).toContain(marked.id);
        expect(ids).not.toContain(loose.id);
        expect(FixedTokens.fixedTokenIds()).toContain(marked.id);
    });

    it('a growth beside a spawned copy does not shove it', () => {
        const gap = Math.ceil(MatPlacement.minGap('fixture_passive', 'sp_vein')) + 1;
        expect(gap).toBeLessThan(MatPlacement.minGap('sp_big', 'sp_vein'));
        const plot = placeAt('fixture_passive', 600, 600);
        const vein = spawnedAt('sp_vein', 600 + gap, 600);
        EffectActions.transformInstance(plot, 'sp_big', { fixPlaced: true });
        expect(pointOf(vein)).toEqual({ x: 600 + gap, y: 600 });
    });

    it('the dev layout tool lifts it, as it lifts the camp’s fixtures', () => {
        const vein = placeAt('sp_vein', 400, 400);
        Landmarks.setLayoutEditing(true);
        expect(FixedTokens.isFixed(vein)).toBe(false);
        Landmarks.setLayoutEditing(false);
        expect(FixedTokens.isFixed(vein)).toBe(true);
    });
});

describe('an old save', () => {
    it('a copy saved before the mark existed is fixed where it stands, with nothing written on it', () => {
        // As a save stores it: placed by hand, no fixture mark, sitting in the middle of things.
        const vein = BoardState.addToken({ id: 'old_vein', typeId: 'sp_vein', usesRemaining: 3, cycleElapsedMs: 0, origin: 'placed' }, 800, 600);
        expect(FixedTokens.isFixed(vein)).toBe(true);
        expect(vein.fixture).toBeUndefined();
        expect(Placement.moveTokenTo(vein.id, { x: 300, y: 300 }).success).toBe(false);
    });

    it('one sitting somewhere awkward can still be demolished (it is not a map node or the camp’s)', () => {
        const vein = placeAt('sp_vein', 800, 600);
        expect(Demolition.refusalOf(vein)).toBeNull();
        expect(Demolition.canMark(vein.id).success).toBe(true);
    });
});
