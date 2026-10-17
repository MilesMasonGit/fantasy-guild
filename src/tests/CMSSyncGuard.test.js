// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { compareSync, describeSyncDiff } from '../../cms/src/engine/syncGuard';
import TopBar from '../../cms/src/components/layout/TopBar.jsx';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';

/**
 * Sync to Game refuses to remove content the game has unless the author confirms. A stale browser
 * workspace once synced over newer `data/` and silently dropped Tokens, items, recipes and effects.
 * Nothing here touches the real workspace or `data/` (TESTING, "The CMS").
 */

const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;

beforeAll(() => {
    storedBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: noStorage });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

const files = (over = {}) => ({
    'tokens.json': { token_a: { name: 'Alpha' }, token_b: { name: 'Beta' } },
    'items.json': { item_x: { name: 'Ex', type: 'material' }, map_m: { name: 'Mire', type: 'map' } },
    'tokenRecipes.json': [{ id: 'rec_1', name: 'One', skill: 'smithing' }, { name: 'Old', skill: 'cooking' }],
    'effects.json': { effect_e: { id: 'effect_e', name: 'Eff' } },
    ...over,
});

describe('compareSync', () => {
    it('finds nothing when the same ids are written, even with changed fields', () => {
        const next = files({
            'tokens.json': { token_a: { name: 'Alpha renamed', tier: 3 }, token_b: { name: 'Beta' } },
            'tokenRecipes.json': [{ id: 'rec_1', name: 'One', skill: 'smithing', inputs: [1] }, { name: 'Old v2', skill: 'cooking' }],
        });
        const diff = compareSync(files(), next);
        expect(diff.hasRemovals).toBe(false);
        expect(Object.values(diff.removed).flat()).toEqual([]);
        expect(Object.values(diff.added).flat()).toEqual([]);
    });

    it('lists removed and added entities per collection, by id and name', () => {
        const next = files({
            'tokens.json': { token_a: { name: 'Alpha' }, token_c: { name: 'Gamma' } },
            'items.json': { map_m: { name: 'Mire', type: 'map' }, map_n: { name: 'Nook', type: 'map' } },
            'effects.json': {},
        });
        const diff = compareSync(files(), next);
        expect(diff.hasRemovals).toBe(true);
        expect(diff.removed.tokens).toEqual([{ id: 'token_b', name: 'Beta' }]);
        expect(diff.added.tokens).toEqual([{ id: 'token_c', name: 'Gamma' }]);
        expect(diff.removed.items).toEqual([{ id: 'item_x', name: 'Ex' }]);
        expect(diff.removed.maps).toEqual([]);
        expect(diff.added.maps).toEqual([{ id: 'map_n', name: 'Nook' }]);
        expect(diff.removed.effects).toEqual([{ id: 'effect_e', name: 'Eff' }]);
    });

    it('keys recipes without an id as pooled_<skill>_<index>, the way the CMS does', () => {
        const diff = compareSync(files(), files({ 'tokenRecipes.json': [{ id: 'rec_1', skill: 'smithing' }] }));
        expect(diff.removed.recipes).toEqual([{ id: 'pooled_cooking_0', name: 'Old' }]);
    });

    it('only additions are not removals', () => {
        const diff = compareSync(files(), files({ 'effects.json': { effect_e: {}, effect_f: { name: 'Eff 2' } } }));
        expect(diff.hasRemovals).toBe(false);
        expect(diff.added.effects).toEqual([{ id: 'effect_f', name: 'Eff 2' }]);
    });

    it('treats a missing file on disk as empty', () => {
        expect(compareSync({ 'tokens.json': null }, files()).hasRemovals).toBe(false);
    });

    it('compares Starter Camp placements only when the Sync writes the Starter Camp; moving one is not a removal', () => {
        const camp = { tokens: [{ typeId: 'token_a', x: 1, y: 1 }, { typeId: 'token_a', x: 2, y: 2 }, { typeId: 'token_b', x: 3, y: 3 }] };
        expect(compareSync({ ...files(), 'starterCamp.json': camp }, files()).hasRemovals).toBe(false);
        const moved = { tokens: [{ typeId: 'token_b', x: 9, y: 9 }, { typeId: 'token_a', x: 5, y: 5 }, { typeId: 'token_a', x: 6, y: 6 }] };
        expect(compareSync({ 'starterCamp.json': camp }, { 'starterCamp.json': moved }).hasRemovals).toBe(false);
        const fewer = { tokens: [{ typeId: 'token_a', x: 1, y: 1 }] };
        const diff = compareSync({ 'starterCamp.json': camp }, { 'starterCamp.json': fewer });
        expect(diff.removed.starterCamp.map((t) => t.id)).toEqual(['token_a #2', 'token_b']);
    });

    it('says it in plain words', () => {
        const removed = { tokens: Array(16).fill(0).map((_, i) => ({ id: 't' + i, name: 't' })), items: Array(14).fill({ id: 'i', name: 'i' }) };
        const added = { tokens: Array(8).fill({ id: 'n', name: 'n' }) };
        expect(describeSyncDiff({ removed, added })).toBe(
            "This Sync would remove 16 Tokens and 14 items that the game has now, and add 8 the game doesn't have. " +
            "If you didn't delete these on purpose, your CMS copy is probably out of date: use Backups → Restore from Game first."
        );
        expect(describeSyncDiff({ removed: { recipes: [{ id: 'r', name: 'r' }] }, added: {} })).toMatch(/^This Sync would remove 1 recipe that the game has now\. If/);
    });
});

describe('the sync route', () => {
    let dataDir, handler;

    function request(method, url, body) {
        return new Promise((resolve) => {
            const req = new EventEmitter();
            Object.assign(req, { method, url, headers: {} });
            const res = {
                statusCode: 200,
                setHeader: () => {},
                end: (text = '') => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null })
            };
            handler(req, res, () => resolve({ status: 'next' }));
            if (body !== undefined) req.emit('data', JSON.stringify(body));
            req.emit('end');
        });
    }
    const onDisk = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));

    beforeEach(() => {
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-sync-guard-'));
        for (const [name, content] of Object.entries(files())) {
            fs.writeFileSync(path.join(dataDir, name), JSON.stringify(content));
        }
        cmsFileApi({ dataDir }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
    });
    afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

    it('writes nothing and answers 409 with the lists when the Sync would remove content', async () => {
        const stale = files({ 'tokens.json': { token_a: { name: 'Alpha' } } });
        const res = await request('POST', '/api/sync-game-data', { files: stale });
        expect(res.status).toBe(409);
        expect(res.body.needsConfirm).toBe(true);
        expect(res.body.diff.removed.tokens).toEqual([{ id: 'token_b', name: 'Beta' }]);
        expect(onDisk('tokens.json')).toEqual(files()['tokens.json']);
    });

    it('writes when the removals are confirmed', async () => {
        const stale = files({ 'tokens.json': { token_a: { name: 'Alpha' } } });
        const res = await request('POST', '/api/sync-game-data', { files: stale, confirmRemovals: true });
        expect(res.status).toBe(200);
        expect(res.body.commit).toMatchObject({ committed: false });
        expect(onDisk('tokens.json')).toEqual({ token_a: { name: 'Alpha' } });
    });

    it('writes additions and edits without asking', async () => {
        const next = files({ 'tokens.json': { token_a: { name: 'Alpha 2' }, token_b: { name: 'Beta' }, token_c: { name: 'Gamma' } } });
        const res = await request('POST', '/api/sync-game-data', { files: next });
        expect(res.status).toBe(200);
        expect(Object.keys(onDisk('tokens.json'))).toEqual(['token_a', 'token_b', 'token_c']);
    });

    it('Restore from Game reads the same folder', async () => {
        const res = await request('GET', '/api/load-game-data');
        expect(res.status).toBe(200);
        expect(Object.keys(res.body.tokens)).toEqual(['token_a', 'token_b']);
    });
});

describe('the Sync to Game button', () => {
    const diff = compareSync(files(), files({ 'tokens.json': { token_a: { name: 'Alpha' } } }));
    let calls;

    function stubServer({ restore } = {}) {
        calls = [];
        vi.stubGlobal('confirm', () => true);
        vi.stubGlobal('fetch', vi.fn(async (url, opts = {}) => {
            const body = opts.body ? JSON.parse(opts.body) : null;
            calls.push({ url, body });
            if (url === '/api/load-game-data') return { ok: true, status: 200, json: async () => restore };
            if (body?.confirmRemovals) return { ok: true, status: 200, json: async () => ({ success: true, filesWritten: [] }) };
            return { ok: false, status: 409, json: async () => ({ needsConfirm: true, diff }) };
        }));
    }

    beforeEach(() => {
        useEntityStore.getState().hydrate({ tokens: { token_a: { name: 'Alpha' } }, items: {}, effects: {}, recipePools: {} });
    });

    const renderBar = () => render(React.createElement(TopBar, {
        onViewChange: () => {}, currentView: 'editor',
        onOpenGenerate: () => {}, onOpenSettings: () => {}, onOpenFileManager: () => {}
    }));

    it('shows the panel instead of reporting success, and Sync anyway resends with the confirm', async () => {
        stubServer();
        const view = renderBar();
        await act(async () => { fireEvent.click(view.getByRole('button', { name: /Sync to Game/ })); });
        expect(view.getByRole('dialog')).toBeTruthy();
        expect(view.getByText(/This Sync would remove 1 Token that the game has now/)).toBeTruthy();
        expect(view.getByText('Beta')).toBeTruthy();
        expect(calls).toHaveLength(1);
        expect(calls[0].body.confirmRemovals).toBe(false);

        await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Sync anyway' })); });
        expect(calls).toHaveLength(2);
        expect(calls[1].body).toMatchObject({ confirmRemovals: true, files: calls[0].body.files });
        expect(view.queryByRole('dialog')).toBeNull();
        expect(view.getByText('Synced to Game!')).toBeTruthy();
    });

    it('Restore from Game instead loads data/ into the workspace and writes nothing', async () => {
        stubServer({ restore: { tokens: files()['tokens.json'], items: {}, effects: {}, recipePools: {} } });
        const view = renderBar();
        await act(async () => { fireEvent.click(view.getByRole('button', { name: /Sync to Game/ })); });
        await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Restore from Game instead' })); });
        expect(calls.map((c) => c.url)).toEqual(['/api/sync-game-data', '/api/load-game-data']);
        expect(Object.keys(useEntityStore.getState().tokens)).toEqual(['token_a', 'token_b']);
        expect(view.queryByRole('dialog')).toBeNull();
        expect(view.getByText('Sync to Game')).toBeTruthy();
    });
});
