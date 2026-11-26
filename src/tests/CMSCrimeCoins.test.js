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
import { stealCoinsOf as cmsStealCoinsOf } from '../../cms/src/utils/constants';
import { stealCoinsOf } from '../config/registries/coinCosts.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * ⭐ A steal table's coins in the CMS (owner 2026-11-25): the enemy editor's steal table takes a
 * Coins box (`steal.coins`), written only as a whole number above 0, read with the game's own rule,
 * kept through Sync; a table of coins alone is a table; the Economy Audit names coins it cannot read.
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
const syncPayload = () => JSON.parse(JSON.stringify(syncFiles(useEntityStore.getState().recalculateEconomy({}))));

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

const store = () => useEntityStore.getState();
// The cow ships with a steal table of its own; these tests build one from nothing.
function openCowWithNoSteal() {
    store().updateToken('token_cow', { steal: undefined });
    return openToken('token_cow');
}

function openToken(id) {
    store().setActiveEntity(id, 'token');
    return render(React.createElement(TokenEditor)).container;
}

describe('⭐ the steal table\'s Coins', () => {
    it('the CMS reads a steal table\'s coins with the game\'s own rule', () => {
        expect(cmsStealCoinsOf).toBe(stealCoinsOf);
    });

    it('a whole number above 0 is written; 0, blank, a fraction or below 0 writes nothing; a table of coins alone is kept; it reaches tokens.json', () => {
        const container = openCowWithNoSteal();
        const input = () => container.querySelector('[data-field="steal-table"] [data-field="steal-coins"]');
        const line = () => container.querySelector('[data-field="steal-coins-line"]');
        expect(input()).not.toBeNull();
        expect(input().value).toBe('');
        expect(line().textContent).toMatch(/Takes no coins/);
        fireEvent.change(input(), { target: { value: '12' } });
        expect(store().tokens.token_cow.steal).toEqual({ coins: 12 });
        expect(line().textContent).toMatch(/Each theft takes 12 coins/);
        expect(syncPayload()['tokens.json'].token_cow.steal).toEqual({ coins: 12 });
        for (const value of ['0', '', '2.5', '-4']) {
            fireEvent.change(input(), { target: { value } });
            expect(store().tokens.token_cow.steal, value).toBeUndefined();
        }
        expect(JSON.stringify(syncPayload()['tokens.json'].token_cow)).not.toContain('"steal"');
    });

    it('coins beside a line: removing the coins keeps the line, removing the line keeps the coins', () => {
        const container = openCowWithNoSteal();
        const block = () => container.querySelector('[data-field="steal-table"]');
        fireEvent.click(block().querySelector('[data-add-steal]'));
        fireEvent.change(block().querySelector('[data-steal-item]'), { target: { value: 'item_wheat' } });
        fireEvent.change(block().querySelector('[data-field="steal-coins"]'), { target: { value: '5' } });
        expect(store().tokens.token_cow.steal).toEqual({ outputs: [{ itemId: 'item_wheat', chance: 100, minQty: 1, maxQty: 1 }], coins: 5 });
        fireEvent.click(block().querySelector('[data-remove-steal]'));
        expect(store().tokens.token_cow.steal).toEqual({ coins: 5 });
        fireEvent.change(block().querySelector('[data-field="steal-coins"]'), { target: { value: '' } });
        expect(store().tokens.token_cow.steal).toBeUndefined();
    });
});

describe('⭐ the Economy Audit names steal coins the game cannot read', () => {
    it('as a warning, in the game\'s words', () => {
        const tokens = {
            fx_thief: { id: 'fx_thief', name: 'Bad Steal Coins', enemy: { level: 1 }, steal: { coins: 0.5, outputs: [{ itemId: 'item_wheat', chance: 100 }] } },
            fx_fine: { id: 'fx_fine', name: 'Fine Steal Coins', enemy: { level: 1 }, steal: { coins: 3 } }
        };
        const issues = auditConnectivity({ items: { item_wheat: { id: 'item_wheat', name: 'Wheat' } }, tokens, recipes: {}, effects: {} })
            .filter(i => /steal table's coins/.test(i.details));
        expect(issues.map(i => i.entityId)).toEqual(['fx_thief']);
        expect(issues.every(i => i.severity === 'Warning')).toBe(true);
    });
});
