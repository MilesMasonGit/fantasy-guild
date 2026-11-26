import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

import { runCli } from '../../cms/cliCommands.mjs';
import { saveWorkspaceFile } from '../../cms/workspaceFile.js';
import { validatePack, setValue, proposedValue, entryConflict } from '../../cms/src/engine/changePacks.js';

/**
 * The number pack writer (`npm run cms -- pack numbers`, `cms/src/engine/numberPack.js`): the
 * balance solver's rows onto the plan's Planned entries as a change pack. Runs on a fixture
 * workspace and a fixture solver output in a throwaway folder; nothing here reads or writes the
 * real workspace.
 */

const root = path.resolve(__dirname, '../..');
const cmsDir = path.join(root, 'cms');
const load = (p) => import(/* @vite-ignore */ path.join(cmsDir, p));
const tmpRoots = [];

const planned = (extra) => ({ status: 'planned', tier: 0, note: 'fixture', ...extra });
const out1 = (itemId, qty) => ({ itemId, chance: 100, minQty: qty, maxQty: qty, baseQty: { min: qty, max: qty }, variable: false });

/** A small workspace: Planned entries of every kind the writer meets, and Live ones it must leave alone. */
const fixtureWorkspace = () => ({
    items: {
        item_flax: { id: 'item_flax', name: 'Flax', type: 'material', plan: { status: 'live', tier: 0 } },
        item_water: { id: 'item_water', name: 'Water', type: 'material' },
        item_string: { id: 'item_string', name: 'String', type: 'material', plan: planned({ catalogueId: 'string', skill: 'tailor', level: 1, madeWith: ['item_flax'] }) },
        item_rope: { id: 'item_rope', name: 'Rope', type: 'material', plan: planned({ catalogueId: 'rope', skill: 'tailor', level: 4, madeWith: ['item_string', 'item_water'] }) },
        // The plan says Flax where the solver says Hemp: unclear, not a guess.
        item_sack: { id: 'item_sack', name: 'Sack', type: 'material', plan: planned({ catalogueId: 'sack', skill: 'tailor', level: 6, madeWith: ['item_flax'] }) },
        // In the plan, not in the solver's output.
        item_canvas: { id: 'item_canvas', name: 'Canvas', type: 'material', plan: planned({ catalogueId: 'canvas', skill: 'tailor', level: 8, madeWith: ['item_flax'] }) },
        item_bamboo: { id: 'item_bamboo', name: 'Bamboo', type: 'material', plan: planned({ catalogueId: 'bamboo', skill: 'forestry' }) },
        item_old_rope: { id: 'item_old_rope', name: 'Old Rope', type: 'material', plan: planned({}) },
        // Live, with a catalogue id the solver has a row for: never touched.
        item_twine: { id: 'item_twine', name: 'Twine', type: 'material', plan: { status: 'live', tier: 0, catalogueId: 'twine', skill: 'tailor', madeWith: ['item_flax'] } },
    },
    tokens: {
        token_bamboo_grove: { id: 'token_bamboo_grove', name: 'Bamboo Grove', autoSyncId: true, uses: 5, respawn: { mode: 'refill', afterMs: 12000 }, plan: planned({ catalogueId: 'bamboo_grove', skill: 'forestry', level: 5, gives: ['item_bamboo'] }) },
        // Two things from one cycle, shared by the plan's split: one Bamboo a cycle, a Flax one cycle in four.
        token_fallen_star: { id: 'token_fallen_star', name: 'Fallen Star', plan: planned({ catalogueId: 'fallen_star', skill: 'mining', level: 80, gives: ['item_bamboo', 'item_flax'], split: [{ itemId: 'item_bamboo', share: 1 }, { itemId: 'item_flax', share: 0.25 }] }) },
        // Two things from one cycle: how they share it is not the solver's.
        token_hollow_tree: { id: 'token_hollow_tree', name: 'Hollow Tree', plan: planned({ catalogueId: 'hollow_tree', skill: 'forestry', level: 10, gives: ['item_bamboo', 'item_flax'] }) },
        token_summoned_slime: { id: 'token_summoned_slime', name: 'Summoned Slime', plan: planned({ catalogueId: 'summoned_slime', skill: 'summoning', level: 1, madeWith: ['item_flax'] }) },
        token_tailors_shop: { id: 'token_tailors_shop', name: "Tailor's Shop", plan: planned({ catalogueId: 'tailor_s_shop', skill: 'construction', level: 1 }) },
        token_chicken: { id: 'token_chicken', name: 'Chicken', plan: planned({ catalogueId: 'chicken', skill: 'combat', level: 2 }) },
    },
    effects: {},
    recipePools: {
        farming: [{ id: 'recipe_flax', name: 'Flax', skill: 'farming', plan: planned({ catalogueId: 'flax_field', skill: 'farming', level: 3, gives: ['item_flax'] }) }],
        crafting: [{ id: 'recipe_twine', name: 'Twine', skill: 'crafting', inputs: [{ itemId: 'item_flax', quantity: 1 }], outputs: [out1('item_twine', 1)], xp: 2, durationMs: 4000, levelRequirement: 1, plan: { status: 'live', tier: 0 } }],
    },
});

/** What the solver prints for that catalogue: `solve(...).rows`, cut to the fields the writer reads. */
const fixtureRows = () => [
    { id: 'string', name: 'String', skill: 'Tailor', category: 'item', planned: 1, level: 1, work: 'prepare', inputs: [{ id: 'flax', name: 'Flax', count: 1 }], seconds: 8.9, xp: 3, makes: 1 },
    { id: 'rope', name: 'Rope', skill: 'Tailor', category: 'item', planned: 4, level: 7, work: 'make', inputs: [{ id: 'string', name: 'String', count: 2 }, { id: 'water', name: 'Water', count: 1 }], seconds: 13.2, xp: 5, makes: 5 },
    { id: 'sack', name: 'Sack', skill: 'Tailor', category: 'item', planned: 6, level: 6, work: 'make', inputs: [{ id: 'hemp', name: 'Hemp', count: 2 }], seconds: 14, xp: 6, makes: 1 },
    { id: 'bamboo', name: 'Bamboo', skill: 'Forestry', category: 'item', planned: 5, level: 5, work: null, why: 'Gathered from a Token' },
    { id: 'bamboo_grove', name: 'Bamboo Grove', skill: 'Forestry', category: 'token', planned: 5, level: 5, work: 'gather', inputs: [], seconds: 6.4, xp: 2, makes: 1 },
    { id: 'fallen_star', name: 'Fallen Star', skill: 'Mining', category: 'token', planned: 80, level: 80, work: 'gather', inputs: [], seconds: 12, xp: 40, makes: 1 },
    { id: 'hollow_tree', name: 'Hollow Tree', skill: 'Forestry', category: 'token', planned: 10, level: 10, work: 'gather', inputs: [], seconds: 5.9, xp: 3, makes: 1 },
    { id: 'summoned_slime', name: 'Summoned Slime', skill: 'Summoning', category: 'token', planned: 1, level: 1, work: 'gather', inputs: [], seconds: 6, xp: 2, makes: 1 },
    { id: 'tailor_s_shop', name: "Tailor's Shop", skill: 'Construction', category: 'building', planned: 1, level: 1, work: null, why: 'Builds follow the one-off step rule' },
    { id: 'chicken', name: 'Chicken', skill: 'Combat', category: 'token', planned: 2, level: 2, work: 'gather', inputs: [], seconds: 6, xp: 2, makes: 1 },
    { id: 'flax_field', name: 'Flax Field', skill: 'Farming', category: 'token', planned: 3, level: 3, work: 'gather', inputs: [], seconds: 6.1, xp: 2, makes: 1 },
    { id: 'twine', name: 'Twine', skill: 'Tailor', category: 'item', planned: 1, level: 1, work: 'prepare', inputs: [{ id: 'flax', name: 'Flax', count: 1 }], seconds: 8, xp: 3, makes: 1 },
];

const hashOf = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function setUp() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-number-pack-'));
    tmpRoots.push(dir);
    fs.mkdirSync(path.join(dir, 'workspace'));
    const workspaceFile = path.join(dir, 'workspace', 'workspace.json');
    saveWorkspaceFile(workspaceFile, fixtureWorkspace(), { baseRevision: 0, savedBy: 'test' });
    const rowsFile = path.join(dir, 'solved.json');
    fs.writeFileSync(rowsFile, JSON.stringify({ rows: fixtureRows() }));
    fs.mkdirSync(path.join(dir, 'out'));
    return { dir, workspaceFile, rowsFile, packFile: path.join(dir, 'out', 'test-numbers.json'), unclearFile: path.join(dir, 'out', 'unclear.txt') };
}

async function cms(argv) {
    const out = [];
    const err = [];
    const code = await runCli(argv, { root, load, out: (s) => out.push(s), err: (s) => err.push(s) });
    return { code, out: out.join('\n'), err: err.join('\n') };
}

afterAll(() => {
    for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true });
});

describe('pack numbers', () => {
    let f;
    let run;
    let pack;
    let hashBefore;

    beforeAll(async () => {
        f = setUp();
        hashBefore = hashOf(f.workspaceFile);
        run = await cms(['pack', 'numbers', `--rows=${f.rowsFile}`, `--workspace=${f.workspaceFile}`, `--out=${f.packFile}`, `--unclear=${f.unclearFile}`]);
        pack = fs.existsSync(f.packFile) ? JSON.parse(fs.readFileSync(f.packFile, 'utf8')) : null;
    });

    it('writes a pack the CMS takes, named after its file', async () => {
        expect(run.code, run.err).toBe(0);
        expect(pack).not.toBeNull();
        expect(pack.id).toBe('test-numbers');
        expect(validatePack(pack, { fileName: 'test-numbers.json' })).toEqual({ ok: true });
        const check = await cms(['pack', 'check', f.packFile, `--workspace=${f.workspaceFile}`]);
        expect(check.code, check.err).toBe(0);
        expect(check.out).toMatch(/No entry conflicts/);
    });

    it('passes the agents\' helper, changePackTool check', () => {
        const r = spawnSync(process.execPath, [path.join(cmsDir, 'changePackTool.mjs'), 'check', f.packFile], { encoding: 'utf8' });
        expect(r.status, r.stdout + r.stderr).toBe(0);
    });

    it('gives a made item its recipe, a gathering Token its cycle and a crop its numbers', () => {
        const byId = Object.fromEntries(pack.entries.map((e) => [e.id, e]));
        expect(Object.keys(byId).sort()).toEqual(['recipe_flax', 'recipe_rope', 'recipe_string', 'token_bamboo_grove', 'token_fallen_star']);

        expect(byId.recipe_string).toMatchObject({ op: 'create', kind: 'recipe' });
        expect(byId.recipe_string.value).toMatchObject({
            name: 'String', skill: 'tailor', levelRequirement: 1, xp: 3, durationMs: 8900,
            inputs: [{ itemId: 'item_flax', quantity: 1 }], outputs: [out1('item_string', 1)],
            plan: { status: 'planned', catalogueId: 'string', tier: 0 },
        });
        // The solver's level (moved from 4), its counts, and what one craft makes.
        expect(byId.recipe_rope.value).toMatchObject({
            levelRequirement: 7, xp: 5, durationMs: 13200,
            inputs: [{ itemId: 'item_string', quantity: 2 }, { itemId: 'item_water', quantity: 1 }], outputs: [out1('item_rope', 5)],
        });
        expect(byId.recipe_rope.note).toMatch(/moved from 4/);

        expect(byId.token_bamboo_grove).toMatchObject({ op: 'edit', kind: 'token' });
        expect(byId.token_bamboo_grove.fingerprint).toMatch(/^fp:[0-9a-f]{16}$/);
        expect(byId.token_bamboo_grove.value.config).toEqual({ skill: 'forestry', skillRequired: 5, cycleTimeMs: 6400, xp: 2, inputs: [], outputs: [out1('item_bamboo', 1)] });
        expect(byId.token_bamboo_grove.value.name).toBe('Bamboo Grove');

        // The plan's split: one line a share, the solver's cycle and XP.
        expect(byId.token_fallen_star.value.config).toEqual({
            skill: 'mining', skillRequired: 80, cycleTimeMs: 12000, xp: 40, inputs: [],
            outputs: [out1('item_bamboo', 1), { itemId: 'item_flax', chance: 25, minQty: 1, maxQty: 1, baseQty: { min: 1, max: 1 }, variable: false }],
        });

        expect(byId.recipe_flax).toMatchObject({ op: 'edit', kind: 'recipe' });
        expect(byId.recipe_flax.value).toMatchObject({ skill: 'farming', levelRequirement: 3, xp: 2, durationMs: 6100, outputs: [out1('item_flax', 1)] });
    });

    it('gives a gathering Token its uses and rest by the rest rule', () => {
        const v = pack.entries.find((e) => e.id === 'token_bamboo_grove').value;
        // 6.4 s a cycle: 21.3 % a cycle that it ends, about 30 s of work on average; back in 30 s.
        expect(v.endChance).toBe(21.3);
        expect(6.4 * 100 / v.endChance).toBeCloseTo(30, 0);
        expect('uses' in v).toBe(false);
        expect(v.respawn).toEqual({ mode: 'refill', afterMs: 30000 });
        // No respawn of its own: its end chance would do nothing, so nothing is written and it is listed.
        const star = pack.entries.find((e) => e.id === 'token_fallen_star').value;
        expect('endChance' in star).toBe(false);
        expect(fs.readFileSync(f.unclearFile, 'utf8')).toMatch(/Fallen Star.*no respawn/);
    });

    it('leaves every entry Planned, and touches nothing Live', () => {
        const ws = fixtureWorkspace();
        let next = ws;
        for (const entry of pack.entries) {
            expect(entryConflict(next, entry).conflict).toBe(false);
            next = { ...next, ...setValue(next, entry.kind, entry.id, proposedValue(entry)) };
        }
        for (const entry of pack.entries) expect(entry.value.plan.status).toBe('planned');
        const plannedIds = (w) => [
            ...Object.values(w.items).filter((r) => r.plan?.status === 'planned').map((r) => r.id),
            ...Object.values(w.tokens).filter((r) => r.plan?.status === 'planned').map((r) => r.id),
            ...Object.values(w.recipePools).flat().filter((r) => r.plan?.status === 'planned').map((r) => r.id),
        ].sort();
        expect(plannedIds(next)).toEqual([...plannedIds(ws), 'recipe_rope', 'recipe_string'].sort());
        // The items themselves are not in the pack, and the Live Twine and its recipe are untouched.
        expect(pack.entries.some((e) => e.kind === 'item')).toBe(false);
        expect(next.items.item_twine).toEqual(ws.items.item_twine);
        expect(next.recipePools.crafting).toEqual(ws.recipePools.crafting);
    });

    it('never writes the workspace', () => {
        expect(hashOf(f.workspaceFile)).toBe(hashBefore);
    });

    it('lists the unclear mappings for the content session and writes none of them', () => {
        const unclearIds = ['item_sack', 'item_canvas', 'token_summoned_slime', 'token_hollow_tree'];
        for (const id of unclearIds) {
            expect(pack.entries.some((e) => e.id === id || e.id === id.replace(/^item_/, 'recipe_'))).toBe(false);
            expect(run.out).toContain(id);
        }
        const listed = fs.readFileSync(f.unclearFile, 'utf8');
        for (const id of unclearIds) expect(listed).toContain(id);
        expect(listed).toMatch(/Sack.*Hemp/);
        expect(listed).toMatch(/Canvas.*no row/);
        expect(listed).toMatch(/Hollow Tree.*share/);
        expect(run.out).toMatch(/5 entries written/);
        expect(run.out).toMatch(/4 unclear/);
        // Skipped, with no work to write: a gathered item, a building, an enemy, an entry with no catalogue id.
        expect(listed).not.toContain('(item item_bamboo');
        expect(run.out).toMatch(/4 skipped/);
    });
});

describe('pack numbers refuses', () => {
    it('without --out, naming the option', async () => {
        const f = setUp();
        const r = await cms(['pack', 'numbers', `--rows=${f.rowsFile}`, `--workspace=${f.workspaceFile}`]);
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/--out/);
    });

    it('to write into cms/incoming/, the inbox', async () => {
        const f = setUp();
        const r = await cms(['pack', 'numbers', `--rows=${f.rowsFile}`, `--workspace=${f.workspaceFile}`, `--out=${path.join(cmsDir, 'incoming', 'x-numbers.json')}`]);
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/incoming/);
        expect(fs.existsSync(path.join(cmsDir, 'incoming', 'x-numbers.json'))).toBe(false);
    });

    it('a solver output with no rows', async () => {
        const f = setUp();
        fs.writeFileSync(f.rowsFile, JSON.stringify({ pace: {} }));
        const r = await cms(['pack', 'numbers', `--rows=${f.rowsFile}`, `--workspace=${f.workspaceFile}`, `--out=${f.packFile}`]);
        expect(r.code).toBe(1);
        expect(fs.existsSync(f.packFile)).toBe(false);
    });
});
