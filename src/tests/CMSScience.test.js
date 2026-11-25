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
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor.js';
import { masteryFindings as cmsMasteryFindings, masteryTrackOf as cmsTrackOf } from '../../cms/src/utils/constants';
import { masteryFindings } from '../systems/core/masteryRule.js';
import { masteryTrackOf } from '../config/registries/mastery.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import RecipeEditor from '../../cms/src/components/editors/RecipeEditor.jsx';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * Science in the CMS (brief 810 K6): a Laboratory block (the highest node level it studies), a
 * mastery track on a node's Token and on a crop's recipe (ranks of points, effect and scale), each
 * carried through Sync and a reload exactly as written; and the audit lines, the game's own rule in
 * both the boot audit and the Economy Audit.
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

const worksAsLab = [{ id: 'stm_cms_lab_works', keyword: 'station', payload: { skill: 'science', stationKind: 'laboratory' } }];
const YIELD = { id: 'fx_cms_sc_yield', name: 'Fixture Keen', statements: [{ id: 'stm_cms_sc_yield', keyword: 'provides', payload: { type: 'YIELD', bucket: 'percentage', value: 0.1 } }] };
const SPAWN = { id: 'fx_cms_sc_spawn', name: 'Fixture Sprout', statements: [{ id: 'stm_cms_sc_spawn', keyword: 'spawns', payload: { typeId: 'token_oak_tree' } }] };

function openToken(id, key) {
    useEntityStore.getState().setActiveEntity(id, 'token');
    const { container } = render(React.createElement(TokenEditor));
    return () => container.querySelector(`[data-block="${key}"]`);
}

describe('the vocabulary comes from the game', () => {
    it('Laboratory and Mastery are lifecycle blocks; a new Laboratory reaches level 20, a new track has no rank', () => {
        expect(TOKEN_LIFECYCLE_BLOCKS).toEqual(expect.arrayContaining(['laboratory', 'mastery']));
        expect(makeLifecycleBlock('laboratory')).toEqual({ maxLevel: 20 });
        expect(makeLifecycleBlock('mastery')).toEqual({ ranks: [] });
        expect(cmsTrackOf).toBe(masteryTrackOf);
        expect(cmsMasteryFindings).toBe(masteryFindings);
    });
});

describe('⭐ the Laboratory and Mastery blocks on a Token', () => {
    it('a Laboratory\'s level and a node\'s track are written as typed and round-trip through Sync', () => {
        const store = useEntityStore.getState();
        useEntityStore.setState((s) => ({ effects: { ...s.effects, [YIELD.id]: YIELD } }));
        const lab = store.addToken({ name: 'Fixture Lab', statements: worksAsLab, config: { skill: 'science', skillRequired: 1, cycleTimeMs: 4000, xp: 2, inputs: [], outputs: [] } });
        let block = openToken(lab, 'laboratory');
        fireEvent.click(within(block()).getByText('Add'));
        expect(useEntityStore.getState().tokens[lab].laboratory).toEqual({ maxLevel: 20 });
        fireEvent.change(within(block()).getByLabelText('Studies nodes up to level'), { target: { value: '40' } });
        expect(useEntityStore.getState().tokens[lab].laboratory).toEqual({ maxLevel: 40 });
        cleanup();

        block = openToken('token_copper_ore_vein', 'mastery');
        fireEvent.click(within(block()).getByText('Add'));
        fireEvent.click(within(block()).getByText('Add a rank'));
        fireEvent.click(within(block()).getByText('Add a rank'));
        const rows = () => block().querySelectorAll('[data-mastery-row]');
        expect(rows()).toHaveLength(2);
        fireEvent.change(rows()[0].querySelector('[data-mastery-effect]'), { target: { value: YIELD.id } });
        fireEvent.change(rows()[1].querySelector('[data-mastery-points]'), { target: { value: '30' } });
        fireEvent.change(rows()[1].querySelector('[data-mastery-effect]'), { target: { value: YIELD.id } });
        expect(useEntityStore.getState().tokens.token_copper_ore_vein.mastery).toEqual({
            ranks: [{ points: 10, effectId: YIELD.id, scale: 1 }, { points: 30, effectId: YIELD.id, scale: 1 }]
        });
        // Its rule is said under the rank.
        expect(rows()[0].textContent).toMatch(/Yield/);

        const first = syncPayload();
        expect(first['tokens.json'][lab].laboratory).toEqual({ maxLevel: 40 });
        expect(first['tokens.json'].token_copper_ore_vein.mastery.ranks).toHaveLength(2);
        const text = serialise(first);
        reload(text);
        const second = syncPayload();
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(text[f]);

        cleanup();
        block = openToken('token_copper_ore_vein', 'mastery');
        fireEvent.click(within(block()).getByText('Remove'));
        expect(JSON.stringify(syncPayload()['tokens.json'].token_copper_ore_vein)).not.toContain('"mastery"');
    });

    it('a track on a Stump says it belongs on its tree', () => {
        useEntityStore.setState((s) => ({ effects: { ...s.effects, [YIELD.id]: YIELD } }));
        const block = openToken('token_oak_stump', 'mastery');
        fireEvent.click(within(block()).getByText('Add'));
        fireEvent.click(within(block()).getByText('Add a rank'));
        fireEvent.change(block().querySelector('[data-mastery-effect]'), { target: { value: YIELD.id } });
        expect(block().querySelector('[data-mastery-findings]').textContent).toMatch(/grows into Oak Tree, whose kind it counts as/);
    });
});

describe('⭐ the Mastery row on a crop recipe', () => {
    it('a crop takes a track, written on the recipe, which round-trips', () => {
        useEntityStore.setState((s) => ({ effects: { ...s.effects, [YIELD.id]: YIELD } }));
        useEntityStore.getState().focusRecipe('recipe_wheat');
        const { container } = render(React.createElement(RecipeEditor));
        const row = () => container.querySelector('[data-testid="crop-mastery-row"]');
        expect(row()).toBeTruthy();
        fireEvent.click(within(row()).getByText('Add'));
        fireEvent.click(within(row()).getByText('Add a rank'));
        fireEvent.change(row().querySelector('[data-mastery-effect]'), { target: { value: YIELD.id } });
        const wheat = () => useEntityStore.getState().recipePools.farming.find((r) => r.id === 'recipe_wheat');
        expect(wheat().mastery).toEqual({ ranks: [{ points: 10, effectId: YIELD.id, scale: 1 }] });
        const first = syncPayload();
        expect(first['tokenRecipes.json'].find((r) => r.id === 'recipe_wheat').mastery).toEqual({ ranks: [{ points: 10, effectId: YIELD.id, scale: 1 }] });
        const text = serialise(first);
        reload(text);
        for (const f of FILES) expect(JSON.stringify(syncPayload()[f], null, 2)).toBe(text[f]);
    });

    it('a recipe that is no crop shows no Mastery row', () => {
        useEntityStore.getState().focusRecipe('recipe_copper_ingot');
        const { container } = render(React.createElement(RecipeEditor));
        expect(container.querySelector('[data-testid="crop-mastery-row"]')).toBeNull();
    });
});

describe('the audit lines', () => {
    const effects = { [YIELD.id]: YIELD, [SPAWN.id]: SPAWN };
    const vein = (extra) => ({ id: 'v', name: 'Vein', tokenType: 'resource', config: { skill: 'mining', skillRequired: 1 }, ...extra });
    const msgs = (content) => masteryFindings({ effects, ...content }).map(f => f.message);

    it('a node with a working track says nothing; no track at all is unfinished content, never named', () => {
        expect(msgs({ tokens: { v: vein({ mastery: { ranks: [{ points: 5, effectId: YIELD.id }] } }) } })).toEqual([]);
        expect(msgs({ tokens: { v: vein({}) } })).toEqual([]);
        expect(msgs({ tokens: { v: vein({ mastery: { ranks: [{ points: 5, effectId: '' }] } }) } })).toEqual([]);
    });

    it('a rank no study reaches, a missing effect, a rule mastery cannot carry', () => {
        const out = msgs({ tokens: { v: vein({ mastery: { ranks: [
            { points: 0, effectId: YIELD.id }, { points: 5, effectId: 'fx_gone' }, { points: 9, effectId: SPAWN.id }
        ] } }) } });
        expect(out.some(m => /at "0" points, which no study reaches/.test(m))).toBe(true);
        expect(out.some(m => /"fx_gone", which does not exist/.test(m))).toBe(true);
        expect(out.some(m => /spawns rule, which mastery cannot carry/.test(m))).toBe(true);
    });

    it('a track on what is no node: a station, an enemy, a spawner, a Field, a Stump; a recipe that is no crop', () => {
        const track = { ranks: [{ points: 5, effectId: YIELD.id }] };
        const tokens = {
            st: { id: 'st', name: 'Kitchen', statements: [{ keyword: 'station', payload: { skill: 'cooking' } }], config: { skill: 'cooking' }, mastery: track },
            en: { id: 'en', name: 'Wolf', enemy: { level: 3 }, mastery: track },
            sp: { id: 'sp', name: 'Forest', spawner: { spawns: [] }, mastery: track },
            fi: { id: 'fi', name: 'Field', field: {}, statements: [{ keyword: 'station', payload: { skill: 'farming', stationKind: 'field' } }], mastery: track },
            tree: { id: 'tree', name: 'Tree', config: { skill: 'forestry' } },
            stump: { id: 'stump', name: 'Stump', grows: { into: 'tree' }, mastery: track }
        };
        const out = masteryFindings({ tokens, effects, recipes: [{ id: 'r', name: 'Ingot', mastery: track }] });
        const by = (id) => out.filter(f => f.entityId === id).map(f => f.message).join(' ');
        expect(by('st')).toMatch(/is a station/);
        expect(by('en')).toMatch(/is an enemy/);
        expect(by('sp')).toMatch(/is a spawner/);
        expect(by('fi')).toMatch(/put the track on each crop recipe/);
        expect(by('stump')).toMatch(/grows into Tree/);
        expect(by('r')).toMatch(/is no crop/);
    });

    it('a Laboratory block on what is no Laboratory, a level that is no whole number', () => {
        const out = masteryFindings({ tokens: {
            a: { id: 'a', name: 'Shed', laboratory: { maxLevel: 20 } },
            b: { id: 'b', name: 'Lab', statements: worksAsLab, laboratory: { maxLevel: 'high' } }
        }, effects });
        expect(out.find(f => f.entityId === 'a').message).toMatch(/does not work as a Laboratory/);
        expect(out.find(f => f.entityId === 'b').message).toMatch(/"high", which is not a whole level/);
    });

    it('a well-formed Laboratory draws no line: it runs no recipe, so Science needs no recipe pool', () => {
        registerTokenTypes({ fixture_cms_sc_lab: {
            id: 'fixture_cms_sc_lab', name: 'Fixture Audit Lab', tokenType: 'station', rarity: 'common', uses: null, sprite: 't_alembic_small', requiresHero: true,
            config: { skill: 'science', skillRequired: 1, cycleTimeMs: 10000, xp: 2, inputs: [], outputs: [] }, laboratory: { maxLevel: 20 }, statements: worksAsLab
        } });
        expect(auditContent().filter(f => JSON.stringify(f).includes('fixture_cms_sc_lab'))).toEqual([]);
    });

    it('the boot audit and the Economy Audit carry the same lines', () => {
        registerEffects({ [YIELD.id]: YIELD });
        registerTokenTypes({ fixture_cms_sc_stump: { id: 'fixture_cms_sc_stump', name: 'Fixture Odd Stump', tokenType: 'resource', grows: { into: 'token_oak_tree', afterMs: 1000 }, mastery: { ranks: [{ points: 5, effectId: YIELD.id }] } } });
        const boot = auditContent().filter(f => /Fixture Odd Stump|fixture_cms_sc_stump/.test(JSON.stringify(f)));
        expect(boot.some(f => /grows into Oak Tree/.test(JSON.stringify(f)))).toBe(true);
        const store = useEntityStore.getState();
        const tokens = { ...store.tokens, fixture_cms_sc_stump: { id: 'fixture_cms_sc_stump', name: 'Fixture Odd Stump', grows: { into: 'token_oak_tree' }, mastery: { ranks: [{ points: 5, effectId: YIELD.id }] } } };
        const cms = auditConnectivity({ items: store.items, tokens, recipes: {}, effects: { ...store.effects, [YIELD.id]: YIELD } });
        expect(cms.some(i => i.entityId === 'fixture_cms_sc_stump' && /Grows into Oak Tree/.test(i.details))).toBe(true);
    });
});
