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
import { STANDARD_REACH_U as CMS_STANDARD_REACH_U, campOf as cmsCampOf } from '../../cms/src/utils/constants';
import { composeTokenDescription } from '../../cms/src/engine/descriptionDictionary';
import { campOf } from '../config/registries/tokenConstants.js';
import { STANDARD_REACH_U } from '../config/registries/reachRegistry.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * Brief 260 O2 in the CMS: a Token's Camp block (the skill whose Tokens its heroes work), carried
 * through Recalculate, Sync and a reload exactly as written, filed as a camp, and gone without a
 * trace when removed. The content audit checks it. Every camp works the game's one standard reach
 * (brief 560 R1): the block has no Reach field, and a reach an older block carries is not read.
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

function openToken(id) {
    useEntityStore.getState().setActiveEntity(id, 'token');
    const { container } = render(React.createElement(TokenEditor));
    return { container, block: () => container.querySelector('[data-block="camp"]') };
}

describe('the vocabulary comes from the game', () => {
    it('the Camp block is a lifecycle block that starts with no skill at the game\'s reach', () => {
        expect(TOKEN_LIFECYCLE_BLOCKS).toContain('camp');
        expect(makeLifecycleBlock('camp')).toEqual({ skill: '' });
        expect(CMS_STANDARD_REACH_U).toBe(STANDARD_REACH_U);
        expect(cmsCampOf).toBe(campOf);
    });
});

describe('⭐ the Camp block', () => {
    it('added, its skill picked and reach typed, round-trips; it files as a camp; removed, no block', () => {
        const id = useEntityStore.getState().addToken({ name: 'Fixture Logging Camp' });
        const { block } = openToken(id);
        fireEvent.click(within(block()).getByText('Add'));
        expect(useEntityStore.getState().tokens[id].camp).toEqual({ skill: '' });
        expect(within(block()).getByText(/Pick the skill/)).toBeTruthy();
        // No Reach field: every camp works the one standard reach.
        expect(within(block()).queryByLabelText('Reach (u)')).toBe(null);

        fireEvent.change(block().querySelector('[data-field="camp-skill"] select'), { target: { value: 'forestry' } });
        expect(useEntityStore.getState().tokens[id].camp).toEqual({ skill: 'forestry' });
        // It names what its heroes would work from today's content: trees, never a station.
        const note = block().querySelector('[data-field="camp-note"]').textContent;
        expect(note).toMatch(/Birch Tree, Cedar Tree/);
        expect(note).toMatch(new RegExp(`within ${STANDARD_REACH_U} u`));

        const first = syncPayload();
        expect(first['tokens.json'][id].camp).toEqual({ skill: 'forestry' });
        expect(first['tokens.json'][id].tokenType).toBe('camp');
        const text = serialise(first);
        reload(text);
        const second = syncPayload();
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(text[f]);

        cleanup();
        const again = openToken(id);
        fireEvent.click(within(again.block()).getByText('Remove'));
        // Removing writes undefined, which the file omits.
        expect(JSON.stringify(syncPayload()['tokens.json'][id])).not.toContain('"camp"');
    });

    it('its description says what its heroes work; a camp is never "passive"', () => {
        const text = composeTokenDescription({ name: 'X', requiresHero: false, config: null, camp: { skill: 'mining', reach: 280 } });
        expect(text).toBe(`A camp: heroes sent here work the Mining Tokens within ${STANDARD_REACH_U} u, one hero each.`);
        expect(text).not.toMatch(/passively/);
    });
});

describe('⭐ the content audit checks a camp', () => {
    const skills = ['forestry', 'mining'];
    const audit = (camp, extra = {}) => auditLifecycleBlocks({ tokens: { t_camp: { id: 't_camp', name: 'Camp', camp, ...extra } }, skills })
        .filter((f) => f.entityId === 't_camp');

    it('a good block says nothing; no skill and a skill that is not one are errors; a reach is not read, so never one', () => {
        expect(audit({ skill: 'forestry' })).toEqual([]);
        expect(audit({ skill: 'forestry', reach: 300 })).toEqual([]);
        expect(audit({ skill: '' })[0]).toMatchObject({ severity: 'error', field: 'camp.skill' });
        expect(audit({ skill: 'basket_weaving' })[0]).toMatchObject({ severity: 'error', field: 'camp.skill' });
        expect(audit({ skill: 'mining', reach: 0 })).toEqual([]);
        expect(audit({ skill: 'mining', reach: 'far' })).toEqual([]);
        expect(audit('yes')[0]).toMatchObject({ severity: 'error', field: 'camp' });
    });

    it('a camp with its own work cycle is warned: no hero works a camp itself', () => {
        const found = audit({ skill: 'mining' }, { config: { skill: 'mining', cycleTimeMs: 1000, outputs: [] } });
        expect(found).toEqual([expect.objectContaining({ severity: 'warning', field: 'camp' })]);
    });
});
