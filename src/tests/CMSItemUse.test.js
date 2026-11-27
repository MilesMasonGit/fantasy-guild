// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { loadGameData } from '../../cms/gameData.js';
import { validateWorkspace } from '../../cms/schemaCheck.js';
import { itemUseDropsOf as cmsUseDropsOf } from '../../cms/src/utils/constants';
import { itemUseDropsOf } from '../config/registries/itemUse.js';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';

/**
 * ⭐ An item's Use in the CMS (brief 400 B4): the item editor's Use block writes `use: { drops }`
 * only while it has a drop; the Use comes through Restore from Game, Recalculate and Sync to Game
 * as written; every item without one is byte-identical either way; the schema knows the field.
 *
 * ⚠️ No real workspace: the store's persistence is a no-op, and the data is a throwaway folder of
 * fixture items, never `data/` (TESTING, "The CMS").
 */

const USE = { drops: [{ itemId: 'cu_seed', chance: 100, minQty: 1, maxQty: 2 }, { itemId: 'cu_rare', chance: 25, minQty: 1, maxQty: 1 }] };
const item = (id, name, extra = {}) => ({ id, name, description: '', type: 'material', sprite: '', stackable: true, restoreAmount: 0, equipSlot: '', autoSyncId: false, tags: [], ...extra });
const ITEMS = {
    cu_nest: item('cu_nest', 'CU Nest', { use: USE }),
    cu_seed: item('cu_seed', 'CU Seed'),
    cu_rare: item('cu_rare', 'CU Rare Seed'),
    cu_wood: item('cu_wood', 'CU Wood', { equipSlot: 'hand', type: 'tool', tool: { kind: 'woodaxe', tier: 1 } })
};
const TOKENS = {
    cu_tree: {
        id: 'cu_tree', name: 'CU Tree', tokenType: 'resource', rarity: 'common', tags: [], uses: null, requiresHero: true,
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 5000, xp: 1, inputs: [], outputs: [{ itemId: 'cu_nest', chance: 50, minQty: 1, maxQty: 1 }] }
    }
};

const tmpRoots = [];
const dataDir = (items) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-item-use-'));
    tmpRoots.push(root);
    const data = path.join(root, 'data');
    fs.mkdirSync(data);
    fs.mkdirSync(path.join(root, 'plan'));
    fs.writeFileSync(path.join(data, 'items.json'), JSON.stringify(items, null, 2));
    fs.writeFileSync(path.join(data, 'tokens.json'), JSON.stringify(TOKENS, null, 2));
    fs.writeFileSync(path.join(data, 'tokenRecipes.json'), '[]');
    fs.writeFileSync(path.join(data, 'effects.json'), '{}');
    return { dataRoot: data, planRoot: path.join(root, 'plan') };
};

const store = () => useEntityStore.getState();
const restore = (items) => store().hydrate(loadGameData(dataDir(items)));
const syncedItems = () => JSON.parse(JSON.stringify(syncFiles(store().recalculateEconomy({}))))['items.json'];
const block = (container) => container.querySelector('[data-field="use"]');

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;
beforeAll(() => {
    storedBefore = globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null;
    useEntityStore.persist.setOptions({ storage: noStorage });
});
beforeEach(() => restore(structuredClone(ITEMS)));
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
    expect(globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null).toBe(storedBefore);
});
afterAll(() => { for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true }); });

describe('⭐ the Use through Restore, Recalculate and Sync', () => {
    it('the CMS reads a Use with the game\'s own rule', () => {
        expect(cmsUseDropsOf).toBe(itemUseDropsOf);
    });

    it('comes back from Restore from Game and goes out with Sync exactly as written', () => {
        expect(store().items.cu_nest.use).toEqual(USE);
        const synced = syncedItems();
        expect(synced.cu_nest.use).toEqual(USE);
        // A second round trip, from what the first Sync wrote: still the same.
        restore(synced);
        expect(syncedItems().cu_nest.use).toEqual(USE);
    });

    it('every item without a Use is byte-identical whether or not another item has one; none gains the key', () => {
        const withUse = syncedItems();
        const without = structuredClone(ITEMS);
        delete without.cu_nest.use;
        restore(without);
        const plain = syncedItems();
        for (const id of ['cu_seed', 'cu_rare', 'cu_wood']) {
            expect(JSON.stringify(withUse[id]), id).toBe(JSON.stringify(plain[id]));
            expect('use' in plain[id], id).toBe(false);
        }
        // The item itself differs by its Use alone.
        const { use, ...rest } = withUse.cu_nest;
        expect(use).toEqual(USE);
        expect(JSON.stringify(rest)).toBe(JSON.stringify(plain.cu_nest));
        expect('use' in plain.cu_nest).toBe(false);
    });

    it('the schema knows it: a workspace with a Use has no errors and no unknown key', () => {
        const result = validateWorkspace({ items: { ...store().items, cu_odd: item('cu_odd', 'CU Odd', { zz: 1 }) } });
        expect(result.errors).toEqual([]);
        // An unlisted key is reported; `use` and its drops' fields are not.
        expect(result.unknown.map(u => u.key)).toEqual(['zz']);
        const bad = validateWorkspace({ items: { ...store().items, cu_bad: item('cu_bad', 'CU Bad', { use: { drops: [{ itemId: 'cu_seed', chance: 'often' }] } }) } });
        expect(bad.errors.length).toBeGreaterThan(0);
    });
});

describe('⭐ the item editor\'s Use block', () => {
    const edit = (id) => {
        store().setActiveEntity(id, 'item');
        return render(React.createElement(ItemEditor));
    };

    it('shows the drops; a new one is a sure one of an item; changing a row writes it', () => {
        const { container } = edit('cu_seed');
        expect(block(container)).not.toBeNull();
        expect(block(container).querySelectorAll('[data-use-index]')).toHaveLength(0);
        expect(store().items.cu_seed.use).toBeUndefined();
        fireEvent.click(block(container).querySelector('[data-add-use]'));
        expect(store().items.cu_seed.use).toEqual({ drops: [{ itemId: '', chance: 100, minQty: 1, maxQty: 1 }] });
        fireEvent.change(block(container).querySelector('[data-use-item]'), { target: { value: 'cu_rare' } });
        fireEvent.change(block(container).querySelector('[data-use-chance] input'), { target: { value: '30' } });
        fireEvent.change(block(container).querySelector('[data-use-max] input'), { target: { value: '3' } });
        expect(store().items.cu_seed.use).toEqual({ drops: [{ itemId: 'cu_rare', chance: 30, minQty: 1, maxQty: 3 }] });
        expect(block(container).querySelector('[data-use-per-copy]').textContent).toBe('0.6');
        // An item never offers itself as its own drop.
        expect([...block(container).querySelectorAll('[data-use-item] option')].map(o => o.value)).not.toContain('cu_seed');
    });

    it('removing the last drop drops the key: the record is as it was', () => {
        const before = JSON.stringify(store().items.cu_rare);
        const { container } = edit('cu_rare');
        fireEvent.click(block(container).querySelector('[data-add-use]'));
        fireEvent.click(block(container).querySelector('[data-remove-use]'));
        expect(store().items.cu_rare.use).toBeUndefined();
        expect(JSON.stringify(store().items.cu_rare)).toBe(before);
        expect('use' in syncedItems().cu_rare).toBe(false);
    });

    it('an item\'s authored Use shows its rows; a Use that gives nothing says so', () => {
        const { container } = edit('cu_nest');
        expect(block(container).querySelectorAll('[data-use-index]')).toHaveLength(2);
        expect(block(container).querySelector('[data-use-problem]')).toBeNull();
        cleanup();
        store().updateItem('cu_nest', { use: { drops: [{ itemId: 'cu_seed', chance: 0 }] } });
        const again = edit('cu_nest');
        expect(block(again.container).querySelector('[data-use-problem]').textContent).toMatch(/Its Use gives nothing/);
    });
});
