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
import { auditContent } from '../systems/core/ContentAudit.js';

/**
 * ⭐ One Token size (owner 2026-11-26): the Token editor has no Token Size control and writes no
 * `artSize`. A Token still carrying the field keeps it through every edit and sync (Sync destroys
 * only what the CMS does not carry, and it carries every field), the game reads it as standard,
 * and the boot audit names it until a change pack removes it.
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
const STANDARD = 'token_stone_outcrop';
const marked = () => Object.keys(shippedTokens).filter((id) => 'artSize' in shippedTokens[id]).sort();
const LINE = 'which the game no longer reads: every Token is drawn and spaced at one size';

beforeEach(() => load(shipped()));
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

describe('a control sync of today’s data changes nothing', () => {
    it('load → Recalculate → Sync writes all four files byte-identical, a leftover Token Size included', () => {
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
        for (const id of marked()) expect(files['tokens.json'][id].artSize).toBe(shippedTokens[id].artSize);
    });
});

describe('⭐ the audit names every shipped Token still carrying a Token Size', () => {
    it('one line on each, and none on a Token without the field', () => {
        const lines = auditContent().filter((f) => f.what.includes(LINE));
        expect(lines.map((f) => f.where).sort()).toEqual(marked().map((id) => `Token "${id}"`));
        expect('artSize' in shippedTokens[STANDARD]).toBe(false);
    });
});

describe('⭐ the Token editor has no Token Size control', () => {
    function editor(id) {
        useEntityStore.getState().setActiveEntity(id, 'token');
        return render(React.createElement(TokenEditor));
    }

    it('no control by that name, and no select offering small', () => {
        const { container } = editor(STANDARD);
        expect(within(container).queryByLabelText('Token Size')).toBeNull();
        expect(container.textContent).not.toContain('Token Size');
        const offersSmall = [...container.querySelectorAll('select')].some((s) => [...s.options].some((o) => o.value === 'small'));
        expect(offersSmall).toBe(false);
    });

    it('going 2×2 writes the size and nothing else', () => {
        const before = { ...useEntityStore.getState().tokens[STANDARD] };
        const { container } = editor(STANDARD);
        const grid = [...container.querySelectorAll('select')]
            .find((s) => [...s.options].map((o) => o.value).join() === '1,2');
        fireEvent.change(grid, { target: { value: '2' } });
        expect(useEntityStore.getState().tokens[STANDARD]).toEqual({ ...before, size: 2 });
    });

    it('an edit to a Token still carrying the field leaves the field as it was', () => {
        // As a Token the old control marked small comes into the workspace.
        useEntityStore.getState().updateToken(STANDARD, { artSize: 'small' });
        const { container } = editor(STANDARD);
        const grid = [...container.querySelectorAll('select')]
            .find((s) => [...s.options].map((o) => o.value).join() === '1,2');
        fireEvent.change(grid, { target: { value: '2' } });
        const written = syncPayload()['tokens.json'][STANDARD];
        expect(written.size).toBe(2);
        expect(written.artSize).toBe('small');
    });
});
