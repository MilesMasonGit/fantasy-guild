// Which workspace changePackTool reads without --from: the newest autosave only while it is newer
// than data/, so a pack built on freshly Synced content is not judged against an old autosave.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { chooseWorkspace, loadWorkspace } from '../../cms/packWorkspace.mjs';

const DAY = 24 * 3600 * 1000;
let root;

function write(rel, value, ageDays) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
    const t = new Date(Date.now() - ageDays * DAY);
    fs.utimesSync(file, t, t);
    return file;
}

function dataFiles(ageDays, itemId = 'fresh_item') {
    write('data/items.json', { [itemId]: { id: itemId, name: 'Fresh' } }, ageDays);
    write('data/tokens.json', {}, ageDays + 1);
}

beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-packws-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('changePackTool workspace choice', () => {
    it('reads data/ (and the plan) when data/ is newer than the newest autosave', () => {
        write('cms/backups/autosave_old.json', { items: { stale_item: { id: 'stale_item' } }, tokens: {} }, 4);
        dataFiles(0);
        write('cms/plan/plan.json', { entries: [] }, 0);
        const choice = chooseWorkspace(root, null);
        expect(choice.kind).toBe('data');
        expect(choice.reason).toMatch(/newer than the newest autosave/);
        const loaded = loadWorkspace(root, null);
        expect(loaded.source).toMatch(/^data\/ /);
        expect(loaded.source).toMatch(/autosave_old\.json/);
        expect(Object.keys(loaded.workspace.items)).toEqual(['fresh_item']);
    });

    it('a newer autosave still wins (the owner has unsynced work)', () => {
        dataFiles(3);
        const save = write('cms/backups/autosave_new.json', { items: { owner_item: { id: 'owner_item' } }, tokens: {} }, 1);
        write('cms/backups/autosave_older.json', { items: {}, tokens: {} }, 2);
        const loaded = loadWorkspace(root, null);
        expect(loaded.kind).toBe('autosave');
        expect(loaded.file).toBe(save);
        expect(loaded.source).toMatch(/newer than data\//);
        expect(Object.keys(loaded.workspace.items)).toEqual(['owner_item']);
    });

    it('any newer data/ file counts, not only items.json', () => {
        dataFiles(5);
        write('cms/backups/autosave_a.json', { items: {}, tokens: {} }, 2);
        write('data/world.json', {}, 0);
        expect(chooseWorkspace(root, null).kind).toBe('data');
    });

    it('reads data/ when there is no autosave, and --from always wins', () => {
        dataFiles(0);
        expect(chooseWorkspace(root, null)).toMatchObject({ kind: 'data', reason: expect.stringMatching(/no CMS autosave/) });
        const named = write('elsewhere.json', { items: {}, tokens: {} }, 9);
        expect(chooseWorkspace(root, named)).toMatchObject({ kind: 'from', file: named });
    });
});
