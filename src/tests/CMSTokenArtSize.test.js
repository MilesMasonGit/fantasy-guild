import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import { isSmallToken } from '../config/matGeometry.js';

/**
 * B8.1 — the CMS models **`artSize`** (TL-19, FB-18) before any content uses it
 * (roadmap v1 §0.3: Sync destroys what the CMS does not carry). Slice B8.2 then
 * sets the saplings and the sprout small through the CMS.
 *
 * ## How the field is written
 * Only when Small: `artSize: 'small'` at the top of the Token record. Standard
 * removes it (the key is left `undefined`, which JSON drops), so a standard
 * Token's record is exactly what it was — a missing field is standard, which
 * is what the game reads (`isSmallToken`). The store shallow-merges patches and
 * Recalculate / Sync never rebuild a Token field by field, so the key rides
 * through untouched. Only a 1×1 may be small: the control is disabled on a 2×2
 * and switching Grid Size to 2×2 clears it.
 *
 * Nothing here touches `data/`: the files are READ, loaded into the store the
 * way `/api/load-game-data` builds its payload, and the sync payload is built
 * in memory with `syncFiles` and compared. No request is sent.
 */
const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'maps.json', 'tokenRecipes.json', 'effects.json'];
// git may check these out with CRLF; JSON.stringify always emits LF.
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, read(f)]));

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
const SAPLING = 'token_oak_sapling';

beforeEach(() => load(shipped()));
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

describe('a control sync of today’s data changes nothing', () => {
    it('no shipped Token carries artSize yet (B8.2 sets it through the CMS)', () => {
        const marked = Object.keys(shippedTokens).filter((id) => 'artSize' in shippedTokens[id]);
        expect(marked).toEqual([]);
        expect(shippedTokens[SAPLING].size).toBe(1);
    });

    it('load → Recalculate → Sync writes all five files byte-identical', () => {
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });
});

describe("artSize: 'small' survives load → edit → sync → reload", () => {
    it("reaches tokens.json on that Token only, the rest of its record untouched", () => {
        const before = { ...useEntityStore.getState().tokens[SAPLING] };
        useEntityStore.getState().updateToken(SAPLING, { artSize: 'small' });

        const written = syncPayload()['tokens.json'][SAPLING];
        expect(written).toEqual({ ...before, artSize: 'small' });
        expect(isSmallToken(written)).toBe(true);
    });

    it('a second load of the synced files and a second sync change nothing, and keep it', () => {
        useEntityStore.getState().updateToken(SAPLING, { artSize: 'small' });
        const first = syncPayload();
        const serialised = Object.fromEntries(FILES.map((f) => [f, JSON.stringify(first[f], null, 2)]));

        load(Object.fromEntries(FILES.map((f) => [f, JSON.parse(serialised[f])])));
        const second = syncPayload();
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(serialised[f]);
        expect(second['tokens.json'][SAPLING].artSize).toBe('small');

        const now = second['tokens.json'];
        for (const other of Object.keys(shippedTokens).filter((t) => t !== SAPLING)) {
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
        const { container } = editor(SAPLING);
        const select = within(container).getByLabelText('Token Size');
        expect(select.value).toBe('standard');
        expect(select.disabled).toBe(false);

        fireEvent.change(select, { target: { value: 'small' } });
        expect(useEntityStore.getState().tokens[SAPLING].artSize).toBe('small');
        expect(select.value).toBe('small');

        fireEvent.change(select, { target: { value: 'standard' } });
        expect(useEntityStore.getState().tokens[SAPLING].artSize).toBeUndefined();
        const files = syncPayload();
        expect(JSON.stringify(files['tokens.json'], null, 2)).toBe(raw['tokens.json'].trimEnd());
    });

    it('⚠️ a 2×2 cannot be small: the control is disabled and going 2×2 clears it', () => {
        useEntityStore.getState().updateToken(SAPLING, { artSize: 'small' });
        const { container } = editor(SAPLING);
        const grid = [...container.querySelectorAll('select')]
            .find((s) => [...s.options].map((o) => o.value).join() === '1,2');
        fireEvent.change(grid, { target: { value: '2' } });

        const token = useEntityStore.getState().tokens[SAPLING];
        expect(token.size).toBe(2);
        expect(token.artSize).toBeUndefined();
        const select = within(container).getByLabelText('Token Size');
        expect(select.disabled).toBe(true);
        expect(select.value).toBe('standard');
    });
});
