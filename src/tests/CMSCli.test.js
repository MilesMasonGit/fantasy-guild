import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync, execFileSync } from 'child_process';

import { runCli, pathsFrom, parseArgs } from '../../cms/cliCommands.mjs';
import { readWorkspaceFile, saveWorkspaceFile } from '../../cms/workspaceFile.js';
import { writeSync } from '../../cms/gameData.js';
import { fingerprint } from '../../cms/src/engine/changePacks.js';
import { recalculateWorkspace } from '../../cms/src/engine/recalculate.js';
import { seedStoredWorkspace } from '../../cms/src/engine/workspaceSeeds.js';
import { DEFAULT_GLOBALS } from '../../cms/src/utils/constants.js';

/**
 * The CMS's command line (`npm run cms -- <command>`, `cms/cliCommands.mjs`). Every command runs
 * against a throwaway copy of today's `data/` and plan (`--sandbox`); nothing here reads or writes
 * the real workspace, `data/` or `cms/plan/` (TESTING, "The CMS"). The commands run in-process
 * with the CMS's modules imported directly; one test runs the real entry, through Vite.
 */

const root = path.resolve(__dirname, '../..');
const cmsDir = path.join(root, 'cms');
const load = (p) => import(/* @vite-ignore */ path.join(cmsDir, p));
const tmpRoots = [];
const realPlanBefore = fs.readFileSync(path.join(root, 'cms', 'plan', 'plan.json'), 'utf8');

function sandbox() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-cms-cli-'));
    tmpRoots.push(dir);
    fs.cpSync(path.join(root, 'data'), path.join(dir, 'data'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'plan'));
    fs.copyFileSync(path.join(root, 'cms', 'plan', 'plan.json'), path.join(dir, 'plan', 'plan.json'));
    return dir;
}

/** Run one command; `{ code, out, err }`. */
async function cms(dir, ...argv) {
    const out = [];
    const err = [];
    const code = await runCli([...argv, `--sandbox=${dir}`], { root, load, out: (s) => out.push(s), err: (s) => err.push(s) });
    return { code, out: out.join('\n'), err: err.join('\n') };
}

const wsOf = (dir) => readWorkspaceFile(path.join(dir, 'workspace', 'workspace.json'));
const textOf = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

afterAll(() => {
    for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true });
    // Nothing reached the real plan.
    expect(fs.readFileSync(path.join(root, 'cms', 'plan', 'plan.json'), 'utf8')).toBe(realPlanBefore);
});

describe('options', () => {
    it('reads --key=value and bare flags', () => {
        expect(parseArgs(['pack', 'apply', 'a.json', '--yes', '--data=x'])).toEqual({ options: { yes: true, data: 'x' }, words: ['pack', 'apply', 'a.json'] });
    });

    it('uses the project folders by default and keeps an overridden data folder away from the real plan', () => {
        const real = pathsFrom({}, root);
        expect(real).toMatchObject({
            dataRoot: path.join(root, 'data'), planRoot: path.join(root, 'cms', 'plan'),
            workspaceFile: path.join(root, 'cms', 'workspace', 'workspace.json'), backupsDir: path.join(root, 'cms', 'backups'), ownProject: true,
        });
        const other = pathsFrom({ data: '/tmp/x/data', workspace: '/tmp/y/ws.json' }, root);
        expect(other.planRoot).toBe(path.resolve('/tmp/x/plan'));
        expect(other.backupsDir).toBe(path.resolve('/tmp/y/backups'));
        expect(other.ownProject).toBe(false);
        expect(pathsFrom({ sandbox: '/tmp/s' }, root)).toMatchObject({ dataRoot: path.resolve('/tmp/s/data'), planRoot: path.resolve('/tmp/s/plan'), backupsDir: path.resolve('/tmp/s/backups'), ownProject: false });
    });

    it('answers an unknown command with the usage', async () => {
        const r = await cms(sandbox(), 'frobnicate');
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/Usage: npm run cms/);
    });
});

describe('restore, recalc and sync', () => {
    let dir;
    beforeAll(() => { dir = sandbox(); });

    it('restore builds the workspace from data/ and the plan, and keeps the one it replaces', async () => {
        const first = await cms(dir, 'restore');
        expect(first.code, first.err).toBe(0);
        const ws = wsOf(dir);
        expect(ws).toMatchObject({ exists: true, revision: 1, savedBy: 'cli: restore' });
        // The game's items, and the Planned stubs the plan lays back on.
        const plan = JSON.parse(textOf(path.join(dir, 'plan', 'plan.json')));
        expect(Object.keys(ws.workspace.items).sort()).toEqual([
            ...Object.keys(JSON.parse(textOf(path.join(dir, 'data', 'items.json')))),
            ...Object.keys(plan.planned?.items || {}),
        ].sort());
        expect(ws.workspace.planSettings).not.toBeUndefined();

        const second = await cms(dir, 'restore');
        expect(second.code).toBe(0);
        expect(second.out).toMatch(/Backups as before-restore_/);
        expect(fs.readdirSync(path.join(dir, 'backups')).some((f) => f.startsWith('before-restore_'))).toBe(true);
        expect(wsOf(dir).revision).toBe(2);
    });

    it('recalc saves exactly what Recalculate makes of the workspace, and prints the audit', async () => {
        const before = wsOf(dir);
        const r = await cms(dir, 'recalc');
        expect(r.code, r.err).toBe(0);
        expect(r.out).toMatch(/Audit: \d+ critical, \d+ warnings?, \d+ info\./);
        const after = wsOf(dir);
        expect(after).toMatchObject({ revision: before.revision + 1, savedBy: 'cli: recalc' });
        const expected = recalculateWorkspace(seedStoredWorkspace(before.workspace), { ...DEFAULT_GLOBALS.simDials, ...(before.simDials || {}) }).workspace;
        expect(JSON.stringify(after.workspace.items)).toBe(JSON.stringify(expected.items));
        expect(JSON.stringify(after.workspace.tokens)).toBe(JSON.stringify(expected.tokens));
    });

    it('sync writes data/ as the last Sync to Game did: today\'s files come back byte for byte', async () => {
        const r = await cms(dir, 'sync');
        expect(r.code, r.err).toBe(0);
        expect(r.out).toMatch(/Not committed: data folder overridden/);
        for (const name of fs.readdirSync(path.join(root, 'data')).filter((f) => f.endsWith('.json'))) {
            expect(textOf(path.join(dir, 'data', name)), name).toBe(textOf(path.join(root, 'data', name)));
        }
        expect(textOf(path.join(dir, 'plan', 'plan.json'))).toBe(textOf(path.join(root, 'cms', 'plan', 'plan.json')));
    });

    it('sync refuses to remove content the game has until --confirm-removals, writing nothing', async () => {
        const ws = wsOf(dir);
        const [goneId] = Object.keys(ws.workspace.items);
        const items = { ...ws.workspace.items };
        delete items[goneId];
        saveWorkspaceFile(path.join(dir, 'workspace', 'workspace.json'), { ...ws.workspace, items }, { baseRevision: ws.revision });
        const itemsBefore = textOf(path.join(dir, 'data', 'items.json'));

        const refused = await cms(dir, 'sync');
        expect(refused.code).toBe(1);
        expect(refused.err).toMatch(/would remove 1 item/);
        expect(refused.err).toContain(`(${goneId})`);
        expect(textOf(path.join(dir, 'data', 'items.json'))).toBe(itemsBefore);

        const confirmed = await cms(dir, 'sync', '--confirm-removals');
        expect(confirmed.code, confirmed.err).toBe(0);
        expect(JSON.parse(textOf(path.join(dir, 'data', 'items.json')))[goneId]).toBeUndefined();
    });
});

describe('pack check and pack apply', () => {
    let dir;
    let inbox;
    const write = (name, pack) => {
        const file = path.join(inbox, name);
        fs.writeFileSync(file, JSON.stringify(pack, null, 2));
        return file;
    };
    const pack = (id, entries) => ({ format: 'fantasy-guild-change-pack', version: 1, id, createdAt: '2026-11-06T12:00:00Z', asked: 'a test', entries });

    beforeAll(async () => {
        dir = sandbox();
        inbox = path.join(dir, 'incoming');
        fs.mkdirSync(inbox);
        expect((await cms(dir, 'restore')).code).toBe(0);
    });

    it('check says whether the CMS takes a pack, and lists conflicts', async () => {
        const ws = wsOf(dir).workspace;
        const [itemId] = Object.keys(ws.items);
        const good = write('p-check.json', pack('p-check', [
            { op: 'create', kind: 'item', id: 'item_cli_test', value: { name: 'CLI Test', type: 'material' }, note: 'test' },
            { op: 'edit', kind: 'item', id: itemId, value: { ...ws.items[itemId], name: 'Stale' }, fingerprint: 'fp:0000000000000000', note: 'test' },
        ]));
        const ok = await cms(dir, 'pack', 'check', good);
        expect(ok.code, ok.err).toBe(0);
        expect(ok.out).toMatch(/OK: 2 entries/);
        expect(ok.out).toMatch(/1 entry conflicts/);
        const bad = write('p-bad.json', { ...pack('p-bad', []), entries: [] });
        expect((await cms(dir, 'pack', 'check', bad)).code).toBe(1);
    });

    it('apply takes the review\'s accept rules, saves the next revision and archives the pack with its record', async () => {
        const disk = wsOf(dir);
        const [itemId] = Object.keys(disk.workspace.items);
        const current = seedStoredWorkspace(disk.workspace).items[itemId];
        const file = write('p-apply.json', pack('p-apply', [
            { op: 'create', kind: 'item', id: 'item_cli_new', value: { name: 'CLI New', type: 'material' }, note: 'test' },
            { op: 'edit', kind: 'item', id: itemId, value: { ...current, description: 'Edited by the command line' }, fingerprint: fingerprint(current), note: 'test' },
        ]));
        const r = await cms(dir, 'pack', 'apply', file);
        expect(r.code, r.err).toBe(0);
        expect(r.out).toMatch(/Applied 2 entries/);
        const after = wsOf(dir);
        expect(after).toMatchObject({ revision: disk.revision + 1, savedBy: 'cli: pack apply p-apply.json' });
        expect(after.workspace.items.item_cli_new).toMatchObject({ id: 'item_cli_new', name: 'CLI New' });
        expect(after.workspace.items[itemId].description).toBe('Edited by the command line');
        expect(fs.existsSync(file)).toBe(false);
        const archived = JSON.parse(fs.readFileSync(path.join(inbox, 'applied', 'p-apply.json'), 'utf8'));
        expect(archived.review.entries.map((e) => e.applied)).toEqual([true, true]);
        expect(archived.review.entries[1].before.description).toBe(current.description);
    });

    it('apply refuses a conflicting pack whole, unless --yes forces it', async () => {
        const disk = wsOf(dir);
        const [, itemId] = Object.keys(disk.workspace.items);
        const file = write('p-conflict.json', pack('p-conflict', [
            { op: 'create', kind: 'item', id: 'item_cli_other', value: { name: 'Other', type: 'material' }, note: 'test' },
            { op: 'edit', kind: 'item', id: itemId, value: { ...disk.workspace.items[itemId], name: 'Forced' }, fingerprint: 'fp:0000000000000000', note: 'test' },
        ]));
        const refused = await cms(dir, 'pack', 'apply', file);
        expect(refused.code).toBe(1);
        expect(refused.err).toMatch(/Refused: 1 entry conflicts[\s\S]*Nothing was applied/);
        expect(wsOf(dir).revision).toBe(disk.revision);
        expect(fs.existsSync(file)).toBe(true);

        const forced = await cms(dir, 'pack', 'apply', file, '--yes');
        expect(forced.code, forced.err).toBe(0);
        expect(forced.out).toMatch(/1 forced over a conflict/);
        expect(wsOf(dir).workspace.items[itemId].name).toBe('Forced');
        const archived = JSON.parse(fs.readFileSync(path.join(inbox, 'applied', 'p-conflict.json'), 'utf8'));
        expect(archived.review.entries[1].forced).toBe(true);
    });

    it('apply writes nothing when the workspace changes while it runs (the CMS page saved meanwhile)', async () => {
        const disk = wsOf(dir);
        const file = write('p-race.json', pack('p-race', [
            { op: 'create', kind: 'item', id: 'item_cli_race', value: { name: 'Race', type: 'material' }, note: 'test' },
        ]));
        const wsFile = path.join(dir, 'workspace', 'workspace.json');
        const racing = async (p) => {
            const mod = await load(p);
            if (p.endsWith('workspaceSeeds.js')) saveWorkspaceFile(wsFile, readWorkspaceFile(wsFile).workspace, { baseRevision: disk.revision, savedBy: 'cms' });
            return mod;
        };
        const err = [];
        const code = await runCli(['pack', 'apply', file, `--sandbox=${dir}`], { root, load: racing, out: () => {}, err: (s) => err.push(s) });
        expect(code).toBe(1);
        expect(err.join('\n')).toMatch(/changed while this ran/);
        expect(wsOf(dir)).toMatchObject({ revision: disk.revision + 1, savedBy: 'cms' });
        expect(wsOf(dir).workspace.items.item_cli_race).toBeUndefined();
        expect(fs.existsSync(file)).toBe(true);
    });

    it('apply without a workspace on disk says how to make one', async () => {
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-cms-cli-'));
        tmpRoots.push(empty);
        const file = path.join(empty, 'p-none.json');
        fs.writeFileSync(file, JSON.stringify(pack('p-none', [{ op: 'create', kind: 'item', id: 'item_x', value: { name: 'X' }, note: 'n' }])));
        const r = await cms(empty, 'pack', 'apply', file);
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/npm run cms -- restore/);
    });
});

describe('the Sync commit', () => {
    it('stages and commits only the files the Sync wrote, never a palette waiting in data/', async () => {
        const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-cms-git-'));
        tmpRoots.push(repo);
        const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
        git('init', '-q');
        git('config', 'user.email', 'test@example.com');
        git('config', 'user.name', 'Test');
        git('config', 'commit.gpgsign', 'false');
        fs.mkdirSync(path.join(repo, 'data', 'palettes'), { recursive: true });
        fs.writeFileSync(path.join(repo, 'data', 'items.json'), '{}');
        fs.writeFileSync(path.join(repo, 'data', 'palettes', 'custom_palettes.json'), '{}');
        git('add', '-A');
        git('commit', '-q', '-m', 'start');
        // The Studio saved a palette, not yet committed.
        fs.writeFileSync(path.join(repo, 'data', 'palettes', 'custom_palettes.json'), '{"oak":["#2a1b0a"]}');

        const { status, body } = await writeSync({
            files: { 'items.json': { item_log: { id: 'item_log', name: 'Log' } } },
            dataRoot: path.join(repo, 'data'), planRoot: path.join(repo, 'cms', 'plan'), commit: { projectRoot: repo },
        });
        expect(status).toBe(200);
        expect(body.commit.committed).toBe(true);
        expect(git('show', '--name-only', '--format=%s', 'HEAD').split('\n').filter(Boolean)).toEqual(['CMS sync: 1 items', 'data/items.json']);
        expect(git('status', '--porcelain')).toBe('M data/palettes/custom_palettes.json');
    });
});

describe('the real entry point', () => {
    it('runs through Vite: npm run cms -- recalc on a sandbox', { timeout: 120_000 }, () => {
        const dir = sandbox();
        saveWorkspaceFile(path.join(dir, 'workspace', 'workspace.json'), { items: {}, tokens: {}, effects: {}, recipePools: {} }, { baseRevision: 0 });
        const r = spawnSync(process.execPath, [path.join(cmsDir, 'cli.mjs'), 'restore', `--sandbox=${dir}`], { cwd: root, encoding: 'utf8', timeout: 110_000 });
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toMatch(/Restored .* \(revision 2\)/);
        const recalc = spawnSync(process.execPath, [path.join(cmsDir, 'cli.mjs'), 'recalc', `--sandbox=${dir}`], { cwd: root, encoding: 'utf8', timeout: 110_000 });
        expect(recalc.status, recalc.stderr).toBe(0);
        expect(recalc.stdout).toMatch(/now revision 3/);
    });
});
