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
import { isSmallToken } from '../config/matGeometry.js';

/**
 * B8.1 — the CMS models **`artSize`** before any content uses it (roadmap v1
 * §0.3: Sync destroys what the CMS does not carry). Slice B8.2 then sets the
 * saplings and the sprout small through the CMS.
 */
const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'maps.json', 'tokenRecipes.json', 'effects.json'];
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
        maps: files['maps.json'],
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
const STANDARD = 'token_stone_outcrop';
const SHIPPED_SMALL = ['token_apple_sapling', 'token_oak_sapling', 'token_wheat_sprout'];

beforeEach(() => load(shipped()));
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

describe('a control sync of today’s data changes nothing', () => {
    it('exactly the saplings and the sprout ship small (B8.2, through the CMS)', () => {
        const marked = Object.keys(shippedTokens).filter((id) => 'artSize' in shippedTokens[id]).sort();
        expect(marked).toEqual(SHIPPED_SMALL);
        for (const id of SHIPPED_SMALL) {
            expect(shippedTokens[id].artSize).toBe('small');
            expect(shippedTokens[id].size).toBe(1);
        }
        expect('artSize' in shippedTokens[STANDARD]).toBe(false);
        expect(shippedTokens[STANDARD].size).toBe(1);
    });

    it('load → Recalculate → Sync writes all five files byte-identical', () => {
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });
});

describe("artSize: 'small' survives load → edit → sync → reload", () => {
    it("reaches tokens.json on that Token only, the rest of its record untouched", () => {
        const before = { ...useEntityStore.getState().tokens[STANDARD] };
        useEntityStore.getState().updateToken(STANDARD, { artSize: 'small' });

        const written = syncPayload()['tokens.json'][STANDARD];
        expect(written).toEqual({ ...before, artSize: 'small' });
        expect(isSmallToken(written)).toBe(true);
    });

    it('a second load of the synced files and a second sync change nothing, and keep it', () => {
        useEntityStore.getState().updateToken(STANDARD, { artSize: 'small' });
        const first = syncPayload();
        const serialised = Object.fromEntries(FILES.map((f) => [f, JSON.stringify(first[f], null, 2)]));

        load(Object.fromEntries(FILES.map((f) => [f, JSON.parse(serialised[f])])));
        const second = syncPayload();
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(serialised[f]);
        expect(second['tokens.json'][STANDARD].artSize).toBe('small');

        const now = second['tokens.json'];
        for (const other of Object.keys(shippedTokens).filter((t) => t !== STANDARD)) {
            expect(JSON.stringify(now[other])).toBe(JSON.stringify(shippedTokens[other]));
        }
        // Every other file is exactly as shipped.
        for (const f of FILES.filter((x) => x !== 'tokens.json')) {
            expect(serialised[f]).toBe(raw[f].trimEnd());
        }
    });
});

describe('the Token editor’s Token Size control', () => {
    function editor(id) {
        useEntityStore.getState().setActiveEntity(id, 'token');
        return render(React.createElement(TokenEditor));
    }

    it('Small writes artSize: small; Standard removes it and the sync is byte-identical again', () => {
        const { container } = editor(STANDARD);
        const select = within(container).getByLabelText('Token Size');
        expect(select.value).toBe('standard');
        expect(select.disabled).toBe(false);

        fireEvent.change(select, { target: { value: 'small' } });
        expect(useEntityStore.getState().tokens[STANDARD].artSize).toBe('small');
        expect(select.value).toBe('small');

        fireEvent.change(select, { target: { value: 'standard' } });
        expect(useEntityStore.getState().tokens[STANDARD].artSize).toBeUndefined();
        const files = syncPayload();
        expect(JSON.stringify(files['tokens.json'], null, 2)).toBe(raw['tokens.json'].trimEnd());
    });

    it('⚠️ a 2×2 cannot be small: the control is disabled and going 2×2 clears it', () => {
        useEntityStore.getState().updateToken(STANDARD, { artSize: 'small' });
        const { container } = editor(STANDARD);
        const grid = [...container.querySelectorAll('select')]
            .find((s) => [...s.options].map((o) => o.value).join() === '1,2');
        fireEvent.change(grid, { target: { value: '2' } });

        const token = useEntityStore.getState().tokens[STANDARD];
        expect(token.size).toBe(2);
        expect(token.artSize).toBeUndefined();
        const select = within(container).getByLabelText('Token Size');
        expect(select.disabled).toBe(true);
        expect(select.value).toBe('standard');
    });
});
