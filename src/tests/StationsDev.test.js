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
 * The QA panel's station pools button (brief 230 S6a): the owner's way to see, by clicking, a
 * Furnace that lists only smelting and a Smithy that lists only smithing.
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
    it('lays out a Furnace offering only ingots and a Smithy offering everything else', () => {
        const shippedSmithing = listRecipes().filter(r => r.skill === 'smithing' && !r.id.startsWith('qa_'));
        expect(setUpStationsScene()).toEqual({ ok: true });

        const furnace = BoardState.tokens().find(t => t.typeId === QA_TYPES.FURNACE);
        const smithy = BoardState.tokens().find(t => t.typeId === QA_TYPES.SMITHY);
        expect(furnace && smithy).toBeTruthy();

        const offered = (inst) => StationRecipe.poolFor(getTokenType(inst.typeId));
        const furnaceOutputs = offered(furnace).flatMap(r => r.outputs.map(o => o.itemId));
        expect(furnaceOutputs.length).toBeGreaterThan(0);
        expect(furnaceOutputs.every(id => /ingot/.test(id))).toBe(true);
        expect(offered(smithy).every(r => r.outputs.every(o => !/ingot/.test(o.itemId)))).toBe(true);
        // Between them, every shipped Smithing recipe, each in one place, with no anvil needed.
        expect(offered(furnace).length + offered(smithy).length).toBe(shippedSmithing.length);
        expect(offered(smithy).every(r => r.requiresContext.length === 0)).toBe(true);

        const lines = stationsReadout();
        expect(lines[0]).toMatch(/^QA Furnace \(Furnace\): \d+ recipes: .*Copper Ingot/);
        expect(lines[1]).toMatch(/^QA Smithy \(Smithy\): \d+ recipes: .*Copper Pickaxe/);
        expect(lines[1]).not.toContain('Ingot');
    });
});
