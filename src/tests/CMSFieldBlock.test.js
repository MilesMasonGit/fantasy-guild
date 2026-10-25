// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup, fireEvent, within, screen } from '@testing-library/react';

import { useEntityStore, makeLifecycleBlock, TOKEN_LIFECYCLE_BLOCKS } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { CROP_DEFAULTS as CMS_CROP_DEFAULTS, cropTermsOf as cmsCropTermsOf, STATION_KINDS as CMS_STATION_KINDS } from '../../cms/src/utils/constants';
import { CROP_DEFAULTS, cropTermsOf, STATION_KINDS } from '../config/registries/tokenConstants.js';
import RecipeEditor from '../../cms/src/components/editors/RecipeEditor.jsx';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * Brief 230 S4 in the CMS: a Token's Field block (its empty and growing pictures, the crop a wild
 * patch starts ripe with) and a crop recipe's Crop row (grow time, load, ripe picture), each carried
 * through Recalculate, Sync and a reload exactly as written, and gone without a trace when removed.
 *
 * ⚠️ No real workspace: the store's persistence is a no-op here (TESTING, "The CMS").
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));

function workspaceFromFiles(files) {
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    return { items: files['items.json'], tokens: files['tokens.json'], effects: files['effects.json'], recipePools };
}
const loadShipped = () => useEntityStore.getState().hydrate(workspaceFromFiles(
    Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]))
));
const syncPayload = () => syncFiles(useEntityStore.getState().recalculateEconomy({}));
const serialise = (files) => Object.fromEntries(FILES.map((f) => [f, JSON.stringify(files[f], null, 2)]));
const reload = (text) => useEntityStore.getState().hydrate(workspaceFromFiles(
    Object.fromEntries(FILES.map((f) => [f, JSON.parse(text[f])]))
));

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;
beforeAll(() => {
    storedBefore = globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null;
    useEntityStore.persist.setOptions({ storage: noStorage });
});
beforeEach(() => loadShipped());
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
    expect(globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null).toBe(storedBefore);
});

const SEED = 'item_wheat_seed';
const worksAsField = [{ id: 'stm_cms_field_works', keyword: 'station', payload: { skill: 'farming', stationKind: 'field' } }];

/** A Field Token and a wheat crop it offers, in the store. */
function authorField(fieldBlock) {
    const store = useEntityStore.getState();
    const id = store.addToken({ name: 'Fixture Field', statements: worksAsField, config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] }, ...(fieldBlock ? { field: fieldBlock } : {}) });
    store.addRecipe('farming', { name: 'Fixture Wheat', stationKinds: ['field'], inputs: [{ itemId: SEED, quantity: 1 }], outputs: [{ itemId: 'item_wheat', chance: 100, minQty: 1, maxQty: 1, baseQty: { min: 1, max: 1 }, variable: false }] });
    const pool = useEntityStore.getState().recipePools.farming;
    return { id, recipe: pool[pool.length - 1] };
}

function openToken(id) {
    useEntityStore.getState().setActiveEntity(id, 'token');
    const { container } = render(React.createElement(TokenEditor));
    return { container, block: () => container.querySelector('[data-block="field"]') };
}

describe('the vocabulary comes from the game', () => {
    it('the Field block is a lifecycle block that starts empty; crop terms and kinds are the game\'s', () => {
        expect(TOKEN_LIFECYCLE_BLOCKS).toContain('field');
        expect(makeLifecycleBlock('field')).toEqual({});
        expect(CMS_CROP_DEFAULTS).toBe(CROP_DEFAULTS);
        expect(cmsCropTermsOf).toBe(cropTermsOf);
        expect(CMS_STATION_KINDS).toBe(STATION_KINDS);
    });
});

describe('⭐ the Field block', () => {
    it('added, its sprites and starting crop typed and picked, round-trips; cleared keys leave no trace; removed, no block', () => {
        const { id, recipe } = authorField();
        const { block } = openToken(id);
        fireEvent.click(within(block()).getByText('Add'));
        expect(useEntityStore.getState().tokens[id].field).toEqual({});
        // It lists its crops.
        expect(within(block()).getByText(/Fixture Wheat \(1 h, 10 harvests, sown for 1 /)).toBeTruthy();

        fireEvent.change(within(block()).getByLabelText('Empty sprite'), { target: { value: 't_farmland' } });
        fireEvent.change(within(block()).getByLabelText('Growing sprite'), { target: { value: 't_garden' } });
        fireEvent.change(within(block()).getByLabelText('Starts ripe with'), { target: { value: recipe.id } });
        expect(useEntityStore.getState().tokens[id].field).toEqual({ emptySprite: 't_farmland', growingSprite: 't_garden', startsWith: recipe.id });

        const first = syncPayload();
        expect(first['tokens.json'][id].field).toEqual({ emptySprite: 't_farmland', growingSprite: 't_garden', startsWith: recipe.id });
        const text = serialise(first);
        reload(text);
        const second = syncPayload();
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(text[f]);

        cleanup();
        const again = openToken(id);
        fireEvent.change(within(again.block()).getByLabelText('Growing sprite'), { target: { value: '' } });
        fireEvent.change(within(again.block()).getByLabelText('Starts ripe with'), { target: { value: '' } });
        expect(useEntityStore.getState().tokens[id].field).toEqual({ emptySprite: 't_farmland' });

        fireEvent.click(within(again.block()).getByText('Remove'));
        // Removing writes undefined, which the file omits.
        expect(JSON.stringify(syncPayload()['tokens.json'][id])).not.toContain('"field"');
    });

    it('an empty Field block survives sync as an empty block', () => {
        const { id } = authorField({});
        expect(syncPayload()['tokens.json'][id].field).toEqual({});
    });

    it('a Token that works as nothing is told it needs a Works as rule', () => {
        const id = useEntityStore.getState().addToken({ name: 'Fixture Bare Field', field: {} });
        const { block } = openToken(id);
        expect(within(block()).getByText(/works as a station/i)).toBeTruthy();
    });
});

describe('⭐ the Crop row on a recipe a Field offers', () => {
    /** The editor opened on Farming, on the given recipe. */
    function openRecipe(recipeId) {
        useEntityStore.getState().focusRecipe(recipeId);
        const { container } = render(React.createElement(RecipeEditor));
        return () => container.querySelector('[data-testid="crop-row"]');
    }

    it('shows the game\'s defaults until edited; grow time, load and ripe sprite write a crop block that round-trips', () => {
        const { recipe } = authorField({});
        const row = openRecipe(recipe.id);
        expect(row()).toBeTruthy();
        expect(within(row()).getByLabelText('Grows for (min)').value).toBe('60');
        expect(within(row()).getByLabelText('Load (harvests)').value).toBe('10');
        expect(within(row()).getByText(/Grown on Fixture Field/)).toBeTruthy();
        const crop = () => useEntityStore.getState().recipePools.farming.find((r) => r.id === recipe.id).crop;
        expect(crop()).toBeUndefined();

        fireEvent.change(within(row()).getByLabelText('Grows for (min)'), { target: { value: '90' } });
        expect(crop()).toEqual({ growMs: 5400000, load: 10 });
        fireEvent.change(within(row()).getByLabelText('Load (harvests)'), { target: { value: '12' } });
        fireEvent.change(within(row()).getByLabelText('Ripe sprite'), { target: { value: 't_field_wheat' } });
        expect(crop()).toEqual({ growMs: 5400000, load: 12, ripeSprite: 't_field_wheat' });

        const first = syncPayload();
        expect(first['tokenRecipes.json'].find((r) => r.id === recipe.id).crop).toEqual({ growMs: 5400000, load: 12, ripeSprite: 't_field_wheat' });
        const text = serialise(first);
        reload(text);
        const second = syncPayload();
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(text[f]);

        // Clearing the sprite leaves no key.
        cleanup();
        const again = openRecipe(recipe.id);
        fireEvent.change(within(again()).getByLabelText('Ripe sprite'), { target: { value: '' } });
        expect(crop()).toEqual({ growMs: 5400000, load: 12 });
    });

    it('a recipe no Field offers shows no Crop row', () => {
        useEntityStore.getState().addRecipe('farming', { name: 'Fixture Not A Crop', stationKinds: ['windmill'] });
        const pool = useEntityStore.getState().recipePools.farming;
        const row = openRecipe(pool[pool.length - 1].id);
        expect(screen.getByDisplayValue('Fixture Not A Crop')).toBeTruthy();
        expect(row()).toBeNull();
    });

    it('shipped recipes are written without a crop block', () => {
        expect(syncPayload()['tokenRecipes.json'].every((r) => !('crop' in r))).toBe(true);
    });
});
