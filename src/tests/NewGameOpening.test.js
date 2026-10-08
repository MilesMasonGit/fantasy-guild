import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap, openingMat, OPENING_ITEMS } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatCap from '../systems/board/MatCap.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getTokenType, getAllTokenTypes } from '../config/registries/tokenRegistry.js';
import { recipesForToken } from '../config/registries/recipePoolRegistry.js';
import { getItem } from '../config/registries/itemRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Token Lifecycle slice 10.1 — the new-game opening (contents are
 * placeholders), and the roadmap §6 **circularity check**: starting from the
 * opening mat, the opening Bank and the Guild Hall trickle alone, every Token
 * and item in the test content set is reachable, on the SHIPPED data.
 */

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
});

describe('a new game opens with the starter set', () => {
    it('the Guild Hall, an Oak Forest and a Copper Mine stand on the mat, all placed', () => {
        EngineBootstrap.createDefaultGameData();
        const onMat = BoardState.tokens();
        expect(onMat.map(t => t.typeId)).toEqual(['token_guild_hall', 'token_oak_forest', 'token_copper_mine']);
        expect(onMat.every(t => t.origin === 'placed')).toBe(true);
        // The Hall is exempt from the mat cap; the other two count.
        expect(MatCap.tokenCount()).toBe(2);
        // Spawners carry no charges.
        expect(onMat.find(t => t.typeId === 'token_oak_forest').usesRemaining ?? null).toBeNull();
    });

    it('the Bank holds 3 Oak Seed, 10 Oak Wood and 2 Wheat Seed', () => {
        EngineBootstrap.createDefaultGameData();
        expect(InventoryManager.getItemCount('item_oak_seed')).toBe(3);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(10);
        expect(InventoryManager.getItemCount('item_wheat_seed')).toBe(2);
        expect(Object.keys(GameState.state.inventory.items).sort())
            .toEqual(['item_oak_seed', 'item_oak_wood', 'item_wheat_seed']);
    });

    it('every opening Token and item exists', () => {
        for (const { typeId } of openingMat()) expect(getTokenType(typeId), typeId).toBeTruthy();
        for (const { itemId } of OPENING_ITEMS) expect(getItem(itemId), itemId).toBeTruthy();
    });

    it('still has no heroes', () => {
        EngineBootstrap.createDefaultGameData();
        expect(GameState.state.heroes).toEqual([]);
    });
});

/**
 * Close over what the player can get: Tokens (on the mat, bought, spawned,
 * grown, turned into, built) and items (opening, trickle, worked from a Token
 * whose inputs are already reachable). A Token is bought once its whole price
 * is reachable; a recipe runs once its inputs are.
 */
function reachable() {
    const tokens = new Set(openingMat().map(t => t.typeId));
    const items = new Set(OPENING_ITEMS.map(i => i.itemId));
    const all = Object.values(getAllTokenTypes());
    const have = (list) => (list || []).every(x => items.has(x.itemId));

    let grew = true;
    while (grew) {
        const before = tokens.size + items.size;
        for (const typeId of [...tokens]) {
            const def = getTokenType(typeId);
            if (!def) continue;
            for (const t of def.trickle || []) items.add(t.itemId);
            for (const s of def.spawner?.spawns || []) tokens.add(s.typeId);
            if (def.grows?.into) tokens.add(def.grows.into);
            for (const t of def.turns?.into || []) tokens.add(t.typeId);
            if (def.config && have(def.config.inputs)) {
                for (const o of def.config.outputs || []) {
                    if (o.itemId) items.add(o.itemId);
                    if (o.tokenId) tokens.add(o.tokenId);
                }
            }
            for (const r of recipesForToken(def) || []) {
                if (!have(r.inputs)) continue;
                for (const o of r.outputs || []) {
                    if (o.itemId) items.add(o.itemId);
                    if (o.tokenId) tokens.add(o.tokenId);
                }
            }
        }
        for (const def of all) {
            if (def.shop && have(def.shop.price)) tokens.add(def.id);
        }
        grew = tokens.size + items.size > before;
    }
    return { tokens, items };
}

describe('the §6 circularity check: every chain is reachable from the opening alone', () => {
    const { tokens, items } = reachable();

    const SIX = {
        Forestry: ['token_oak_forest', 'token_oak_sapling', 'token_oak_tree'],
        Mining: ['token_copper_mine', 'token_coal_mine', 'token_quarry', 'token_copper_ore_vein', 'token_coal_vein', 'token_stone_outcrop'],
        Fishing: ['token_coast', 'token_shrimp_coast'],
        Farming: ['token_farmland', 'token_wheat_field', 'token_wheat_sprout', 'token_ripe_wheat', 'token_apple_orchard', 'token_apple_sapling', 'token_apple_tree'],
        Construction: ['token_wood_foundation', 'token_stone_foundation', 'token_fighter_s_academy'],
        Crafting: ['token_workbench'],
        Smithing: ['token_furnace', 'token_copper_anvil'],
        Cooking: ['token_cooking_pot'],
        Combat: ['token_goblin_camp', 'token_goblin', 'token_goblin_chief']
    };

    for (const [chain, ids] of Object.entries(SIX)) {
        it(`${chain}: every Token is reachable`, () => {
            for (const id of ids) expect(tokens.has(id), id).toBe(true);
        });
    }

    it('every chain item is reachable', () => {
        for (const id of [
            'item_oak_wood', 'item_oak_seed', 'item_copper_ore', 'item_coal', 'item_stone',
            'item_raw_shrimp', 'item_wheat', 'item_wheat_seed', 'item_apple', 'item_apple_seed',
            'item_charcoal', 'item_torch', 'item_copper_ingot', 'item_shrimp'
        ]) {
            expect(items.has(id), id).toBe(true);
        }
    });
});
