import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

import { runCli } from '../../cms/cliCommands.mjs';
import { saveWorkspaceFile } from '../../cms/workspaceFile.js';
import { validatePack, setValue, proposedValue, entryConflict } from '../../cms/src/engine/changePacks.js';

/**
 * The number pack writer's live mode (`npm run cms -- pack numbers --live`): the balance solver's
 * numbers onto the Live recipes and gathering Tokens the content session's id map
 * (`docs/active/content_cms_ids.json`) matches to the catalogue, XP pinned. Anything whose
 * ingredients or output differ from the catalogue's is listed, never guessed. Fixture workspace,
 * catalogue, id map and solver rows in a throwaway folder; the real workspace is never read.
 */

const root = path.resolve(__dirname, '../..');
const cmsDir = path.join(root, 'cms');
const load = (p) => import(/* @vite-ignore */ path.join(cmsDir, p));
const tmpRoots = [];

const live = { status: 'live', tier: 0 };
const out1 = (itemId, qty) => ({ itemId, chance: 100, minQty: qty, maxQty: qty, baseQty: { min: qty, max: qty }, variable: false });
const range = (itemId, min, max, chance = 100) => ({ itemId, chance, minQty: min, maxQty: max, baseQty: { min, max }, variable: chance < 100 });
const item = (id, name) => ({ id, name, type: 'material', plan: live });

const fixtureWorkspace = () => ({
    items: Object.fromEntries([
        ['item_flax', 'Flax'], ['item_water', 'Water'], ['item_string', 'String'], ['item_twine', 'Twine'], ['item_rope', 'Rope'],
        ['item_bucket', 'Bucket'], ['item_scrap', 'Scrap'], ['item_old_thing', 'Old Thing'], ['item_copper_ore', 'Copper Ore'],
        ['item_gem', 'Gem'], ['item_oak_wood', 'Oak Wood'], ['item_fir_wood', 'Fir Wood'], ['item_birch_wood', 'Birch Wood'], ['item_carp', 'Carp'],
    ].map(([id, name]) => [id, item(id, name)])),
    tokens: {
        token_copper_vein: {
            id: 'token_copper_vein', name: 'Copper Vein', uses: 5, respawn: { mode: 'refill', afterMs: 60000 }, sim: { tempo: 'quick', purpose: 'iph' }, plan: live,
            config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 6, inputs: [], outputs: [range('item_copper_ore', 1, 2), range('item_gem', 1, 1, 5)] },
        },
        // Its rest lives on its Stump, which needs its Forest: the end chance is written, the rest listed.
        token_oak_tree: {
            id: 'token_oak_tree', name: 'Oak Tree', uses: 5, respawn: { mode: 'regrow', into: 'token_oak_stump' }, plan: live,
            config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 6, inputs: [], outputs: [range('item_oak_wood', 1, 2)] },
        },
        token_oak_stump: { id: 'token_oak_stump', name: 'Oak Stump', grows: { into: 'token_oak_tree', afterMs: 300000, needsNearby: ['token_oak_forest'] }, plan: live },
        // Three woods a third each, by its plan's split.
        token_logjam: {
            id: 'token_logjam', name: 'Logjam', uses: 4, respawn: { mode: 'refill', afterMs: 20000 },
            plan: { ...live, split: [{ itemId: 'item_oak_wood', share: 1 / 3 }, { itemId: 'item_fir_wood', share: 1 / 3 }, { itemId: 'item_birch_wood', share: 1 / 3 }] },
            config: { skill: 'forestry', skillRequired: 10, cycleTimeMs: 4000, xp: 5, inputs: [], outputs: [range('item_oak_wood', 1, 1)] },
        },
        // Live, gathering, in no catalogue entry.
        token_pond: { id: 'token_pond', name: 'Pond', plan: live, config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 5000, xp: 3, inputs: [], outputs: [range('item_carp', 1, 1)] } },
        // Not Live: left alone, and not counted.
        token_planned_vein: { id: 'token_planned_vein', name: 'Planned Vein', plan: { status: 'planned', tier: 2, catalogueId: 'copper_vein' }, config: { skill: 'mining', outputs: [] } },
    },
    effects: {},
    recipePools: {
        crafting: [
            { id: 'recipe_twine', name: 'Twine', skill: 'crafting', inputs: [{ itemId: 'item_flax', quantity: 1 }], outputs: [out1('item_twine', 1)], xp: 2, durationMs: 4000, levelRequirement: 1, sim: { tempo: 'quick', purpose: 'iph' }, plan: live },
            // The catalogue's Rope is String and Water; this one is String and Flax.
            { id: 'recipe_rope', name: 'Rope', skill: 'crafting', inputs: [{ itemId: 'item_string', quantity: 2 }, { itemId: 'item_flax', quantity: 1 }], outputs: [out1('item_rope', 1)], xp: 4, durationMs: 6000, levelRequirement: 4, plan: live },
            // A Bucket and Scrap: the catalogue's Bucket makes a Bucket only.
            { id: 'recipe_bucket', name: 'Bucket', skill: 'crafting', inputs: [{ itemId: 'item_water', quantity: 1 }], outputs: [out1('item_bucket', 1), out1('item_scrap', 1)], xp: 4, durationMs: 6000, levelRequirement: 5, plan: live },
            { id: 'recipe_old_thing', name: 'Old Thing', skill: 'crafting', inputs: [], outputs: [out1('item_old_thing', 1)], xp: 1, durationMs: 1000, levelRequirement: 1 },
        ],
    },
});

const fixtureCatalogue = () => ({
    format: 'fixture', version: 1,
    entries: [
        { id: 'flax', name: 'Flax', category: 'item', skill: 'Farming' },
        { id: 'water', name: 'Water', category: 'item' },
        { id: 'string', name: 'String', category: 'item', skill: 'Crafting', level: 2, madeWith: ['flax'] },
        { id: 'twine', name: 'Twine', category: 'item', skill: 'Crafting', level: 1, madeWith: ['flax'] },
        { id: 'rope', name: 'Rope', category: 'item', skill: 'Crafting', level: 4, madeWith: ['string', 'water'] },
        { id: 'bucket', name: 'Bucket', category: 'item', skill: 'Crafting', level: 5, madeWith: ['water'] },
        { id: 'copper_ore', name: 'Copper Ore', category: 'item' },
        { id: 'gem', name: 'Gem', category: 'item' },
        { id: 'copper_vein', name: 'Copper Vein', category: 'token', skill: 'Mining', level: 1, gives: ['copper_ore', 'gem'] },
        { id: 'oak_tree', name: 'Oak Tree', category: 'token', skill: 'Forestry', level: 1, gives: ['oak_wood'] },
        { id: 'logjam', name: 'Logjam', category: 'token', skill: 'Forestry', level: 10, gives: ['oak_wood', 'fir_wood', 'birch_wood'] },
    ],
});

const fixtureIds = () => ({
    format: 'fantasy-guild-catalogue-cms-ids',
    ids: {
        flax: { cms: 'item_flax', how: 'live' }, water: { cms: 'item_water', how: 'live' }, string: { cms: 'item_string', how: 'live' },
        twine: { cms: 'item_twine', how: 'live' }, rope: { cms: 'item_rope', how: 'live' }, bucket: { cms: 'item_bucket', how: 'live' },
        copper_ore: { cms: 'item_copper_ore', how: 'live' }, gem: { cms: 'item_gem', how: 'live' },
        oak_wood: { cms: 'item_oak_wood', how: 'live' }, fir_wood: { cms: 'item_fir_wood', how: 'live' }, birch_wood: { cms: 'item_birch_wood', how: 'live' },
        copper_vein: { cms: 'token_copper_vein', how: 'live' }, oak_tree: { cms: 'token_oak_tree', how: 'live' }, logjam: { cms: 'token_logjam', how: 'live' },
    },
});

const fixtureRows = () => [
    { id: 'twine', name: 'Twine', skill: 'Crafting', category: 'item', planned: 1, level: 1, work: 'prepare', inputs: [{ id: 'flax', name: 'Flax', count: 2 }], seconds: 7.5, xp: 3, makes: 1 },
    { id: 'rope', name: 'Rope', skill: 'Crafting', category: 'item', planned: 4, level: 4, work: 'make', inputs: [{ id: 'string', name: 'String', count: 1 }, { id: 'water', name: 'Water', count: 1 }], seconds: 12, xp: 5, makes: 1 },
    { id: 'bucket', name: 'Bucket', skill: 'Crafting', category: 'item', planned: 5, level: 5, work: 'make', inputs: [{ id: 'water', name: 'Water', count: 1 }], seconds: 12, xp: 5, makes: 1 },
    { id: 'copper_vein', name: 'Copper Vein', skill: 'Mining', category: 'token', planned: 1, level: 1, work: 'gather', inputs: [], seconds: 6, xp: 2, makes: 1 },
    { id: 'oak_tree', name: 'Oak Tree', skill: 'Forestry', category: 'token', planned: 1, level: 1, work: 'gather', inputs: [], seconds: 5, xp: 2, makes: 1 },
    { id: 'logjam', name: 'Logjam', skill: 'Forestry', category: 'token', planned: 10, level: 11, work: 'gather', inputs: [], seconds: 6.6, xp: 3, makes: 1 },
];

const hashOf = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function setUp() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-number-pack-live-'));
    tmpRoots.push(dir);
    fs.mkdirSync(path.join(dir, 'workspace'));
    const workspaceFile = path.join(dir, 'workspace', 'workspace.json');
    saveWorkspaceFile(workspaceFile, fixtureWorkspace(), { baseRevision: 0, savedBy: 'test' });
    const write = (name, value) => { const f = path.join(dir, name); fs.writeFileSync(f, JSON.stringify(value)); return f; };
    fs.mkdirSync(path.join(dir, 'out'));
    return {
        workspaceFile,
        rowsFile: write('solved.json', { rows: fixtureRows() }),
        catalogueFile: write('catalogue.json', fixtureCatalogue()),
        idsFile: write('ids.json', fixtureIds()),
        packFile: path.join(dir, 'out', 'test-live-numbers.json'),
        unclearFile: path.join(dir, 'out', 'unclear.txt'),
    };
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

describe('pack numbers --live', () => {
    let f;
    let run;
    let pack;
    let byId;
    let hashBefore;

    beforeAll(async () => {
        f = setUp();
        hashBefore = hashOf(f.workspaceFile);
        run = await cms(['pack', 'numbers', '--live', `--rows=${f.rowsFile}`, `--catalogue=${f.catalogueFile}`, `--ids=${f.idsFile}`,
            `--workspace=${f.workspaceFile}`, `--out=${f.packFile}`, `--unclear=${f.unclearFile}`]);
        pack = fs.existsSync(f.packFile) ? JSON.parse(fs.readFileSync(f.packFile, 'utf8')) : null;
        byId = Object.fromEntries((pack?.entries || []).map((e) => [e.id, e]));
    });

    it('writes a pack of fingerprinted edits the CMS takes', async () => {
        expect(run.code, run.err).toBe(0);
        expect(pack).not.toBeNull();
        expect(validatePack(pack, { fileName: 'test-live-numbers.json' })).toEqual({ ok: true });
        expect(Object.keys(byId).sort()).toEqual(['recipe_twine', 'token_copper_vein', 'token_logjam', 'token_oak_tree']);
        for (const e of pack.entries) {
            expect(e.op).toBe('edit');
            expect(e.fingerprint).toMatch(/^fp:[0-9a-f]{16}$/);
        }
        const check = await cms(['pack', 'check', f.packFile, `--workspace=${f.workspaceFile}`]);
        expect(check.code, check.err).toBe(0);
        expect(check.out).toMatch(/No entry conflicts/);
    });

    it('gives a matched Live recipe its level, time, XP and counts, XP pinned', () => {
        expect(byId.recipe_twine.value).toMatchObject({
            name: 'Twine', skill: 'crafting', levelRequirement: 1, durationMs: 7500, xp: 3,
            inputs: [{ itemId: 'item_flax', quantity: 2 }], outputs: [out1('item_twine', 1)],
            sim: { tempo: 'quick', purpose: 'iph', xpPinned: true }, plan: { status: 'live' },
        });
    });

    it('gives a matched Live Token its cycle, XP pinned, its chance extras kept', () => {
        const v = byId.token_copper_vein.value;
        expect(v.config).toMatchObject({ skill: 'mining', skillRequired: 1, cycleTimeMs: 6000, xp: 2 });
        expect(v.config.outputs).toEqual([out1('item_copper_ore', 1), range('item_gem', 1, 1, 5)]);
        expect(v.sim).toEqual({ tempo: 'quick', purpose: 'iph', xpPinned: true });
        expect(byId.token_copper_vein.note).toMatch(/was 1 to 2/);
    });

    it('writes uses and rest by the rest rule: about 30 s of work, back in about 30 s', () => {
        const v = byId.token_copper_vein.value;
        // 6 s a cycle: a 20 % chance a cycle that it ends, so five cycles, 30 s, on average.
        expect(v.endChance).toBe(20);
        expect('uses' in v).toBe(false);
        expect(v.respawn).toEqual({ mode: 'refill', afterMs: 30000 });
    });

    it('reads a Token\'s plan.split for its outputs', () => {
        const v = byId.token_logjam.value;
        const third = { chance: 33.33, minQty: 1, maxQty: 1, baseQty: { min: 1, max: 1 }, variable: false };
        expect(v.config.outputs).toEqual([{ itemId: 'item_oak_wood', ...third }, { itemId: 'item_fir_wood', ...third }, { itemId: 'item_birch_wood', ...third }]);
        expect(v.config).toMatchObject({ skillRequired: 11, cycleTimeMs: 6600, xp: 3 });
        expect(v.endChance).toBe(22);
    });

    it('writes a regrowing tree\'s end chance and lists its rest, which its Stump and Forest hold', () => {
        const v = byId.token_oak_tree.value;
        expect(v.endChance).toBe(16.7);
        expect(v.respawn).toEqual({ mode: 'regrow', into: 'token_oak_stump' });
        expect(pack.entries.some((e) => e.id === 'token_oak_stump')).toBe(false);
        const listed = fs.readFileSync(f.unclearFile, 'utf8');
        expect(listed).toMatch(/Oak Tree.*token_oak_stump.*token_oak_forest/);
    });

    it('lists, never writes, a Live entry with no match, other ingredients or another output', () => {
        const listed = fs.readFileSync(f.unclearFile, 'utf8');
        for (const id of ['recipe_rope', 'recipe_bucket', 'recipe_old_thing', 'token_pond']) {
            expect(byId[id]).toBeUndefined();
            expect(listed).toContain(id);
            expect(run.out).toContain(id);
        }
        expect(listed).toMatch(/recipe_rope.*ingredients.*Water/);
        expect(listed).toMatch(/recipe_bucket.*output.*item_scrap/);
        expect(listed).toMatch(/recipe_old_thing.*no catalogue match/);
        expect(listed).toMatch(/token_pond.*no catalogue match/);
        expect(run.out).toMatch(/4 entries written, 4 unclear/);
    });

    it('leaves the Planned entries and everything unmatched alone, and every entry Live', () => {
        const ws = fixtureWorkspace();
        let next = ws;
        for (const entry of pack.entries) {
            expect(entryConflict(next, entry).conflict).toBe(false);
            next = { ...next, ...setValue(next, entry.kind, entry.id, proposedValue(entry)) };
        }
        expect(next.tokens.token_planned_vein).toEqual(ws.tokens.token_planned_vein);
        expect(next.tokens.token_oak_stump).toEqual(ws.tokens.token_oak_stump);
        expect(next.recipePools.crafting.slice(1)).toEqual(ws.recipePools.crafting.slice(1));
        for (const entry of pack.entries) expect(entry.value.plan.status).toBe('live');
    });

    it('never writes the workspace', () => {
        expect(hashOf(f.workspaceFile)).toBe(hashBefore);
    });

    it('refuses to write into cms/incoming/', async () => {
        const g = setUp();
        const r = await cms(['pack', 'numbers', '--live', `--rows=${g.rowsFile}`, `--catalogue=${g.catalogueFile}`, `--ids=${g.idsFile}`,
            `--workspace=${g.workspaceFile}`, `--out=${path.join(cmsDir, 'incoming', 'x-live-numbers.json')}`]);
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/incoming/);
        expect(fs.existsSync(path.join(cmsDir, 'incoming', 'x-live-numbers.json'))).toBe(false);
    });
});
