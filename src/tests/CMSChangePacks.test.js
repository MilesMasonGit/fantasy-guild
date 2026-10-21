import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';

import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import {
    validatePack, fingerprint, canonicalJson, currentValue, setValue, entryConflict, proposedValue, changedFields,
} from '../../cms/src/engine/changePacks.js';
import { startAutosave, autosaveName } from '../../cms/src/engine/autosave.js';

/**
 * ⭐ Change packs, the inbox and autosave (brief 200 P1): an agent's pack is checked with readable
 * reasons, listed, read, archived and restored through the CMS server, and the workspace autosaves
 * to disk in the server's last-five rotation. Everything runs in temp folders; nothing reaches
 * `cms/incoming/`, `cms/backups/` or `data/`.
 */

const WORKSPACE = Object.freeze({
    items: {
        item_oak: { id: 'item_oak', name: 'Oak', type: 'material' },
        map_glade: { id: 'map_glade', name: 'Glade', type: 'map', cartography: { nodes: [] } },
    },
    tokens: { token_mill: { id: 'token_mill', name: 'Mill', tags: ['a', 'b'] } },
    effects: { effect_x: { id: 'effect_x', name: 'X', statements: [] } },
    recipePools: { carpentry: [{ id: 'recipe_a', skill: 'carpentry', name: 'A' }, { id: 'recipe_b', skill: 'carpentry', name: 'B' }] },
});

/** A pack that passes the check: one create, one edit, one delete. */
function goodPack(id = 'pack-one') {
    return {
        format: 'fantasy-guild-change-pack',
        version: 1,
        id,
        createdAt: '2026-10-20T15:00:00Z',
        asked: 'A second plank',
        entries: [
            { op: 'create', kind: 'item', id: 'item_fir', value: { name: 'Fir', type: 'material' }, note: 'new plank', placeholderArt: true },
            { op: 'edit', kind: 'token', id: 'token_mill', value: { ...WORKSPACE.tokens.token_mill, name: 'Big Mill' }, fingerprint: fingerprint(WORKSPACE.tokens.token_mill), note: 'rename' },
            { op: 'delete', kind: 'effect', id: 'effect_x', fingerprint: fingerprint(WORKSPACE.effects.effect_x), note: 'unused' },
        ],
    };
}

describe('the change-pack format', () => {
    it('fingerprints a value the same whatever its key order, and differently once it changes', () => {
        const a = { name: 'Mill', tags: ['a', 'b'], id: 'token_mill' };
        const b = { id: 'token_mill', tags: ['a', 'b'], name: 'Mill' };
        expect(canonicalJson(a)).toBe(canonicalJson(b));
        expect(fingerprint(a)).toBe(fingerprint(b));
        expect(fingerprint(a)).toMatch(/^fp:[0-9a-f]{16}$/);
        expect(fingerprint({ ...a, tags: ['b', 'a'] })).not.toBe(fingerprint(a));
        expect(fingerprint(null)).not.toBe(fingerprint({}));
    });

    it('accepts a well-formed pack', () => {
        expect(validatePack(goodPack(), { fileName: 'pack-one.json' })).toEqual({ ok: true });
    });

    it('refuses a malformed pack with a reason an agent can act on', () => {
        const pack = goodPack();
        pack.format = 'something';
        pack.asked = '';
        pack.entries[0].kind = 'building';
        delete pack.entries[1].fingerprint;
        pack.entries[2].value = {};
        pack.entries.push({ op: 'create', kind: 'item', id: 'map_new', value: { type: 'map' }, note: 'x' });
        pack.entries.push({ op: 'create', kind: 'recipe', id: 'recipe_c', value: { name: 'C' }, note: 'x' });
        pack.entries.push({ op: 'edit', kind: 'token', id: 'token_mill', value: {}, fingerprint: 'fp:0000000000000000', note: 'twice' });
        const { ok, errors } = validatePack(pack, { fileName: 'other.json' });
        expect(ok).toBe(false);
        const text = errors.join('\n');
        expect(text).toMatch(/"format" must be "fantasy-guild-change-pack"/);
        expect(text).toMatch(/"asked" must say what the owner asked for/);
        expect(text).toMatch(/named after the pack id: "pack-one.json"/);
        expect(text).toMatch(/Entry 1 \(item_fir\): "kind" must be one of/);
        expect(text).toMatch(/Entry 2 \(token_mill\): an edit needs "fingerprint"/);
        expect(text).toMatch(/Entry 3 \(effect_x\): a delete carries no "value"/);
        expect(text).toMatch(/Entry 4 \(map_new\): this is a map or modifier; use "kind": "map"/);
        expect(text).toMatch(/Entry 5 \(recipe_c\): a recipe's "value.skill"/);
        expect(text).toMatch(/Entry 6 \(token_mill\): the same entity is already entry 2/);
        expect(validatePack('nope').errors[0]).toMatch(/one JSON object/);
        expect(validatePack({ ...goodPack(), entries: [] }).errors.join()).toMatch(/at least one entry/);
    });
});

describe('applying entries to a workspace', () => {
    it('reads, sets and removes each kind in its own collection, a map as an item and a recipe in its pool', () => {
        expect(currentValue(WORKSPACE, 'map', 'map_glade').name).toBe('Glade');
        expect(currentValue(WORKSPACE, 'recipe', 'recipe_b').name).toBe('B');
        expect(currentValue(WORKSPACE, 'token', 'token_none')).toBeNull();

        const edited = setValue(WORKSPACE, 'recipe', 'recipe_a', { skill: 'carpentry', name: 'A2' });
        expect(edited.recipePools.carpentry.map((r) => r.name)).toEqual(['A2', 'B']);
        const moved = setValue(WORKSPACE, 'recipe', 'recipe_a', { skill: 'cooking', name: 'A3' });
        expect(moved.recipePools.carpentry.map((r) => r.id)).toEqual(['recipe_b']);
        expect(moved.recipePools.cooking).toEqual([{ skill: 'cooking', name: 'A3', id: 'recipe_a' }]);
        expect(setValue(WORKSPACE, 'recipe', 'recipe_b', null).recipePools.carpentry.map((r) => r.id)).toEqual(['recipe_a']);

        const items = setValue(WORKSPACE, 'item', 'item_fir', { name: 'Fir' }).items;
        expect(Object.keys(items)).toEqual(['item_oak', 'map_glade', 'item_fir']);
        expect(items.item_fir.id).toBe('item_fir');
        expect(setValue(WORKSPACE, 'effect', 'effect_x', null)).toEqual({ effects: {} });
        expect(WORKSPACE.effects.effect_x).toBeDefined();
    });

    it('flags a conflict rather than overwriting: a taken id, a changed entity, a missing one', () => {
        const [create, edit, del] = goodPack().entries;
        expect(entryConflict(WORKSPACE, create)).toEqual({ conflict: false });
        expect(entryConflict(WORKSPACE, edit)).toEqual({ conflict: false });
        expect(entryConflict(WORKSPACE, del)).toEqual({ conflict: false });

        const changed = { ...WORKSPACE, tokens: { token_mill: { ...WORKSPACE.tokens.token_mill, name: 'Owner Mill' } } };
        expect(entryConflict(changed, edit)).toMatchObject({ conflict: true, reason: expect.stringMatching(/changed since/) });
        expect(entryConflict({ ...WORKSPACE, effects: {} }, del)).toMatchObject({ conflict: true, reason: expect.stringMatching(/no longer/) });
        expect(entryConflict({ ...WORKSPACE, items: { item_fir: {} } }, create)).toMatchObject({ conflict: true, reason: expect.stringMatching(/already exists/) });
    });

    it('names the fields an edit changes', () => {
        const edit = goodPack().entries[1];
        expect(changedFields(WORKSPACE.tokens.token_mill, proposedValue(edit))).toEqual(['name']);
    });
});

/** One request through the plugin's middleware; resolves with what it answered. */
function makeRequester(options) {
    let handler;
    cmsFileApi(options).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
    return (method, url, body) => new Promise((resolve) => {
        const req = new EventEmitter();
        Object.assign(req, { method, url, headers: {} });
        const res = {
            statusCode: 200,
            setHeader: () => {},
            end: (text = '') => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }),
        };
        handler(req, res, () => resolve({ status: 'next' }));
        if (body !== undefined) req.emit('data', JSON.stringify(body));
        req.emit('end');
    });
}

describe('the inbox through the CMS server', () => {
    let dir;
    let request;
    const write = (name, value) => fs.writeFileSync(path.join(dir, name), typeof value === 'string' ? value : JSON.stringify(value));

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-packs-'));
        request = makeRequester({ incomingDir: dir, backupsDir: path.join(dir, 'backups') });
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('lists the waiting packs, with a malformed one and its reasons, and ignores other files', async () => {
        write('pack-one.json', goodPack());
        write('broken.json', '{ not json');
        write('misnamed.json', goodPack('pack-two'));
        fs.writeFileSync(path.join(dir, 'README.md'), '# hi');
        const { status, body } = await request('GET', '/api/change-packs');
        expect(status).toBe(200);
        expect(body.applied).toEqual([]);
        const byFile = Object.fromEntries(body.inbox.map((p) => [p.file, p]));
        expect(Object.keys(byFile).sort()).toEqual(['broken.json', 'misnamed.json', 'pack-one.json']);
        expect(byFile['pack-one.json']).toMatchObject({ id: 'pack-one', asked: 'A second plank', entries: 3 });
        expect(byFile['pack-one.json'].errors).toBeUndefined();
        expect(byFile['broken.json'].errors[0]).toMatch(/Not valid JSON/);
        expect(byFile['misnamed.json'].errors[0]).toMatch(/named after the pack id/);
    });

    it('reads a pack, refuses a malformed one with its reasons, and never a path outside the inbox', async () => {
        write('pack-one.json', goodPack());
        write('misnamed.json', goodPack('pack-two'));
        expect((await request('GET', '/api/change-packs/inbox/pack-one.json')).body.entries).toHaveLength(3);
        const bad = await request('GET', '/api/change-packs/inbox/misnamed.json');
        expect(bad.status).toBe(422);
        expect(bad.body.errors[0]).toMatch(/named after the pack id/);
        expect((await request('GET', '/api/change-packs/inbox/..%2F..%2Fpackage.json')).status).toBe(400);
        expect((await request('GET', '/api/change-packs/inbox/nothing.json')).status).toBe(404);
    });

    it('archives a finished review with its record, and restores it to the inbox for another', async () => {
        write('pack-one.json', goodPack());
        const review = { entries: [{ index: 0, decision: 'accepted', applied: true, before: null, after: { name: 'Fir' } }] };
        expect((await request('POST', '/api/change-packs/inbox/pack-one.json/archive', { review })).status).toBe(200);
        expect(fs.existsSync(path.join(dir, 'pack-one.json'))).toBe(false);

        const listed = (await request('GET', '/api/change-packs')).body;
        expect(listed.inbox).toEqual([]);
        expect(listed.applied[0]).toMatchObject({ file: 'pack-one.json', review: { applied: 1 } });
        const archived = (await request('GET', '/api/change-packs/applied/pack-one.json')).body;
        expect(archived.review.entries[0].after).toEqual({ name: 'Fir' });
        expect(typeof archived.review.finishedAt).toBe('string');

        expect((await request('POST', '/api/change-packs/applied/pack-one.json/restore', { undone: [0] })).status).toBe(200);
        const back = (await request('GET', '/api/change-packs/inbox/pack-one.json')).body;
        expect(back.review).toBeUndefined();
        expect(back.history[0]).toMatchObject({ undone: [0] });
        expect(typeof back.history[0].undoneAt).toBe('string');
        expect(fs.existsSync(path.join(dir, 'applied', 'pack-one.json'))).toBe(false);
    });

    it('refuses to archive without a review record or a pack that is not there', async () => {
        write('pack-one.json', goodPack());
        expect((await request('POST', '/api/change-packs/inbox/pack-one.json/archive', {})).status).toBe(400);
        expect((await request('POST', '/api/change-packs/inbox/none.json/archive', { review: { entries: [] } })).status).toBe(404);
        expect((await request('POST', '/api/change-packs/inbox/pack-one.json/explode', {})).status).toBe(404);
    });

    it('is not served by the Studio', async () => {
        const studio = makeRequester({ incomingDir: dir, studio: true });
        expect((await studio('GET', '/api/change-packs')).status).toBe(403);
    });
});

describe('autosave', () => {
    let dir;
    beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-autosave-')); });
    afterEach(() => {
        vi.useRealTimers();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('the server keeps the newest five autosaves and never a named backup', async () => {
        const request = makeRequester({ backupsDir: dir });
        expect((await request('POST', '/api/backups', { name: 'before-rebalance', data: { items: {} }, isAutoSave: false })).status).toBe(200);
        const names = [];
        for (let i = 0; i < 7; i++) {
            const name = autosaveName(new Date(Date.UTC(2026, 9, 20, 15, 0, i)));
            names.push(name);
            expect((await request('POST', '/api/backups', { name, data: { items: { i } }, isAutoSave: true })).status).toBe(200);
        }
        const left = fs.readdirSync(dir).sort();
        expect(left).toEqual(['before-rebalance.json', ...names.slice(2).map((n) => n + '.json')].sort());
    });

    it('the CMS saves every few minutes only when the workspace changed, and tries again after a failure', async () => {
        vi.useFakeTimers();
        let state = { items: {}, tokens: {}, effects: {}, recipePools: {}, starterCamp: null, activeEntityId: null };
        const listeners = new Set();
        const store = {
            getState: () => state,
            subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
        };
        const setState = (patch) => {
            const prev = state;
            state = { ...state, ...patch };
            listeners.forEach((fn) => fn(state, prev));
        };
        const ok = vi.fn(async () => ({ ok: true }));
        const auto = startAutosave(store, (s) => ({ items: s.items }), { everyMs: 1000, fetchFn: ok, now: () => new Date(Date.UTC(2026, 9, 20)) });

        await vi.advanceTimersByTimeAsync(3000);
        expect(ok).not.toHaveBeenCalled();
        setState({ activeEntityId: 'item_oak' });
        await vi.advanceTimersByTimeAsync(1000);
        expect(ok).not.toHaveBeenCalled();

        setState({ items: { item_oak: { name: 'Oak' } } });
        await vi.advanceTimersByTimeAsync(1000);
        expect(ok).toHaveBeenCalledTimes(1);
        const [url, init] = ok.mock.calls[0];
        expect(url).toBe('/api/backups');
        expect(JSON.parse(init.body)).toEqual({ name: 'autosave_2026-10-20T00-00-00-000Z', data: { items: { item_oak: { name: 'Oak' } } }, isAutoSave: true });
        await vi.advanceTimersByTimeAsync(3000);
        expect(ok).toHaveBeenCalledTimes(1);
        auto.stop();

        const failing = vi.fn(async () => ({ ok: false, status: 500 }));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const again = startAutosave(store, (s) => s, { everyMs: 1000, fetchFn: failing });
        setState({ tokens: { t: {} } });
        await vi.advanceTimersByTimeAsync(2000);
        expect(failing).toHaveBeenCalledTimes(2);
        again.stop();
        warn.mockRestore();
        setState({ tokens: {} });
        await vi.advanceTimersByTimeAsync(5000);
        expect(failing).toHaveBeenCalledTimes(2);
    });
});
