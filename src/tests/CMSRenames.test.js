import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import {
    recordRename, forgetRenamesTo, settleSyncedRenames, mergeRenameTables, idsByKind, RENAMES_SYNC_KEY, emptyRenames,
} from '../../cms/src/engine/renames.js';
import { syncFiles } from '../../cms/src/engine/recipeSync.js';
import { workspaceFromImport } from '../../cms/src/engine/workspaceSeeds.js';
import { writeSync, syncCounts } from '../../cms/gameData.js';
import { runCli } from '../../cms/cliCommands.mjs';
import { readWorkspaceFile, saveWorkspaceFile } from '../../cms/workspaceFile.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { setRenamesForTests, resetRenamesForTests } from '../config/registries/renameRegistry.js';
import { createInitialState, GAME_VERSION } from '../state/StateSchema.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * The CMS keeps what was renamed since the last Sync, and Sync carries it into `data/renames.json`,
 * the table a loaded save follows. Nothing here reads or writes the real workspace, `data/` or the
 * plan: the Sync tests write to throwaway folders (TESTING, "The CMS").
 */

const root = path.resolve(__dirname, '../..');
const tmpRoots = [];
afterAll(() => {
    for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true });
    resetRenamesForTests();
});
const tmp = (prefix) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpRoots.push(dir);
    return dir;
};

describe('the record: one entry per entity that moved since the last Sync', () => {
    it('a name typed one key at a time leaves one entry, from where it stood to where it ends', () => {
        let record = emptyRenames();
        const steps = ['item_oak_wood', 'item_oak_woo', 'item_oak_wo', 'item_oak_w', 'item_oak', 'item_oak_l', 'item_oak_lo', 'item_oak_logs'];
        for (let i = 1; i < steps.length; i++) record = recordRename(record, 'items', steps[i - 1], steps[i]);
        expect(record.items).toEqual({ item_oak_wood: 'item_oak_logs' });
    });

    it('a name put back as it was leaves nothing', () => {
        let record = recordRename(emptyRenames(), 'tokens', 'token_wolf', 'token_wol');
        record = recordRename(record, 'tokens', 'token_wol', 'token_wolf');
        expect(record.tokens).toEqual({});
    });

    it('an entity made since the last Sync passing through an id another one left is not recorded under it', () => {
        // Oak Wood became Oak Logs; a new item is then named "Oak Wood" and renamed again.
        let record = recordRename(emptyRenames(), 'items', 'item_oak_wood', 'item_oak_logs');
        record = recordRename(record, 'items', 'item_oak_wood', 'item_oak_bark');
        expect(record.items).toEqual({ item_oak_wood: 'item_oak_logs' });
    });

    it('a deleted entity is followed nowhere', () => {
        const record = recordRename(emptyRenames(), 'items', 'item_a', 'item_b');
        expect(forgetRenamesTo(record, 'items', 'item_b').items).toEqual({});
        expect(forgetRenamesTo(record, 'items', 'item_zzz')).toBe(record);
    });

    it('once a Sync lands, the record starts again from the ids it wrote, keeping a rename made meanwhile', () => {
        const sent = { items: { item_a: 'item_b', item_x: 'item_y' }, tokens: {}, effects: {} };
        const now = { items: { item_a: 'item_b', item_x: 'item_z' }, tokens: { token_t: 'token_u' }, effects: {} };
        expect(settleSyncedRenames(now, sent)).toEqual({ items: { item_y: 'item_z' }, tokens: { token_t: 'token_u' }, effects: {} });
    });
});

describe('the store records every id change', () => {
    const reset = () => useEntityStore.setState({
        items: {}, tokens: {}, effects: {}, recipePools: {}, renames: emptyRenames(),
        activeEntityId: null, activeEntityType: null,
    });
    beforeEach(reset);
    const idOf = (collection, name) => Object.keys(useEntityStore.getState()[collection]).find((k) => useEntityStore.getState()[collection][k].name === name);
    const type = (collection, update, from, to) => {
        // The editor's name box: one update per key, the id following each.
        let name = from;
        while (name.length > 0 && !to.startsWith(name)) {
            const id = idOf(collection, name);
            name = name.slice(0, -1);
            useEntityStore.getState()[update](id, { name });
        }
        while (name !== to) {
            const id = idOf(collection, name);
            name = to.slice(0, name.length + 1);
            useEntityStore.getState()[update](id, { name });
        }
    };

    it('an item, a Token and a library effect renamed in the editor', () => {
        const store = useEntityStore.getState();
        store.addItem({ name: 'Oak Wood' });
        store.addToken({ name: 'Wolf' });
        store.addEffect({ name: 'Slow' });
        // A Sync has carried these ids to the game.
        useEntityStore.setState({ renames: emptyRenames() });

        type('items', 'updateItem', 'Oak Wood', 'Oak Logs');
        type('tokens', 'updateToken', 'Wolf', 'Grey Wolf');
        type('effects', 'updateEffect', 'Slow', 'Sluggish');

        expect(useEntityStore.getState().renames).toEqual({
            items: { item_oak_wood: 'item_oak_logs' },
            tokens: { token_wolf: 'token_grey_wolf' },
            effects: { effect_slow: 'effect_sluggish' },
        });
    });

    it('an id edited by hand is recorded too, and a delete forgets', () => {
        const store = useEntityStore.getState();
        store.addItem({ name: 'Copper' });
        useEntityStore.setState({ renames: emptyRenames() });
        useEntityStore.getState().renameEntityId('item_copper', 'item_copper_ingot', 'item');
        expect(useEntityStore.getState().renames.items).toEqual({ item_copper: 'item_copper_ingot' });
        useEntityStore.getState().deleteItem('item_copper_ingot');
        expect(useEntityStore.getState().renames.items).toEqual({});
    });

    it('Sync sends the record beside the files, never as a file', () => {
        const files = syncFiles({ items: {}, tokens: {}, recipePools: {}, effects: {}, renames: { items: { a: 'b' } } });
        expect(files[RENAMES_SYNC_KEY]).toEqual({ items: { a: 'b' }, tokens: {}, effects: {} });
        expect(files['renames.json']).toBeUndefined();
        expect(syncFiles({ items: {}, tokens: {}, recipePools: {}, effects: {}, renames: emptyRenames() })[RENAMES_SYNC_KEY]).toBeUndefined();
    });

    it('Restore from Game starts an empty record; a backup brings its own back', () => {
        expect(workspaceFromImport({ items: {}, tokens: {} }).renames).toEqual(emptyRenames());
        expect(workspaceFromImport({ items: {}, tokens: {}, renames: { tokens: { t: 'u' } } }).renames.tokens).toEqual({ t: 'u' });
    });
});

describe('what data/renames.json holds after a Sync', () => {
    const ids = (items = [], tokens = [], effects = []) => ({ items: new Set(items), tokens: new Set(tokens), effects: new Set(effects) });

    it('a rename of an id the game has is added; one the game never had is not', () => {
        const table = mergeRenameTables({
            onDisk: null,
            sent: { items: { item_a: 'item_b', item_new: 'item_newer' } },
            before: ids(['item_a']), after: ids(['item_b', 'item_newer']),
        });
        expect(table.items).toEqual({ item_a: 'item_b' });
    });

    it('a second rename carries the first on to the end of the chain', () => {
        const table = mergeRenameTables({
            onDisk: { items: { item_a: 'item_b' } },
            sent: { items: { item_b: 'item_c' } },
            before: ids(['item_b']), after: ids(['item_c']),
        });
        expect(table.items).toEqual({ item_a: 'item_c', item_b: 'item_c' });
    });

    it('a name put back, and an id used again, are never renamed away', () => {
        const back = mergeRenameTables({
            onDisk: { items: { item_a: 'item_b' } },
            sent: { items: { item_b: 'item_a' } },
            before: ids(['item_b']), after: ids(['item_a']),
        });
        expect(back.items).toEqual({ item_b: 'item_a' });
        const reused = mergeRenameTables({ onDisk: { tokens: { token_wolf: 'token_grey_wolf' } }, sent: null, before: ids([], ['token_grey_wolf']), after: ids([], ['token_grey_wolf', 'token_wolf']) });
        expect(reused.tokens).toEqual({});
    });

    it('a stale record sent again changes nothing, and keeps what the table had', () => {
        const table = mergeRenameTables({
            onDisk: { items: { item_a: 'item_b' } },
            sent: { items: { item_a: 'item_zzz' } },
            before: ids(['item_b']), after: ids(['item_b']),
        });
        expect(table.items).toEqual({ item_a: 'item_b' });
    });

    it('a loop in a damaged table is dropped, and the merge ends', () => {
        const table = mergeRenameTables({ onDisk: { items: { item_a: 'item_b', item_b: 'item_a', item_c: 'item_a' } }, sent: null, before: ids(), after: ids() });
        expect(table.items).toEqual({});
    });

    it('a kind whose file this Sync does not write keeps the ids data/ has', () => {
        const before = ids(['item_a'], ['token_t'], ['effect_e']);
        const after = idsByKind({ 'items.json': { item_b: {} } }, before);
        expect([...after.items]).toEqual(['item_b']);
        expect([...after.tokens]).toEqual(['token_t']);
    });
});

describe('Sync to Game writes the table', () => {
    function dataDir(items) {
        const dir = tmp('fg-renames-');
        fs.mkdirSync(path.join(dir, 'data'));
        fs.writeFileSync(path.join(dir, 'data', 'items.json'), JSON.stringify(items));
        fs.writeFileSync(path.join(dir, 'data', 'tokens.json'), '{}');
        fs.writeFileSync(path.join(dir, 'data', 'effects.json'), '{}');
        return dir;
    }
    const sync = (dir, items, renames) => writeSync({
        files: { 'items.json': items, 'tokens.json': {}, 'effects.json': {} }, renames, confirmRemovals: true,
        dataRoot: path.join(dir, 'data'), planRoot: path.join(dir, 'plan'),
    });
    const tableOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'data', 'renames.json'), 'utf8'));

    it('nothing renamed and no table yet: no file', async () => {
        const dir = dataDir({ item_a: { id: 'item_a' } });
        const { status, body } = await sync(dir, { item_a: { id: 'item_a' } }, null);
        expect(status).toBe(200);
        expect(body.filesWritten).not.toContain('renames.json');
        expect(fs.existsSync(path.join(dir, 'data', 'renames.json'))).toBe(false);
    });

    it('two Syncs, renamed twice: the table follows both; a Sync with no renames keeps it', async () => {
        const dir = dataDir({ item_a: { id: 'item_a' } });
        expect((await sync(dir, { item_b: { id: 'item_b' } }, { items: { item_a: 'item_b' } })).status).toBe(200);
        expect(tableOf(dir).items).toEqual({ item_a: 'item_b' });
        expect((await sync(dir, { item_c: { id: 'item_c' } }, { items: { item_b: 'item_c' } })).status).toBe(200);
        expect(tableOf(dir).items).toEqual({ item_a: 'item_c', item_b: 'item_c' });
        const quiet = await sync(dir, { item_c: { id: 'item_c' } }, null);
        expect(quiet.body.filesWritten).toContain('renames.json');
        expect(tableOf(dir).items).toEqual({ item_a: 'item_c', item_b: 'item_c' });
    });

    it('a renames.json sent among the files is never written as sent', async () => {
        const dir = dataDir({ item_a: { id: 'item_a' } });
        await writeSync({
            files: { 'items.json': { item_a: { id: 'item_a' } }, 'renames.json': { items: { item_x: 'item_a' } } },
            confirmRemovals: true, dataRoot: path.join(dir, 'data'), planRoot: path.join(dir, 'plan'),
        });
        expect(fs.existsSync(path.join(dir, 'data', 'renames.json'))).toBe(false);
    });

    it('an unreadable table stops the Sync before anything is written', async () => {
        const dir = dataDir({ item_a: { id: 'item_a' } });
        fs.writeFileSync(path.join(dir, 'data', 'renames.json'), '{ not json');
        const { status, body } = await sync(dir, { item_b: { id: 'item_b' } }, { items: { item_a: 'item_b' } });
        expect(status).toBe(500);
        expect(body.error).toMatch(/renames\.json cannot be read/);
        expect(JSON.parse(fs.readFileSync(path.join(dir, 'data', 'items.json'), 'utf8'))).toEqual({ item_a: { id: 'item_a' } });
    });

    it('the commit message counts the renamed ids', () => {
        expect(syncCounts({ 'items.json': { a: {} }, 'renames.json': { items: { x: 'a', y: 'a' } } }, null)).toMatchObject({ items: 1, 'renamed ids': 2 });
    });
});

describe('from the CMS to a loaded save, through the command line\'s real Sync', () => {
    it('rename an item in the editor, Sync, load a save holding the old id: the item is back', async () => {
        const dir = tmp('fg-renames-cli-');
        fs.cpSync(path.join(root, 'data'), path.join(dir, 'data'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'plan'));
        fs.copyFileSync(path.join(root, 'cms', 'plan', 'plan.json'), path.join(dir, 'plan', 'plan.json'));
        const out = [];
        const err = [];
        const cms = (...argv) => runCli([...argv, `--sandbox=${dir}`], {
            root, load: (p) => import(/* @vite-ignore */ path.join(root, 'cms', p)), out: (s) => out.push(s), err: (s) => err.push(s),
        });
        expect(await cms('restore'), err.join('\n')).toBe(0);

        // The page's editor: the workspace loaded into the store, the name typed over.
        const wsFile = path.join(dir, 'workspace', 'workspace.json');
        const disk = readWorkspaceFile(wsFile);
        useEntityStore.getState().hydrate(disk.workspace);
        // An item the game has (not a Planned stub, which never reaches data/).
        const shipped = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'items.json'), 'utf8'));
        const oldId = Object.keys(shipped).find((id) => shipped[id].type === 'material' && disk.workspace.items[id]);
        const oldName = disk.workspace.items[oldId].name;
        useEntityStore.getState().updateItem(oldId, { name: `${oldName} Renamed` });
        const s = useEntityStore.getState();
        const newId = Object.keys(s.items).find((id) => s.items[id].name === `${oldName} Renamed`);
        expect(newId).not.toBe(oldId);
        expect(s.renames.items).toEqual({ [oldId]: newId });
        saveWorkspaceFile(wsFile, { ...disk.workspace, items: s.items, tokens: s.tokens, effects: s.effects, recipePools: s.recipePools, renames: s.renames }, { baseRevision: disk.revision });

        // A rename takes the old id out of data/, so the Sync asks first, as it does today.
        expect(await cms('sync', '--confirm-removals'), err.join('\n')).toBe(0);
        const table = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'renames.json'), 'utf8'));
        expect(table.items).toEqual({ [oldId]: newId });
        expect(readWorkspaceFile(wsFile).workspace.renames.items).toEqual({});
        expect(JSON.parse(fs.readFileSync(path.join(dir, 'data', 'items.json'), 'utf8'))[newId]).toBeTruthy();

        // The game with that table (its items.json still the real one here, which defines the old id; a
        // game built from the sandbox's data/ would define the new one instead, as `defined` says).
        setRenamesForTests(table);
        const save = createInitialState();
        save.inventory.items = { [oldId]: { quantity: 42, dur: null } };
        const { followRenames } = await import('../systems/core/followRenames.js');
        const followed = followRenames(save, { table, defined: { items: (id) => id === newId, tokens: () => true, effects: () => true } });
        expect(followed.inventory.items[newId].quantity).toBe(42);
        expect(followed.inventory.items[oldId]).toBeUndefined();
        // And through the load path, where the real registry still knows the old id: left as it is.
        expect(migrateState(structuredClone(save), GAME_VERSION).inventory.items[oldId].quantity).toBe(42);
    }, 120000);
});
