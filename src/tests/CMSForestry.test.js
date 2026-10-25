// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { asLoaded } from './fixtures/shippedAsLoaded.js';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * Brief 230 S2a in the CMS: the Grows block's "Needs one of these in reach" list and its cost (a
 * Stump that needs its Forest and pays a seedling), the Spawner block's "Plants within its reach"
 * box, and the Token editor's "Can be cleared where a map placed it" box. Each is written only when
 * set, so today's files round-trip byte for byte, and each survives Recalculate, Sync and a reload.
 *
 * ⚠️ No real workspace: the store's persistence is a no-op here (TESTING, "The CMS").
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));

const NOOP = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const WORKSPACE_KEY = 'fantasy-guild-cms-v2';

function workspaceFromFiles(files) {
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    return { items: files['items.json'], tokens: files['tokens.json'], effects: files['effects.json'], recipePools };
}
const loadShipped = () => useEntityStore.getState().hydrate(workspaceFromFiles(
    Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]))
));
const syncPayload = () => syncFiles(useEntityStore.getState().recalculateEconomy({}));
const asFile = (files) => Object.fromEntries(FILES.map((f) => [f, JSON.parse(JSON.stringify(files[f], null, 2))]));
const token = (id) => useEntityStore.getState().tokens[id];

function openEditor(id) {
    useEntityStore.getState().setActiveEntity(id, 'token');
    const { container } = render(React.createElement(TokenEditor));
    return { container, block: (key) => container.querySelector(`[data-block="${key}"]`) };
}

let storageBefore;
beforeAll(() => {
    storageBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: NOOP });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storageBefore);
});
beforeEach(() => loadShipped());
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

describe('⭐ the Grows block: the Forest it needs in reach, and its seedling', () => {
    it('Add Token, pick the Forest: written as needsNearby; removed, the key goes', () => {
        const { block } = openEditor('token_oak_sapling');
        const grows = () => block('grows');
        expect(within(grows()).queryByLabelText('Needs in reach')).toBeNull();
        expect(grows().textContent).toContain('Grows wherever it stands.');

        fireEvent.click(within(grows().querySelector('[data-field="needs-nearby"]')).getByText('Add Token'));
        fireEvent.change(within(grows()).getByLabelText('Needs in reach'), { target: { value: 'token_oak_forest' } });
        expect(token('token_oak_sapling').grows).toEqual({ into: 'token_oak_tree', afterMs: 30000, needsNearby: ['token_oak_forest'] });
        expect(grows().textContent).toContain('Its clock stands still while none of these stands within reach');

        fireEvent.click(grows().querySelector('[data-field="needs-nearby"] button.text-gray-600'));
        expect(token('token_oak_sapling').grows).toEqual({ into: 'token_oak_tree', afterMs: 30000 });
    });

    it('the Token it grows into is not offered as what it needs (it can never need itself)', () => {
        const { block } = openEditor('token_oak_sapling');
        fireEvent.click(within(block('grows').querySelector('[data-field="needs-nearby"]')).getByText('Add Token'));
        const options = [...within(block('grows')).getByLabelText('Needs in reach').querySelectorAll('option')].map(o => o.value);
        expect(options).toContain('token_oak_forest');
        expect(options).not.toContain('token_oak_sapling');
    });

    it('a cost is listed by name; removing its last line drops the key', () => {
        useEntityStore.getState().updateToken('token_oak_sapling', {
            grows: { into: 'token_oak_tree', afterMs: 30000, cost: [{ itemId: 'item_oak_seedling', quantity: 1 }] }
        });
        const { block } = openEditor('token_oak_sapling');
        const cost = () => block('grows').querySelector('[data-field="grow-cost"]');
        expect(cost().textContent).toContain('Oak Seedling');
        expect(block('grows').textContent).toContain('with none in the Bank it stops and says what it needs');
        fireEvent.change(cost().querySelector('input[type="number"]'), { target: { value: '2' } });
        expect(token('token_oak_sapling').grows.cost).toEqual([{ itemId: 'item_oak_seedling', quantity: 2 }]);
        fireEvent.click(cost().querySelector('button.text-gray-600'));
        expect(token('token_oak_sapling').grows).toEqual({ into: 'token_oak_tree', afterMs: 30000 });
    });
});

describe('⭐ the Spawner block: plants within its reach', () => {
    it('ticking writes withinReach: true; unticking drops the key', () => {
        const { container } = openEditor('token_oak_forest');
        const box = () => container.querySelector('[data-field="within-reach"]');
        expect(box().checked).toBe(false);
        fireEvent.click(box());
        expect(token('token_oak_forest').spawner.withinReach).toBe(true);
        expect(box().checked).toBe(true);
        fireEvent.click(box());
        expect(token('token_oak_forest').spawner).not.toHaveProperty('withinReach');
    });
});

describe('⭐ the Token editor: can be cleared where a map placed it', () => {
    it('ticking writes clearable: true; unticking drops the key', () => {
        const { container } = openEditor('token_oak_forest');
        const box = () => container.querySelector('[data-field="clearable"]');
        expect(box().checked).toBe(false);
        fireEvent.click(box());
        expect(token('token_oak_forest').clearable).toBe(true);
        fireEvent.click(box());
        expect(token('token_oak_forest').clearable).toBeUndefined();
        expect(JSON.parse(JSON.stringify(syncPayload()['tokens.json'].token_oak_forest))).not.toHaveProperty('clearable');
    });
});

describe('⭐ through Recalculate and Sync', () => {
    it('every new field survives, and a reload and a second Sync keep the same bytes', () => {
        const store = useEntityStore.getState();
        const stump = store.addToken({ name: 'Stump Fixture' });
        store.updateToken(stump, {
            clearable: true,
            grows: {
                into: 'token_oak_sapling', afterMs: 120000,
                needsNearby: ['token_oak_forest'], cost: [{ itemId: 'item_oak_seedling', quantity: 1 }]
            }
        });
        store.updateToken('token_oak_forest', { spawner: { ...token('token_oak_forest').spawner, withinReach: true } });

        const first = asFile(syncPayload());
        expect(first['tokens.json'][stump]).toMatchObject({
            clearable: true,
            grows: { into: 'token_oak_sapling', afterMs: 120000, needsNearby: ['token_oak_forest'], cost: [{ itemId: 'item_oak_seedling', quantity: 1 }] }
        });
        expect(first['tokens.json'].token_oak_forest.spawner.withinReach).toBe(true);

        useEntityStore.getState().hydrate(workspaceFromFiles(first));
        const second = asFile(syncPayload());
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(JSON.stringify(first[f], null, 2));
    });

    it('today\'s data, which uses none of them, still round-trips byte-identical', () => {
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });
});
