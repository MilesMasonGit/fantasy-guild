// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import React from 'react';
import { render, cleanup, fireEvent, waitFor, within, configure, getConfig } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useReviewStore } from '../../cms/src/stores/useReviewStore';
import App from '../../cms/src/App.jsx';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import { fingerprint } from '../../cms/src/engine/changePacks.js';
import {
    emptySession, accept, applyEarly, reject, acceptAll, rejectAll, finish, planUndo, undo, rowState,
} from '../../cms/src/engine/packReview.js';

/**
 * ⭐ Reviewing a change pack in the CMS (brief 200 P2): the badge counts the inbox, each entry is a
 * row accepted, rejected or opened in the editor to tweak, a conflict is never applied silently,
 * Finish applies to the workspace and archives, Undo puts it back and flags what was edited since.
 * The workspace and the review sessions run on no-op storage (TESTING, "The CMS"), and the inbox
 * is a temp folder behind the real server routes; nothing reaches `data/`.
 */

const workspace = () => ({
    items: { item_oak: { id: 'item_oak', name: 'Oak', type: 'material', sprite: 'item_oak' } },
    tokens: { token_mill: { id: 'token_mill', name: 'Mill', tags: ['wood'], autoSyncId: true } },
    effects: { effect_old: { id: 'effect_old', name: 'Old Bonus', statements: [] } },
    recipePools: { carpentry: [{ id: 'recipe_board', skill: 'carpentry', name: 'Board', inputs: [], outputs: [] }] },
    starterCamp: null,
});

function makePack(ws = workspace()) {
    return {
        format: 'fantasy-guild-change-pack',
        version: 1,
        id: 'test-pack',
        createdAt: '2026-10-20T15:00:00Z',
        asked: 'A second plank and a tidier mill',
        entries: [
            { op: 'create', kind: 'item', id: 'item_fir', value: { name: 'Fir', type: 'material', sprite: 'item_oak', autoSyncId: false }, note: 'Construction needs a second plank', placeholderArt: true },
            { op: 'edit', kind: 'token', id: 'token_mill', value: { ...ws.tokens.token_mill, tags: ['wood', 'fir'] }, fingerprint: fingerprint(ws.tokens.token_mill), note: 'The Mill takes Fir too' },
            { op: 'delete', kind: 'effect', id: 'effect_old', fingerprint: fingerprint(ws.effects.effect_old), note: 'Nothing uses it' },
        ],
    };
}

describe('the review rules', () => {
    it('applies an entry early for tweaking and puts it back on reject', () => {
        const ws = workspace();
        const pack = makePack(ws);
        const early = applyEarly(ws, pack, emptySession(), 1);
        expect(early.workspace.tokens.token_mill.tags).toEqual(['wood', 'fir']);
        expect(rowState(early.workspace, pack, early.session, 1)).toMatchObject({ decision: 'accepted', appliedEarly: true, conflict: false });
        const back = reject(early.workspace, pack, early.session, 1);
        expect(back.workspace.tokens.token_mill).toEqual(ws.tokens.token_mill);
        expect(back.session.entries[1]).toMatchObject({ decision: 'rejected', appliedEarly: false });
    });

    it('will not accept or finish a conflicting entry unless the owner forces it, nor finish with one undecided', () => {
        const ws = workspace();
        const pack = makePack(ws);
        const edited = { ...ws, tokens: { token_mill: { ...ws.tokens.token_mill, name: 'Owner Mill' } } };
        let s = acceptAll(edited, pack, emptySession());
        expect(s.entries[0].decision).toBe('accepted');
        expect(s.entries[1]).toBeUndefined();
        expect(applyEarly(edited, pack, s, 1)).toBeNull();
        expect(finish(edited, pack, s).blocked).toEqual([{ index: 1, reason: 'Not decided yet: accept or reject it.' }]);
        s = { ...s, entries: { ...s.entries, 1: { decision: 'accepted' } } };
        expect(finish(edited, pack, s).blocked[0].reason).toMatch(/changed since/);
        const all = rejectAll(edited, pack, s);
        const done = finish(all.workspace, pack, all.session);
        expect(done.record.entries.every((e) => !e.applied)).toBe(true);
        expect(done.workspace.tokens.token_mill.name).toBe('Owner Mill');
    });

    it('finishes with a record undo can use, and undo flags what was edited since', () => {
        const ws = workspace();
        const pack = makePack(ws);
        const s = acceptAll(ws, pack, emptySession());
        const done = finish(ws, pack, s);
        expect(Object.keys(done.workspace.items)).toEqual(['item_oak', 'item_fir']);
        expect(done.workspace.effects).toEqual({});
        expect(done.record.entries.map((e) => [e.op, e.applied, e.before?.id ?? null])).toEqual([
            ['create', true, null], ['edit', true, 'token_mill'], ['delete', true, 'effect_old'],
        ]);

        const later = { ...done.workspace, items: { ...done.workspace.items, item_fir: { ...done.workspace.items.item_fir, name: 'Fir Wood' } } };
        const archived = { ...pack, review: done.record };
        expect(planUndo(later, archived).map((e) => [e.index, e.flagged])).toEqual([[0, true], [1, false], [2, false]]);
        const kept = undo(later, archived);
        expect(kept.undone).toEqual([1, 2]);
        expect(kept.workspace.items.item_fir.name).toBe('Fir Wood');
        expect(kept.workspace.tokens.token_mill).toEqual(ws.tokens.token_mill);
        expect(kept.workspace.effects.effect_old).toEqual(ws.effects.effect_old);
        expect(undo(later, archived, [0]).workspace.items.item_fir).toBeUndefined();
    });
});

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const WORKSPACE_KEY = 'fantasy-guild-cms-v2';

// Each case mounts the whole CMS and round-trips the file server: slow on a busy machine, so the
// waits get 10 s (not testing-library's 1 s) and each case 30 s.
describe('the review page in the CMS', { timeout: 30_000 }, () => {
    let dir;
    let handler;
    let storedBefore;
    let asyncUtilTimeout;

    beforeAll(() => {
        asyncUtilTimeout = getConfig().asyncUtilTimeout;
        configure({ asyncUtilTimeout: 10_000 });
        storedBefore = localStorage.getItem(WORKSPACE_KEY);
        useEntityStore.persist.setOptions({ storage: noStorage });
        useReviewStore.persist.setOptions({ storage: noStorage });
    });
    afterAll(() => {
        configure({ asyncUtilTimeout });
        expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
    });

    /** The browser's fetch, answered by the CMS server's own middleware. */
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
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-review-'));
        cmsFileApi({ incomingDir: dir, backupsDir: path.join(dir, 'backups') }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
        vi.stubGlobal('fetch', vi.fn(serverFetch));
        useEntityStore.getState().hydrate(workspace());
        useReviewStore.setState({ listing: null, sessions: {} });
        fs.writeFileSync(path.join(dir, 'test-pack.json'), JSON.stringify(makePack()));
    });
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    async function openPack(view) {
        const badge = await view.findByText('Changes to review (1)');
        fireEvent.click(badge);
        fireEvent.click(await view.findByText('test-pack'));
        return view.findByTestId('pack-review');
    }

    it('reviews, partly accepts, tweaks in the editor, finishes, then undoes', async () => {
        const view = render(React.createElement(App));
        let review = await openPack(view);
        expect(within(review).getByText('A second plank and a tidier mill')).toBeTruthy();
        expect(within(review).getByText('placeholder art')).toBeTruthy();
        expect(within(view.getByTestId('entry-2')).getByText('Deleted')).toBeTruthy();

        fireEvent.click(within(view.getByTestId('entry-0')).getByText('Accept'));
        fireEvent.click(within(view.getByTestId('entry-1')).getByText('Open in the editor'));
        expect(useEntityStore.getState().activeEntityId).toBe('token_mill');
        expect(useEntityStore.getState().tokens.token_mill.tags).toEqual(['wood', 'fir']);
        useEntityStore.getState().updateToken('token_mill', { tags: ['wood', 'fir', 'tweaked'] });

        review = await openPack(view);
        expect(within(review).getByTestId('status-1').textContent).toMatch(/in the workspace/);
        fireEvent.click(within(view.getByTestId('entry-2')).getByText('Reject'));
        fireEvent.click(within(review).getByText(/Finish review/));

        await waitFor(() => expect(fs.existsSync(path.join(dir, 'applied', 'test-pack.json'))).toBe(true));
        expect(fs.existsSync(path.join(dir, 'test-pack.json'))).toBe(false);
        const after = useEntityStore.getState();
        expect(after.items.item_fir).toMatchObject({ id: 'item_fir', name: 'Fir' });
        expect(after.tokens.token_mill.tags).toEqual(['wood', 'fir', 'tweaked']);
        expect(after.effects.effect_old).toBeDefined();
        const record = JSON.parse(fs.readFileSync(path.join(dir, 'applied', 'test-pack.json'), 'utf8')).review;
        expect(record.entries.map((e) => [e.decision, e.applied])).toEqual([['accepted', true], ['accepted', true], ['rejected', false]]);
        expect(await view.findByText('Changes to review (0)')).toBeTruthy();

        useEntityStore.getState().updateItem('item_fir', { sprite: 'item_fir_owner' });
        fireEvent.click(await view.findByText('test-pack'));
        const archived = await view.findByTestId('archived-pack');
        expect(within(view.getByTestId('undo-0')).getByText(/Edited since/)).toBeTruthy();
        fireEvent.click(within(archived).getByText('Undo this pack'));

        await waitFor(() => expect(fs.existsSync(path.join(dir, 'test-pack.json'))).toBe(true));
        const undone = useEntityStore.getState();
        expect(undone.tokens.token_mill).toEqual(workspace().tokens.token_mill);
        expect(undone.items.item_fir.sprite).toBe('item_fir_owner');
        expect(await view.findByText('Changes to review (1)')).toBeTruthy();
    });

    it('flags a conflict instead of overwriting the owner\'s newer edit', async () => {
        useEntityStore.getState().updateToken('token_mill', { tags: ['owner'] });
        const view = render(React.createElement(App));
        await openPack(view);
        const row = view.getByTestId('entry-1');
        expect(within(row).getByText(/Conflict: It has changed since/)).toBeTruthy();
        expect(within(row).getByText('Accept').closest('button').disabled).toBe(true);
        fireEvent.click(within(view.getByTestId('pack-review')).getByText('Accept all'));
        expect(within(row).getByTestId('status-1').textContent).toBe('To decide');
        fireEvent.click(within(view.getByTestId('pack-review')).getByText(/Finish review/));
        expect(await view.findByText(/Not finished yet/)).toBeTruthy();
        expect(useEntityStore.getState().tokens.token_mill.tags).toEqual(['owner']);
        expect(useEntityStore.getState().items.item_fir).toBeUndefined();

        fireEvent.click(within(row).getByText('Apply anyway'));
        fireEvent.click(within(view.getByTestId('pack-review')).getByText(/Finish review/));
        await waitFor(() => expect(useEntityStore.getState().tokens.token_mill.tags).toEqual(['wood', 'fir']));
    });

    it('lists a malformed pack with its reasons and does not open it for review', async () => {
        fs.writeFileSync(path.join(dir, 'broken.json'), JSON.stringify({ ...makePack(), id: 'broken', asked: '' }));
        const view = render(React.createElement(App));
        fireEvent.click(await view.findByText('Changes to review (2)'));
        expect(await view.findByText(/"asked" must say what the owner asked for/)).toBeTruthy();
        fireEvent.click(view.getByText('broken'));
        expect(await view.findByText(/This pack is malformed/)).toBeTruthy();
        expect(view.queryByTestId('pack-review')).toBeNull();
    });
});
