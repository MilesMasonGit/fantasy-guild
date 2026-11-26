// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import { useEntityStore, makeLifecycleBlock, TOKEN_LIFECYCLE_BLOCKS } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';
import { composeTokenDescription } from '../../cms/src/engine/descriptionDictionary.js';
import {
    shrineOf as cmsShrineOf, offeringTermsOf as cmsOfferingTermsOf, SHRINE_DEFAULTS as CMS_SHRINE_DEFAULTS
} from '../../cms/src/utils/constants';
import { shrineOf, offeringTermsOf, SHRINE_DEFAULTS } from '../config/registries/tokenConstants.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import RecipeEditor from '../../cms/src/components/editors/RecipeEditor.jsx';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * Brief 810 K3 in the CMS: a Token's Shrine block (the most it can be lit) and an offering recipe's
 * Offering row (how long one keeps the shrine lit), each carried through Recalculate, Sync and a
 * reload exactly as written; Can't Run Out authored as a chance; the content audit's lines on
 * shrines, offerings and blessings worn by something that is not a shrine.
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

const OFFERING_ITEM = 'item_oak_wood';
const worksAsShrine = { id: 'stm_cms_shrine_works', keyword: 'station', payload: { skill: 'faith', stationKind: 'shrine' } };
const nature = {
    id: 'stm_cms_shrine_nature', keyword: 'provides', to: { mode: 'all', value: '' }, reach: 'nearby',
    payload: { type: EFFECT_TYPES.NEVER_RUNS_OUT, bucket: 'flat', value: 100 }
};

/** A shrine Token and an offering it burns, in the store. */
function authorShrine(shrineBlock, statements = [worksAsShrine, nature]) {
    const store = useEntityStore.getState();
    const id = store.addToken({
        name: 'Fixture Shrine', statements,
        config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] },
        ...(shrineBlock ? { shrine: shrineBlock } : {})
    });
    store.addRecipe('faith', { name: 'Fixture Offering', stationKinds: ['shrine'], inputs: [{ itemId: OFFERING_ITEM, quantity: 2 }], outputs: [] });
    const pool = useEntityStore.getState().recipePools.faith;
    return { id, recipe: pool[pool.length - 1] };
}

function openToken(id) {
    useEntityStore.getState().setActiveEntity(id, 'token');
    const { container } = render(React.createElement(TokenEditor));
    return { container, block: () => container.querySelector('[data-block="shrine"]') };
}

describe('the vocabulary comes from the game', () => {
    it('the Shrine block is a lifecycle block that starts at the game\'s default; its terms are the game\'s', () => {
        expect(TOKEN_LIFECYCLE_BLOCKS).toContain('shrine');
        expect(makeLifecycleBlock('shrine')).toEqual({ maxLitMs: SHRINE_DEFAULTS.maxLitMs });
        expect(cmsShrineOf).toBe(shrineOf);
        expect(cmsOfferingTermsOf).toBe(offeringTermsOf);
        expect(CMS_SHRINE_DEFAULTS).toBe(SHRINE_DEFAULTS);
    });
});

describe('⭐ the Shrine block', () => {
    it('added, its most lit time typed, round-trips; it lists its offerings; removed, no block', () => {
        const { id } = authorShrine();
        const { block } = openToken(id);
        fireEvent.click(within(block()).getByText('Add'));
        expect(useEntityStore.getState().tokens[id].shrine).toEqual({ maxLitMs: SHRINE_DEFAULTS.maxLitMs });
        expect(within(block()).getByText(/Fixture Offering \(2 Oak Wood, lit 1 min\)/)).toBeTruthy();
        expect(within(block()).getByText(/rule is its blessing, on only while it is lit/)).toBeTruthy();

        fireEvent.change(within(block()).getByLabelText('Lit at most (min)'), { target: { value: '4' } });
        expect(useEntityStore.getState().tokens[id].shrine).toEqual({ maxLitMs: 240_000 });

        const first = syncPayload();
        expect(first['tokens.json'][id].shrine).toEqual({ maxLitMs: 240_000 });
        const text = serialise(first);
        reload(text);
        const second = syncPayload();
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(text[f]);

        cleanup();
        const again = openToken(id);
        fireEvent.click(within(again.block()).getByText('Remove'));
        expect(JSON.stringify(syncPayload()['tokens.json'][id])).not.toContain('"shrine"');
    });

    it('a shrine with no rule but its Works as is told to give it a blessing', () => {
        const { id } = authorShrine({ maxLitMs: 60_000 }, [worksAsShrine]);
        const { block } = openToken(id);
        expect(within(block()).getByText(/no rule yet: give it a blessing/)).toBeTruthy();
    });

    it('its description says it is a shrine', () => {
        const { id } = authorShrine({ maxLitMs: 60_000 });
        expect(composeTokenDescription(useEntityStore.getState().tokens[id])).toMatch(/A shrine: its blessing holds only while it is lit/);
    });
});

describe('⭐ the Offering row on a recipe a shrine burns', () => {
    function openRecipe(recipeId) {
        useEntityStore.getState().focusRecipe(recipeId);
        const { container } = render(React.createElement(RecipeEditor));
        return () => container.querySelector('[data-testid="offering-row"]');
    }

    it('shows the game\'s default until edited; its lit time writes an offering block that round-trips', () => {
        const { recipe } = authorShrine({ maxLitMs: 600_000 });
        const row = openRecipe(recipe.id);
        expect(row()).toBeTruthy();
        // The shipped Nature Shrine burns the same offerings, so it may be named beside the fixture's.
        expect(within(row()).getByText(/Burned at (.+, )?Fixture Shrine(?![a-z])/)).toBeTruthy();
        expect(within(row()).getByText(/Not yet written/)).toBeTruthy();
        fireEvent.change(within(row()).getByLabelText('Keeps it lit for (s)'), { target: { value: '90' } });
        const written = useEntityStore.getState().recipePools.faith.find((r) => r.id === recipe.id);
        expect(written.offering).toEqual({ litMs: 90_000 });

        const first = syncPayload();
        expect(first['tokenRecipes.json'].find((r) => r.id === recipe.id).offering).toEqual({ litMs: 90_000 });
        const text = serialise(first);
        reload(text);
        const second = syncPayload();
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(text[f]);
    });

    it('a recipe no shrine burns has no Offering row', () => {
        const store = useEntityStore.getState();
        store.addRecipe('faith', { name: 'Fixture Candle', stationKinds: ['altar'], inputs: [], outputs: [{ itemId: OFFERING_ITEM, chance: 100, minQty: 1, maxQty: 1 }] });
        authorShrine({ maxLitMs: 600_000 });
        const candle = useEntityStore.getState().recipePools.faith.find((r) => r.name === 'Fixture Candle');
        expect(openRecipe(candle.id)()).toBeNull();
    });
});

describe('Can\'t Run Out is authored as a chance', () => {
    it('its rule offers an amount and what it reaches; picking it starts at 100, never running out, while Echo starts at no chance', () => {
        const ids = slotsOf(nature, { onToken: true }).map((s) => s.id);
        expect(ids).toContain('value');
        expect(ids).toContain('category');
        const echo = { ...nature, payload: { type: EFFECT_TYPES.ECHO, bucket: 'flat', value: 10 } };
        const typeSlot = slotsOf(echo, { onToken: true }).find((s) => s.id === 'type');
        expect(typeSlot.patch(EFFECT_TYPES.NEVER_RUNS_OUT)).toEqual({ payload: { type: EFFECT_TYPES.NEVER_RUNS_OUT, bucket: 'flat', value: 100 } });
        expect(typeSlot.patch(EFFECT_TYPES.ECHO)).toEqual({ payload: { type: EFFECT_TYPES.ECHO, bucket: 'flat', value: 0 } });
    });
});

describe('the content audit on shrines, offerings and blessings', () => {
    const shrine = (extra = {}) => ({
        id: 'token_fx_shrine', name: 'FX Shrine', statements: [worksAsShrine, nature], shrine: { maxLitMs: 60_000 }, ...extra
    });
    const offering = (extra = {}) => ({
        id: 'recipe_fx_offer', name: 'FX Offer', skill: 'faith', stationKinds: ['shrine'],
        inputs: [{ itemId: OFFERING_ITEM, quantity: 1 }], outputs: [], offering: { litMs: 30_000 }, ...extra
    });
    const findings = (tokens, recipes = [offering()]) => auditLifecycleBlocks({
        tokens: Object.fromEntries(tokens.map((t) => [t.id, t])), items: { [OFFERING_ITEM]: { id: OFFERING_ITEM } }, recipes, skills: ['faith', 'mining']
    }).map((f) => `${f.severity}: ${f.message}`);

    it('a finished shrine says nothing', () => {
        expect(findings([shrine()])).toEqual([]);
    });

    it('a shrine that works as nothing is an error; one with no offering, or no blessing, a warning', () => {
        expect(findings([shrine({ statements: [nature] })]).join('\n')).toMatch(/error: .*is a shrine but works as no station/);
        expect(findings([shrine()], []).join('\n')).toMatch(/warning: .*no "?faith"? recipe made at a Shrine is an offering yet/);
        expect(findings([shrine({ statements: [worksAsShrine] })]).join('\n')).toMatch(/warning: .*no rule but its Works as/);
    });

    it('an offering longer than the shrine\'s most is a warning: it is offered only while the shrine is out', () => {
        expect(findings([shrine()], [offering({ offering: { litMs: 90_000 } })]).join('\n')).toMatch(/warning: .*less than one FX Offer \(90 s\)/);
    });

    it('an offering with no inputs, or with outputs, is a warning; a broken lit time an error', () => {
        expect(findings([shrine()], [offering({ inputs: [] })]).join('\n')).toMatch(/warning: .*offering with no inputs/);
        expect(findings([shrine()], [offering({ outputs: [{ itemId: OFFERING_ITEM, chance: 100 }] })]).join('\n')).toMatch(/warning: .*offering that also makes something/);
        expect(findings([shrine()], [offering({ offering: { litMs: 5 } })]).join('\n')).toMatch(/error: .*offering lit time is 5/);
    });

    it('a blessing on a Token that is not a shrine is a warning', () => {
        const support = { id: 'token_fx_well', name: 'FX Well', statements: [{ ...nature, id: 'stm_fx_well' }] };
        expect(findings([shrine(), support]).join('\n')).toMatch(/warning: FX Well \(token_fx_well\): carries Can't Run Out, a shrine’s blessing, but is not a shrine/);
    });
});

describe('the statement keyword stays the game\'s', () => {
    it('a shrine\'s Works as is a station rule', () => {
        expect(worksAsShrine.keyword).toBe(KEYWORD.STATION);
    });
});
