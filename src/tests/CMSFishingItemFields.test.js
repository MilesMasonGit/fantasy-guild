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
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';
import { fishOf, lureOf } from '../config/registries/fishRules.js';

/**
 * ⭐ Fishing in the CMS item editor: a fish's level, catch time and Bait, a lure's fish and break chance, a fishing tool's Bait saving, written as the game reads them and carried through Sync.
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
const input = (container, name, value) => fireEvent.change(field(container, name), { target: { value: String(value) } });
const open = (id) => {
    store().setActiveEntity(id, 'item');
    return render(React.createElement(ItemEditor)).container;
};

describe('⭐ the item editor: fishing fields', () => {
    it('a fish a water lands takes a level, a catch time, its Bait and its XP; blanks drop the block', () => {
        store().updateToken('token_coast', { catchPools: [{ tool: 'fishing_rod', bait: 'item_shrimp_bait', catches: [{ itemId: 'item_salmon', weight: 1 }] }] });
        const container = open('item_salmon');
        input(container, 'fish-level', 40);
        input(container, 'fish-cycle', 6.5);
        input(container, 'fish-bait', 3);
        input(container, 'fish-xp', 12);
        expect(store().items.item_salmon.fish).toEqual({ level: 40, cycleMs: 6500, bait: 3, xp: 12 });
        expect(fishOf(store().items.item_salmon)).toEqual({ level: 40, cycleMs: 6500, bait: 3, xp: 12 });
        expect(syncPayload()['items.json'].item_salmon.fish).toEqual({ level: 40, cycleMs: 6500, bait: 3, xp: 12 });
        input(container, 'fish-level', '');
        input(container, 'fish-cycle', '');
        input(container, 'fish-bait', '');
        input(container, 'fish-xp', '');
        expect(store().items.item_salmon.fish).toBeUndefined();
    });

    it('an ore or a plank shows no catch fields', () => {
        const container = open('item_copper_ore');
        expect(field(container, 'fish-level')).toBeNull();
    });

    it('a Consumable becomes a lure by naming fish, with a chance to break', () => {
        const id = store().addItem({ name: 'Feather Lure Fixture' });
        store().updateItem(id, { equipSlot: 'consumable' });
        const container = open(id);
        fireEvent.change(field(container, 'lure-add-fish'), { target: { value: 'item_trout' } });
        fireEvent.change(field(container, 'lure-add-fish'), { target: { value: 'item_salmon' } });
        input(container, 'lure-break-chance', 5);
        expect(store().items[id].lure).toEqual({ fish: ['item_trout', 'item_salmon'], breakChance: 5 });
        expect(lureOf(store().items[id])).toEqual({ fish: ['item_trout', 'item_salmon'], breakChance: 5 });
        fireEvent.click(container.querySelector('[data-lure-fish="item_trout"]'));
        fireEvent.click(container.querySelector('[data-lure-fish="item_salmon"]'));
        expect(store().items[id].lure).toBeUndefined();
    });

    it('a fishing tool saves Bait per catch; changing its tier keeps the saving', () => {
        const container = open('item_master_rod');
        input(container, 'tool-bait-saving', 2);
        expect(store().items.item_master_rod.tool).toMatchObject({ kind: 'fishing_rod', tier: 3, baitSaving: 2 });
        input(container, 'tool-tier', 4);
        expect(store().items.item_master_rod.tool).toMatchObject({ tier: 4, baitSaving: 2 });
        input(container, 'tool-bait-saving', 0);
        expect('baitSaving' in store().items.item_master_rod.tool).toBe(false);
        // A pickaxe saves no Bait: no field.
        cleanup();
        const pick = open(Object.keys(store().items).find((k) => store().items[k].tool?.kind === 'pickaxe'));
        expect(field(pick, 'tool-bait-saving')).toBeNull();
    });
});
