import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { createEmptyBoard } from '../state/StateSchema.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { TERRAIN_ENABLED } from '../config/registries/terrainRegistry.js';

/**
 * Free Playmat slice 1.1 — terrain is switched off (FP-10).
 *
 * The switch is `TERRAIN_ENABLED` in `terrainRegistry.js`. With it off, nothing
 * in the running game may paint, stamp or carry terrain. Each test here fails
 * if one of the guards is removed. `TerrainPainting.test.js` forces the switch
 * on and pins what happens when terrain is revived.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

registerTokenTypes({
    fixture_off_mine: {
        id: 'fixture_off_mine', name: 'Fixture Mine', tokenType: 'resource',
        rarity: 'common', uses: 100, requiresHero: false, config: null
    },
    fixture_off_keep: {
        id: 'fixture_off_keep', name: 'Fixture Keep', tokenType: 'buff',
        rarity: 'common', uses: null, requiresHero: false, size: 2, config: null
    }
});

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.settings = { ...(GameState.state.settings || {}), autoCollect: false };
});

describe('Terrain is switched off (FP-10)', () => {
    it('ships switched off', () => {
        expect(TERRAIN_ENABLED).toBe(false);
    });

    it('placing a Token paints nothing, even one carrying a Map stamp', () => {
        // Since Free Playmat 1.6a there is no paint hook and no terrain storage
        // on the board at all (FP-10); placing still works.
        const mine = BoardState.createTokenInstance('fixture_off_mine', 100, 'hills');
        Placement.placeTokenAt(mine, { x: 400, y: 300 });
        Placement.placeTokenAt(BoardState.createTokenInstance('fixture_off_keep', null), { x: 1000, y: 700 });

        expect(BoardState.getTokenById(mine.id)?.typeId).toBe('fixture_off_mine');
        for (const field of ['terrain', 'nextPaintOrder', 'terrainSeed']) {
            expect(field in GameState.state.board).toBe(false);
            expect(field in createEmptyBoard()).toBe(false);
        }
        for (const fn of ['getTileTerrain', 'terrainMap', 'terrainSeed', 'paintTile']) {
            expect(BoardState[fn]).toBeUndefined();
        }
    });

    // Skipped since Free Playmat 1.6a: the backfill and the tile-keyed terrain
    // storage these pinned were removed from BoardState and the save schema.
    // Terrain stays dormant (FP-10) and needs new storage on a free mat.
    it.skip('does not backfill paint under an old save’s Tokens (backfill removed in 1.6a, FP-10)', () => {});

    it.skip('keeps terrain a save already holds, untouched (terrain left the schema in 1.6a, FP-10)', () => {});

    // 'a Token sent to the Vault does not carry a stamp' went with the Vault
    // (Token Lifecycle 9.3).

    // 'bursting a Map stamps nothing on the Tokens it produces' went with the
    // Map bursts (Token Lifecycle 9.1).
});
