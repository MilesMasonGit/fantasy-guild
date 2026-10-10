// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor';
import { STARTING_TOKEN_CAP } from '../../cms/src/utils/constants';
import MapEditor from '../../cms/src/components/editors/MapEditor.jsx';
import Sidebar from '../../cms/src/components/layout/Sidebar.jsx';
import { BASE_TOKEN_CAP } from '../systems/board/MatCap.js';
import { blankCartography, recipeOf, MAP_TEXT } from '../systems/atlas/mapItems.js';

/**
 * The CMS's Map editor: maps and modifiers are authored in their own editor, and
 * each one IS an item in the workspace's item collection, so it reaches `data/items.json` and the
 * Bank with no copy to keep in step. Checked with persistence switched off, so no test writes the
 * author's real workspace.
 */

const STORAGE_KEY = 'fantasy-guild-cms-v2';
const NO_STORAGE = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;

beforeAll(() => {
    storedBefore = window.localStorage.getItem(STORAGE_KEY);
    useEntityStore.persist.setOptions({ storage: NO_STORAGE });
});
afterAll(() => {
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
});

/** A small workspace: two Tokens a map can name, an enemy and a chest that drop maps. */
function workspace() {
    return {
        items: {
            item_fixture_log: { id: 'item_fixture_log', name: 'Fixture Log', type: 'material', value: null, valueSource: null, autoSyncId: true }
        },
        tokens: {
            token_fixture_tree: {
                id: 'token_fixture_tree', name: 'Fixture Tree', tokenType: 'resource', rarity: 'common', uses: null,
                requiresHero: true, autoSyncId: true, sim: { tempo: 'fast', purpose: 'iph' },
                config: {
                    skill: 'forestry', skillRequired: 1, cycleTimeMs: 12000, xp: 5, inputs: [],
                    outputs: [{ itemId: 'item_fixture_log', chance: 100, minQty: 1, maxQty: 1 }]
                }
            },
            token_fixture_fir: { id: 'token_fixture_fir', name: 'Fixture Fir', tokenType: 'resource', rarity: 'common', uses: null, config: null },
            token_fixture_camp: { id: 'token_fixture_camp', name: 'Fixture Camp', tokenType: 'buff', rarity: 'common', uses: null, config: null },
            token_fixture_wolf: {
                id: 'token_fixture_wolf', name: 'Fixture Wolf', rarity: 'common', uses: null, enemy: { level: 3, style: 'melee' },
                config: { skill: '', skillRequired: 1, cycleTimeMs: 6000, inputs: [], outputs: [] }
            },
            token_fixture_chest: {
                id: 'token_fixture_chest', name: 'Fixture Chest', tokenType: 'resource', rarity: 'common', uses: 1,
                requiresHero: true, sim: { tempo: 'fast', purpose: 'iph' },
                config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 12000, xp: 5, inputs: [], outputs: [] }
            }
        },
        effects: {},
        recipePools: {}
    };
}

function load() {
    useEntityStore.getState().hydrate(workspace());
}

/** Author a Forest Base Map and an Overgrown modifier through the store, as the editor does. */
function authorForestAndOvergrown() {
    const store = useEntityStore.getState();
    const forestId = store.addMap('map', { name: 'Forest Map', sprite: 'map_forest' });
    store.updateItem(forestId, {
        cartography: {
            biome: 'forest', points: 40,
            nodes: [{ typeId: 'token_fixture_tree', weight: 6 }],
            camps: [{ typeId: 'token_fixture_camp', count: 1 }], treasures: [],
            bountyWeight: 2
        }
    });
    const overgrownId = useEntityStore.getState().addMap('modifier', { name: 'Overgrown', sprite: 'map_flowers' });
    useEntityStore.getState().updateItem(overgrownId, {
        cartography: { effects: [{ kind: 'density', typeId: 'token_fixture_tree', points: 16 }] }
    });
    return { forestId, overgrownId };
}

/** Recalculate and build the sync payload exactly as `syncToGame` does, minus the POST. */
function syncPayload() {
    const balanced = useEntityStore.getState().recalculateEconomy({});
    return { files: syncFiles(balanced), balanced };
}

beforeEach(load);
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

describe('authoring a map writes an item', () => {
    it('a new Base Map and a new Modifier are items, with a blank Cartography block and no value', () => {
        const store = useEntityStore.getState();
        const mapId = store.addMap();
        const modId = useEntityStore.getState().addMap('modifier');
        const { items } = useEntityStore.getState();
        expect(mapId).toBe('map_new_map');
        expect(modId).toBe('mod_new_modifier');
        expect(items[mapId]).toMatchObject({ id: mapId, type: 'map', stackable: true, cartography: blankCartography('map') });
        expect(items[modId]).toMatchObject({ id: modId, type: 'modifier', cartography: blankCartography('modifier') });
        for (const id of [mapId, modId]) {
            expect('value' in items[id]).toBe(false);
            expect('valueSource' in items[id]).toBe(false);
        }
        expect(useEntityStore.getState().maps).toBeUndefined();
    });

    it('renaming keeps a map\'s id prefix', () => {
        const { forestId, overgrownId } = authorForestAndOvergrown();
        expect(forestId).toBe('map_forest_map');
        expect(overgrownId).toBe('mod_overgrown');
    });

    it('switching kind swaps the block and the prefix, keeping bounty weight and upcycling', () => {
        const id = useEntityStore.getState().addMap('map', { name: 'Odd One' });
        useEntityStore.getState().updateItem(id, { cartography: { ...blankCartography('map'), bountyWeight: 0, upcycle: { itemId: 'map_x', ratio: 5 } } });
        const next = useEntityStore.getState().setMapKind(id, 'modifier');
        const item = useEntityStore.getState().items[next];
        expect(next).toBe('mod_odd_one');
        expect(item.type).toBe('modifier');
        expect(item.cartography).toEqual({ effects: [], bountyWeight: 0, upcycle: { itemId: 'map_x', ratio: 5 } });
    });

    it('renaming a Token repoints every map that names it', () => {
        const { forestId, overgrownId } = authorForestAndOvergrown();
        useEntityStore.getState().updateToken('token_fixture_tree', { name: 'Fixture Oak' });
        const { items, tokens } = useEntityStore.getState();
        expect(tokens.token_fixture_oak).toBeTruthy();
        expect(items[forestId].cartography.nodes[0].typeId).toBe('token_fixture_oak');
        expect(items[overgrownId].cartography.effects[0].typeId).toBe('token_fixture_oak');
    });

    it('renaming a map repoints the enemies that drop it and the maps that trade up into it', () => {
        const { forestId } = authorForestAndOvergrown();
        const lesserId = useEntityStore.getState().addMap('map', { name: 'Lesser Map' });
        useEntityStore.getState().updateItem(lesserId, { cartography: { ...blankCartography('map'), upcycle: { itemId: forestId, ratio: 10 } } });
        const wolf = useEntityStore.getState().tokens.token_fixture_wolf;
        useEntityStore.getState().updateToken('token_fixture_wolf', { config: { ...wolf.config, outputs: [{ itemId: forestId, chance: 2, minQty: 1, maxQty: 1 }] } });
        useEntityStore.getState().updateItem(forestId, { name: 'Deep Forest Map' });
        const { items, tokens } = useEntityStore.getState();
        expect(items[lesserId].cartography.upcycle.itemId).toBe('map_deep_forest_map');
        expect(tokens.token_fixture_wolf.config.outputs[0].itemId).toBe('map_deep_forest_map');
    });
});

describe('the round trip through Sync', () => {
    it('writes each map into items.json exactly as authored, and no maps.json', () => {
        const { forestId, overgrownId } = authorForestAndOvergrown();
        const authored = structuredClone(useEntityStore.getState().items);
        const { files } = syncPayload();

        expect(Object.keys(files)).not.toContain('maps.json');
        expect(JSON.stringify(files['items.json'][forestId])).toBe(JSON.stringify(authored[forestId]));
        expect(JSON.stringify(files['items.json'][overgrownId])).toBe(JSON.stringify(authored[overgrownId]));
    });

    it('reads back from the files as the same maps, which the engine reads', () => {
        const { forestId, overgrownId } = authorForestAndOvergrown();
        const before = structuredClone(useEntityStore.getState().items);
        const { files } = syncPayload();

        const reread = JSON.parse(JSON.stringify(files));
        useEntityStore.getState().hydrate({
            items: reread['items.json'], tokens: reread['tokens.json'], effects: reread['effects.json'], recipePools: {}
        });
        const after = useEntityStore.getState().items;
        expect(after[forestId]).toEqual(before[forestId]);
        expect(after[overgrownId]).toEqual(before[overgrownId]);
        expect(recipeOf(after[forestId])).toMatchObject({ kind: 'base', biome: 'forest', points: 40 });
        expect(recipeOf(after[overgrownId]).effects).toHaveLength(1);
    });

    it('the simulator prices no map, refuses none, and leaves a map drop exactly as authored', () => {
        const { forestId } = authorForestAndOvergrown();
        const drop = { itemId: forestId, chance: 2, minQty: 1, maxQty: 1 };
        const tokens = useEntityStore.getState().tokens;
        useEntityStore.getState().updateToken('token_fixture_wolf', { config: { ...tokens.token_fixture_wolf.config, outputs: [drop] } });
        useEntityStore.getState().updateToken('token_fixture_chest', {
            config: { ...tokens.token_fixture_chest.config, outputs: [{ itemId: 'item_fixture_log', chance: 100, minQty: 3, maxQty: 3 }, drop] }
        });

        const { files, balanced } = syncPayload();
        expect(balanced.sim.values.has(forestId)).toBe(false);
        expect(balanced.sim.rows.filter(r => r.itemId === forestId || String(r.message).includes(forestId))).toEqual([]);
        expect(files['tokens.json'].token_fixture_wolf.config.outputs).toEqual([drop]);
        expect(files['tokens.json'].token_fixture_chest.config.outputs[1]).toEqual(drop);
        expect('value' in files['items.json'][forestId]).toBe(false);
    });

    it('a workspace still holding the retired Map collection drops it', () => {
        useEntityStore.getState().hydrate({ ...workspace(), maps: { map_old: { id: 'map_old', name: 'Old', pool: [] } } });
        expect(useEntityStore.getState().maps).toBeUndefined();
        const persisted = useEntityStore.persist.getOptions().partialize(useEntityStore.getState());
        expect('maps' in persisted).toBe(false);
    });
});

describe('the Economy Audit reads maps', () => {
    it('raises no unreachable or dead-end row for a map, and names a Token a map points at that does not exist', () => {
        const { forestId } = authorForestAndOvergrown();
        const state = useEntityStore.getState();
        state.updateItem(forestId, { cartography: { ...state.items[forestId].cartography, treasures: [{ typeId: 'token_fixture_gone', count: 1 }] } });
        const { items, tokens, effects } = useEntityStore.getState();
        const issues = auditConnectivity({ items, tokens, effects, recipes: {} });
        const aboutForest = issues.filter(i => i.entityId === forestId);
        expect(aboutForest.map(i => i.details)).toEqual([MAP_TEXT.missingToken('One of its treasures', 'token_fixture_gone')]);
        expect(issues.some(i => /Unreachable Item|Dead-End/.test(i.details) && (i.entityId === forestId || i.entityId === 'mod_overgrown'))).toBe(false);
    });
});

describe('the Map editor', () => {
    it('shows a Base Map\'s Cartography and what it writes at the starting cap', () => {
        const { forestId } = authorForestAndOvergrown();
        useEntityStore.getState().setActiveEntity(forestId, 'map');
        const { container } = render(React.createElement(MapEditor));
        const text = container.textContent;
        for (const words of ['Cartography', 'What it writes', '41 Tokens', '40 × Fixture Tree', '1 × Fixture Camp', 'Upcycling', 'Bounties']) {
            expect(text).toContain(words);
        }
    });

    it('edits the points, and the preview follows', () => {
        const { forestId } = authorForestAndOvergrown();
        useEntityStore.getState().setActiveEntity(forestId, 'map');
        const { container } = render(React.createElement(MapEditor));
        const points = container.querySelector('input[data-field="points"]');
        fireEvent.change(points, { target: { value: '20' } });
        expect(useEntityStore.getState().items[forestId].cartography.points).toBe(20);
        expect(container.textContent).toContain('20 × Fixture Tree');
    });

    it('shows a Modifier\'s effects', () => {
        const { overgrownId } = authorForestAndOvergrown();
        useEntityStore.getState().setActiveEntity(overgrownId, 'map');
        const { container } = render(React.createElement(MapEditor));
        expect(container.textContent).toContain('+16 × Fixture Tree');
        expect(container.textContent).toContain('Effects');
    });

    it('opens a map item reached as an item too', () => {
        const { forestId } = authorForestAndOvergrown();
        useEntityStore.getState().setActiveEntity(forestId, 'item');
        const { container } = render(React.createElement(MapEditor));
        expect(container.textContent).toContain('Cartography');
    });

    it('previews at the game\'s starting Token cap', () => {
        expect(STARTING_TOKEN_CAP).toBe(BASE_TOKEN_CAP);
    });
});

describe('the sidebar keeps maps apart from items', () => {
    it('lists maps under Maps and not under Items', () => {
        authorForestAndOvergrown();
        const { container, getByTitle } = render(React.createElement(Sidebar));
        expect(container.textContent).toContain('Fixture Log');
        expect(container.textContent).not.toContain('Forest Map');
        fireEvent.click(getByTitle('Maps'));
        expect(container.textContent).toContain('Forest Map');
        expect(container.textContent).toContain('Overgrown');
        expect(container.textContent).not.toContain('Fixture Log');
    });
});
