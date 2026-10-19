// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import { cardArtOf } from '../ui/components/board/tokenCard.js';
import { resolveSpritePath } from '../utils/AssetManager.js';

/**
 * The Token editor's Card art field: the picture behind a Token's card in the game. Written only
 * when set, carried through load, edit, sync and reload, and read by the game's card. A store
 * hydrated here from the shipped files, never the CMS's own workspace.
 */
const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
// git may check these out with CRLF; JSON.stringify always emits LF.
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
// ⚠️ As the CMS holds the files once loaded: it renames retired skill ids, so until the
// owner's next Sync writes them, a sync differs from data/ by that rename and nothing else.
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));

/** The workspace `/api/load-game-data` builds from `data/` (vite-plugin-cms-api.js). */
function workspaceFromFiles(files) {
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) {
        (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    }
    return {
        items: files['items.json'],
        tokens: files['tokens.json'],
        effects: files['effects.json'],
        recipePools,
    };
}

function load(files) {
    useEntityStore.getState().hydrate(workspaceFromFiles(files));
}

const shipped = () => Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]));

/** Recalculate + build the sync payload, exactly as `syncToGame` does, minus the POST. */
function syncPayload() {
    const balanced = useEntityStore.getState().recalculateEconomy({});
    return syncFiles(balanced);
}

const shippedTokens = JSON.parse(raw['tokens.json']);
const TOKEN = 'token_copper_ore_vein';

beforeEach(() => load(shipped()));
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

function editor(id) {
    useEntityStore.getState().setActiveEntity(id, 'token');
    return render(React.createElement(TokenEditor));
}

describe('Card art in the Token editor', () => {
    it('no shipped Token names one yet, and a control sync changes nothing', () => {
        expect(Object.keys(shippedTokens).filter((id) => 'cardArt' in shippedTokens[id])).toEqual([]);
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });

    it('typing a picture writes cardArt on that Token only; the game card reads it', () => {
        const before = { ...useEntityStore.getState().tokens[TOKEN] };
        const { container } = editor(TOKEN);
        const input = within(container).getByLabelText('Card art');
        expect(input.value).toBe('');

        fireEvent.change(input, { target: { value: 'b_forge' } });
        expect(useEntityStore.getState().tokens[TOKEN].cardArt).toBe('b_forge');
        expect(container.querySelector('[data-card-art-preview]')).not.toBeNull();

        const written = syncPayload()['tokens.json'];
        expect(written[TOKEN]).toEqual({ ...before, cardArt: 'b_forge' });
        for (const other of Object.keys(shippedTokens).filter((t) => t !== TOKEN)) {
            expect(JSON.stringify(written[other])).toBe(JSON.stringify(shippedTokens[other]));
        }
        expect(cardArtOf(written[TOKEN])).toEqual({ path: resolveSpritePath('b_forge'), source: 'override' });
    });

    it('survives a reload of the synced files', () => {
        useEntityStore.getState().updateToken(TOKEN, { cardArt: 'b_forge' });
        const first = syncPayload();
        const serialised = Object.fromEntries(FILES.map((f) => [f, JSON.stringify(first[f], null, 2)]));
        load(Object.fromEntries(FILES.map((f) => [f, JSON.parse(serialised[f])])));
        const second = syncPayload();
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(serialised[f]);
        expect(second['tokens.json'][TOKEN].cardArt).toBe('b_forge');
    });

    it('Clear and an emptied box both remove the key, and the sync is byte-identical again', () => {
        useEntityStore.getState().updateToken(TOKEN, { cardArt: 'b_forge' });
        const { container } = editor(TOKEN);
        fireEvent.click(container.querySelector('[data-card-art-clear]'));
        expect(useEntityStore.getState().tokens[TOKEN].cardArt).toBeUndefined();

        const input = within(container).getByLabelText('Card art');
        fireEvent.change(input, { target: { value: 'b_mine' } });
        fireEvent.change(input, { target: { value: '' } });
        expect(useEntityStore.getState().tokens[TOKEN].cardArt).toBeUndefined();
        const files = syncPayload();
        expect(JSON.stringify(files['tokens.json'], null, 2)).toBe(raw['tokens.json'].trimEnd());
    });
});
