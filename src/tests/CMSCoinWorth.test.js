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
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor.js';
import { coinWorthOf as cmsCoinWorthOf } from '../../cms/src/utils/constants';
import { coinWorthOf } from '../config/registries/itemCoins.js';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';

/**
 * ⭐ Gold Coins in the CMS: every item's Coin worth, written as `coinWorth` (a whole number of 0
 * or more; blank writes nothing and sells for 0), carried through Recalculate and Sync, read with
 * the game's own rule; the Economy Audit names a worth the game cannot read.
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
const loadShipped = () => useEntityStore.getState().hydrate(workspaceFromFiles(Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]))));
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

const field = (container, name) => container.querySelector(`[data-field="${name}"]`);
const store = () => useEntityStore.getState();
const edit = (patch) => {
    const id = store().addItem({ name: 'Coin Fixture', ...patch });
    store().setActiveEntity(id, 'item');
    return { id, ...render(React.createElement(ItemEditor)) };
};

describe('⭐ the item editor\'s Coin worth', () => {
    it('the CMS reads the worth with the game\'s own rule', () => {
        expect(cmsCoinWorthOf).toBe(coinWorthOf);
    });

    it('offered on every item: a material, worn gear and a tool', () => {
        expect(field(edit({ equipSlot: '' }).container, 'coin-worth')).not.toBeNull();
        cleanup();
        expect(field(edit({ equipSlot: 'chest', type: 'armor' }).container, 'coin-worth')).not.toBeNull();
        cleanup();
        expect(field(edit({ equipSlot: 'hand', type: 'tool', tool: { kind: 'woodaxe', tier: 1 } }).container, 'coin-worth')).not.toBeNull();
    });

    it('a whole number of 0 or more is written; blank clears it; a fraction or below 0 writes nothing', () => {
        const { id, container } = edit({});
        const input = () => field(container, 'coin-worth');
        expect(input().value).toBe('');
        fireEvent.change(input(), { target: { value: '12' } });
        expect(store().items[id].coinWorth).toBe(12);
        fireEvent.change(input(), { target: { value: '0' } });
        expect(store().items[id].coinWorth).toBe(0);
        fireEvent.change(input(), { target: { value: '2.5' } });
        expect(store().items[id].coinWorth).toBeUndefined();
        fireEvent.change(input(), { target: { value: '-3' } });
        expect(store().items[id].coinWorth).toBeUndefined();
        fireEvent.change(input(), { target: { value: '' } });
        expect(store().items[id].coinWorth).toBeUndefined();
    });

    it('shows a stack\'s worth in words', () => {
        const { container } = edit({ coinWorth: 4 });
        expect(field(container, 'coin-worth-line').textContent).toMatch(/One sells for 4 coins/);
        cleanup();
        const blank = edit({});
        expect(field(blank.container, 'coin-worth-line').textContent).toMatch(/sells for 0 coins/);
    });
});

describe('⭐ the worth survives Recalculate and Sync', () => {
    it('written as typed; an item with none writes none', () => {
        const ore = store().addItem({ name: 'Coin Fixture Ore', coinWorth: 7 });
        const free = store().addItem({ name: 'Coin Fixture Free', coinWorth: 0 });
        const blank = store().addItem({ name: 'Coin Fixture Blank' });
        const files = syncPayload();
        expect(files['items.json'][ore].coinWorth).toBe(7);
        expect(files['items.json'][free].coinWorth).toBe(0);
        expect('coinWorth' in files['items.json'][blank]).toBe(false);
    });
});

describe('⭐ the Economy Audit names a worth the game cannot read', () => {
    it('as a warning, in the game\'s words', () => {
        const items = {
            fx_ok: { id: 'fx_ok', name: 'Fine', coinWorth: 3 },
            fx_neg: { id: 'fx_neg', name: 'Negative', coinWorth: -1 },
            fx_frac: { id: 'fx_frac', name: 'Fraction', coinWorth: 0.5 }
        };
        const issues = auditConnectivity({ items, tokens: {}, recipes: {}, effects: {} })
            .filter(i => /Coin worth/.test(i.details));
        expect(issues.map(i => i.entityId).sort()).toEqual(['fx_frac', 'fx_neg']);
        expect(issues.every(i => i.severity === 'Warning')).toBe(true);
    });
});
