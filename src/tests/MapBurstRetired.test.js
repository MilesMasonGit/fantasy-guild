import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Shop from '../systems/board/Shop.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getAllTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';

/**
 * Token Lifecycle slice 9.1 — **the Map bursts are retired**.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const src = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('The burst code is deleted (9.1)', () => {
    it('Cartographer, the Guild Hall Maps and the Map inspection panel are gone', () => {
        for (const rel of [
            'systems/board/Cartographer.js',
            'config/registries/guildHallMaps.js',
            'ui/components/drawer/MapInspection.jsx'
        ]) {
            expect(() => statSync(join(src, rel)), rel).toThrow();
        }
    });

    it('the Shop panel has no Maps section', () => {
        const tab = readFileSync(join(src, 'ui/components/drawer/ShopDrawer.jsx'), 'utf8');
        expect(tab).not.toMatch(/MapCard|buyMap|Cartographer\.|>Maps</);
    });

    it('nothing on the board keeps Maps lying loose any more', () => {
        expect(BoardState.getBoardMaps).toBeUndefined();
        expect(BoardState.addBoardMap).toBeUndefined();
        expect(BoardState.MAX_MAP_LIMIT).toBeUndefined();
    });
});

describe('A Map Token is an ordinary Token now (9.1)', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        TileModifiers.clearAll();
        TileModifiers.init();
        EngineBootstrap.createDefaultGameData();
    });

    it('a new game has no Map box storage', () => {
        expect(GameState.state.board.maps).toBeUndefined();
    });

    it('an unreworked Map Token placed on the mat stands there like any Token, and bursts nothing', () => {
        const types = getAllTokenTypes();
        const typeId = Object.keys(types).find((id) => types[id].mapId);
        expect(typeId, 'an unreworked Map Token is still in the data (DP-9)').toBeTruthy();

        const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
        const hall = Placement.centreOfBoard();
        const result = Placement.placeTokenAt(instance, { x: hall.x + 300, y: hall.y });
        expect(result.success).toBe(true);
        expect(BoardState.getTokenById(instance.id)).toBeTruthy();
        expect(SpriteLayer.getSprites()).toEqual([]);
    });

    it('the unreworked Map Tokens are not sold (DP-9); the Oak Forest Map is', () => {
        const sold = Shop.catalogue().flatMap((g) => g.items.map((i) => i.typeId));
        expect(sold).toContain('token_oak_forest_map');
        const types = getAllTokenTypes();
        for (const id of sold) expect(types[id].mapId, id).toBeUndefined();
    });
});
