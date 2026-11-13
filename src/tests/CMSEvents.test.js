// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import React from 'react';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useReviewStore } from '../../cms/src/stores/useReviewStore';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import { validatePack, fingerprint, currentValue, workspaceFromDataFiles, KINDS, collectionOf } from '../../cms/src/engine/changePacks.js';
import { emptySession, acceptAll, finish, undo } from '../../cms/src/engine/packReview.js';
import { workspaceFingerprint, applyPackInMemory } from '../../cms/src/engine/packGate.js';
import { syncFiles } from '../../cms/src/engine/recipeSync.js';
import { compareSync, SYNC_COLLECTIONS } from '../../cms/src/engine/syncGuard.js';
import { snapshot } from '../../cms/src/engine/fileUtils.js';
import { EVENTS_FILE, eventsFile } from '../../cms/src/engine/events.js';
import { validateWorkspace } from '../../cms/schemaCheck.js';
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor.js';
import { WORKSPACE_KEYS } from '../../cms/workspaceFile.js';
import EventsPage from '../../cms/src/components/events/EventsPage.jsx';

/**
 * The events table in the CMS (brief 640 E1): one workspace collection (`events`) edited on the
 * Events page or carried by a change pack, written to `data/events.json` by Sync only when the
 * workspace holds one, read back by Restore from Game, guarded like the other files. The workspace
 * runs on no-op storage and every folder is a temp one (TESTING, "The CMS"); nothing reaches `data/`.
 */

const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const dataDir = path.resolve(__dirname, '../../data');
const dataStamp = () => fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')).map((f) => [f, fs.statSync(path.join(dataDir, f)).mtimeMs]);
let storedBefore;
let dataBefore;

const COMET = { id: 'event_comet', name: 'Copper Ore Comet', typeId: 'token_copper_comet', kind: 'node', weight: 10, ground: [], biomes: [] };
const RAIN = { id: 'event_rain', name: 'Rainfall', typeId: 'token_rainfall', kind: 'buff', weight: 5, ground: ['grass'], biomes: ['meadow'], durationMinutes: 20 };
const TABLE = { event_comet: COMET, event_rain: RAIN };
const TOKENS = {
    token_copper_comet: { id: 'token_copper_comet', name: 'Copper Ore Comet' },
    token_rainfall: { id: 'token_rainfall', name: 'Rainfall' },
};

const store = () => useEntityStore.getState();
const workspace = (extra = {}) => ({ items: {}, tokens: {}, effects: {}, recipePools: {}, starterCamp: null, skillPerks: null, ...extra });

beforeAll(() => {
    storedBefore = localStorage.getItem(WORKSPACE_KEY);
    dataBefore = dataStamp();
    useEntityStore.persist.setOptions({ storage: noStorage });
    useReviewStore.persist.setOptions({ storage: noStorage });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
    expect(dataStamp()).toEqual(dataBefore);
});
beforeEach(() => store().hydrate(workspace()));
afterEach(() => cleanup());

async function loadGameData(dir) {
    let handler;
    cmsFileApi({ dataDir: dir, planDir: path.join(dir, 'plan') }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
    return new Promise((resolve) => {
        const req = new EventEmitter();
        Object.assign(req, { method: 'GET', url: '/api/load-game-data', headers: {} });
        handler(req, { statusCode: 200, setHeader: () => {}, end: (text) => resolve(JSON.parse(text)) }, () => resolve(null));
        req.emit('end');
    });
}

describe('the workspace holds the events table', () => {
    it('starts with none; a workspace that never held one stays null, in its file', () => {
        expect(store().events).toBeNull();
        expect(snapshot(store()).events).toBeNull();
        expect(WORKSPACE_KEYS).toContain('events');
    });

    it('takes it from a backup, keeps it in the file, and Clear empties it', () => {
        store().hydrate(workspace({ events: TABLE }));
        expect(store().events).toEqual(TABLE);
        expect(snapshot(store()).events).toEqual(TABLE);
        store().resetWorkspace();
        expect(store().events).toBeNull();
    });

    it('adds, changes and removes rows', () => {
        store().addEvent('event_1', { name: 'Windfall', kind: 'node' });
        expect(store().events).toEqual({ event_1: { id: 'event_1', name: 'Windfall', kind: 'node' } });
        store().setEvent('event_1', { weight: 3 });
        expect(store().events.event_1.weight).toBe(3);
        store().removeEvent('event_1');
        expect(store().events).toEqual({});
    });
});

describe('Sync writes data/events.json', () => {
    it('only when the workspace holds a table (an empty one too), each row in one shape', () => {
        expect(EVENTS_FILE).toBe('events.json');
        expect(syncFiles(workspace())[EVENTS_FILE]).toBeUndefined();
        expect(syncFiles(workspace({ events: {} }))[EVENTS_FILE]).toEqual({});
        const written = syncFiles(workspace({ events: { event_comet: { ...COMET, durationMinutes: 9, note: 'scratch' }, event_rain: RAIN } }))[EVENTS_FILE];
        // A node carries no time and nothing outside the shape is written.
        expect(written).toEqual(TABLE);
        expect(Object.keys(written.event_rain)).toEqual(['id', 'name', 'typeId', 'kind', 'weight', 'ground', 'biomes', 'durationMinutes']);
    });

    it('gets it through the recalculation that runs before every Sync, which audits its rows', () => {
        store().hydrate(workspace({ events: { ...TABLE, event_ghost: { ...COMET, id: 'event_ghost', typeId: 'token_ghost' } } }));
        expect(store().recalculateEconomy({}).events.event_rain).toEqual(RAIN);
        const issues = auditConnectivity({ tokens: TOKENS, events: store().events });
        expect(issues.filter((i) => i.entityType === 'Event')).toEqual([
            expect.objectContaining({ entityId: 'event_ghost', details: expect.stringContaining('"token_ghost", which does not exist') })
        ]);
    });

    it('is guarded: a Sync dropping an event the game has asks first; one that writes no table leaves it alone', () => {
        expect(SYNC_COLLECTIONS.map((c) => c.key)).toContain('events');
        const onDisk = { [EVENTS_FILE]: TABLE };
        const diff = compareSync(onDisk, { [EVENTS_FILE]: { event_comet: COMET } });
        expect(diff.hasRemovals).toBe(true);
        expect(diff.removed.events).toEqual([{ id: 'event_rain', name: 'Rainfall' }]);
        expect(compareSync(onDisk, { [EVENTS_FILE]: { ...TABLE, event_rain: { ...RAIN, weight: 7 } } }).changed.events).toEqual([{ id: 'event_rain', name: 'Rainfall' }]);
        expect(compareSync(onDisk, {}).hasRemovals).toBe(false);
    });

    it('and Restore from Game reads it back, so a Restore then a Sync writes the file byte for byte', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-events-'));
        try {
            fs.writeFileSync(path.join(dir, 'items.json'), '{}');
            fs.writeFileSync(path.join(dir, 'tokens.json'), '{}');
            store().hydrate(await loadGameData(dir));
            expect(store().events).toBeNull();
            const text = JSON.stringify(eventsFile(workspace({ events: TABLE })), null, 2);
            fs.writeFileSync(path.join(dir, EVENTS_FILE), text);
            store().hydrate(await loadGameData(dir));
            expect(store().events).toEqual(TABLE);
            expect(JSON.stringify(syncFiles(store())[EVENTS_FILE], null, 2)).toBe(text);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('is checked against its schema when the workspace holds one', () => {
        expect(validateWorkspace(workspace()).checked).not.toContain('events');
        const good = validateWorkspace(workspace({ events: TABLE }));
        expect(good.checked).toContain('events');
        expect(good.errors).toEqual([]);
        const bad = validateWorkspace(workspace({ events: { event_rain: { ...RAIN, ground: ['lava'] } } }));
        expect(bad.errors).toEqual([expect.objectContaining({ path: '/event_rain/ground/0' })]);
    });
});

const pack = (entries) => ({
    format: 'fantasy-guild-change-pack', version: 1, id: 'events-pack', createdAt: '2026-11-12T15:00:00Z',
    asked: 'The first events', entries
});
const eventEntry = (over = {}) => ({ op: 'create', kind: 'event', id: COMET.id, value: COMET, note: 'A comet', ...over });

describe('a change pack carries events', () => {
    it('knows the kind and refuses a row that could never land', () => {
        expect(KINDS).toContain('event');
        expect(collectionOf('event')).toBe('events');
        expect(validatePack(pack([eventEntry()]))).toEqual({ ok: true });
        const errors = (over) => validatePack(pack([eventEntry(over)])).errors.join(' ');
        expect(errors({ value: { ...COMET, kind: undefined } })).toMatch(/no kind/);
        expect(errors({ value: { ...COMET, typeId: '' } })).toMatch(/names no Token/);
        expect(errors({ value: { ...COMET, weight: 0 } })).toMatch(/weight of 0/);
        expect(errors({ value: { ...RAIN, id: COMET.id, durationMinutes: undefined } })).toMatch(/no time on the mat/);
        expect(errors({ value: { ...COMET, plan: { status: 'live' } } })).toMatch(/carry a "plan"/);
    });

    it('applies on finish into a workspace that held none, and undoes', () => {
        const ws = workspace();
        const p = pack([eventEntry(), eventEntry({ id: RAIN.id, value: RAIN, note: 'Rain' })]);
        const done = finish(ws, p, acceptAll(ws, p, emptySession()));
        expect(done.workspace.events).toEqual(TABLE);
        const back = undo(done.workspace, { ...p, review: done.record });
        expect(back.workspace.events ?? {}).toEqual({});
    });

    it('is fingerprinted from a workspace built from data/, the same as from the store', () => {
        const ws = workspaceFromDataFiles({ events: TABLE });
        expect(currentValue(ws, 'event', COMET.id)).toEqual(COMET);
        expect(fingerprint(currentValue(ws, 'event', COMET.id))).toBe(fingerprint(COMET));
        expect(workspaceFromDataFiles({}).events).toBeNull();
    });

    it('the gate applies it, and a workspace\'s fingerprint follows its events', () => {
        const ws = workspace();
        expect(applyPackInMemory(ws, pack([eventEntry()])).workspace.events).toEqual({ event_comet: COMET });
        expect(workspaceFingerprint(workspace({ events: TABLE }))).not.toBe(workspaceFingerprint(ws));
    });
});

describe('the Events page', () => {
    it('with no table, says so and starts one', () => {
        render(React.createElement(EventsPage));
        expect(screen.getByTestId('events-page').textContent).toMatch(/holds no events yet/);
        fireEvent.click(document.querySelector('[data-event-add]'));
        expect(Object.keys(store().events)).toEqual(['event_1']);
        expect(store().events.event_1).toMatchObject({ kind: 'node', weight: 10, ground: [], biomes: [] });
    });

    it('edits a row: Token, kind, weight, a buff\'s minutes, ground and biomes; and lists the checks', () => {
        store().hydrate(workspace({ tokens: TOKENS, events: { event_rain: { ...RAIN, typeId: 'token_gone', kind: 'node' } } }));
        render(React.createElement(EventsPage));
        const row = document.querySelector('[data-event-row="event_rain"]');
        expect(document.querySelector('[data-event-problems]').textContent).toMatch(/"token_gone", which does not exist/);
        expect(row.querySelector('[data-event-minutes]')).toBeNull();

        fireEvent.change(row.querySelector('[data-event-token]'), { target: { value: 'token_rainfall' } });
        fireEvent.change(row.querySelector('[data-event-kind]'), { target: { value: 'buff' } });
        fireEvent.change(row.querySelector('[data-event-weight]'), { target: { value: '7' } });
        fireEvent.change(document.querySelector('[data-event-row="event_rain"] [data-event-minutes]'), { target: { value: '30' } });
        fireEvent.click(row.querySelector('[data-event-ground="water"]'));
        fireEvent.click(row.querySelector('[data-event-biome="coast"]'));
        expect(store().events.event_rain).toMatchObject({
            typeId: 'token_rainfall', kind: 'buff', weight: 7, durationMinutes: 30, ground: ['water', 'grass'], biomes: ['meadow', 'coast']
        });
        expect(document.querySelector('[data-event-problems]')).toBeNull();

        fireEvent.click(row.querySelector('[data-event-remove]'));
        expect(store().events).toEqual({});
    });
});
