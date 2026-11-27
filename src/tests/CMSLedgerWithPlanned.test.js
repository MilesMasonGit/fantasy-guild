import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

import { runCli, USAGE } from '../../cms/cliCommands.mjs';
import { saveWorkspaceFile } from '../../cms/workspaceFile.js';
import { ledgerReadout, readoutText } from '../../cms/src/engine/ledgerReadout.js';
import { paceWorkspace } from './fixtures/paceWorld.js';

/**
 * `npm run cms -- ledger --with-planned` (brief 900 B5 b): the read-out times Planned work as if it
 * were live, each Planned row still marked Planned; without the flag the read-out is the plain one.
 * Runs on the pace fixture with a Planned recipe and the Planned item it makes; nothing here reads
 * or writes the real workspace.
 */

const root = path.resolve(__dirname, '../..');
const cmsDir = path.join(root, 'cms');
const load = (p) => import(/* @vite-ignore */ path.join(cmsDir, p));
const tmpRoots = [];

const PLANNED = { status: 'planned', tier: 0, note: 'later' };

/** The pace fixture with a Planned Ale (an item) and its Planned recipe: a richer cooking work than Beer. */
function plannedWorkspace() {
    const ws = paceWorkspace();
    ws.items.item_ale = { id: 'item_ale', name: 'Ale', type: 'material', plan: { ...PLANNED } };
    ws.recipePools.cooking.push({
        id: 'recipe_ale', name: 'Ale', skill: 'cooking', levelRequirement: 1, stationKinds: ['still'], durationMs: 10000, xp: 8,
        inputs: [{ itemId: 'item_oak_wood', quantity: 1 }], outputs: [{ itemId: 'item_ale', chance: 100, min: 1, max: 1 }], plan: { ...PLANNED },
    });
    return ws;
}

/** The read-out without its run time, the only thing that differs between two runs of the same workspace. */
const stable = (r) => JSON.stringify({ ...r, ms: 0 });

function sandbox() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-cms-ledger-wp-'));
    tmpRoots.push(dir);
    fs.mkdirSync(path.join(dir, 'workspace'));
    saveWorkspaceFile(path.join(dir, 'workspace', 'workspace.json'), plannedWorkspace(), { baseRevision: 0, savedBy: 'test' });
    return dir;
}

async function cms(dir, ...argv) {
    const out = [];
    const err = [];
    const code = await runCli([...argv, `--sandbox=${dir}`], { root, load, out: (s) => out.push(s), err: (s) => err.push(s) });
    return { code, out: out.join('\n'), err: err.join('\n') };
}

const hashOf = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rowOf = (r, key) => r.rows.find((x) => x.key === key);

afterAll(() => {
    for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true });
});

describe('ledger --with-planned', () => {
    it('is in the usage', () => {
        expect(USAGE).toMatch(/^\s+ledger \[--json=<file>\] \[--one-layout\] \[--with-planned\]/m);
        expect(USAGE).toMatch(/--with-planned times Planned work as if it were live/);
    });

    it('⭐ without the flag, the read-out is the plain one and times nothing Planned', () => {
        const plain = ledgerReadout(plannedWorkspace(), { layouts: false });
        const off = ledgerReadout(plannedWorkspace(), { layouts: false, withPlanned: false });
        expect(stable(off)).toBe(stable(plain));
        expect(plain).not.toHaveProperty('withPlanned');
        expect(plain.counts).not.toHaveProperty('plannedTimed');
        for (const key of ['recipe:recipe_ale', 'item:item_ale']) {
            expect(rowOf(plain, key), key).toMatchObject({ planned: true, status: 'planned', arriveOpt: null, arriveTyp: null, why: 'planned' });
        }
        expect(readoutText(plain).join('\n')).not.toMatch(/as if live/);
    });

    it('⭐ with the flag, times Planned work as if it were live, every Planned row still marked', () => {
        const plain = ledgerReadout(plannedWorkspace(), { layouts: false });
        const wp = ledgerReadout(plannedWorkspace(), { layouts: false, withPlanned: true });
        expect(wp.withPlanned).toBe(true);
        for (const key of ['recipe:recipe_ale', 'item:item_ale']) {
            const row = rowOf(wp, key);
            expect(row, key).toMatchObject({ planned: true, status: 'planned' });
            expect(row.arriveOpt, key).toBeGreaterThanOrEqual(0);
            expect(row.arriveTyp, key).toBeGreaterThanOrEqual(0);
            expect(row).not.toHaveProperty('why');
        }
        expect(rowOf(wp, 'recipe:recipe_ale')).toMatchObject({ skill: 'cooking', xp: 8, seconds: 10 });
        // The same rows, the same Planned count; the Planned ones timed.
        expect(wp.counts.rows).toBe(plain.counts.rows);
        expect(wp.counts.planned).toBe(plain.counts.planned);
        expect(wp.counts.plannedTimed).toBe(2);
        // The Planned Ale, eight times Beer's XP, is the better cooking work: cooking climbs faster.
        expect(wp.pace.cooking.days.bare).toBeLessThan(plain.pace.cooking.days.bare);
        // A live entry's numbers do not move.
        expect(rowOf(wp, 'recipe:recipe_beer')).toMatchObject({ planned: false, status: 'live', xp: 1 });
        expect(readoutText(wp).join('\n')).toMatch(/Planned work timed as if live: 2 of 2 Planned entries timed/);
    });

    it('leaves the workspace it is handed untouched', () => {
        const ws = plannedWorkspace();
        const before = JSON.stringify(ws);
        ledgerReadout(ws, { layouts: false, withPlanned: true });
        expect(JSON.stringify(ws)).toBe(before);
        // A plain read-out after it is still the plain one.
        expect(rowOf(ledgerReadout(ws, { layouts: false }), 'item:item_ale').arriveOpt).toBeNull();
    });

    it('⭐ the CLI times them, says so, and leaves the workspace byte for byte as it was', async () => {
        const dir = sandbox();
        const wsFile = path.join(dir, 'workspace', 'workspace.json');
        const before = hashOf(wsFile);
        const plainFile = path.join(dir, 'plain.json');
        const wpFile = path.join(dir, 'wp.json');

        const plain = await cms(dir, 'ledger', '--one-layout', `--json=${plainFile}`);
        expect(plain.code, plain.err).toBe(0);
        expect(plain.out).not.toMatch(/as if live/);
        const wp = await cms(dir, 'ledger', '--one-layout', '--with-planned', `--json=${wpFile}`);
        expect(wp.code, wp.err).toBe(0);
        expect(wp.out).toMatch(/Planned work timed as if live: 2 of 2 Planned entries timed/);

        expect(hashOf(wsFile)).toBe(before);
        const p = JSON.parse(fs.readFileSync(plainFile, 'utf8'));
        const w = JSON.parse(fs.readFileSync(wpFile, 'utf8'));
        expect(p).not.toHaveProperty('withPlanned');
        expect(rowOf(p, 'item:item_ale').arriveOpt).toBeNull();
        expect(w.withPlanned).toBe(true);
        expect(rowOf(w, 'item:item_ale')).toMatchObject({ planned: true, status: 'planned' });
        expect(rowOf(w, 'item:item_ale').arriveOpt).toBeGreaterThanOrEqual(0);
    });
});
