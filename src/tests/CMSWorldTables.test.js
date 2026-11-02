// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useReviewStore } from '../../cms/src/stores/useReviewStore';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import { validatePack, fingerprint, currentValue, workspaceFromDataFiles, KINDS, WORLD_ID } from '../../cms/src/engine/changePacks.js';
import { emptySession, acceptAll, finish, undo } from '../../cms/src/engine/packReview.js';
import { workspaceFingerprint, applyPackInMemory } from '../../cms/src/engine/packGate.js';
import { syncFiles } from '../../cms/src/engine/recipeSync.js';
import { compareSync } from '../../cms/src/engine/syncGuard.js';
import { snapshot } from '../../cms/src/engine/fileUtils.js';
import { workspaceContent } from '../../cms/src/stores/useLedgerWatchStore.js';
import { WORLD_FILE, worldDiff } from '../../cms/src/engine/worldTables.js';
import {
    baseWorldTables, worldTablesSource, wedgeChoices, originPlaces, workspaceOriginFindings,
} from '../../cms/src/engine/ledgerWorld.js';
import LedgerWorld from '../../cms/src/components/ledger/LedgerWorld.jsx';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';
import { worldWorkspace } from './fixtures/ledgerWorldMap.js';

/**
 * The world tables in the CMS (brief 330 W6): one workspace record (`world`) carried by a change
 * pack, written to `data/world.json` by Sync only when the workspace holds one, read back by
 * Restore from Game, guarded like the other files, and read by the Ledger's World plan instead of
 * the placeholder. The workspace runs on no-op storage and every folder is a temp one (TESTING,
 * "The CMS"); nothing reaches `data/`.
 */

const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const dataDir = path.resolve(__dirname, '../../data');
const dataStamp = () => fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')).map((f) => [f, fs.statSync(path.join(dataDir, f)).mtimeMs]);
let storedBefore;
let dataBefore;

/** The placeholder with the Trees line's ring 1 renamed, so it is told apart from the placeholder. */
const RAW = JSON.parse(JSON.stringify(PLACEHOLDER_WORLD_TABLES));
RAW.lines.find((l) => l.id === 'trees').origins[1] = [{ id: 'token_oak_tree', weight: 1 }, { id: 'token_apple_tree', weight: 1 }];
RAW.lines.find((l) => l.id === 'herbs').name = 'Herbs and Simples';

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

describe('the workspace holds the world tables', () => {
    it('starts with none; a workspace that never held them stays null, in its file and its autosave', () => {
        expect(store().world).toBeNull();
        expect(snapshot(store()).world).toBeNull();
        expect(workspaceContent(store()).world).toBeNull();
    });

    it('takes them from a backup as they are, and keeps them in the file and the ledger\'s content', () => {
        store().hydrate(workspace({ world: RAW }));
        expect(store().world).toEqual(RAW);
        expect(snapshot(store()).world).toEqual(RAW);
        expect(workspaceContent(store()).world).toEqual(RAW);
        store().resetWorkspace();
        expect(store().world).toBeNull();
    });
});

describe('Sync writes data/world.json', () => {
    it('only when the workspace holds tables, as they are', () => {
        expect(WORLD_FILE).toBe('world.json');
        expect(syncFiles(workspace())[WORLD_FILE]).toBeUndefined();
        expect(syncFiles(workspace({ world: RAW }))[WORLD_FILE]).toEqual(RAW);
    });

    it('gets them through the recalculation that runs before every Sync', () => {
        store().hydrate(workspace({ world: RAW }));
        expect(store().recalculateEconomy({}).world).toEqual(RAW);
    });

    it('is guarded: a Sync dropping an origin the game\'s tables place asks first; one that writes no tables leaves them alone', () => {
        const onDisk = { [WORLD_FILE]: RAW };
        const fewer = JSON.parse(JSON.stringify(RAW));
        fewer.lines.find((l) => l.id === 'trees').origins[1] = [{ id: 'token_oak_tree', weight: 1 }];
        const diff = compareSync(onDisk, { [WORLD_FILE]: fewer });
        expect(diff.hasRemovals).toBe(true);
        expect(diff.removed.world).toEqual([{ id: 'trees ring 1: token_apple_tree', name: 'token_apple_tree' }]);
        expect(compareSync(onDisk, { [WORLD_FILE]: RAW }).hasRemovals).toBe(false);
        expect(compareSync(onDisk, {}).hasRemovals).toBe(false);
        expect(compareSync({}, { [WORLD_FILE]: RAW }).added.world.length).toBeGreaterThan(10);
    });

    it('and Restore from Game reads it back; with no file the workspace holds none', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-world-'));
        try {
            fs.writeFileSync(path.join(dir, 'items.json'), '{}');
            fs.writeFileSync(path.join(dir, 'tokens.json'), '{}');
            store().hydrate(await loadGameData(dir));
            expect(store().world).toBeNull();
            fs.writeFileSync(path.join(dir, WORLD_FILE), JSON.stringify(RAW));
            store().hydrate(await loadGameData(dir));
            expect(store().world).toEqual(RAW);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

const pack = (entries) => ({
    format: 'fantasy-guild-change-pack', version: 1, id: 'world-pack', createdAt: '2026-11-01T15:00:00Z',
    asked: 'The first world pack', entries
});
const worldEntry = (over = {}) => ({ op: 'create', kind: 'world', id: WORLD_ID, value: RAW, note: 'The world tables', ...over });

describe('a change pack carries the world tables', () => {
    it('knows the kind, and refuses tables that cannot be generated from, another id, a value id, a plan or a delete', () => {
        expect(KINDS).toContain('world');
        expect(WORLD_ID).toBe('world');
        expect(validatePack(pack([worldEntry()]))).toEqual({ ok: true });
        const errors = (over) => validatePack(pack([worldEntry(over)])).errors.join(' ');
        expect(errors({ value: { ...RAW, lines: RAW.lines.slice(0, 5) } })).toMatch(/six lines/);
        expect(errors({ id: 'tables' })).toMatch(/"id" must be "world"/);
        expect(errors({ value: { ...RAW, id: 'world' } })).toMatch(/carry no "value.id"/);
        expect(errors({ value: { ...RAW, plan: { status: 'live' } } })).toMatch(/carry a "plan"/);
        expect(errors({ op: 'delete', value: undefined, fingerprint: 'fp:0123456789abcdef' })).toMatch(/cannot be deleted/);
    });

    it('applies on finish into a workspace that held none, and undoes', () => {
        const ws = workspace();
        const p = pack([worldEntry()]);
        const done = finish(ws, p, acceptAll(ws, p, emptySession()));
        expect(done.workspace.world).toEqual(RAW);
        const back = undo(done.workspace, { ...p, review: done.record });
        expect(back.workspace.world).toBeNull();
    });

    it('is fingerprinted from a workspace built from data/, the same as from the store', () => {
        const ws = workspaceFromDataFiles({ world: RAW });
        expect(currentValue(ws, 'world', WORLD_ID)).toEqual(RAW);
        expect(fingerprint(currentValue(ws, 'world', WORLD_ID))).toBe(fingerprint(RAW));
        expect(currentValue(workspaceFromDataFiles({}), 'world', WORLD_ID)).toBeNull();
    });

    it('the gate applies it, and a workspace\'s fingerprint follows its tables', () => {
        const ws = workspace();
        expect(applyPackInMemory(ws, pack([worldEntry()])).workspace.world).toEqual(RAW);
        expect(workspaceFingerprint(workspace({ world: RAW }))).not.toBe(workspaceFingerprint(ws));
    });

    it('says what changes, line by line: origins in and out per ring, kits, camps, arrivals, prices', () => {
        const after = JSON.parse(JSON.stringify(RAW));
        after.lines.find((l) => l.id === 'ores').origins[3].push({ id: 'token_darkmetal_ore_vein', weight: 1 });
        after.camps = { 1: ['token_wolf_den'] };
        after.prices[1].items[0].qty = 25;
        const lines = worldDiff(RAW, after);
        expect(lines).toEqual(expect.arrayContaining([
            { kind: 'added', text: 'Ores ring 3: token_darkmetal_ore_vein' },
            { kind: 'added', text: 'Camps ring 1: token_wolf_den' },
        ]));
        expect(lines.some((l) => l.kind === 'changed' && /prices/.test(l.text))).toBe(true);
        expect(worldDiff(null, RAW).filter((l) => l.kind === 'added').length).toBeGreaterThan(10);
        expect(worldDiff(RAW, RAW)).toEqual([]);
    });
});

describe('the Ledger reads the workspace\'s tables', () => {
    it('generates from them when the workspace holds usable tables, else from the placeholder, and says which', () => {
        expect(baseWorldTables({}).lines.find((l) => l.id === 'herbs').name).toBe('Herbs');
        expect(baseWorldTables({ world: RAW }).lines.find((l) => l.id === 'herbs').name).toBe('Herbs and Simples');
        expect(baseWorldTables({ world: { lines: [] } }).lines.find((l) => l.id === 'herbs').name).toBe('Herbs');
        expect(worldTablesSource({})).toMatch(/placeholder/);
        expect(worldTablesSource({ world: RAW })).toMatch(/workspace/);
        expect(worldTablesSource({ world: { lines: [] } })).toMatch(/cannot be generated from/);
    });

    it('wedge choices, origin places and the wild origins no wedge places follow them', () => {
        expect(wedgeChoices({ world: RAW }).find((w) => w.id === 'herbs').name).toBe('Herbs and Simples');
        expect(wedgeChoices({}).find((w) => w.id === 'herbs').name).toBe('Herbs');
        expect(originPlaces({}, { world: RAW }).get('token_apple_tree')).toEqual({ wedge: 'trees', ring: 1, planned: false });
        expect(originPlaces({}, {}).get('token_apple_tree')).toEqual({ wedge: 'crops', ring: 1, planned: false });
        const ws = worldWorkspace();
        ws.tokens.token_gold_vein = {
            id: 'token_gold_vein', name: 'Gold Vein', config: { skill: 'mining', outputs: [{ itemId: 'item_gold', chance: 100, minQty: 1, maxQty: 1 }] },
        };
        ws.items.item_gold = { id: 'item_gold', name: 'Gold', type: 'material' };
        const placing = JSON.parse(JSON.stringify(RAW));
        placing.lines.find((l) => l.id === 'ores').origins[3].push({ id: 'token_gold_vein', weight: 1 });
        const keys = (state) => workspaceOriginFindings(state).map((f) => f.key);
        expect(keys(ws)).toContain('token:token_gold_vein');
        expect(keys({ ...ws, world: placing })).not.toContain('token:token_gold_vein');
    });

    it('the World page draws the workspace\'s tables and says so', () => {
        globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
        store().hydrate({ ...worldWorkspace(), world: RAW });
        const view = render(React.createElement(LedgerWorld, { onOpen: () => {} }));
        expect(view.container.textContent).toMatch(/the workspace's world tables/);
        cleanup();
        store().hydrate(worldWorkspace());
        const plain = render(React.createElement(LedgerWorld, { onOpen: () => {} }));
        expect(plain.container.textContent).toMatch(/placeholder/);
    });
});
