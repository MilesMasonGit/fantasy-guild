import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { listRecipes } from '../config/registries/recipePoolRegistry.js';
import { setUpStationsScene, stationsReadout, QA_TYPES } from '../ui/dev/stationsDev.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * The QA panel's station pools button: a QA Furnace and a QA Smithy, each still naming its old
 * station kind. The craft kinds are retired (one building per skill), so each now lists every
 * Smithing recipe.
 */

beforeAll(() => BoardRunner.init());

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    clearMat();
});

describe('the stations scene', () => {
    it('lays out a Furnace and a Smithy, each offering every Smithing recipe now', () => {
        const shippedSmithing = listRecipes().filter(r => r.skill === 'smithing' && !r.id.startsWith('qa_') && !r.foundationKinds?.length);
        expect(setUpStationsScene()).toEqual({ ok: true });

        const furnace = BoardState.tokens().find(t => t.typeId === QA_TYPES.FURNACE);
        const smithy = BoardState.tokens().find(t => t.typeId === QA_TYPES.SMITHY);
        expect(furnace && smithy).toBeTruthy();

        const offered = (inst) => StationRecipe.poolFor(getTokenType(inst.typeId)).map(r => r.id).sort();
        expect(offered(furnace)).toHaveLength(shippedSmithing.length);
        expect(offered(smithy)).toEqual(offered(furnace));

        const lines = stationsReadout();
        expect(lines[0]).toMatch(/^QA Furnace \(Furnace\): \d+ recipes: .*Copper Ingot.*Copper Pickaxe|^QA Furnace \(Furnace\): \d+ recipes: .*Copper Pickaxe.*Copper Ingot/);
        expect(lines[1]).toMatch(/^QA Smithy \(Smithy\): \d+ recipes: .*Ingot/);
    });
});
