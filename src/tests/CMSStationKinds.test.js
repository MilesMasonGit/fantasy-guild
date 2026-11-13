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
 * A recipe's "Made at" station kinds and a station's kind on its `Works as` rule in the CMS, each
 * carried through Recalculate, Sync and a reload unchanged. Only Farming offers kinds now; the craft
 * skills' old ones are retired (one building per skill) and shown as leftovers to clear.
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

/** A fresh recipe of a skill, alone in its pool, the active one when the editor opens on that skill. */
function authorRecipe(skill, extra = {}) {
    useEntityStore.setState((s) => ({ recipePools: { ...s.recipePools, [skill]: [] } }));
    useEntityStore.getState().addRecipe(skill, { name: 'Fixture Recipe', ...extra });
    return useEntityStore.getState().recipePools[skill][0];
}
/** A fresh Alchemy recipe (Alchemy ships none). */
const authorAlchemyRecipe = (extra = {}) => authorRecipe('alchemy', extra);

describe('a recipe\'s station kinds', () => {
    it('ticking Made at writes stationKinds; unticking every kind removes the field (Farming)', () => {
        authorRecipe('farming');
        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click(screen.getByText('Farming'));
        const row = () => container.querySelector('[data-testid="station-kinds"]');
        expect(row()).toBeTruthy();

        fireEvent.click(within(row()).getByLabelText('Field'));
        expect(useEntityStore.getState().recipePools.farming[0].stationKinds).toEqual(['field']);
        fireEvent.click(within(row()).getByLabelText('Herb Garden'));
        expect(useEntityStore.getState().recipePools.farming[0].stationKinds).toEqual(['field', 'herb_garden']);

        fireEvent.click(within(row()).getByLabelText('Field'));
        fireEvent.click(within(row()).getByLabelText('Herb Garden'));
        expect(useEntityStore.getState().recipePools.farming[0].stationKinds).toBeUndefined();
    });

    it('a skill with one building has no kinds to tick: every building of it offers the recipe', () => {
        authorAlchemyRecipe();
        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click(screen.getByText('Alchemy'));
        const row = container.querySelector('[data-testid="station-kinds"]');
        expect(within(row).queryAllByRole('checkbox')).toEqual([]);
        expect(row.textContent).toContain('Every Alchemy building offers it');
        // Today's Alchemy Table still offers it: its old kind narrows nothing.
        expect(within(row).getByTestId('station-kinds-offered').textContent).toBe('Offered by: Alchemy Table');
    });

    it('a recipe still marked for a retired kind says so, and Clear removes it', () => {
        authorAlchemyRecipe({ stationKinds: ['alchemy_table'] });
        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click(screen.getByText('Alchemy'));
        const warning = container.querySelector('[data-testid="station-kinds-retired"]');
        expect(warning.textContent).toContain('Alchemy Table');
        fireEvent.click(within(warning).getByText('Clear'));
        expect(useEntityStore.getState().recipePools.alchemy[0].stationKinds).toBeUndefined();
        expect(container.querySelector('[data-testid="station-kinds-retired"]')).toBeNull();
    });

    it('a building recipe shows no Made at row', () => {
        useEntityStore.setState((s) => ({ recipePools: { ...s.recipePools, construction: [] } }));
        useEntityStore.getState().addRecipe('construction', { name: 'Build It', foundationKinds: ['wood'] });
        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click(screen.getByText('Construction'));
        expect(container.querySelector('[data-testid="station-kinds"]')).toBeNull();
    });

    it('stationKinds survive sync and a reload unchanged, a retired kind too (the content pack clears it, not Sync)', () => {
        for (const kinds of [['herb_garden'], ['summoning_circle']]) {
            const recipe = authorRecipe(kinds[0] === 'herb_garden' ? 'farming' : 'alchemy', { stationKinds: kinds });
            const first = syncPayload();
            const written = first['tokenRecipes.json'].find((r) => r.id === recipe.id);
            expect(written.stationKinds).toEqual(kinds);

            reload(first);
            const second = syncPayload();
            expect(second['tokenRecipes.json'].find((r) => r.id === recipe.id)).toEqual(written);
            loadShipped();
        }
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
    const kindSelect = (container) => within(container.querySelector('[data-testid="station-kind"]')).getByLabelText('Station kind');

    it('the Token editor\'s Station kind writes the kind beside the skill, sharing no entry with another station', () => {
        useEntityStore.getState().setActiveEntity('token_wheat_field', 'token');
        const { container } = render(React.createElement(TokenEditor));
        const select = kindSelect(container);
        fireEvent.change(select, { target: { value: 'herb_garden' } });

        expect(stationSkillOf(expanded('token_wheat_field'))).toBe('farming');
        expect(stationKindOf(expanded('token_wheat_field'))).toBe('herb_garden');
        // The shared Field entry is untouched: the Wild Wheat Patch is still a Field.
        expect(stationKindOf(expanded('token_wild_wheat_patch'))).toBe('field');

        fireEvent.change(select, { target: { value: '' } });
        expect(stationKindOf(expanded('token_wheat_field'))).toBeNull();
        expect(stationSkillOf(expanded('token_wheat_field'))).toBe('farming');
    });

    it('a Farming station offers Farming\'s kinds; a Smithing one only Any station, and its old kind as retired', () => {
        useEntityStore.getState().setActiveEntity('token_wheat_field', 'token');
        const farming = render(React.createElement(TokenEditor));
        const offered = (select) => within(select).getAllByRole('option').map((o) => o.textContent);
        expect(offered(kindSelect(farming.container))).toEqual(['Any station (every Farming recipe)', 'Field', 'Herb Garden', 'Windmill']);
        cleanup();

        useEntityStore.getState().setActiveEntity('token_furnace', 'token');
        const { container } = render(React.createElement(TokenEditor));
        expect(offered(kindSelect(container))).toEqual(['Any station (every Smithing recipe)', 'Furnace (retired)']);
        expect(container.textContent).toContain('Furnace is a retired station kind, which narrows nothing');

        fireEvent.change(kindSelect(container), { target: { value: '' } });
        expect(stationKindOf(expanded('token_furnace'))).toBeNull();
        expect(stationSkillOf(expanded('token_furnace'))).toBe('smithing');
        // Cleared, it shares the skill's own entry, as a skill's building does.
        expect(useEntityStore.getState().tokens.token_furnace.effects.map((e) => e.effectId)).toContain('effect_smithing_station');
        expect(offered(kindSelect(container))).toEqual(['Any station (every Smithing recipe)']);
    });

    it('a station kind survives sync and a reload unchanged', () => {
        useEntityStore.getState().setTokenPooling('token_windmill', 'farming', 'field');
        const first = syncPayload();
        reload(first);
        expect(stationKindOf(expanded('token_windmill'))).toBe('field');
        const second = syncPayload();
        expect(second['tokens.json'].token_windmill).toEqual(first['tokens.json'].token_windmill);
        expect(second['effects.json']).toEqual(first['effects.json']);
    });

    it('the Rules line offers the skill\'s kinds as an optional slot and says it', () => {
        const slotOf = (statement) => slotsOf(statement).find((s) => s.id === 'stationKind');
        const farming = { id: 'stm_x', keyword: KEYWORD.STATION, payload: { skill: 'farming' } };
        const slot = slotOf(farming);
        expect(slot.optional).toBe(true);
        expect(slot.options.map((o) => o.id)).toEqual(['', 'field', 'herb_garden', 'windmill']);
        const kinded = { ...farming, ...slot.patch('herb_garden') };
        expect(kinded.payload).toEqual({ skill: 'farming', stationKind: 'herb_garden' });
        expect(renderSegments(kinded).map((s) => s.text).join('')).toBe('Works as a Farming station: Herb Garden.');
        expect(slot.patch('').payload).toEqual({ skill: 'farming' });
        expect(renderSegments(farming).map((s) => s.text).join('')).toBe('Works as a Farming station.');

        const smithing = { id: 'stm_y', keyword: KEYWORD.STATION, payload: { skill: 'smithing' } };
        expect(slotOf(smithing).options.map((o) => o.id)).toEqual(['']);
        const old = { ...smithing, payload: { skill: 'smithing', stationKind: 'smithy' } };
        expect(slotOf(old).options.map((o) => [o.id, o.label])).toEqual([['', 'Any station'], ['smithy', 'Smithy (retired)']]);
        expect(renderSegments(old).map((s) => s.text).join('')).toBe('Works as a Smithing station: Smithy.');
    });
});

describe('the content audit', () => {
    it('passes Farming\'s kinds, warns of a retired one and reports an unknown one, on a recipe or a station', () => {
        const station = (kind, skill = 'smithing') => ({
            id: 't', name: 'T', statements: [{ id: 's', keyword: KEYWORD.STATION, payload: { skill, stationKind: kind } }]
        });
        const recipe = (kinds, skill = 'smithing') => ({ id: 'r', name: 'R', skill, stationKinds: kinds, outputs: [] });
        const fields = (tokens, recipes) => auditLifecycleBlocks({ tokens, recipes, items: {}, skills: ['smithing', 'farming'] })
            .filter((e) => e.field === 'stationKind' || e.field === 'stationKinds')
            .map((e) => e.severity);

        expect(fields({ t: station('field', 'farming') }, [recipe(['herb_garden'], 'farming')])).toEqual([]);
        expect(fields({ t: station('furnace') }, [])).toEqual(['warning']);
        expect(fields({}, [recipe(['smithy'])])).toEqual(['warning']);
        expect(fields({ t: station('forge') }, [])).toEqual(['error']);
        expect(fields({}, [recipe(['anvil'])])).toEqual(['error']);
        expect(fields({}, [recipe('smithy')])).toEqual(['error']);
    });
});
