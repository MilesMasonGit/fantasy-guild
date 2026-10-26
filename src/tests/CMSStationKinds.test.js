// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup, fireEvent, within, screen } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { expandBearer, stationKindOf, stationSkillOf, slotsOf, renderSegments, KEYWORD } from '../../cms/src/utils/constants';
import RecipeEditor from '../../cms/src/components/editors/RecipeEditor.jsx';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';

/**
 * Brief 230 S6a in the CMS: a recipe's "Made at" station kinds and a station's kind on its
 * `Works as` rule, each carried through Recalculate, Sync and a reload unchanged.
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
const asFile = (files) => Object.fromEntries(FILES.map((f) => [f, JSON.parse(JSON.stringify(files[f], null, 2))]));
const reload = (files) => useEntityStore.getState().hydrate(workspaceFromFiles(asFile(files)));

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

/** A fresh Alchemy recipe (Alchemy ships none), the active one when the editor opens on Alchemy. */
function authorAlchemyRecipe(extra = {}) {
    useEntityStore.setState((s) => ({ recipePools: { ...s.recipePools, alchemy: [] } }));
    useEntityStore.getState().addRecipe('alchemy', { name: 'Fixture Tonic', ...extra });
    return useEntityStore.getState().recipePools.alchemy[0];
}

describe('a recipe\'s station kinds', () => {
    it('ticking Made at writes stationKinds; unticking every kind removes the field', () => {
        authorAlchemyRecipe();
        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click(screen.getByText('Alchemy'));
        const row = () => container.querySelector('[data-testid="station-kinds"]');
        expect(row()).toBeTruthy();

        fireEvent.click(within(row()).getByLabelText('Alchemy Table'));
        expect(useEntityStore.getState().recipePools.alchemy[0].stationKinds).toEqual(['alchemy_table']);
        fireEvent.click(within(row()).getByLabelText('Summoning Circle'));
        expect(useEntityStore.getState().recipePools.alchemy[0].stationKinds).toEqual(['alchemy_table', 'summoning_circle']);

        fireEvent.click(within(row()).getByLabelText('Alchemy Table'));
        fireEvent.click(within(row()).getByLabelText('Summoning Circle'));
        expect(useEntityStore.getState().recipePools.alchemy[0].stationKinds).toBeUndefined();
    });

    it('a building recipe shows no Made at row', () => {
        useEntityStore.setState((s) => ({ recipePools: { ...s.recipePools, construction: [] } }));
        useEntityStore.getState().addRecipe('construction', { name: 'Build It', foundationKinds: ['wood'] });
        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click(screen.getByText('Construction'));
        expect(container.querySelector('[data-testid="station-kinds"]')).toBeNull();
    });

    it('stationKinds survive sync and a reload unchanged', () => {
        const recipe = authorAlchemyRecipe({ stationKinds: ['summoning_circle'] });
        const first = syncPayload();
        const written = first['tokenRecipes.json'].find((r) => r.id === recipe.id);
        expect(written.stationKinds).toEqual(['summoning_circle']);

        reload(first);
        const second = syncPayload();
        expect(second['tokenRecipes.json'].find((r) => r.id === recipe.id)).toEqual(written);
    });

    it('a shipped recipe with no kinds is written with no stationKinds field; one with kinds keeps them', () => {
        const shipped = Object.fromEntries(JSON.parse(raw['tokenRecipes.json']).map((r) => [r.id, r]));
        const written = syncPayload()['tokenRecipes.json'];
        const kindless = written.filter((r) => !shipped[r.id].stationKinds);
        expect(kindless.length).toBeGreaterThan(0);
        for (const r of kindless) expect('stationKinds' in r, r.id).toBe(false);
        for (const r of written.filter((w) => shipped[w.id].stationKinds)) {
            expect(r.stationKinds, r.id).toEqual(shipped[r.id].stationKinds);
        }
    });
});

describe('a station\'s kind on its Works as rule', () => {
    const expanded = (id) => {
        const s = useEntityStore.getState();
        return expandBearer(s.tokens[id], s.effects);
    };

    it('the Token editor\'s Station kind writes the kind beside the skill, sharing no entry with a kindless station', () => {
        useEntityStore.getState().setActiveEntity('token_furnace', 'token');
        const { container } = render(React.createElement(TokenEditor));
        const select = within(container.querySelector('[data-testid="station-kind"]')).getByLabelText('Station kind');
        fireEvent.change(select, { target: { value: 'furnace' } });

        expect(stationSkillOf(expanded('token_furnace'))).toBe('smithing');
        expect(stationKindOf(expanded('token_furnace'))).toBe('furnace');
        // The shared Smithing Station entry is untouched: no other Token became a Furnace.
        const effects = useEntityStore.getState().effects;
        expect(effects.effect_smithing_station.statements[0].payload).toEqual({ skill: 'smithing' });

        fireEvent.change(select, { target: { value: '' } });
        expect(stationKindOf(expanded('token_furnace'))).toBeNull();
        expect(stationSkillOf(expanded('token_furnace'))).toBe('smithing');
    });

    it('a station kind survives sync and a reload unchanged', () => {
        useEntityStore.getState().setTokenPooling('token_furnace', 'smithing', 'furnace');
        const first = syncPayload();
        reload(first);
        expect(stationKindOf(expanded('token_furnace'))).toBe('furnace');
        const second = syncPayload();
        expect(second['tokens.json'].token_furnace).toEqual(first['tokens.json'].token_furnace);
        expect(second['effects.json']).toEqual(first['effects.json']);
    });

    it('the Rules line offers the kind as an optional slot and says it', () => {
        const statement = { id: 'stm_x', keyword: KEYWORD.STATION, payload: { skill: 'smithing' } };
        const slot = slotsOf(statement).find((s) => s.id === 'stationKind');
        expect(slot.optional).toBe(true);
        expect(slot.options.map((o) => o.id)).toEqual(expect.arrayContaining(['', 'furnace', 'smithy']));
        const kinded = { ...statement, ...slot.patch('smithy') };
        expect(kinded.payload).toEqual({ skill: 'smithing', stationKind: 'smithy' });
        expect(renderSegments(kinded).map((s) => s.text).join('')).toBe('Works as a Smithing station: Smithy.');
        expect(slot.patch('').payload).toEqual({ skill: 'smithing' });
        expect(renderSegments(statement).map((s) => s.text).join('')).toBe('Works as a Smithing station.');
    });
});

describe('the content audit', () => {
    it('reports an unknown station kind on a recipe or a station, and passes the known ones', () => {
        const station = (kind) => ({
            id: 't', name: 'T', statements: [{ id: 's', keyword: KEYWORD.STATION, payload: { skill: 'smithing', stationKind: kind } }]
        });
        const recipe = (kinds) => ({ id: 'r', name: 'R', skill: 'smithing', stationKinds: kinds, outputs: [] });
        const fields = (tokens, recipes) => auditLifecycleBlocks({ tokens, recipes, items: {}, skills: ['smithing'] })
            .filter((e) => e.field === 'stationKind' || e.field === 'stationKinds');

        expect(fields({ t: station('furnace') }, [recipe(['smithy'])])).toEqual([]);
        expect(fields({ t: station('forge') }, [])).toHaveLength(1);
        expect(fields({}, [recipe(['anvil'])])).toHaveLength(1);
        expect(fields({}, [recipe('smithy')])).toHaveLength(1);
    });
});
