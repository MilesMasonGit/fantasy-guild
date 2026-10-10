import { describe, it, expect, vi } from 'vitest';

/**
 * A map item loads like any item: the game reads `data/items.json`, and a `map` or `modifier`
 * item comes through the loader with its Cartography block whole. The loader's sources are
 * replaced here by a file holding one of each, the way the CMS's Sync writes them.
 */

const FILE = vi.hoisted(() => ({
    item_oak_wood: { name: 'Oak Wood', type: 'material', sprite: 'd_oak_wood', stackable: true, value: 1 },
    map_forest: {
        name: 'Forest Map', description: '', type: 'map', tags: [], sprite: 'map_forest', stackable: true,
        autoSyncId: true, id: 'map_forest',
        cartography: {
            biome: 'forest', points: 40,
            nodes: [{ typeId: 'token_oak_tree', weight: 6 }, { typeId: 'token_redberry_bush', weight: 1 }],
            camps: [], treasures: [{ typeId: 'token_ruins', count: 1 }],
            upcycle: { itemId: 'map_mountain', ratio: 10 }, bountyWeight: 2
        }
    },
    mod_overgrown: {
        name: 'Overgrown', type: 'modifier', sprite: 'map_flowers', stackable: true, id: 'mod_overgrown',
        cartography: { effects: [{ kind: 'density', typeId: 'token_oak_tree', points: 16 }] }
    }
}));

vi.mock('../config/DatabaseManager.js', () => ({
    DatabaseManager: {
        itemFilesSingle: { '/data/items.json': { default: structuredClone(FILE) } },
        itemFilesGlob: {},
        tokenFilesSingle: {},
        recipePoolFilesSingle: {},
        recipePoolFilesGlob: {},
        effectFilesSingle: {},
        effectFilesGlob: {}
    },
    default: {}
}));

const { getItem, ITEM_TYPES } = await import('../config/registries/itemRegistry.js');
const { recipeOf, isMapItem } = await import('../systems/atlas/mapItems.js');

describe('a map item loads from data/items.json', () => {
    it('with its type and its Cartography block, exactly as written', () => {
        const map = getItem('map_forest');
        expect(map.type).toBe(ITEM_TYPES.MAP);
        expect(map.cartography).toEqual(FILE.map_forest.cartography);
        const mod = getItem('mod_overgrown');
        expect(mod.type).toBe(ITEM_TYPES.MODIFIER);
        expect(mod.cartography).toEqual(FILE.mod_overgrown.cartography);
    });

    it('and the engine reads it', () => {
        expect(recipeOf(getItem('map_forest'))).toEqual({
            id: 'map_forest', kind: 'base', biome: 'forest', points: 40,
            nodes: [{ typeId: 'token_oak_tree', weight: 6 }, { typeId: 'token_redberry_bush', weight: 1 }],
            treasures: [{ typeId: 'token_ruins', count: 1 }]
        });
        expect(recipeOf(getItem('mod_overgrown'))).toEqual({
            id: 'mod_overgrown', kind: 'modifier', effects: [{ kind: 'density', typeId: 'token_oak_tree', points: 16 }]
        });
    });

    it('beside ordinary items, which stay ordinary', () => {
        expect(isMapItem(getItem('item_oak_wood'))).toBe(false);
        expect(recipeOf(getItem('item_oak_wood'))).toBeNull();
    });
});
