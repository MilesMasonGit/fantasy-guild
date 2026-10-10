// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { asLoaded } from './fixtures/shippedAsLoaded.js';

import { useEntityStore, makeLifecycleBlock, TOKEN_LIFECYCLE_BLOCKS } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { RESPAWN_DEFAULTS as CMS_RESPAWN_DEFAULTS, RESPAWN_MODES as CMS_RESPAWN_MODES } from '../../cms/src/utils/constants';
import { RESPAWN_DEFAULTS, RESPAWN_MODES } from '../config/registries/tokenConstants.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * The CMS's Respawns block: a Token's way back after it runs out (refill in place after a time,
 * or regrow from another Token that grows back into it). Authored in the Token editor, carried
 * through Recalculate and Sync exactly as written, and gone without a trace when removed.
 *
 * ⚠️ The store's persistence is pointed at a no-op for this file, so nothing here can reach the
 * owner's real workspace (`localStorage['fantasy-guild-cms-v2']`) and from there `data/`.
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));

const NOOP = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const WORKSPACE_KEY = 'fantasy-guild-cms-v2';

function workspaceFromFiles(files) {
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    return {
        items: files['items.json'], tokens: files['tokens.json'],
        effects: files['effects.json'], recipePools,
    };
}

const loadShipped = () => useEntityStore.getState().hydrate(workspaceFromFiles(
    Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]))
));

/** Recalculate + build the sync payload, exactly as Sync to Game does, minus the POST. */
const syncPayload = () => syncFiles(useEntityStore.getState().recalculateEconomy({}));

/** The editor on one Token, and its Respawns block. */
function openEditor(id) {
    useEntityStore.getState().setActiveEntity(id, 'token');
    const { container } = render(React.createElement(TokenEditor));
    return { container, block: () => container.querySelector('[data-block="respawn"]') };
}

let storageBefore;
beforeAll(() => {
    storageBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: NOOP });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storageBefore);
});
beforeEach(() => loadShipped());
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

describe('the block and its starting value', () => {
    it('is one of the lifecycle blocks, and a new one is a 12 s refill on the game\'s defaults', () => {
        expect(TOKEN_LIFECYCLE_BLOCKS).toContain('respawn');
        expect(CMS_RESPAWN_DEFAULTS).toBe(RESPAWN_DEFAULTS);
        expect(CMS_RESPAWN_MODES).toBe(RESPAWN_MODES);
        expect(makeLifecycleBlock('respawn')).toEqual({ mode: 'refill', afterMs: RESPAWN_DEFAULTS.afterMs });
        expect(RESPAWN_DEFAULTS.afterMs).toBe(12000);
    });

    it('a Token without one is written without one', () => {
        const id = useEntityStore.getState().addToken({ name: 'Plain Fixture' });
        expect(syncPayload()['tokens.json'][id]).not.toHaveProperty('respawn');
    });
});

describe('authored in the editor, it round-trips through Sync', () => {
    it('refill: Add, set the time, Sync, reload, Sync again: the same bytes', () => {
        const id = useEntityStore.getState().addToken({ name: 'Vein Fixture', uses: 5 });
        const { block } = openEditor(id);
        fireEvent.click(within(block()).getByText('Add'));
        expect(useEntityStore.getState().tokens[id].respawn).toEqual({ mode: 'refill', afterMs: 12000 });

        fireEvent.change(within(block()).getByLabelText('Rests for (ms)'), { target: { value: '15000' } });
        expect(useEntityStore.getState().tokens[id].respawn).toEqual({ mode: 'refill', afterMs: 15000 });
        // Never under a second, as the game reads it.
        fireEvent.change(within(block()).getByLabelText('Rests for (ms)'), { target: { value: '200' } });
        expect(useEntityStore.getState().tokens[id].respawn.afterMs).toBe(1000);
        fireEvent.change(within(block()).getByLabelText('Rests for (ms)'), { target: { value: '15000' } });

        const first = syncPayload();
        expect(first['tokens.json'][id].respawn).toEqual({ mode: 'refill', afterMs: 15000 });

        const serialised = Object.fromEntries(FILES.map((f) => [f, JSON.stringify(first[f], null, 2)]));
        useEntityStore.getState().hydrate(workspaceFromFiles(
            Object.fromEntries(FILES.map((f) => [f, JSON.parse(serialised[f])]))
        ));
        const second = syncPayload();
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(serialised[f]);
    });

    it('regrow: switching mode drops the time and asks for the Token it regrows from', () => {
        const store = useEntityStore.getState();
        const sapling = store.addToken({ name: 'Sapling Fixture' });
        const tree = store.addToken({ name: 'Tree Fixture', uses: 5 });
        useEntityStore.getState().updateToken(sapling, { grows: { into: tree, afterMs: 30000 } });
        const { block } = openEditor(tree);
        fireEvent.click(within(block()).getByText('Add'));

        fireEvent.change(within(block()).getByLabelText('Comes back by'), { target: { value: 'regrow' } });
        expect(useEntityStore.getState().tokens[tree].respawn).toEqual({ mode: 'regrow', into: '' });

        fireEvent.change(within(block()).getByLabelText('Regrows from'), { target: { value: sapling } });
        expect(useEntityStore.getState().tokens[tree].respawn).toEqual({ mode: 'regrow', into: sapling });
        // The time it takes is the Sapling's own growth, said beside the pick.
        expect(within(block()).getByText(/grows back in 30 s/i)).toBeTruthy();

        expect(syncPayload()['tokens.json'][tree].respawn).toEqual({ mode: 'regrow', into: sapling });

        fireEvent.change(within(block()).getByLabelText('Comes back by'), { target: { value: 'refill' } });
        expect(useEntityStore.getState().tokens[tree].respawn).toEqual({ mode: 'refill', afterMs: 12000 });
    });

    it('a regrow pick that never grows back into this Token says so', () => {
        const store = useEntityStore.getState();
        const stone = store.addToken({ name: 'Stone Fixture' });
        const tree = store.addToken({ name: 'Tree Fixture', uses: 5, respawn: { mode: 'regrow', into: stone } });
        const { block } = openEditor(tree);
        expect(within(block()).getByText(/never grows back/i)).toBeTruthy();
    });

    it('Remove leaves no key behind in the file', () => {
        const id = useEntityStore.getState().addToken({ name: 'Vein Fixture', uses: 5, respawn: { mode: 'refill', afterMs: 12000 } });
        const { block } = openEditor(id);
        fireEvent.click(within(block()).getByText('Remove'));
        expect(useEntityStore.getState().tokens[id].respawn).toBeUndefined();
        expect(JSON.parse(JSON.stringify(syncPayload()['tokens.json']))[id]).not.toHaveProperty('respawn');
    });

    it('renaming the Token it regrows from repoints `into`', () => {
        const store = useEntityStore.getState();
        const sapling = store.addToken({ name: 'Sapling Fixture' });
        const tree = store.addToken({ name: 'Tree Fixture', respawn: { mode: 'regrow', into: sapling } });
        useEntityStore.getState().renameEntityId(sapling, 'token_fixture_seedling', 'token');
        expect(useEntityStore.getState().tokens[tree].respawn).toEqual({ mode: 'regrow', into: 'token_fixture_seedling' });
    });
});
