// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor';
import { neverWearsReason as CMS_NEVER_WEARS_REASON } from '../../cms/src/utils/constants';
import { neverWearsReason } from '../systems/core/wearRule.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * Brief 230 S1a in the CMS Token editor: the "Stays where it stands" box (`staysPut`), carried
 * through Recalculate and Sync, and the Charges field, which a station or a support does not
 * offer (they never wear out) and whose leftover number the editor can clear.
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

function openEditor(id) {
    useEntityStore.getState().setActiveEntity(id, 'token');
    return render(React.createElement(TokenEditor)).container;
}
const box = (container) => container.querySelector('[data-field="stays-put"]');

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

describe('⭐ "Stays where it stands"', () => {
    it('is unticked on a Token without it; ticking writes staysPut: true, unticking drops the key', () => {
        const container = openEditor('token_copper_ore_vein');
        expect(box(container).checked).toBe(false);

        fireEvent.click(box(container));
        expect(useEntityStore.getState().tokens.token_copper_ore_vein.staysPut).toBe(true);
        expect(box(container).checked).toBe(true);

        fireEvent.click(box(container));
        expect(useEntityStore.getState().tokens.token_copper_ore_vein.staysPut).toBeUndefined();
        expect(JSON.parse(JSON.stringify(syncPayload()['tokens.json'].token_copper_ore_vein))).not.toHaveProperty('staysPut');
    });

    it('survives Recalculate and Sync, and a reload and a second sync keep it', () => {
        useEntityStore.getState().updateToken('token_oak_tree', { staysPut: true });
        const first = asFile(syncPayload());
        expect(first['tokens.json'].token_oak_tree.staysPut).toBe(true);

        useEntityStore.getState().hydrate(workspaceFromFiles(first));
        expect(useEntityStore.getState().tokens.token_oak_tree.staysPut).toBe(true);
        const second = asFile(syncPayload());
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(JSON.stringify(first[f], null, 2));
    });

    it('today\'s data, which has no staysPut, still round-trips byte-identical', () => {
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });
});

describe('⭐ Charges on a station or a support', () => {
    it('the editor reads the game’s own rule', () => {
        expect(CMS_NEVER_WEARS_REASON).toBe(neverWearsReason);
    });

    it('a station offers no Charges field: it says it never wears out, and that its old number is ignored', () => {
        const container = openEditor('token_grandma_s_kitchen');
        const note = container.querySelector('[data-field="never-wears"]');
        expect(note).not.toBeNull();
        expect(note.textContent).toContain('Never wears out');
        expect(note.textContent).toContain('works as a station');
        expect(container.textContent).toContain('Its 5000 Charges are ignored.');
        expect(container.querySelector('input[placeholder="unlimited"], input[type="number"][min="1"]')).toBeNull();
    });

    it('Clear empties the old number, and Sync writes it unlimited', () => {
        const container = openEditor('token_grandma_s_kitchen');
        fireEvent.click(container.querySelector('[data-clear-charges]'));
        expect(useEntityStore.getState().tokens.token_grandma_s_kitchen.uses).toBeNull();
        expect(container.querySelector('[data-clear-charges]')).toBeNull();
        expect(syncPayload()['tokens.json'].token_grandma_s_kitchen.uses).toBeNull();
    });

    it('a support says so too (the Copper Anvil)', () => {
        const container = openEditor('token_copper_anvil');
        expect(container.querySelector('[data-field="never-wears"]').textContent).toContain('helps the Tokens near it');
    });

    it('a gathering node keeps its Charges field', () => {
        const container = openEditor('token_blackberry_bush');
        expect(container.querySelector('[data-field="never-wears"]')).toBeNull();
        expect(container.textContent).toContain('Never depletes');
    });

    it('the Economy Audit flags the ignored charges, as a warning', () => {
        const s = useEntityStore.getState();
        const rows = auditConnectivity({ items: s.items, tokens: s.tokens, recipes: Object.values(s.recipePools).flat(), effects: s.effects })
            .filter((r) => r.entityId === 'token_grandma_s_kitchen' && /Charges/.test(r.details));
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ severity: 'Warning' });
        expect(rows[0].details).toContain('stations never wear out');
    });
});
