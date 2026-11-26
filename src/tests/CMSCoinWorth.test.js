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
 * or more), read with the game's own rule. Recalculate fills it from the item's value (brief 870
 * C3); a number typed in the item editor pins it (`sim.coinWorthPinned`), and a pinned worth is
 * carried through Recalculate and Sync as typed. The Economy Audit names a worth the game cannot read.
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
const shippedFiles = () => Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]));
const loadShipped = () => useEntityStore.getState().hydrate(workspaceFromFiles(shippedFiles()));

const omit = (record, key) => {
    if (!record || !(key in record)) return record;
    const { [key]: _gone, ...rest } = record;
    return rest;
};
/**
 * The shipped content with every coin taken out, as it was before the coin pack: no Shop coins, no
 * enemy Coin drop, no steal-table coins and no item Coin worth.
 */
function loadWithoutCoins() {
    const files = shippedFiles();
    for (const [id, def] of Object.entries(files['tokens.json'])) {
        files['tokens.json'][id] = {
            ...def,
            ...(def.shop ? { shop: omit(def.shop, 'coins') } : {}),
            ...(def.enemy ? { enemy: omit(def.enemy, 'coinDrop') } : {}),
            ...(def.steal ? { steal: omit(def.steal, 'coins') } : {})
        };
    }
    for (const [id, item] of Object.entries(files['items.json'])) files['items.json'][id] = omit(item, 'coinWorth');
    useEntityStore.getState().hydrate(workspaceFromFiles(files));
}
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

    it('a whole number of 0 or more is written and pinned; blank clears both; a fraction or below 0 writes nothing', () => {
        const { id, container } = edit({});
        const input = () => field(container, 'coin-worth');
        const pinned = () => store().items[id].sim?.coinWorthPinned === true;
        expect(input().value).toBe('');
        fireEvent.change(input(), { target: { value: '12' } });
        expect(store().items[id].coinWorth).toBe(12);
        expect(pinned()).toBe(true);
        fireEvent.change(input(), { target: { value: '0' } });
        expect(store().items[id].coinWorth).toBe(0);
        expect(pinned()).toBe(true);
        fireEvent.change(input(), { target: { value: '2.5' } });
        expect(store().items[id].coinWorth).toBeUndefined();
        expect(pinned()).toBe(false);
        fireEvent.change(input(), { target: { value: '-3' } });
        expect(store().items[id].coinWorth).toBeUndefined();
        fireEvent.change(input(), { target: { value: '' } });
        expect(store().items[id].coinWorth).toBeUndefined();
        expect(pinned()).toBe(false);
    });

    it('⭐ the pin: ticked Recalculate keeps the number, unticked it is derived from the value again', () => {
        const { id, container } = edit({ value: 40, coinWorth: 40 });
        const pin = () => container.querySelector('[data-coin-pin]');
        expect(pin().getAttribute('data-coin-pin')).toBe('off');
        expect(field(container, 'coin-worth-line').textContent).toMatch(/From its value \(40\) at each Recalculate/);
        fireEvent.change(field(container, 'coin-worth'), { target: { value: '25' } });
        expect(pin().getAttribute('data-coin-pin')).toBe('on');
        expect(field(container, 'coin-worth-line').textContent).toMatch(/Pinned: Recalculate keeps it/);
        fireEvent.click(pin().querySelector('input'));
        expect(store().items[id].sim?.coinWorthPinned).toBeUndefined();
        expect(store().items[id].coinWorth).toBe(25);
    });

    it('shows a stack\'s worth in words', () => {
        const { container } = edit({ coinWorth: 4 });
        expect(field(container, 'coin-worth-line').textContent).toMatch(/One sells for 4 coins/);
        cleanup();
        const blank = edit({});
        expect(field(blank.container, 'coin-worth-line').textContent).toMatch(/sells for 0 coins/);
    });
});

describe('⭐ Recalculate fills the worth from the value once the content uses coins; a pinned worth survives Recalculate and Sync', () => {
    /** A coin cost on the first Shop Token: the content now uses coins. */
    const askCoins = () => {
        const shopId = Object.values(store().tokens).find(t => t.shop)?.id;
        store().updateToken(shopId, { shop: { ...store().tokens[shopId].shop, coins: 5 } });
        return shopId;
    };

    it('no coin anywhere (the content before the coin pack): no item gains a worth, so the files round-trip as they were', () => {
        loadWithoutCoins();
        const items = Object.values(syncPayload()['items.json']);
        expect(items.some(i => 'coinWorth' in i)).toBe(false);
    });

    it('⭐ with a coin cost: every priced item worth its value in coins, an unpriced one none', () => {
        askCoins();
        const items = Object.values(syncPayload()['items.json']);
        const priced = items.filter(i => i.value != null);
        expect(priced.length).toBeGreaterThan(100);
        for (const item of priced) expect(item.coinWorth, item.id).toBe(item.value);
        for (const item of items.filter(i => i.value == null)) expect('coinWorth' in item, item.id).toBe(false);
    });

    it('an enemy\'s Coin drop puts coins in play as a Shop price does', () => {
        const enemyId = Object.values(store().tokens).find(t => t.enemy)?.id;
        store().updateToken(enemyId, { enemy: { ...store().tokens[enemyId].enemy, coinDrop: 3 } });
        expect(Object.values(syncPayload()['items.json']).filter(i => 'coinWorth' in i).length).toBeGreaterThan(100);
    });

    it('pinned: written as typed, priced or not; unpinned: a typed number gives way to the value', () => {
        askCoins();
        const pinned = { coinWorthPinned: true };
        const ore = store().addItem({ name: 'Coin Fixture Ore', coinWorth: 7, sim: pinned });
        const free = store().addItem({ name: 'Coin Fixture Free', coinWorth: 0, sim: pinned });
        const blank = store().addItem({ name: 'Coin Fixture Blank' });
        const loose = store().addItem({ name: 'Coin Fixture Loose', coinWorth: 9 });
        const copperId = Object.values(store().items).find(i => i.name === 'Copper Ore')?.id;
        store().updateItem(copperId, { coinWorth: 123, sim: pinned });
        const files = syncPayload();
        expect(files['items.json'][ore].coinWorth).toBe(7);
        expect(files['items.json'][free].coinWorth).toBe(0);
        expect(files['items.json'][copperId].coinWorth).toBe(123);
        expect(files['items.json'][copperId].sim).toEqual(pinned);
        expect('coinWorth' in files['items.json'][blank]).toBe(false);
        // Nothing makes it, so it has no value: the number typed without a pin is not kept.
        expect('coinWorth' in files['items.json'][loose]).toBe(false);
    });

    it('with no coins in play a typed worth is left exactly as typed, pinned or not', () => {
        loadWithoutCoins();
        const loose = store().addItem({ name: 'Coin Fixture Loose', coinWorth: 9 });
        expect(syncPayload()['items.json'][loose].coinWorth).toBe(9);
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
