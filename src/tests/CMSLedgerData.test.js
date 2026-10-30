// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import picomatch from 'picomatch';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { compareSync } from '../../cms/src/engine/syncGuard';
import { validatePack, workspaceFromDataFiles } from '../../cms/src/engine/changePacks';
import {
    splitPlanned, rejoinPlanned, buildLedgerFile, mergeLedgerFile, LEDGER_FILE,
} from '../../cms/src/engine/ledgerFile';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import { workspaceLedger } from '../../cms/src/engine/ledgerReport';
import { ledgerWorkspace } from './fixtures/ledgerWorld.js';
import {
    ledgerOf, isPlanned, withLedger, cleanLedger, tierLabel, tierBudgetMs, LEDGER_STATUSES,
} from '../systems/atlas/ledger.js';
import { sourceCode, setScanTimeout } from './fixtures/sourceScan.js';

setScanTimeout();

/**
 * The ledger's data half: every item, Token and recipe can carry `ledger: { status, tier, note }`,
 * a Planned stub never reaches the game's files, and the plan survives a Sync and a Restore.
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

const planned = (tier, note = '') => ({ status: 'planned', tier, ...(note ? { note } : {}) });

/** A small workspace: an ore, its node, a smelting recipe, and one Planned stub of each kind. */
function workspace() {
    return {
        items: {
            item_ore: { id: 'item_ore', name: 'Ore', type: 'material', ledger: { status: 'live', tier: 1 } },
            item_mythril: { id: 'item_mythril', name: 'Mythril Ore', type: 'material', ledger: planned(3, 'plane 3 ore') },
            item_bar: { id: 'item_bar', name: 'Bar', type: 'material' },
        },
        tokens: {
            token_vein: {
                id: 'token_vein', name: 'Vein', tokenType: 'resource',
                config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 6000, inputs: [], outputs: [{ itemId: 'item_ore', chance: 100, minQty: 1, maxQty: 1 }] },
            },
            token_mythril_vein: { id: 'token_mythril_vein', name: 'Mythril Vein', config: null, ledger: planned(3) },
        },
        effects: {},
        recipePools: {
            smithing: [
                { id: 'recipe_bar', name: 'Bar', skill: 'smithing', levelRequirement: 1, durationMs: 9000, inputs: [{ itemId: 'item_ore', quantity: 2 }], outputs: [{ itemId: 'item_bar', chance: 100, minQty: 1, maxQty: 1 }], ledger: { status: 'draft' } },
                { id: 'recipe_mythril_bar', name: 'Mythril Bar', skill: 'smithing', inputs: [], outputs: [], ledger: planned(3) },
                { id: 'recipe_late', name: 'Late', skill: 'smithing', inputs: [], outputs: [] },
            ],
        },
        starterCamp: null,
    };
}

describe('the vocabulary', () => {
    it('reads a record with no ledger as Live, with no tier and no note', () => {
        expect(ledgerOf({ id: 'x' })).toEqual({ status: 'live', tier: null, note: '' });
        expect(ledgerOf(undefined)).toEqual({ status: 'live', tier: null, note: '' });
        expect(LEDGER_STATUSES).toEqual(['planned', 'draft', 'live', 'parked']);
    });

    it('never reads a status it does not know as Planned, so a typo cannot take content out of the game', () => {
        expect(ledgerOf({ ledger: { status: 'planed' } }).status).toBe('live');
        expect(ledgerOf({ ledger: { status: ' Planned ' } }).status).toBe('planned');
    });

    it('drops blanks, and removes the block once nothing is left', () => {
        expect(cleanLedger({ status: 'nonsense', tier: -1, note: '  ' })).toBeUndefined();
        const tiered = withLedger({ id: 'x' }, { tier: 2 });
        expect(tiered).toEqual({ id: 'x', ledger: { tier: 2 } });
        expect(withLedger(tiered, { tier: null })).toEqual({ id: 'x' });
    });

    it('names tiers and knows the stage budgets the owner set', () => {
        expect([0, 1, 2, null].map(tierLabel)).toEqual(['Starter Camp', 'Plane 1', 'Plane 2', 'No tier set']);
        expect([0, 1, 2, 3].map(tierBudgetMs)).toEqual([30 * 60000, 90 * 60000, 24 * 3600000, null]);
    });
});

describe('Sync to Game keeps Planned stubs out of the game', () => {
    it('writes no Planned stub and no ledger block into the game files', () => {
        const files = syncFiles(workspace());
        expect(Object.keys(files['items.json'])).toEqual(['item_ore', 'item_bar']);
        expect(Object.keys(files['tokens.json'])).toEqual(['token_vein']);
        expect(files['tokenRecipes.json'].map((r) => r.id)).toEqual(['recipe_bar', 'recipe_late']);
        const text = JSON.stringify([files['items.json'], files['tokens.json'], files['tokenRecipes.json']]);
        expect(text).not.toMatch(/mythril|"ledger"/i);
    });

    it('writes the plan into ledger.json: every block, and every stub whole', () => {
        const file = syncFiles(workspace())[LEDGER_FILE];
        expect(file.entries).toEqual({
            items: { item_ore: { status: 'live', tier: 1 } },
            tokens: {},
            recipes: { recipe_bar: { status: 'draft' } },
        });
        expect(Object.keys(file.planned.items)).toEqual(['item_mythril']);
        expect(file.planned.items.item_mythril).toEqual(workspace().items.item_mythril);
        expect(Object.keys(file.planned.tokens)).toEqual(['token_mythril_vein']);
        expect(file.planned.recipes.map((r) => r.id)).toEqual(['recipe_mythril_bar']);
    });

    it('leaves the files exactly as before for a workspace that holds no ledger', () => {
        const old = workspace();
        old.items = { item_ore: { id: 'item_ore', name: 'Ore', type: 'material' }, item_bar: old.items.item_bar };
        old.tokens = { token_vein: old.tokens.token_vein };
        old.recipePools = { smithing: [{ ...old.recipePools.smithing[0], ledger: undefined }, old.recipePools.smithing[2]] };
        delete old.recipePools.smithing[0].ledger;
        const files = syncFiles(old);
        expect(Object.keys(files)).toEqual(['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json']);
        expect(files['items.json']).toEqual(old.items);
        expect(files['tokens.json']).toEqual(old.tokens);
        expect(files['tokenRecipes.json']).toEqual(old.recipePools.smithing);
    });

    it('splits stubs off even when handed a workspace nobody split, and puts them back in their places', () => {
        const ws = workspace();
        const { live, planned: stubs } = splitPlanned(ws);
        expect(Object.keys(live.items)).toEqual(['item_ore', 'item_bar']);
        expect(stubs.recipes.map((r) => r.id)).toEqual(['recipe_mythril_bar']);
        const back = rejoinPlanned(ws, live);
        expect(Object.keys(back.items)).toEqual(Object.keys(ws.items));
        expect(back.recipePools.smithing.map((r) => r.id)).toEqual(['recipe_bar', 'recipe_mythril_bar', 'recipe_late']);
        expect(back.items.item_mythril).toBe(ws.items.item_mythril);
    });
});

describe('Restore from Game brings the plan back', () => {
    it('lays ledger.json back over the game files: blocks onto records, stubs into their collections', () => {
        const ws = workspace();
        const files = syncFiles(ws);
        const restored = workspaceFromDataFiles({
            items: files['items.json'], tokens: files['tokens.json'], effects: files['effects.json'],
            tokenRecipes: files['tokenRecipes.json'], ledger: files[LEDGER_FILE],
        });
        for (const id of Object.keys(ws.items)) expect(restored.items[id]).toEqual(ws.items[id]);
        for (const id of Object.keys(ws.tokens)) expect(restored.tokens[id]).toEqual(ws.tokens[id]);
        const byId = Object.fromEntries(restored.recipePools.smithing.map((r) => [r.id, r]));
        for (const recipe of ws.recipePools.smithing) expect(byId[recipe.id]).toEqual(recipe);
    });

    it('lets the game record win over a stub of the same id, and drops a block whose record is gone', () => {
        const merged = mergeLedgerFile(
            { items: { item_a: { id: 'item_a', name: 'A (made)' } }, tokens: {}, recipePools: {} },
            { entries: { items: { item_gone: { tier: 1 } } }, planned: { items: { item_a: { id: 'item_a', name: 'A', ledger: planned(1) } } } },
        );
        expect(merged.items).toEqual({ item_a: { id: 'item_a', name: 'A (made)' } });
    });

    it('is a no-op without a ledger file', () => {
        const game = { items: { a: { id: 'a' } }, tokens: {}, recipePools: {} };
        expect(mergeLedgerFile(game, null)).toBe(game);
    });
});

describe('the economy line never sees a Planned stub', () => {
    it('Recalculate prices and audits the rest, and leaves each stub as it was, in its place', () => {
        useEntityStore.getState().hydrate(workspace());
        const before = useEntityStore.getState();
        const stub = before.items.item_mythril;
        const balanced = before.recalculateEconomy({});
        expect(Object.keys(balanced.items)).toEqual(['item_ore', 'item_bar']);
        expect(Object.keys(balanced.planned.items)).toEqual(['item_mythril']);
        const after = useEntityStore.getState();
        expect(Object.keys(after.items)).toEqual(['item_ore', 'item_mythril', 'item_bar']);
        expect(after.items.item_mythril).toBe(stub);
        expect(after.recipePools.smithing.map((r) => r.id)).toEqual(['recipe_bar', 'recipe_mythril_bar', 'recipe_late']);
        expect(JSON.stringify(balanced.sim.rows)).not.toMatch(/mythril/i);
        // A ledger block rides through the line untouched.
        expect(after.items.item_ore.ledger).toEqual({ status: 'live', tier: 1 });
        expect(syncFiles(balanced)[LEDGER_FILE].planned.tokens.token_mythril_vein).toEqual(workspace().tokens.token_mythril_vein);
    });
});

describe('the engines over the workspace', () => {
    it('prices a tree at the simulator’s rates, and still knows the stubs as Planned', () => {
        const ws = ledgerWorkspace();
        const smelt = ws.recipePools.smithing.find((r) => r.id === 'recipe_iron_ingot');
        smelt.sim = { tempo: 'medium', purpose: 'iph' };
        useEntityStore.getState().hydrate(ws);
        const balanced = useEntityStore.getState().recalculateEconomy({});
        const timed = balanced.sim.cycleTimes.get('recipe_iron_ingot');
        expect(Number.isFinite(timed)).toBe(true);
        expect(timed).not.toBe(18000);

        const fromRecords = workspaceLedger(useEntityStore.getState());
        const fromRun = workspaceLedger(useEntityStore.getState(), { sim: balanced });
        expect(fromRecords.treeOf('item_iron_ingot').tree.source.cycleMs).toBe(timed);
        expect(fromRun.treeOf('item_iron_ingot').effortMs).toBe(fromRecords.treeOf('item_iron_ingot').effortMs);
        expect(fromRecords.reachOf('item:item_mythril_ore')).toMatchObject({ planned: true, tier: null });
        expect(fromRecords.reachOf('item:item_iron_ore')).toMatchObject({ tier: 2 });
    });
});

describe('an old workspace opens unchanged', () => {
    it('loads a saved workspace with no ledger fields exactly as it was', () => {
        const old = workspace();
        old.items = { item_ore: { id: 'item_ore', name: 'Ore', type: 'material' } };
        old.tokens = { token_vein: old.tokens.token_vein };
        old.recipePools = { smithing: [old.recipePools.smithing[2]] };
        const { merge } = useEntityStore.persist.getOptions();
        const opened = merge(JSON.parse(JSON.stringify(old)), useEntityStore.getState());
        expect(opened.items).toEqual(old.items);
        expect(opened.recipePools).toEqual(old.recipePools);
        expect(JSON.stringify(opened.items)).not.toMatch(/ledger/);
    });
});

describe('the Sync guard', () => {
    const disk = () => syncFiles(workspace());

    it('does not call a stub that became content a removal, nor content sent back to the plan', () => {
        const promoted = workspace();
        promoted.items.item_mythril = { ...promoted.items.item_mythril, ledger: { status: 'draft', tier: 3 } };
        expect(compareSync(disk(), syncFiles(promoted)).hasRemovals).toBe(false);

        const demoted = workspace();
        demoted.items.item_bar = { ...demoted.items.item_bar, ledger: planned(2) };
        expect(compareSync(disk(), syncFiles(demoted)).hasRemovals).toBe(false);
    });

    it('asks before a stale workspace drops a Planned stub', () => {
        const stale = workspace();
        delete stale.items.item_mythril;
        const diff = compareSync(disk(), syncFiles(stale));
        expect(diff.hasRemovals).toBe(true);
        expect(diff.removed.planned).toEqual([{ id: 'items:item_mythril', name: 'Mythril Ore' }]);
    });

    it('compares no ledger when the Sync writes none', () => {
        const noPlan = { items: { item_ore: { id: 'item_ore', name: 'Ore' } }, tokens: {}, recipePools: {} };
        const current = { ...disk(), 'items.json': { item_ore: { name: 'Ore' } } };
        expect(compareSync(current, syncFiles(noPlan)).removed.planned).toEqual([]);
    });
});

describe('the server', () => {
    let dataDir, handler;

    function request(method, url, body) {
        return new Promise((resolve) => {
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

    beforeAll(() => {
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-ledger-'));
        cmsFileApi({ dataDir }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
    });
    afterAll(() => fs.rmSync(dataDir, { recursive: true, force: true }));

    it('writes ledger.json beside the game files, and Restore from Game reads it back', async () => {
        const ws = workspace();
        const res = await request('POST', '/api/sync-game-data', { files: syncFiles(ws), confirmRemovals: true });
        expect(res.status).toBe(200);
        expect(fs.existsSync(path.join(dataDir, LEDGER_FILE))).toBe(true);
        const items = JSON.parse(fs.readFileSync(path.join(dataDir, 'items.json'), 'utf8'));
        expect(Object.keys(items)).toEqual(['item_ore', 'item_bar']);

        const restored = (await request('GET', '/api/load-game-data')).body;
        expect(restored.items.item_mythril).toEqual(ws.items.item_mythril);
        expect(restored.items.item_ore.ledger).toEqual({ status: 'live', tier: 1 });
        expect(restored.tokens.token_mythril_vein).toEqual(ws.tokens.token_mythril_vein);
        expect(restored.recipePools.smithing.map((r) => r.id)).toEqual(['recipe_bar', 'recipe_late', 'recipe_mythril_bar']);
    });
});

describe('the game never loads ledger.json', () => {
    it('no data glob in the game matches it', () => {
        const globs = [];
        for (const { code } of sourceCode()) {
            for (const m of code.matchAll(/import\.meta\.glob\(\s*\[?\s*['"`]([^'"`]+)['"`]/g)) globs.push(m[1]);
        }
        expect(globs.some((g) => g.includes('/data/'))).toBe(true);
        const hits = globs.filter((g) => picomatch(g.replace(/^\//, ''))(`data/${LEDGER_FILE}`));
        expect(hits).toEqual([]);
    });
});

describe('change packs', () => {
    const pack = (value) => ({
        format: 'fantasy-guild-change-pack', version: 1, id: 'p1', createdAt: '2026-10-29T10:00:00Z', asked: 'tiers',
        entries: [{ op: 'create', kind: 'item', id: 'item_new', note: 'a stub', value }],
    });

    it('accepts a Planned stub and refuses a status the ledger does not know', () => {
        expect(validatePack(pack({ name: 'New', ledger: planned(2, 'later') })).ok).toBe(true);
        const bad = validatePack(pack({ name: 'New', ledger: { status: 'Planed', tier: 1.5 } }));
        expect(bad.ok).toBe(false);
        expect(bad.errors.join(' ')).toMatch(/ledger\.status/);
        expect(bad.errors.join(' ')).toMatch(/ledger\.tier/);
    });

    it('builds the workspace a pack is stamped against with the ledger laid on, as the CMS holds it', () => {
        const files = syncFiles(workspace());
        const ws = workspaceFromDataFiles({ items: files['items.json'], tokens: files['tokens.json'], ledger: files[LEDGER_FILE] });
        expect(isPlanned(ws.items.item_mythril)).toBe(true);
        expect(ws.items.item_ore.ledger).toEqual({ status: 'live', tier: 1 });
    });

    it('builds a ledger file only when there is a plan', () => {
        expect(buildLedgerFile({ items: { a: { id: 'a' } } }, {})).toBeNull();
    });
});
