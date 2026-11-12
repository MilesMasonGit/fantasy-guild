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
import { checkTargets } from '../../cms/schemaCheck.js';
import { rareTableOf as CMS_RARE_TABLE_OF } from '../../cms/src/utils/constants';
import { rareTableOf } from '../config/registries/rareTables.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * Brief 590 P3 in the CMS Token editor: the Rare drop table block (`rareTable`), one chance a
 * cycle (decimals allowed) and weighted finds with a quantity range. Carried through Recalculate
 * and Sync byte for byte, its item ids follow a rename, the schema check accepts it, and the
 * Economy Audit counts a find as produced.
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
const store = () => useEntityStore.getState();
const syncPayload = () => syncFiles(store().recalculateEconomy({}));
const asFile = (files) => Object.fromEntries(FILES.map((f) => [f, JSON.parse(JSON.stringify(files[f], null, 2))]));

function openEditor(id) {
    store().setActiveEntity(id, 'token');
    return render(React.createElement(TokenEditor)).container;
}
const q = (container, sel) => container.querySelector(sel);
const qa = (container, sel) => [...container.querySelectorAll(sel)];
const input = (container, sel, i = 0) => qa(container, `${sel} input`)[i];

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

/** A copper vein's rare finds: Copper Ore 3 to Iron Ore 1, at half a percent a cycle. */
const VEIN = 'token_copper_ore_vein';
const GEMS = {
    chance: 0.5,
    entries: [
        { itemId: 'item_copper_ore', weight: 3, minQty: 1, maxQty: 1 },
        { itemId: 'item_iron_ore', weight: 1, minQty: 1, maxQty: 2 }
    ]
};

describe('⭐ the Rare drop table block', () => {
    it('reads the game\'s own table', () => {
        expect(CMS_RARE_TABLE_OF).toBe(rareTableOf);
    });

    it('a Token has none to begin with; adding the first find writes a 1 % table', () => {
        expect(store().tokens[VEIN]).toBeDefined();
        expect(store().tokens[VEIN].rareTable).toBeUndefined();
        const container = openEditor(VEIN);
        expect(q(container, '[data-field="rare-table"]')).not.toBeNull();
        expect(qa(container, '[data-rare-index]')).toHaveLength(0);

        fireEvent.click(q(container, '[data-add-rare]'));
        expect(store().tokens[VEIN].rareTable).toEqual({ chance: 1, entries: [{ itemId: '', weight: 10, minQty: 1, maxQty: 1 }] });
    });

    it('the chance takes decimals; finds take an item, a weight and a range; the share and the odds read back', () => {
        const container = openEditor(VEIN);
        fireEvent.click(q(container, '[data-add-rare]'));
        fireEvent.change(input(container, '[data-rare-chance]'), { target: { value: '0.5' } });
        fireEvent.change(q(container, '[data-rare-item]'), { target: { value: 'item_copper_ore' } });
        fireEvent.change(input(container, '[data-rare-weight]'), { target: { value: '3' } });
        fireEvent.click(q(container, '[data-add-rare]'));
        fireEvent.change(qa(container, '[data-rare-item]')[1], { target: { value: 'item_iron_ore' } });
        fireEvent.change(input(container, '[data-rare-weight]', 1), { target: { value: '1' } });
        fireEvent.change(input(container, '[data-rare-max]', 1), { target: { value: '2' } });
        expect(store().tokens[VEIN].rareTable).toEqual(GEMS);
        expect(qa(container, '[data-rare-share]').map((n) => n.textContent)).toEqual(['75%', '25%']);
        expect(qa(container, '[data-rare-odds]').map((n) => n.textContent)).toEqual(['0.38%', '0.13%']);
    });

    it('removing the last find drops the key: the synced record has no rareTable', () => {
        store().updateToken(VEIN, { rareTable: { chance: 1, entries: [{ itemId: 'item_copper_ore', weight: 1 }] } });
        const container = openEditor(VEIN);
        fireEvent.click(q(container, '[data-remove-rare]'));
        expect(store().tokens[VEIN].rareTable).toBeUndefined();
        expect(JSON.parse(JSON.stringify(syncPayload()['tokens.json'][VEIN]))).not.toHaveProperty('rareTable');
    });

    it('an enemy has the block too', () => {
        const enemyId = Object.keys(store().tokens).find((id) => store().tokens[id].enemy);
        expect(enemyId).toBeDefined();
        const container = openEditor(enemyId);
        expect(q(container, '[data-field="rare-table"]')).not.toBeNull();
    });
});

describe('⭐ a rare table through Recalculate, Sync, a reload and the schema check', () => {
    it('survives Recalculate and Sync, and a reload and a second sync keep it byte-identical', () => {
        store().updateToken(VEIN, { rareTable: GEMS });
        const first = asFile(syncPayload());
        expect(first['tokens.json'][VEIN].rareTable).toEqual(GEMS);

        store().hydrate(workspaceFromFiles(first));
        expect(store().tokens[VEIN].rareTable).toEqual(GEMS);
        const second = asFile(syncPayload());
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(JSON.stringify(first[f], null, 2));
    });

    it('today\'s data, which has no rare tables, still round-trips byte-identical', () => {
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });

    it('the schema check accepts a table: no error and no unknown key; a chance over 100 is an error', () => {
        store().updateToken(VEIN, { rareTable: GEMS });
        const tokens = asFile(syncPayload())['tokens.json'];
        const ok = checkTargets([{ where: 'tokens.json', schema: 'tokens', value: tokens }]);
        expect(ok.errors).toEqual([]);
        expect(ok.unknown.filter((u) => u.path.includes('rareTable'))).toEqual([]);
        const bad = checkTargets([{ where: 'tokens.json', schema: 'tokens', value: { [VEIN]: { ...tokens[VEIN], rareTable: { chance: 150, entries: [] } } } }]);
        expect(bad.errors.map((e) => e.path)).toContain(`/${VEIN}/rareTable/chance`);
    });

    it('renaming an item follows it into the table', () => {
        store().updateToken(VEIN, { rareTable: GEMS });
        expect(store().renameEntityId('item_iron_ore', 'item_iron_nugget', 'item')).toBe(true);
        expect(store().tokens[VEIN].rareTable.entries.map((e) => e.itemId)).toEqual(['item_copper_ore', 'item_iron_nugget']);
    });

    it('the Economy Audit counts a find as produced there', () => {
        store().addItem({ name: 'Rare Gem Fixture' });
        const gemId = Object.keys(store().items).find((id) => store().items[id].name === 'Rare Gem Fixture');
        const audit = () => {
            const st = store();
            return auditConnectivity({ items: st.items, tokens: st.tokens, recipes: Object.values(st.recipePools).flat(), effects: st.effects });
        };
        const unreachable = () => audit().filter((r) => r.entityId === gemId && /Unreachable/.test(r.details));
        expect(unreachable()).toHaveLength(1);
        store().updateToken(VEIN, { rareTable: { chance: 0.5, entries: [{ itemId: gemId, weight: 1 }] } });
        expect(unreachable()).toHaveLength(0);
    });
});
