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
        // Fixture: the shipped bush now stays put (it rests and refills), so the mark is taken off
        // first, to start from a Token without it.
        useEntityStore.getState().updateToken('token_blackberry_bush', { staysPut: undefined });
        expect(useEntityStore.getState().tokens.token_blackberry_bush.staysPut).toBeUndefined();
        const container = openEditor('token_blackberry_bush');
        expect(box(container).checked).toBe(false);

        fireEvent.click(box(container));
        expect(useEntityStore.getState().tokens.token_blackberry_bush.staysPut).toBe(true);
        expect(box(container).checked).toBe(true);

        fireEvent.click(box(container));
        expect(useEntityStore.getState().tokens.token_blackberry_bush.staysPut).toBeUndefined();
        expect(JSON.parse(JSON.stringify(syncPayload()['tokens.json'].token_blackberry_bush))).not.toHaveProperty('staysPut');
    });

    it('survives Recalculate and Sync, and a reload and a second sync keep it', () => {
        useEntityStore.getState().updateToken('token_blackberry_bush', { staysPut: true });
        const first = asFile(syncPayload());
        expect(first['tokens.json'].token_blackberry_bush.staysPut).toBe(true);

        useEntityStore.getState().hydrate(workspaceFromFiles(first));
        expect(useEntityStore.getState().tokens.token_blackberry_bush.staysPut).toBe(true);
        const second = asFile(syncPayload());
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(JSON.stringify(first[f], null, 2));
    });

    it('today\'s data, staysPut and all, still round-trips byte-identical', () => {
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });
});

describe('⭐ Charges on an enemy: one use, never offered', () => {
    it('an enemy authored with more says it is one fight and its number is ignored; Set to 1 writes 1', () => {
        useEntityStore.getState().updateToken('token_cow', { uses: 100 });
        const container = openEditor('token_cow');
        expect(container.querySelector('[data-field="enemy-one-use"]').textContent).toContain('One fight');
        expect(container.textContent).toContain('Its 100 Charges are ignored.');
        expect(container.textContent).not.toContain('Never depletes');
        fireEvent.click(container.querySelector('[data-clear-charges]'));
        expect(useEntityStore.getState().tokens.token_cow.uses).toBe(1);
        expect(container.querySelector('[data-clear-charges]')).toBeNull();
    });

    it('an enemy at one use shows the note alone', () => {
        const container = openEditor('token_goblin');
        expect(container.querySelector('[data-field="enemy-one-use"]')).not.toBeNull();
        expect(container.querySelector('[data-clear-charges]')).toBeNull();
        expect(container.textContent).not.toContain('Never depletes');
    });
});

describe('⭐ Charges on a station or a support', () => {
    // Fixture: the owner has cleared every shipped station's Charges, so the Kitchen is given an old
    // 5000, to have a number to show, clear and flag.
    const withOldCharges = () => useEntityStore.getState().updateToken('token_cooking_pot', { uses: 5000 });

    it('the editor reads the game’s own rule', () => {
        expect(CMS_NEVER_WEARS_REASON).toBe(neverWearsReason);
    });

    it('a station offers no Charges field: it says it never wears out, and that its old number is ignored', () => {
        withOldCharges();
        const container = openEditor('token_cooking_pot');
        const note = container.querySelector('[data-field="never-wears"]');
        expect(note).not.toBeNull();
        expect(note.textContent).toContain('Never wears out');
        expect(note.textContent).toContain('works as a station');
        expect(container.textContent).toContain('Its 5000 Charges are ignored.');
        // The Charges input: a number from 1 with a placeholder and no max (the access level has no
        // placeholder; an effect's scale field has a max).
        expect(container.querySelector('input[placeholder="unlimited"], input[type="number"][min="1"][placeholder]:not([max])')).toBeNull();
        expect(container.textContent).not.toContain('Never depletes');
    });

    it('Clear empties the old number, and Sync writes it unlimited', () => {
        withOldCharges();
        const container = openEditor('token_cooking_pot');
        fireEvent.click(container.querySelector('[data-clear-charges]'));
        expect(useEntityStore.getState().tokens.token_cooking_pot.uses).toBeNull();
        expect(container.querySelector('[data-clear-charges]')).toBeNull();
        expect(syncPayload()['tokens.json'].token_cooking_pot.uses).toBeNull();
    });

    it('a support says so too (the Copper Anvil)', () => {
        const container = openEditor('token_copper_anvil');
        expect(container.querySelector('[data-field="never-wears"]').textContent).toContain('helps the Tokens near it');
    });

    it('a gathering node that leaves the mat keeps its Charges field', () => {
        const container = openEditor('token_copper_comet');
        expect(container.querySelector('[data-field="never-wears"]')).toBeNull();
        expect(container.querySelector('[data-field="end-chance"]')).toBeNull();
        expect(container.textContent).toContain('Never depletes');
    });

    it('a gathering node that comes back runs out by chance: its chance in place of Charges', () => {
        // The shipped bush rests and refills and carries the rest rule's chance, shown as written.
        const shippedChance = JSON.parse(raw['tokens.json']).token_blackberry_bush.endChance;
        expect(Number.isFinite(shippedChance)).toBe(true);
        expect(openEditor('token_blackberry_bush').querySelector('[data-field="end-chance"]').value).toBe(String(shippedChance));
        cleanup();

        // Fixture: the bush as it was before a chance was written, with 25 Charges: one in 25 a round.
        useEntityStore.getState().updateToken('token_blackberry_bush', { uses: 25, endChance: undefined });
        const container = openEditor('token_blackberry_bush');
        expect(container.querySelector('[data-field="never-wears"]')).toBeNull();
        expect(container.textContent).not.toContain('Never depletes');
        const input = container.querySelector('[data-field="end-chance"]');
        expect(input.value).toBe('4');
        expect(container.querySelector('[data-field="end-chance-note"]').textContent).toContain('about 1 in 25');
        expect(container.querySelector('[data-field="end-chance-note"]').textContent).toContain('From its 25 Charges');

        fireEvent.change(input, { target: { value: '20' } });
        const bush = useEntityStore.getState().tokens.token_blackberry_bush;
        expect(bush.endChance).toBe(20);
        expect(bush.uses).toBeUndefined();
        expect(container.querySelector('[data-field="end-chance-note"]').textContent).toContain('about 1 in 5');
        const synced = syncPayload()['tokens.json'].token_blackberry_bush;
        expect(synced.endChance).toBe(20);
        expect(JSON.parse(JSON.stringify(synced))).not.toHaveProperty('uses');

        fireEvent.click(container.querySelector('[data-field="end-chance"]').closest('div').parentElement.querySelector('input[type="checkbox"]'));
        expect(useEntityStore.getState().tokens.token_blackberry_bush).toMatchObject({ uses: null });
        expect(useEntityStore.getState().tokens.token_blackberry_bush.endChance).toBeUndefined();
        expect(container.querySelector('[data-field="end-chance-note"]').textContent).toContain('never runs out');
    });

    it('the Economy Audit flags the ignored charges, as a warning', () => {
        withOldCharges();
        const s = useEntityStore.getState();
        const rows = auditConnectivity({ items: s.items, tokens: s.tokens, recipes: Object.values(s.recipePools).flat(), effects: s.effects })
            .filter((r) => r.entityId === 'token_cooking_pot' && /Charges/.test(r.details));
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ severity: 'Warning' });
        expect(rows[0].details).toContain('stations never wear out');
    });
});
