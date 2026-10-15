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
import { STANDS_ON_CHOICES } from '../../cms/src/utils/constants';
import { STANDS_ON_CHOICES as GAME_STANDS_ON_CHOICES } from '../systems/atlas/TerrainMap.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * ⭐ **"Stands on" in the CMS** (terrain roadmap T4, TD-1 A): the Token editor's Lifecycle section
 * carries `standsOn` through load → edit → Recalculate → Sync. Sync writes `data/tokens.json`
 * wholesale, so a field the CMS does not carry is lost; an empty list means anywhere dry and is
 * dropped rather than written.
 *
 * ⚠️ No real workspace: the store's persistence is a no-op here (TESTING, "The CMS").
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));

function workspaceFromFiles(files) {
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) {
        (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    }
    return { items: files['items.json'], tokens: files['tokens.json'], effects: files['effects.json'], recipePools };
}

const hydrate = (files) => useEntityStore.getState().hydrate(workspaceFromFiles(files));
const loadShipped = () => hydrate(Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])])));

/** Recalculate + build the sync payload, exactly as `syncToGame` does, minus the POST. */
function syncPayload() {
    return syncFiles(useEntityStore.getState().recalculateEconomy({}));
}
/** As written to disk and read back. */
const asFile = (files) => Object.fromEntries(FILES.map((f) => [f, JSON.parse(JSON.stringify(files[f], null, 2))]));

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

const chip = (container, id) => container.querySelector(`[data-field="stands-on"] [data-stands-on="${id}"]`);

describe('⭐ "Stands on" chips in the Token editor', () => {
    it('offers the game\'s five words, imported from the game, in its order', () => {
        expect(STANDS_ON_CHOICES).toBe(GAME_STANDS_ON_CHOICES);
        const id = useEntityStore.getState().addToken({ name: 'Chip Fixture' });
        useEntityStore.getState().setActiveEntity(id, 'token');
        const { container } = render(React.createElement(TokenEditor));
        const chips = [...container.querySelectorAll('[data-field="stands-on"] [data-stands-on]')];
        expect(chips.map((c) => c.getAttribute('data-stands-on'))).toEqual(['water', 'shore', 'grass', 'rock', 'sand']);
        expect(chips.map((c) => c.textContent.trim())).toEqual(['Water', 'Shore', 'Grass', 'Rock', 'Sand']);
        for (const c of chips) expect(c.getAttribute('aria-pressed')).toBe('false');
    });

    it('ticking writes the list in the game\'s order; unticking the last drops the key', () => {
        const id = useEntityStore.getState().addToken({ name: 'Dock Fixture' });
        useEntityStore.getState().setActiveEntity(id, 'token');
        const { container } = render(React.createElement(TokenEditor));

        fireEvent.click(chip(container, 'sand'));
        fireEvent.click(chip(container, 'shore'));
        expect(useEntityStore.getState().tokens[id].standsOn).toEqual(['shore', 'sand']);
        expect(chip(container, 'shore').getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(chip(container, 'sand'));
        expect(useEntityStore.getState().tokens[id].standsOn).toEqual(['shore']);
        fireEvent.click(chip(container, 'shore'));
        expect(useEntityStore.getState().tokens[id].standsOn).toBeUndefined();
        expect(JSON.parse(JSON.stringify(syncPayload()['tokens.json'][id]))).not.toHaveProperty('standsOn');
    });
});

describe('⭐ standsOn survives load → Recalculate → Sync, and an empty list is dropped', () => {
    it('a list reaches tokens.json as written, and a reload and a second sync keep it', () => {
        const id = useEntityStore.getState().addToken({ name: 'Sailboat Fixture' });
        useEntityStore.getState().updateToken(id, { standsOn: ['water'] });
        const first = asFile(syncPayload());
        expect(first['tokens.json'][id].standsOn).toEqual(['water']);

        hydrate(first);
        expect(useEntityStore.getState().tokens[id].standsOn).toEqual(['water']);
        const second = asFile(syncPayload());
        expect(second['tokens.json'][id].standsOn).toEqual(['water']);
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(JSON.stringify(first[f], null, 2));
    });

    it('an empty list is dropped on Sync, not written', () => {
        const id = useEntityStore.getState().addToken({ name: 'Empty Fixture' });
        useEntityStore.getState().updateToken(id, { standsOn: [] });
        const written = asFile(syncPayload())['tokens.json'][id];
        expect(written).not.toHaveProperty('standsOn');
    });

    it('today\'s data, which has no standsOn, still round-trips byte-identical', () => {
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });
});
