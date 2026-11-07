// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import React from 'react';
import { render, cleanup, fireEvent, act, waitFor } from '@testing-library/react';

import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import {
    readWorkspaceFile, saveWorkspaceFile, serializeWorkspaceFile, putWorkspace, RevisionConflict, WORKSPACE_KEYS,
} from '../../cms/workspaceFile.js';
import {
    connectDiskWorkspace, disconnectDiskWorkspace, saveWorkspaceNow, useDiskWorkspace, workspaceStorage,
    ENTITY_KEY, GLOBALS_KEY, DISK_META_KEY, SAVE_DELAY_MS,
} from '../../cms/src/engine/diskWorkspace.js';
import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useGlobalStore } from '../../cms/src/stores/useGlobalStore';
import FileManagerModal from '../../cms/src/components/shared/FileManagerModal.jsx';
import { chooseWorkspace, loadWorkspace } from '../../cms/packWorkspace.mjs';
import { WorkspaceBanner, WorkspaceStatus } from '../../cms/src/components/layout/WorkspaceStatus.jsx';

/**
 * The CMS workspace on disk (`cms/workspace/workspace.json`): the server's file and its revision
 * guard, the page's storage adapter, the move from the browser's localStorage, and New workspace.
 * Every file lives in a throwaway folder and every page call goes to the real route through an
 * in-memory request (TESTING, "The CMS"); nothing touches the real workspace or `data/`.
 */

const tmpRoots = [];
function sandbox() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-disk-ws-'));
    tmpRoots.push(dir);
    return dir;
}
afterAll(() => { for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true }); });

/** One in-memory request through the CMS server's middleware. */
function call(handler, method, url, body) {
    return new Promise((resolve) => {
        const req = new EventEmitter();
        Object.assign(req, { method, url, headers: {} });
        const res = {
            statusCode: 200,
            setHeader: () => {},
            end: (text = '') => resolve({ status: res.statusCode, text }),
        };
        handler(req, res, () => resolve({ status: 404, text: JSON.stringify({ error: 'next' }) }));
        if (body !== undefined) req.emit('data', typeof body === 'string' ? body : JSON.stringify(body));
        req.emit('end');
    });
}

function serverFor(dir, options = {}) {
    let handler;
    cmsFileApi({ sandboxDir: dir, ...options }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
    const requests = [];
    const fetchFn = vi.fn(async (url, init = {}) => {
        const method = init.method || 'GET';
        requests.push({ method, url });
        const { status, text } = await call(handler, method, url, init.body);
        return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(text) };
    });
    return { handler, fetchFn, requests, request: (...a) => call(handler, ...a) };
}

const wsFile = (dir) => path.join(dir, 'workspace', 'workspace.json');
const backups = (dir) => (fs.existsSync(path.join(dir, 'backups')) ? fs.readdirSync(path.join(dir, 'backups')) : []);
const readBackup = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, 'backups', name), 'utf8'));

const sample = (name = 'Log') => ({
    items: { item_log: { id: 'item_log', name, type: 'material', value: 3 } },
    tokens: { token_grove: { id: 'token_grove', name: 'Grove', effects: [] } },
    effects: {},
    recipePools: { crafting: [{ id: 'recipe_plank', name: 'Plank', skill: 'crafting', inputs: [], outputs: [] }] },
    starterCamp: null,
    skillPerks: null,
    hallConstellations: null,
    hallStars: null,
    world: null,
    planSettings: null,
});

describe('the workspace file', () => {
    it('reads a missing file as revision 0 and writes revision 1, then refuses a stale base', () => {
        const file = wsFile(sandbox());
        expect(readWorkspaceFile(file)).toMatchObject({ exists: false, revision: 0 });
        const first = saveWorkspaceFile(file, sample(), { baseRevision: 0, simDials: { a: 1 }, savedBy: 'test' });
        expect(first.revision).toBe(1);
        expect(readWorkspaceFile(file)).toMatchObject({ exists: true, revision: 1, savedBy: 'test', simDials: { a: 1 } });
        expect(saveWorkspaceFile(file, sample('Oak Log'), { baseRevision: 1 }).revision).toBe(2);
        // The dials stay when a writer does not send any.
        expect(readWorkspaceFile(file).simDials).toEqual({ a: 1 });
        expect(() => saveWorkspaceFile(file, sample('Stale'), { baseRevision: 1 })).toThrow(RevisionConflict);
        expect(readWorkspaceFile(file).workspace.items.item_log.name).toBe('Oak Log');
    });

    it('writes a fixed field order, the collections in the store order, records untouched and no tab selection', () => {
        const ws = { activeEntityId: 'item_log', activeEntityType: 'item', zeta: 1, ...sample() };
        ws.items = { item_b: { name: 'B', id: 'item_b' }, item_a: { id: 'item_a', name: 'A' } };
        const text = serializeWorkspaceFile({ revision: 4, savedAt: 'now', workspace: ws });
        const parsed = JSON.parse(text);
        expect(Object.keys(parsed)).toEqual(['format', 'version', 'revision', 'savedAt', 'savedBy', 'simDials', 'workspace']);
        expect(Object.keys(parsed.workspace)).toEqual([...WORKSPACE_KEYS, 'zeta']);
        // The sidebar's order and each record's own key order survive.
        expect(Object.keys(parsed.workspace.items)).toEqual(['item_b', 'item_a']);
        expect(Object.keys(parsed.workspace.items.item_b)).toEqual(['name', 'id']);
        expect(text.endsWith('}\n')).toBe(true);
        expect(text).toContain('\n  "workspace": {\n    "items": {');
    });

    it('never writes over a damaged file', () => {
        const dir = sandbox();
        const file = wsFile(dir);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '{ half a workspace');
        const out = putWorkspace(file, { baseRevision: 0, workspace: sample() }, { backupsDir: path.join(dir, 'backups') });
        expect(out.status).toBe(500);
        expect(fs.readFileSync(file, 'utf8')).toBe('{ half a workspace');
    });
});

describe('the change-pack helper', () => {
    it('reads the workspace on disk first, unwrapped, whatever autosaves or data/ say', () => {
        const root = sandbox();
        fs.mkdirSync(path.join(root, 'cms', 'backups'), { recursive: true });
        fs.writeFileSync(path.join(root, 'cms', 'backups', 'autosave_2099-01-01T00-00-00-000Z.json'), JSON.stringify(sample('Autosave')));
        saveWorkspaceFile(path.join(root, 'cms', 'workspace', 'workspace.json'), sample('On disk'), { baseRevision: 0 });
        expect(chooseWorkspace(root, null)).toMatchObject({ kind: 'disk' });
        const { workspace, source } = loadWorkspace(root, null);
        expect(workspace.items.item_log.name).toBe('On disk');
        expect(source).toMatch(/CMS workspace on disk/);
        // A named workspace file is unwrapped too; a bare backup is read as it is.
        expect(loadWorkspace(root, path.join(root, 'cms', 'workspace', 'workspace.json')).workspace.items.item_log.name).toBe('On disk');
        expect(loadWorkspace(root, path.join(root, 'cms', 'backups', 'autosave_2099-01-01T00-00-00-000Z.json')).workspace.items.item_log.name).toBe('Autosave');
    });
});

describe('the /api/workspace route', () => {
    it('seeds once with a migrated backup, saves by revision and refuses a stale one into a backup', async () => {
        const dir = sandbox();
        const { request } = serverFor(dir);
        expect(JSON.parse((await request('GET', '/api/workspace')).text)).toMatchObject({ exists: false, revision: 0 });

        const seeded = await request('PUT', '/api/workspace', { seed: true, workspace: sample(), simDials: { dial: 2 } });
        expect(seeded.status).toBe(200);
        const { backup } = JSON.parse(seeded.text);
        expect(backup).toMatch(/^migrated_/);
        expect(readBackup(dir, `${backup}.json`)).toMatchObject({ items: sample().items, simDials: { dial: 2 } });
        // A second seed (another tab moving at the same time) is refused.
        expect((await request('PUT', '/api/workspace', { seed: true, workspace: sample('Other') })).status).toBe(409);

        const got = JSON.parse((await request('GET', '/api/workspace')).text);
        expect(got).toMatchObject({ exists: true, revision: 1, simDials: { dial: 2 }, workspace: { items: sample().items } });
        const meta = JSON.parse((await request('GET', '/api/workspace?meta=1')).text);
        expect(meta).toMatchObject({ exists: true, revision: 1 });
        expect(meta.workspace).toBeUndefined();

        expect((await request('PUT', '/api/workspace', { baseRevision: 1, workspace: sample('Oak'), clientId: 'tab-a' })).status).toBe(200);
        const refused = await request('PUT', '/api/workspace', { baseRevision: 1, workspace: sample('Birch'), clientId: 'tab-b' });
        expect(refused.status).toBe(409);
        expect(JSON.parse(refused.text)).toMatchObject({ revision: 2, refusedBackup: 'refused_tab-b' });
        expect(readBackup(dir, 'refused_tab-b.json').items.item_log.name).toBe('Birch');
        expect(readWorkspaceFile(wsFile(dir)).workspace.items.item_log.name).toBe('Oak');
    });

    it('keeps backups under the given folder, not the server process folder', async () => {
        const dir = sandbox();
        const { request } = serverFor(dir);
        expect((await request('POST', '/api/backups', { name: 'mine', data: sample() })).status).toBe(200);
        expect(backups(dir)).toEqual(['mine.json']);
    });

    it('is refused by the Studio server', async () => {
        let studio;
        cmsFileApi({ sandboxDir: sandbox(), studio: true }).configureServer({ middlewares: { use: (fn) => { studio = fn; } } });
        expect((await call(studio, 'GET', '/api/workspace')).status).toBe(403);
        expect((await call(studio, 'PUT', '/api/workspace', { baseRevision: 0, workspace: sample() })).status).toBe(403);
    });
});

describe('the page and the disk', () => {
    /** The page at start: the store hydrates from the browser's cache before it connects. */
    const startPage = () => useEntityStore.persist.rehydrate();
    const cache = (state, version = 1) => localStorage.setItem(ENTITY_KEY, JSON.stringify({ state, version }));
    const names = () => Object.values(useEntityStore.getState().items).map((i) => i.name);

    beforeEach(() => {
        disconnectDiskWorkspace();
        localStorage.clear();
        useEntityStore.getState().hydrate({});
        localStorage.clear();
    });
    afterEach(() => {
        disconnectDiskWorkspace();
        vi.useRealTimers();
        cleanup();
    });

    it('moves the browser workspace to disk on the first start, with a backup, and clears nothing', async () => {
        const dir = sandbox();
        const { fetchFn } = serverFor(dir);
        cache({ ...sample('Birch Log'), activeEntityId: 'item_log', activeEntityType: 'item' });
        localStorage.setItem(GLOBALS_KEY, JSON.stringify({ state: { simDials: { cycleScale: 7 }, geminiApiKey: 'k' }, version: 2 }));
        localStorage.setItem('fantasy-guild-cms-review', '{"state":{"sessions":{"p.json":{}}},"version":1}');
        const before = { ...localStorage };
        startPage();

        const status = await connectDiskWorkspace({ store: useEntityStore, globalStore: useGlobalStore, fetchFn, win: null });
        expect(status.mode).toBe('disk');
        expect(status.notice).toMatch(/moved from this browser to disk/);
        expect(status.savedAt).toBeTruthy();
        const disk = readWorkspaceFile(wsFile(dir));
        expect(disk).toMatchObject({ revision: 1, simDials: { cycleScale: 7 } });
        expect(disk.workspace.items.item_log.name).toBe('Birch Log');
        expect(disk.workspace.activeEntityId).toBeUndefined();
        const migrated = backups(dir).find((f) => f.startsWith('migrated_'));
        expect(readBackup(dir, migrated).items.item_log.name).toBe('Birch Log');
        // Nothing in the browser was cleared or replaced.
        for (const key of [ENTITY_KEY, GLOBALS_KEY, 'fantasy-guild-cms-review']) expect(localStorage.getItem(key)).toBe(before[key]);
        expect(names()).toEqual(['Birch Log']);
    });

    it('opens the disk copy over an older browser cache, keeps the tab selection, and takes the dials from disk', async () => {
        const dir = sandbox();
        const { fetchFn } = serverFor(dir);
        saveWorkspaceFile(wsFile(dir), sample('Disk Log'), { baseRevision: 0, simDials: { cycleScale: 3 } });
        saveWorkspaceFile(wsFile(dir), sample('Newer Disk Log'), { baseRevision: 1 });
        // The cache was saved at revision 1 and has gone stale since (the command line wrote revision 2).
        cache({ ...sample('Disk Log'), activeEntityId: 'item_log', activeEntityType: 'item' });
        localStorage.setItem(DISK_META_KEY, JSON.stringify({ file: wsFile(dir), revision: 1, dirty: false }));
        startPage();

        await connectDiskWorkspace({ store: useEntityStore, globalStore: useGlobalStore, fetchFn, win: null });
        expect(names()).toEqual(['Newer Disk Log']);
        expect(useEntityStore.getState().activeEntityId).toBe('item_log');
        expect(useGlobalStore.getState().simDials.cycleScale).toBe(3);
        expect(backups(dir)).toEqual([]);
        expect(useDiskWorkspace.getState()).toMatchObject({ mode: 'disk', revision: 2 });
    });

    it('writes a change about a second after the last one, as the next revision, with the dials', async () => {
        const dir = sandbox();
        const { fetchFn, requests } = serverFor(dir);
        saveWorkspaceFile(wsFile(dir), sample(), { baseRevision: 0 });
        startPage();
        await connectDiskWorkspace({ store: useEntityStore, globalStore: useGlobalStore, fetchFn, win: null });

        vi.useFakeTimers();
        useEntityStore.getState().updateItem('item_log', { value: 4 });
        useEntityStore.getState().updateItem('item_log', { value: 5 });
        await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 100);
        expect(requests.filter((r) => r.method === 'PUT')).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(200);
        await saveWorkspaceNow();
        expect(requests.filter((r) => r.method === 'PUT')).toHaveLength(1);
        const disk = readWorkspaceFile(wsFile(dir));
        expect(disk.revision).toBe(2);
        expect(disk.workspace.items.item_log.value).toBe(5);
        // As JSON holds them (the last bracket's Infinity is written as null, as localStorage always did; `dials.js` falls back to the last bracket either way).
        expect(disk.simDials).toEqual(JSON.parse(JSON.stringify(useGlobalStore.getState().simDials)));
        expect(JSON.parse(localStorage.getItem(DISK_META_KEY))).toMatchObject({ revision: 2, dirty: false });

        // A dial change alone is saved too.
        useGlobalStore.setState((g) => ({ simDials: { ...g.simDials, cycleScale: 9 } }));
        await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 50);
        await saveWorkspaceNow();
        expect(readWorkspaceFile(wsFile(dir))).toMatchObject({ revision: 3, simDials: { cycleScale: 9 } });

        // Selecting an entity is this tab's own business and writes nothing.
        useEntityStore.getState().setActiveEntity('item_log', 'item');
        await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 50);
        await saveWorkspaceNow();
        expect(readWorkspaceFile(wsFile(dir)).revision).toBe(3);
    });

    it('refuses to write over a disk that changed elsewhere, shows the banner and keeps the edit as a backup', async () => {
        const dir = sandbox();
        const { fetchFn } = serverFor(dir);
        saveWorkspaceFile(wsFile(dir), sample(), { baseRevision: 0 });
        startPage();
        await connectDiskWorkspace({ store: useEntityStore, globalStore: useGlobalStore, fetchFn, win: null });

        // The command line applies a pack meanwhile.
        saveWorkspaceFile(wsFile(dir), sample('From the command line'), { baseRevision: 1, savedBy: 'cli' });
        useEntityStore.getState().updateItem('item_log', { value: 42 });
        await saveWorkspaceNow();

        const disk = readWorkspaceFile(wsFile(dir));
        expect(disk).toMatchObject({ revision: 2, savedBy: 'cli' });
        expect(disk.workspace.items.item_log.name).toBe('From the command line');
        const { conflict } = useDiskWorkspace.getState();
        expect(conflict.refusedBackup).toMatch(/^refused_/);
        expect(readBackup(dir, `${conflict.refusedBackup}.json`).items.item_log.value).toBe(42);
        // The refused backup holds the edit, so the reload the banner asks for does not keep it a second time.
        expect(JSON.parse(localStorage.getItem(DISK_META_KEY)).dirty).toBe(false);

        const view = render(React.createElement(React.Fragment, null, React.createElement(WorkspaceStatus), React.createElement(WorkspaceBanner)));
        expect(view.getByTestId('workspace-banner').textContent).toMatch(/The workspace on disk changed elsewhere; reload to see it/);
        expect(view.getByTestId('workspace-status').textContent).toMatch(/changed elsewhere/);
    });

    it('notices a change made elsewhere when the page comes back into view', async () => {
        const dir = sandbox();
        const { fetchFn } = serverFor(dir);
        saveWorkspaceFile(wsFile(dir), sample(), { baseRevision: 0 });
        startPage();
        const win = new EventTarget();
        await connectDiskWorkspace({ store: useEntityStore, globalStore: useGlobalStore, fetchFn, win });
        win.dispatchEvent(new Event('focus'));
        await waitFor(() => expect(fetchFn).toHaveBeenCalledWith('/api/workspace?meta=1'));
        expect(useDiskWorkspace.getState().conflict).toBeNull();

        saveWorkspaceFile(wsFile(dir), sample('Elsewhere'), { baseRevision: 1 });
        win.dispatchEvent(new Event('focus'));
        await waitFor(() => expect(useDiskWorkspace.getState().conflict).not.toBeNull());
    });

    it('sends edits a closed tab never sent, when the disk has not moved since', async () => {
        const dir = sandbox();
        const { fetchFn } = serverFor(dir);
        saveWorkspaceFile(wsFile(dir), sample(), { baseRevision: 0 });
        cache(sample('Typed just before closing'));
        localStorage.setItem(DISK_META_KEY, JSON.stringify({ file: wsFile(dir), revision: 1, dirty: true }));
        startPage();
        const status = await connectDiskWorkspace({ store: useEntityStore, globalStore: useGlobalStore, fetchFn, win: null });
        expect(status.notice).toMatch(/saved now/);
        expect(readWorkspaceFile(wsFile(dir))).toMatchObject({ revision: 2, workspace: { items: { item_log: { name: 'Typed just before closing' } } } });
        expect(names()).toEqual(['Typed just before closing']);
    });

    it('keeps unsent edits as a backup when the disk moved on meanwhile, and opens the disk', async () => {
        const dir = sandbox();
        const { fetchFn } = serverFor(dir);
        saveWorkspaceFile(wsFile(dir), sample(), { baseRevision: 0 });
        saveWorkspaceFile(wsFile(dir), sample('Moved on'), { baseRevision: 1 });
        cache(sample('Unsent'));
        localStorage.setItem(DISK_META_KEY, JSON.stringify({ file: wsFile(dir), revision: 1, dirty: true }));
        startPage();
        const status = await connectDiskWorkspace({ store: useEntityStore, globalStore: useGlobalStore, fetchFn, win: null });
        const unsent = backups(dir).find((f) => f.startsWith('unsent_'));
        expect(readBackup(dir, unsent).items.item_log.name).toBe('Unsent');
        expect(status.notice).toMatch(/Backups as unsent_/);
        expect(names()).toEqual(['Moved on']);
        expect(readWorkspaceFile(wsFile(dir)).revision).toBe(2);
    });

    it('keeps a browser copy written by a CMS that did not know the disk, or by another checkout', async () => {
        const dir = sandbox();
        const { fetchFn } = serverFor(dir);
        saveWorkspaceFile(wsFile(dir), sample('Disk'), { baseRevision: 0 });
        cache(sample('Older CMS'));
        // Unsent edits of a different checkout's workspace are never pushed into this one.
        localStorage.setItem(DISK_META_KEY, JSON.stringify({ file: '/elsewhere/workspace.json', revision: 1, dirty: true }));
        startPage();
        await connectDiskWorkspace({ store: useEntityStore, globalStore: useGlobalStore, fetchFn, win: null });
        const kept = backups(dir).find((f) => f.startsWith('browser_'));
        expect(readBackup(dir, kept).items.item_log.name).toBe('Older CMS');
        expect(names()).toEqual(['Disk']);
        expect(readWorkspaceFile(wsFile(dir)).revision).toBe(1);
    });

    it('carries on with the browser copy when the disk cannot be reached, and writes nothing to it', async () => {
        cache(sample('Browser only'));
        startPage();
        const fetchFn = vi.fn(async () => { throw new Error('offline'); });
        const status = await connectDiskWorkspace({ store: useEntityStore, globalStore: useGlobalStore, fetchFn, win: null });
        expect(status.mode).toBe('browser');
        expect(names()).toEqual(['Browser only']);
        useEntityStore.getState().updateItem('item_log', { value: 8 });
        expect(await saveWorkspaceNow()).toBe(false);
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(JSON.parse(localStorage.getItem(ENTITY_KEY)).state.items.item_log.value).toBe(8);
    });

    it('behaves exactly like localStorage before it connects (tests, a server without the route)', () => {
        workspaceStorage.setItem(ENTITY_KEY, { state: { items: { a: 1 } }, version: 1 });
        expect(JSON.parse(localStorage.getItem(ENTITY_KEY))).toEqual({ state: { items: { a: 1 } }, version: 1 });
        expect(workspaceStorage.getItem(ENTITY_KEY)).toEqual({ state: { items: { a: 1 } }, version: 1 });
        workspaceStorage.removeItem(ENTITY_KEY);
        expect(localStorage.getItem(ENTITY_KEY)).toBeNull();
    });

    it('New workspace backs the workspace up first and empties only the workspace', async () => {
        const dir = sandbox();
        const server = serverFor(dir);
        saveWorkspaceFile(wsFile(dir), sample('Before New'), { baseRevision: 0 });
        localStorage.setItem(GLOBALS_KEY, JSON.stringify({ state: { simDials: { cycleScale: 5 }, geminiApiKey: 'key' }, version: 2 }));
        localStorage.setItem('fantasy-guild-cms-review', '{"state":{"sessions":{}},"version":1}');
        startPage();
        await connectDiskWorkspace({ store: useEntityStore, globalStore: useGlobalStore, fetchFn: server.fetchFn, win: null });
        const globalsBefore = localStorage.getItem(GLOBALS_KEY);
        vi.stubGlobal('fetch', server.fetchFn);
        try {
            const view = render(React.createElement(FileManagerModal, { isOpen: true, onClose: () => {} }));
            // The File Manager says where the workspace lives.
            expect(view.getByTestId('workspace-status').textContent).toMatch(/Workspace: on disk, saved \d/);
            fireEvent.click(await view.findByText('New Workspace'));
            await act(async () => { fireEvent.click(view.getByText('Confirm')); });
            await waitFor(() => expect(readWorkspaceFile(wsFile(dir)).revision).toBe(2));
        } finally {
            vi.unstubAllGlobals();
        }
        const kept = backups(dir).find((f) => f.startsWith('before-new_'));
        expect(readBackup(dir, kept).items.item_log.name).toBe('Before New');
        expect(readWorkspaceFile(wsFile(dir)).workspace.items).toEqual({});
        expect(names()).toEqual([]);
        expect(localStorage.getItem(GLOBALS_KEY)).toBe(globalsBefore);
        expect(localStorage.getItem('fantasy-guild-cms-review')).toBe('{"state":{"sessions":{}},"version":1}');
    });

    it('the CMS no longer clears localStorage anywhere', () => {
        const cmsSrc = path.resolve(__dirname, '../../cms/src');
        const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
        for (const f of walk(cmsSrc).filter((f) => /\.(js|jsx)$/.test(f))) {
            expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/localStorage\.clear\(/);
        }
    });
});
