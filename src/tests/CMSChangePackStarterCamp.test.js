// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import React from 'react';
import { render, cleanup, fireEvent, waitFor, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useReviewStore } from '../../cms/src/stores/useReviewStore';
import App from '../../cms/src/App.jsx';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import {
    validatePack, fingerprint, currentValue, setValue, proposedValue, entryConflict, workspaceFromDataFiles,
} from '../../cms/src/engine/changePacks.js';
import { emptySession, acceptAll, finish, undo } from '../../cms/src/engine/packReview.js';
import { starterCampDiff } from '../../cms/src/engine/starterCamp.js';
import { normaliseStarterCamp } from '../config/starterCampShape.js';

/**
 * ⭐ A change pack carries the Starter Camp (brief 240 K0.1): one `starterCamp` entry whose value is
 * the Starter Camp page's shape, reviewed as a list of Tokens added, moved and removed and of Bank
 * lines changed, applied, and undone. The workspace and review sessions run on no-op storage and
 * the inbox is a temp folder (TESTING, "The CMS"); nothing reaches `data/`.
 */

const CAMP = Object.freeze({
    version: 1, savedAt: '2026-10-20T10:00:00.000Z', mat: { w: 1760, h: 1126 }, hall: { x: 880, y: 563 },
    tokens: [
        { typeId: 'token_oak_tree', x: 500, y: 400 },
        { typeId: 'token_ruins', x: 1200, y: 300 },
        { typeId: 'token_ruins', x: 1300, y: 300 },
    ],
    bank: { item_oak_wood: 50, item_stone: 20 },
});

/** The camp the pack proposes: one oak moved, one copper vein added, the Bank set back. */
const PROPOSED = Object.freeze({
    ...CAMP,
    tokens: [
        { typeId: 'token_oak_tree', x: 560, y: 420 },
        { typeId: 'token_ruins', x: 1200, y: 300 },
        { typeId: 'token_ruins', x: 1300, y: 300 },
        { typeId: 'token_copper_vein', x: 700, y: 700 },
    ],
    bank: { item_oak_wood: 5 },
});

const workspace = (starterCamp = normaliseStarterCamp(CAMP)) => ({
    items: { item_oak_wood: { id: 'item_oak_wood', name: 'Oak Wood', type: 'material' }, item_stone: { id: 'item_stone', name: 'Stone', type: 'material' } },
    tokens: {
        token_oak_tree: { id: 'token_oak_tree', name: 'Oak Tree' },
        token_ruins: { id: 'token_ruins', name: 'Ruins' },
        token_copper_vein: { id: 'token_copper_vein', name: 'Copper Vein' },
    },
    effects: {},
    recipePools: {},
    starterCamp,
});

function makePack(ws = workspace()) {
    return {
        format: 'fantasy-guild-change-pack',
        version: 1,
        id: 'camp-pack',
        createdAt: '2026-10-25T15:00:00Z',
        asked: 'A copper vein in the Starter Camp',
        entries: [
            { op: 'edit', kind: 'starterCamp', id: 'starterCamp', value: PROPOSED, fingerprint: fingerprint(ws.starterCamp), note: 'Copper for the first tools' },
        ],
    };
}

describe('the format', () => {
    it('accepts a starterCamp entry and refuses a wrong id, a delete or a value that is not a camp', () => {
        expect(validatePack(makePack())).toEqual({ ok: true });
        const bad = (entry) => validatePack({ ...makePack(), entries: [{ ...makePack().entries[0], ...entry }] });
        expect(bad({ id: 'camp' }).errors.join(' ')).toMatch(/"id" must be "starterCamp"/);
        expect(bad({ op: 'delete', value: undefined }).errors.join(' ')).toMatch(/cannot be deleted/);
        expect(bad({ value: { tokens: 'none' } }).errors.join(' ')).toMatch(/no Tokens and an empty Bank/);
        expect(bad({ value: [1, 2] }).errors.join(' ')).toMatch(/full new record/);
        expect(bad({ value: { ...PROPOSED, id: 'starterCamp' } }).errors.join(' ')).toMatch(/carries no "value.id"/);
    });

    it('reads, sets and fingerprints the camp in its one shape, with no id added', () => {
        const ws = workspace();
        expect(currentValue(ws, 'starterCamp', 'starterCamp')).toEqual(ws.starterCamp);
        expect(fingerprint(currentValue({ starterCamp: { ...CAMP, extra: 1 } }, 'starterCamp', 'starterCamp'))).toBe(fingerprint(ws.starterCamp));
        expect(currentValue(workspace(null), 'starterCamp', 'starterCamp')).toBeNull();
        const entry = makePack().entries[0];
        const value = proposedValue(entry);
        expect(value).toEqual(normaliseStarterCamp(PROPOSED));
        expect(value.id).toBeUndefined();
        expect(setValue(ws, 'starterCamp', 'starterCamp', value)).toEqual({ starterCamp: value });
        expect(setValue(ws, 'starterCamp', 'starterCamp', null)).toEqual({ starterCamp: null });
        expect(entryConflict(ws, entry)).toEqual({ conflict: false });
        const moved = { ...ws, starterCamp: { ...ws.starterCamp, hall: { x: 1, y: 1 } } };
        expect(entryConflict(moved, entry)).toMatchObject({ conflict: true, reason: expect.stringMatching(/changed since/) });
        // A workspace that never held one takes a create.
        expect(entryConflict(workspace(null), { ...entry, op: 'create', fingerprint: undefined })).toEqual({ conflict: false });
    });

    it('builds the camp into a workspace made from data/ in the same shape the CMS loads', () => {
        const ws = workspaceFromDataFiles({ starterCamp: { ...CAMP, tokens: [...CAMP.tokens, { typeId: 'token_guild_hall', x: 1, y: 1 }] } });
        expect(ws.starterCamp).toEqual(normaliseStarterCamp(CAMP));
        expect(workspaceFromDataFiles({}).starterCamp).toBeNull();
    });
});

describe('the before / after list', () => {
    it('pairs Tokens by type: unchanged, moved to the nearest, added and removed, and the Bank lines', () => {
        const diff = starterCampDiff(normaliseStarterCamp(CAMP), normaliseStarterCamp({
            ...PROPOSED, tokens: [...PROPOSED.tokens.filter((t) => t.x !== 1300)],
        }));
        expect(diff.moved).toEqual([{ typeId: 'token_oak_tree', from: { x: 500, y: 400 }, to: { x: 560, y: 420 } }]);
        expect(diff.added).toEqual([{ typeId: 'token_copper_vein', x: 700, y: 700 }]);
        expect(diff.removed).toEqual([{ typeId: 'token_ruins', x: 1300, y: 300 }]);
        expect(diff.unchanged).toBe(1);
        expect(diff.bank).toEqual([
            { itemId: 'item_oak_wood', before: 50, after: 5 },
            { itemId: 'item_stone', before: 20, after: 0 },
        ]);
        expect(diff.hall).toBeNull();
        expect(starterCampDiff(null, normaliseStarterCamp(CAMP)).added).toHaveLength(3);
    });
});

describe('reviewing, applying and undoing', () => {
    it('applies the camp on finish and puts the old one back on undo', () => {
        const ws = workspace();
        const pack = makePack(ws);
        const done = finish(ws, pack, acceptAll(ws, pack, emptySession()));
        expect(done.workspace.starterCamp).toEqual(normaliseStarterCamp(PROPOSED));
        expect(done.workspace.items).toBe(ws.items);
        const back = undo(done.workspace, { ...pack, review: done.record });
        expect(back.undone).toEqual([0]);
        expect(back.workspace.starterCamp).toEqual(ws.starterCamp);
    });
});

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const WORKSPACE_KEY = 'fantasy-guild-cms-v2';

describe('the review page in the CMS', () => {
    let dir;
    let handler;
    let storedBefore;
    const dataDir = path.resolve(__dirname, '../../data');
    const dataBefore = () => fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')).map((f) => [f, fs.statSync(path.join(dataDir, f)).mtimeMs]);
    let dataStamp;

    beforeAll(() => {
        storedBefore = localStorage.getItem(WORKSPACE_KEY);
        dataStamp = dataBefore();
        useEntityStore.persist.setOptions({ storage: noStorage });
        useReviewStore.persist.setOptions({ storage: noStorage });
    });
    afterAll(() => {
        expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
        expect(dataBefore()).toEqual(dataStamp);
    });

    function serverFetch(url, init = {}) {
        return new Promise((resolve) => {
            const req = new EventEmitter();
            Object.assign(req, { method: init.method || 'GET', url, headers: {} });
            const res = {
                statusCode: 200,
                setHeader: () => {},
                end: (text = '') => resolve({ ok: res.statusCode < 400, status: res.statusCode, json: async () => (text ? JSON.parse(text) : null) }),
            };
            handler(req, res, () => resolve({ ok: false, status: 404, json: async () => ({}) }));
            if (init.body) req.emit('data', init.body);
            req.emit('end');
        });
    }

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-camp-pack-'));
        cmsFileApi({ incomingDir: dir, backupsDir: path.join(dir, 'backups') }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
        vi.stubGlobal('fetch', vi.fn(serverFetch));
        useEntityStore.getState().hydrate(workspace());
        useReviewStore.setState({ listing: null, sessions: {} });
        fs.writeFileSync(path.join(dir, 'camp-pack.json'), JSON.stringify(makePack()));
    });
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('lists the Tokens added and moved and the Bank lines, applies on finish, and undoes', async () => {
        const view = render(React.createElement(App));
        fireEvent.click(await view.findByText('Changes to review (1)'));
        fireEvent.click(await view.findByText('camp-pack'));
        const row = await view.findByTestId('entry-0');
        expect(within(row).getByText('Starter Camp', { selector: 'span' })).toBeTruthy();
        const diff = within(row).getByTestId('camp-diff');
        expect(within(diff).getByText(/Added: Copper Vein at 700, 700/)).toBeTruthy();
        expect(within(diff).getByText(/Moved: Oak Tree from 500, 400 to 560, 420/)).toBeTruthy();
        expect(within(diff).getByText(/Oak Wood: 50 → 5/)).toBeTruthy();
        expect(within(diff).getByText(/Stone: 20 → 0/)).toBeTruthy();
        expect(within(diff).getByText(/2 Tokens unchanged/)).toBeTruthy();

        fireEvent.click(within(row).getByText('Accept'));
        fireEvent.click(within(view.getByTestId('pack-review')).getByText(/Finish review/));
        await waitFor(() => expect(fs.existsSync(path.join(dir, 'applied', 'camp-pack.json'))).toBe(true));
        expect(useEntityStore.getState().starterCamp).toEqual(normaliseStarterCamp(PROPOSED));

        fireEvent.click(await view.findByText('camp-pack'));
        const archived = await view.findByTestId('archived-pack');
        expect(within(view.getByTestId('undo-0')).getByText('Starter Camp')).toBeTruthy();
        fireEvent.click(within(archived).getByText('Undo this pack'));
        await waitFor(() => expect(fs.existsSync(path.join(dir, 'camp-pack.json'))).toBe(true));
        expect(useEntityStore.getState().starterCamp).toEqual(normaliseStarterCamp(CAMP));
    });

    it('opens the Starter Camp page to tweak an accepted camp', async () => {
        const view = render(React.createElement(App));
        fireEvent.click(await view.findByText('Changes to review (1)'));
        fireEvent.click(await view.findByText('camp-pack'));
        const row = await view.findByTestId('entry-0');
        fireEvent.click(within(row).getByText('Open in the editor'));
        expect(useEntityStore.getState().starterCamp).toEqual(normaliseStarterCamp(PROPOSED));
        expect(await view.findByText(/Save this mat as the Starter Camp/)).toBeTruthy();
    });
});
