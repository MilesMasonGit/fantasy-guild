import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { createEmptyBoard } from '../state/StateSchema.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Cartographer from '../systems/board/Cartographer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
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
        Placement.placeToken(9, BoardState.createTokenInstance('fixture_off_mine', 100, 'hills'));
        Placement.placeToken(7, BoardState.createTokenInstance('fixture_off_keep', null));

        expect(BoardState.getToken(9)?.typeId).toBe('fixture_off_mine');
        expect(BoardState.terrainMap()).toEqual({});
        expect(GameState.state.board.nextPaintOrder).toBe(0);
    });

    it('does not backfill paint under an old save’s Tokens', () => {
        GameState.state.board = createEmptyBoard();
        GameState.state.board.tiles = {
            9: { id: 'tok_old_1', typeId: 'fixture_off_mine', usesRemaining: 50, cycleElapsedMs: 0 }
        };
        expect(BoardState.getTileTerrain(9)).toBeNull();
        expect(GameState.state.board.nextPaintOrder).toBe(0);
    });

    it('keeps terrain a save already holds, untouched (save schema unchanged)', () => {
        GameState.state.board.terrain = { 9: { terrainId: 'forest', paintedAt: 3 } };
        GameState.state.board.nextPaintOrder = 4;
        Placement.placeToken(9, BoardState.createTokenInstance('fixture_off_mine', 100, 'hills'));
        expect(GameState.state.board.terrain).toEqual({ 9: { terrainId: 'forest', paintedAt: 3 } });
        expect(GameState.state.board.nextPaintOrder).toBe(4);
    });

    it('a Token sent to the Vault does not carry a stamp', () => {
        expect(TokenBank.deposit(BoardState.createTokenInstance('fixture_off_mine', 60, 'shore'))).toBe(true);
        expect(BoardState.takeFromTokenBank('fixture_off_mine').terrain).toBeUndefined();
    });

    it('bursting a Map stamps nothing on the Tokens it produces', () => {
        // Fill the Tray so every Token lands as a board sprite, then burst a
        // second Map into an empty Tray: both routes a stamp can take.
        while (BoardState.getTray().length < BoardState.TRAY_CAPACITY) {
            BoardState.addToTray(BoardState.createTokenInstance('token_forest', 100));
        }
        const mapToken = () => BoardState.createTokenInstance('token_test_map', tokenStartingUses('token_test_map'));

        expect(Cartographer.openMap(mapToken(), 'tray').success).toBe(true);
        const tokenSprites = SpriteLayer.getSprites().filter(s => s.kind === 'token');
        expect(tokenSprites.length).toBeGreaterThan(0);
        for (const s of tokenSprites) expect(s.terrain).toBeUndefined();

        GameState.state.board.tray = [];
        expect(Cartographer.openMap(mapToken(), 'tray').success).toBe(true);
        const trayed = BoardState.getTray();
        expect(trayed.length).toBeGreaterThan(0);
        for (const inst of trayed) expect(inst.terrain).toBeUndefined();
    });
});
