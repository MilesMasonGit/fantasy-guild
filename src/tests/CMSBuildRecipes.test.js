// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup, fireEvent, within, screen } from '@testing-library/react';

import { useEntityStore, makeTokenOutputEntry } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import RecipeEditor from '../../cms/src/components/editors/RecipeEditor.jsx';

/**
 * Token Lifecycle slice 4.3 — the CMS authors a recipe that builds (§3.1):
 * a Construction/Farming recipe with `foundationKinds`, one `tokenId` output,
 * its inputs as the building cost and `durationMs` as the build time.
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'maps.json', 'tokenRecipes.json', 'effects.json'];
const read = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));

function loadShipped() {
    const files = Object.fromEntries(FILES.map((f) => [f, read(f)]));
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    useEntityStore.getState().hydrate({
        items: files['items.json'],
        tokens: files['tokens.json'],
        maps: files['maps.json'],
        effects: files['effects.json'],
        recipePools,
    });
}

function syncPayload() {
    return syncFiles(useEntityStore.getState().recalculateEconomy({}));
}

/** A fixture Furnace, a Stone Foundation, a stone item and "Build Furnace". */
function authorBuildFurnace() {
    const store = useEntityStore.getState();
    const stone = store.addItem({ name: 'Fixture Build Stone' });
    const furnace = store.addToken({ name: 'Fixture Build Furnace' });
    const foundation = store.addToken({ name: 'Fixture Build Stone Foundation' });
    useEntityStore.getState().updateToken(foundation, { foundation: { kind: 'stone', skill: 'construction' } });
    const index = useEntityStore.getState().addRecipe('construction', {
        name: 'Build Furnace',
        levelRequirement: 3,
        foundationKinds: ['stone'],
        inputs: [{ itemId: stone, quantity: 5 }],
        outputs: [makeTokenOutputEntry(furnace)],
        durationMs: 30000,
        xp: 10,
    });
    const recipe = useEntityStore.getState().recipePools.construction[index];
    return { stone, furnace, foundation, index, recipe };
}

beforeEach(() => loadShipped());
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

describe('A recipe that builds syncs intact', () => {
    it('Build Furnace authored in the store reaches tokenRecipes.json unchanged', () => {
        const { recipe } = authorBuildFurnace();
        const written = syncPayload()['tokenRecipes.json'].find((r) => r.id === recipe.id);

        expect(written).toBeTruthy();
        expect(written.skill).toBe('construction');
        expect(written.foundationKinds).toEqual(['stone']);
        expect(written.levelRequirement).toBe(3);
        expect(written.inputs).toEqual(recipe.inputs);
        expect(written.outputs).toEqual(recipe.outputs);
        expect(written.durationMs).toBe(30000);
        // Nothing added, nothing lost.
        expect(JSON.parse(JSON.stringify(written))).toEqual(JSON.parse(JSON.stringify(recipe)));
    });

    it('the Foundation Token carries its block through the same sync', () => {
        const { foundation } = authorBuildFurnace();
        const tokens = syncPayload()['tokens.json'];
        expect(tokens[foundation].foundation).toEqual({ kind: 'stone', skill: 'construction' });
    });
});

describe('Renaming a Token repoints tokenId outputs', () => {
    it('in a pooled recipe', () => {
        const { furnace, recipe } = authorBuildFurnace();
        useEntityStore.getState().renameEntityId(furnace, 'token_fixture_kiln_renamed', 'token');

        const after = useEntityStore.getState().recipePools.construction.find((r) => r.id === recipe.id);
        expect(after.outputs).toEqual([makeTokenOutputEntry('token_fixture_kiln_renamed')]);
        expect(useEntityStore.getState().tokens.token_fixture_kiln_renamed).toBeTruthy();
    });

    it('in a Token’s config outputs, leaving item outputs alone', () => {
        const store = useEntityStore.getState();
        const target = store.addToken({ name: 'Fixture Drop Target' });
        const bearer = store.addToken({ name: 'Fixture Dropper' });
        const itemOut = { itemId: 'item_fixture_unrelated', chance: 100, minQty: 1, maxQty: 1 };
        const current = useEntityStore.getState().tokens[bearer];
        useEntityStore.getState().updateToken(bearer, {
            config: { ...(current.config || {}), outputs: [itemOut, makeTokenOutputEntry(target)] },
        });

        useEntityStore.getState().renameEntityId(target, 'token_fixture_drop_renamed', 'token');
        const outputs = useEntityStore.getState().tokens[bearer].config.outputs;
        expect(outputs).toEqual([itemOut, makeTokenOutputEntry('token_fixture_drop_renamed')]);
    });

    it('leaves recipes that do not name the Token untouched (same object)', () => {
        const before = useEntityStore.getState().recipePools;
        const id = useEntityStore.getState().addToken({ name: 'Fixture Unreferenced' });
        const pools = useEntityStore.getState().recipePools;
        expect(pools).toBe(before);
        useEntityStore.getState().renameEntityId(id, 'token_fixture_unreferenced_2', 'token');
        expect(useEntityStore.getState().recipePools).toBe(pools);
    });
});

/** Empty the store's Construction pool (the shipped 7.5 building recipes); the store is this test's own. */
const clearConstructionPool = () =>
    useEntityStore.setState((s) => ({ recipePools: { ...s.recipePools, construction: [] } }));

describe('The Recipe editor’s building flow', () => {
    it('ticking a Foundation kind swaps Outputs for a single Token picker', () => {
        const store = useEntityStore.getState();
        const furnace = store.addToken({ name: 'Fixture Editor Furnace' });
        // Construction ships building recipes since slice 7.5; empty this
        // store's copy of the pool so the new recipe is the active one.
        clearConstructionPool();
        expect(useEntityStore.getState().recipePools.construction || []).toHaveLength(0);
        useEntityStore.getState().addRecipe('construction', { name: 'Build It' });

        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click(screen.getByText('Construction'));
        expect(container.querySelector('[data-testid="builds-column"]')).toBeNull();
        expect(screen.getByText('Cycle Time (ms)')).toBeTruthy();

        const row = container.querySelector('[data-testid="foundation-kinds"]');
        fireEvent.click(within(row).getByLabelText('Stone'));
        expect(useEntityStore.getState().recipePools.construction[0].foundationKinds).toEqual(['stone']);

        const column = container.querySelector('[data-testid="builds-column"]');
        expect(column).toBeTruthy();
        expect(screen.getByText('Build Time (ms)')).toBeTruthy();
        expect(screen.getByText('Building cost')).toBeTruthy();

        fireEvent.change(within(column).getByLabelText('Builds Token'), { target: { value: furnace } });
        expect(useEntityStore.getState().recipePools.construction[0].outputs).toEqual([makeTokenOutputEntry(furnace)]);

        // Unticking returns it to an ordinary recipe; the field is removed.
        fireEvent.click(within(row).getByLabelText('Stone'));
        expect(useEntityStore.getState().recipePools.construction[0].foundationKinds).toBeUndefined();
        expect(container.querySelector('[data-testid="builds-column"]')).toBeNull();
    });

    it('warns when a ticked kind’s Foundations are built with another skill', () => {
        const store = useEntityStore.getState();
        const farmland = store.addToken({ name: 'Fixture Editor Farmland' });
        useEntityStore.getState().updateToken(farmland, { foundation: { kind: 'farmland', skill: 'farming' } });
        clearConstructionPool();
        useEntityStore.getState().addRecipe('construction', { name: 'Wrong Skill', foundationKinds: ['farmland'] });

        render(React.createElement(RecipeEditor));
        fireEvent.click(screen.getByText('Construction'));
        // The shipped Farmland (7.4) is named alongside the fixture one.
        expect(screen.getByText(/Fixture Editor Farmland (is|are) built with Farming, not Construction/)).toBeTruthy();
    });
});
