import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

import { runCli, USAGE } from '../../cms/cliCommands.mjs';
import { saveWorkspaceFile } from '../../cms/workspaceFile.js';
import { paceWorkspace } from './fixtures/paceWorld.js';

/**
 * The ledger's read-out for the balancer (`npm run cms -- ledger`, brief 880 L1): run on the pace
 * fixture's small world in a throwaway sandbox, it prints a summary, writes the JSON it is asked
 * for, and never writes the workspace. Nothing here reads or writes the real workspace.
 */

const root = path.resolve(__dirname, '../..');
const cmsDir = path.join(root, 'cms');
const load = (p) => import(/* @vite-ignore */ path.join(cmsDir, p));
const tmpRoots = [];

const PLANNED_ID = 'item_silver_ore';

/** A sandbox holding only a workspace: the pace fixture, with one Planned stub. */
function sandbox() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-cms-ledger-'));
    tmpRoots.push(dir);
    const ws = paceWorkspace();
    ws.items[PLANNED_ID] = { id: PLANNED_ID, name: 'Silver Ore', type: 'material', plan: { status: 'planned', tier: 2, note: 'later' } };
    fs.mkdirSync(path.join(dir, 'workspace'));
    saveWorkspaceFile(path.join(dir, 'workspace', 'workspace.json'), ws, { baseRevision: 0, savedBy: 'test' });
    return dir;
}

async function cms(dir, ...argv) {
    const out = [];
    const err = [];
    const code = await runCli([...argv, `--sandbox=${dir}`], { root, load, out: (s) => out.push(s), err: (s) => err.push(s) });
    return { code, out: out.join('\n'), err: err.join('\n') };
}

const hashOf = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

afterAll(() => {
    for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true });
});

describe('npm run cms -- ledger', () => {
    it('is in the usage', () => {
        expect(USAGE).toMatch(/^\s+ledger \[--json=<file>\]/m);
    });

    it('runs, prints a summary, writes the JSON, and leaves the workspace byte for byte as it was', async () => {
        const dir = sandbox();
        const wsFile = path.join(dir, 'workspace', 'workspace.json');
        const before = hashOf(wsFile);
        const stat = fs.statSync(wsFile);
        const jsonFile = path.join(dir, 'readout.json');

        const r = await cms(dir, 'ledger', `--json=${jsonFile}`);
        expect(r.code, r.err).toBe(0);
        expect(r.out).toMatch(/opt is the ledger's Maxed player, typ its Typical/);
        expect(r.out).toMatch(/^mining /m);
        expect(r.out).toMatch(/1 Planned, marked/);

        expect(hashOf(wsFile)).toBe(before);
        expect(fs.statSync(wsFile).mtimeMs).toBe(stat.mtimeMs);
        // Nothing else was written beside it: no backups, no second workspace.
        expect(fs.readdirSync(dir).sort()).toEqual(['readout.json', 'workspace']);
        expect(fs.readdirSync(path.join(dir, 'workspace'))).toEqual(['workspace.json']);

        const out = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        expect(out).toMatchObject({ format: 'fantasy-guild-ledger-readout', version: 1, profiles: { opt: 'maxed', typ: 'typical' } });
        expect(out.workspace).toMatchObject({ revision: 1 });
        for (const section of ['pace', 'rows', 'stages', 'checks', 'notes', 'units', 'counts']) expect(out, section).toHaveProperty(section);

        // Each skill's pace: levels 1 to 98 (the time to the next), hero and guild time at both profiles.
        expect(Object.keys(out.pace)).toEqual(expect.arrayContaining(['mining', 'forestry', 'construction']));
        for (const [skill, p] of Object.entries(out.pace)) {
            expect(p.levels.map((l) => l.L), skill).toEqual(Array.from({ length: 98 }, (_, i) => i + 1));
            for (const l of p.levels) {
                for (const k of ['opt', 'typ', 'guild', 'guildTyp', 'curve']) expect(l, `${skill} ${l.L} ${k}`).toHaveProperty(k);
                expect(l.reach).toEqual({ opt: expect.anything(), typ: expect.anything(), guild: expect.anything(), guildTyp: expect.anything() });
            }
            for (const k of ['opt', 'typ', 'guild', 'guildTyp', 'curve']) expect(p.days, `${skill} days ${k}`).toHaveProperty(k);
        }
        const mining = out.pace.mining;
        expect(mining.levels[0].opt).toBeGreaterThan(0);
        // The best work is named up to the highest level any entry asks (the Big Hut's Construction 15), and past it marked.
        const construction = out.pace.construction;
        expect(construction.top).toBe(15);
        expect(construction.levels[0].best.opt).toEqual(expect.any(String));
        expect(construction.levels[13].pastTop).toBeUndefined();
        expect(construction.levels[14]).toMatchObject({ pastTop: true, best: { opt: null, typ: null } });
        // Maxed never levels slower than Typical, and guild time is never under hero time.
        for (const l of mining.levels) {
            if (l.opt === null || l.typ === null) continue;
            expect(l.opt).toBeLessThanOrEqual(l.typ + 1e-9);
            expect(l.guild).toBeGreaterThanOrEqual(l.opt - 1e-9);
        }

        // Each entry's numbers and arrival at both profiles.
        const vein = out.rows.find((x) => x.key === 'token:token_vein');
        expect(vein).toMatchObject({ kind: 'token', planned: false, skill: 'mining', level: 1, xp: 1, seconds: 3, inputs: [] });
        expect(vein.makes).toEqual([{ id: 'item_copper_ore', name: 'Copper Ore', count: 1.5 }]);
        expect(vein.arriveOpt).toBe(0);
        expect(vein.arriveTyp).toBe(0);
        const beer = out.rows.find((x) => x.kind === 'recipe' && x.makes.some((m) => m.id === 'item_beer'));
        expect(beer.inputs.length).toBeGreaterThan(0);
        expect(beer.inputs[0]).toMatchObject({ id: expect.any(String), count: expect.any(Number) });
        for (const row of out.rows) {
            expect(row, row.key).toHaveProperty('arriveOpt');
            expect(row, row.key).toHaveProperty('arriveTyp');
        }

        // Planned entries are listed and marked, and the ledger times nothing Planned.
        const planned = out.rows.filter((x) => x.planned);
        expect(planned.map((x) => x.id)).toEqual([PLANNED_ID]);
        expect(planned[0]).toMatchObject({ status: 'planned', tier: 2, arriveOpt: null, arriveTyp: null, why: 'planned' });
        expect(out.counts.planned).toBe(1);

        // The ledger's checks, each with its severity and words.
        expect(out.checks.length).toBeGreaterThan(0);
        for (const c of out.checks) expect(c).toMatchObject({ check: expect.any(String), severity: expect.any(String), message: expect.any(String) });
        expect(out.stages.length).toBeGreaterThan(0);
    });

    it('prints the summary without --json, and asks for a file name for a bare --json', async () => {
        const dir = sandbox();
        const plain = await cms(dir, 'ledger');
        expect(plain.code, plain.err).toBe(0);
        expect(plain.out).not.toMatch(/written to/);
        const bare = await cms(dir, 'ledger', '--json');
        expect(bare.code).toBe(2);
        expect(bare.err).toMatch(/--json=<file>/);
    });

    it('refuses a sandbox with no workspace, writing nothing', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-cms-ledger-'));
        tmpRoots.push(dir);
        const r = await cms(dir, 'ledger');
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/No workspace/);
        expect(fs.readdirSync(dir)).toEqual([]);
    });
});
