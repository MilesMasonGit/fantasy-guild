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
import EffectEditor from '../../cms/src/components/editors/EffectEditor.jsx';

/**
 * ⭐ A status in the CMS (brief 220, C4): the Effect editor's Status section makes a library effect
 * a status (how many stacks, how many ticks), the Rules Text says so, the Poison the Venomous kind
 * names is flagged as an id to keep, and the block survives Recalculate, Sync and a reload.
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
const load = (files) => useEntityStore.getState().hydrate(workspaceFromFiles(files));
const shipped = () => Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]));
const syncPayload = () => JSON.parse(JSON.stringify(syncFiles(useEntityStore.getState().recalculateEconomy({}))));

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;
beforeAll(() => {
    storedBefore = globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null;
    useEntityStore.persist.setOptions({ storage: noStorage });
});
beforeEach(() => load(shipped()));
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
    expect(globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null).toBe(storedBefore);
});

const store = () => useEntityStore.getState();
const field = (container, name) => container.querySelector(`[data-field="${name}"]`);

function effectEditor(id) {
    store().setActiveEntity(id, 'effect');
    return render(React.createElement(EffectEditor));
}

describe('⭐ the Effect editor makes a status', () => {
    it('a new effect named Poison gets the id Venomous names, and is flagged to keep it', () => {
        // A library without Poison, whatever ships.
        useEntityStore.setState((s) => {
            const { effect_poison: _gone, ...effects } = s.effects;
            return { effects };
        });
        const id = store().addEffect({ name: 'Poison' });
        expect(id).toBe('effect_poison');
        const { container } = effectEditor(id);
        expect(container.textContent).toContain('Venomous enemies land this effect by its id');
    });

    it('ticking Status writes the block; stacks and ticks write into it; the Rules Text says so', () => {
        const id = store().addEffect({ name: 'Poison' });
        const { container } = effectEditor(id);
        expect(store().effects[id].status).toBeUndefined();

        fireEvent.click(field(container, 'status-on'));
        expect(store().effects[id].status).toEqual({ stacks: 1, ticks: 0 });
        fireEvent.change(field(container, 'status-stacks'), { target: { value: '3' } });
        expect(store().effects[id].status).toEqual({ stacks: 3, ticks: 0 });
        expect(container.textContent).toContain('A status: stacks up to 3, its rules once per stack; lasts until the fight ends.');

        fireEvent.change(field(container, 'status-ticks'), { target: { value: '3' } });
        expect(store().effects[id].status).toEqual({ stacks: 3, ticks: 3 });

        fireEvent.click(field(container, 'status-on'));
        expect(store().effects[id].status).toBeUndefined();
    });

    it('survives Recalculate, Sync and a reload unchanged, and changes nothing else', () => {
        const id = store().addEffect({ name: 'Burn' });
        store().updateEffect(id, { status: { stacks: 1, ticks: 3 } });
        const first = syncPayload();
        expect(first['effects.json'][id].status).toEqual({ stacks: 1, ticks: 3 });
        for (const other of Object.keys(shipped()['effects.json'])) {
            expect(JSON.stringify(first['effects.json'][other]), other).toBe(JSON.stringify(shipped()['effects.json'][other]));
        }
        const serialised = Object.fromEntries(FILES.map((f) => [f, JSON.stringify(first[f], null, 2)]));
        load(Object.fromEntries(FILES.map((f) => [f, JSON.parse(serialised[f])])));
        const second = syncPayload();
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2), f).toBe(serialised[f]);
    });
});
