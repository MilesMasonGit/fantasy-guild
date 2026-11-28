import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

import { runCli, USAGE } from '../../cms/cliCommands.mjs';
import { saveWorkspaceFile } from '../../cms/workspaceFile.js';
import { ledgerReadout, readoutText } from '../../cms/src/engine/ledgerReadout.js';
import { workspaceCoins, coinsText } from '../../cms/src/engine/ledgerCoins.js';
import { paceWorkspace } from './fixtures/paceWorld.js';
import { WORLD_FIXTURE_RAW, worldWorkspace } from './fixtures/ledgerWorldMap.js';

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
        expect(r.out).toMatch(/opt is the ledger's Maxed player \(the curve's\), typ its Typical, bare its Bare/);
        expect(r.out).toMatch(/days to 99 opt \(Maxed\) \| typ \(Typical\) \| bare \(Bare\)/);
        expect(r.out).toMatch(/^mining /m);
        expect(r.out).toMatch(/1 Planned, marked/);

        expect(hashOf(wsFile)).toBe(before);
        expect(fs.statSync(wsFile).mtimeMs).toBe(stat.mtimeMs);
        // Nothing else was written beside it: no backups, no second workspace.
        expect(fs.readdirSync(dir).sort()).toEqual(['readout.json', 'workspace']);
        expect(fs.readdirSync(path.join(dir, 'workspace'))).toEqual(['workspace.json']);

        const out = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        expect(out).toMatchObject({ format: 'fantasy-guild-ledger-readout', version: 7, profiles: { opt: 'maxed', typ: 'typical', bare: 'bare' } });
        expect(out.workspace).toMatchObject({ revision: 1 });
        for (const section of ['guild', 'pace', 'rows', 'stages', 'layouts', 'boostBudget', 'ruleChecks', 'checks', 'notes', 'units', 'counts']) expect(out, section).toHaveProperty(section);

        // Each skill's pace: levels 1 to 98 (the time to the next), hero and guild time at all three profiles, and the gatherers a level's work needs.
        expect(Object.keys(out.pace)).toEqual(expect.arrayContaining(['mining', 'forestry', 'construction']));
        const keys = ['opt', 'typ', 'bare', 'guild', 'guildTyp', 'guildBare'];
        for (const [skill, p] of Object.entries(out.pace)) {
            expect(p.levels.map((l) => l.L), skill).toEqual(Array.from({ length: 98 }, (_, i) => i + 1));
            for (const l of p.levels) {
                for (const k of [...keys, 'curve']) expect(l, `${skill} ${l.L} ${k}`).toHaveProperty(k);
                expect(Object.keys(l.reach).sort(), `${skill} ${l.L} reach`).toEqual([...keys].sort());
                expect(Object.keys(l.gatherers).sort(), `${skill} ${l.L} gatherers`).toEqual(['bare', 'opt', 'typ']);
                expect(Object.keys(l.brewers).sort(), `${skill} ${l.L} brewers`).toEqual(['bare', 'opt', 'typ']);
                for (const who of ['opt', 'typ', 'bare']) expect(l.chain[who], `${skill} ${l.L} chain`).toBeLessThanOrEqual(1);
                expect(l.best).toHaveProperty('bare');
            }
            for (const k of [...keys, 'curve']) expect(p.days, `${skill} days ${k}`).toHaveProperty(k);
        }
        const mining = out.pace.mining;
        expect(mining.levels[0].opt).toBeGreaterThan(0);
        // The best work is named up to the highest level any entry asks (the Big Hut's Construction 15), and past it marked.
        const construction = out.pace.construction;
        expect(construction.top).toBe(15);
        expect(construction.levels[0].best.opt).toEqual(expect.any(String));
        expect(construction.levels[13].pastTop).toBeUndefined();
        expect(construction.levels[14]).toMatchObject({ pastTop: true, best: { opt: null, typ: null } });
        // Maxed never levels slower than Typical, Typical never slower than Bare, and guild time is never under hero time (one hero at work at least).
        for (const l of mining.levels) {
            if (l.opt === null || l.typ === null || l.bare === null) continue;
            expect(l.opt).toBeLessThanOrEqual(l.typ + 1e-9);
            expect(l.typ).toBeLessThanOrEqual(l.bare + 1e-9);
            expect(l.guild).toBeGreaterThanOrEqual(l.opt - 1e-9);
            expect(l.guildBare).toBeGreaterThanOrEqual(l.bare - 1e-9);
        }
        // ⭐ Guild time is the hero-hours the level takes: a build fed by two foresters at Bare, which the Starter
        // Camp's one hero does in turn, a third as fast, its guild time its own.
        const build = construction.levels[0];
        expect(build.best.bare).toBe('Build Hut at Plot');
        expect(build.gatherers.bare).toBeCloseTo(2, 3);
        expect(build.chain.bare).toBeCloseTo(1 / 3, 3);
        expect(build.guildBare).toBeCloseTo(build.bare, 2);
        // The Bare column is the balance rules' divisor: a level's bare over its opt is the optimized boost factor there.
        expect(mining.levels[0].bare / mining.levels[0].opt).toBeGreaterThan(1);

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

        // ⭐ The boost budget, cell by tier, and every total over its cell; the check lists the same.
        expect(out.boostBudget.tiers.map((t) => t.tier)).toEqual([0, 2, 3, 4, 5, 6, 7]);
        expect(out.boostBudget.tiers[0]).toMatchObject({ label: 'Starter Camp', level: 1, xp: { typical: 7.5, maxed: 10 } });
        expect(out.boostBudget.speedCapPct).toBe(65);
        expect(out.boostBudget.over.length).toBeGreaterThan(0);
        for (const o of out.boostBudget.over) expect(o.pct).toBeGreaterThan(o.budget);
        const budgetChecks = out.checks.filter((c) => c.check === 'boost-budget');
        expect(budgetChecks.length).toBeGreaterThan(0);
        expect(new Set(out.boostBudget.over.map((o) => `${o.kind}|${o.profile}`)).size).toBe(budgetChecks.length);
        expect(out.stages[0]).toMatchObject({ profile: 'maxed', endsAt: 10, heroes: 1 });
        // ⭐ A stage's full content, information only, timed with the reference guild's heroes: the later of the slowest path and the heroes' work.
        for (const s of out.stages.filter((x) => x.content.entries)) {
            expect(s.content.minutes).toBeCloseTo(Math.max(s.content.pathMinutes, s.content.workMinutes), 1);
            expect(s.content.heroMinutes).toBeCloseTo(s.content.levelHeroMinutes + s.content.stepHeroMinutes, 1);
            expect(typeof s.content.byWork).toBe('boolean');
        }
        // ⭐ What the budget times is the way out; the last stage has none.
        for (const s of out.stages.filter((x) => x.gate)) {
            expect(s.minutes).toBe(s.gate.minutes);
            expect(s.gate.minutes).toBeCloseTo(Math.max(s.gate.pathMinutes, s.gate.workMinutes), 1);
            expect(s.offPct).toBeCloseTo((s.gate.minutes / s.budgetMinutes - 1) * 100, 0);
        }
        expect(out.stages[out.stages.length - 1]).toMatchObject({ gate: null, minutes: null, gateWhy: 'the last stage: no place after it' });
        expect(out.guild.heroes.map((h) => h.heroes)).toEqual([1, 1, 2, 3, 4, 5, 6, 8]);
        expect(out.guild).toMatchObject({
            gatherersPerMaker: 2.2, layout: 'dense', layoutNodes: { sparse: 2, dense: 5 }, layoutSpawners: { sparse: 1, dense: 1 }, sitePlaces: { places: 12, buildings: 8, perKind: 4 }
        });
        // ⭐ Both layouts, the warning where they differ, and the vein the dense layout makes more of.
        expect(out.layouts).toMatchObject({ timed: 'dense', other: 'sparse', nodes: { sparse: 2, dense: 5 } });
        expect(out.layouts.skills.mining).toMatchObject({ warn: true });
        expect(out.layouts.skills.mining.dense.opt).toBeLessThan(out.layouts.skills.mining.sparse.opt);
        expect(out.layouts.warnings).toContain('mining');
        expect(out.layouts.nodesOff.map((n) => n.entry)).toEqual(['token:token_vein']);
        expect(out.layouts.nodesOff[0].nodes).toEqual({ sparse: 2, dense: 5 });
        // ⭐ Each work's site: the buildings in its places, with their copies, and its camp's nodes; the camp and its five veins take six places, six left.
        expect(vein.site.opt).toMatchObject({ places: 4, room: 6, taken: 6, byKind: { yield: 4 }, camp: { id: 'token_mining_camp', nodes: 5, spawners: 0 } });
        expect(vein.site.opt.buildings).toEqual([{ id: 'token_mine', name: 'Mine', count: 4, kinds: ['yield'] }]);
        // An arrival is never before its path.
        for (const row of out.rows.filter((x) => x.arriveTyp !== null)) expect(row.arriveTyp, row.key).toBeGreaterThanOrEqual(row.pathTyp - 1e-6);

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

    it('⭐ times a level on the reference chain, keeps the full gatherer count, and its guild time is that chain\'s', () => {
        // The chain's heroes share all its work. Eight heroes, a chain of one maker
        // and one gatherer: two heroes for the Hut builder's three heroes' work, half as long again.
        const eight = [{ tier: 0, heroes: 8 }];
        const loose = ledgerReadout({ ...paceWorkspace(), planSettings: { heroesByTier: eight } }).pace.construction.levels[0];
        const tight = ledgerReadout({ ...paceWorkspace(), planSettings: { heroesByTier: eight, gatherersPerMaker: 1 } }).pace.construction.levels[0];
        expect(tight.bare).toBeCloseTo(loose.bare * 1.5, 2);
        expect(tight.gatherers.bare).toBeCloseTo(2, 3);
        expect(loose.gatherers.bare).toBeCloseTo(2, 3);
        expect(tight.chain.bare).toBeCloseTo(2 / 3, 3);
        // Two heroes for half as long again: the same hero-hours as three heroes for the shorter time.
        expect(tight.guildBare).toBeCloseTo(tight.bare * 2, 2);
        expect(loose.guildBare).toBeCloseTo(loose.bare * 3, 2);
        expect(tight.guildBare).toBeCloseTo(loose.guildBare, 2);
    });

    it('⭐ --one-layout leaves out the other layout\'s days to 99, keeping its node check', async () => {
        const dir = sandbox();
        const jsonFile = path.join(dir, 'one.json');
        const r = await cms(dir, 'ledger', '--one-layout', `--json=${jsonFile}`);
        expect(r.code, r.err).toBe(0);
        expect(r.out).toMatch(/Layouts: timed dense only \(the sparse layout left out\); 1 node make/);
        const out = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        expect(out.layouts).toMatchObject({ skipped: true, skills: null, timed: 'dense', other: 'sparse' });
        expect(out.layouts.nodesOff.map((n) => n.entry)).toEqual(['token:token_vein']);
        expect(USAGE).toMatch(/--one-layout times only the pace's/);
    });

    it('⭐ run from a worktree with no workspace of its own, reads the main checkout\'s, and says so', async () => {
        const main = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-cms-main-'));
        tmpRoots.push(main);
        fs.mkdirSync(path.join(main, 'cms', 'workspace'), { recursive: true });
        const mainFile = path.join(main, 'cms', 'workspace', 'workspace.json');
        saveWorkspaceFile(mainFile, paceWorkspace(), { baseRevision: 0, savedBy: 'test' });
        const worktree = path.join(main, '.claude', 'worktrees', 'x');
        fs.mkdirSync(worktree, { recursive: true });
        fs.writeFileSync(path.join(worktree, '.git'), `gitdir: ${main.split(path.sep).join('/')}/.git/worktrees/x\n`);
        const before = hashOf(mainFile);
        const out = [];
        const err = [];
        const code = await runCli(['ledger'], { root: worktree, load, out: (x) => out.push(x), err: (x) => err.push(x) });
        expect(code, err.join('\n')).toBe(0);
        expect(out.join('\n')).toMatch(/the main checkout's workspace/);
        expect(out.join('\n')).toMatch(/^mining /m);
        expect(hashOf(mainFile)).toBe(before);
        expect(fs.readdirSync(worktree)).toEqual(['.git']);
        expect(USAGE).toMatch(/a worktree with no workspace of its own reads the\s+main checkout's/);
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

describe('the read-out\'s stages', () => {
    it('⭐ gives each stage its way out, what its budget times, and its full content beside it as information', () => {
        const world = structuredClone(WORLD_FIXTURE_RAW);
        world.prices[1] = { ...world.prices[1], skills: [{ skill: 'line', level: 3 }], coins: 30 };
        const ws = { ...worldWorkspace(), world };
        ws.items.item_copper_ore.value = 1;
        const out = ledgerReadout(ws, { layouts: false });
        const camp = out.stages[0];
        expect(camp.gate).toMatchObject({ place: 'wedge:ores:1', name: 'Ores ring 1', ring: 1, coins: 30, asks: [{ skill: 'mining', level: 3 }], complete: true });
        // ⭐ Fully timed, and still a floor while its goods price (the world seed's) is not counted: every way out says so.
        for (const s of out.stages.filter((x) => x.gate)) {
            expect(s.gate.floor).toBe(true);
            expect(s.gate.floorWhy).toEqual(["its goods price (the world seed's) is not counted"]);
        }
        expect(camp.minutes).toBe(camp.gate.minutes);
        expect(camp.gate.minutes).toBeCloseTo(camp.gate.levelMinutes + camp.gate.priceMinutes, 2);
        expect(camp.gate.asks[0].minutes).toBeCloseTo(camp.gate.levelMinutes, 2);
        expect(camp.offPct).toBeCloseTo((camp.gate.minutes / camp.budgetMinutes - 1) * 100, 0);
        expect(camp.content.entries).toBeGreaterThan(0);
        expect(camp.content.minutes).toBeGreaterThan(0);
        // Plane 1's way out is an iron place, which needs Ring 2 opened and the place before it.
        expect(out.stages[1].gate.needs.map((n) => n.key).sort()).toEqual(['ring:2', 'wedge:ores:1']);
        // The fixture's world holds no place of Plane 4.
        expect(out.stages[3]).toMatchObject({ gate: null, minutes: null, offPct: null, gateWhy: 'no place of Plane 4 to settle' });
        const text = readoutText(out).join('\n');
        expect(text).toMatch(/^Starter Camp \| .+: Ores ring 1, mining 3 \+ 30 coins, a floor \(its goods price \(the world seed's\) is not counted\) \| .+ \| 1 \| .+, \d+ \(\d+\)/m);
        expect(out.notes.join(' ')).toMatch(/every way out is a floor while its goods are not counted/);
        expect(text).toMatch(/^Plane 3 \| no place of Plane 4 to settle \|/m);
    });
});

describe('the read-out\'s coins', () => {
    it('⭐ shows the two coin curves, and each price that asks coins on its curve with its proposal', () => {
        const world = structuredClone(WORLD_FIXTURE_RAW);
        world.prices[1] = { ...world.prices[1], coins: 30 };
        const ws = { ...worldWorkspace(), world };
        ws.items.item_copper_ore.value = 1;
        const out = ledgerReadout(ws, { layouts: false });
        expect(out.coins.curves.everyday[0]).toEqual({ tier: 0, minutes: 5 });
        expect(out.coins.curves.big[0]).toEqual({ tier: 0, minutes: 30 });
        const ring = out.coins.prices.find((p) => p.kind === 'ring' && p.ring === 1);
        expect(ring).toMatchObject({ curve: 'big', coins: 30, minutes: 45 });
        expect(ring.proposed).toBeGreaterThan(0);
        // Only prices that ask coins are listed.
        expect(out.coins.prices.every((p) => p.coins > 0)).toBe(true);
        const text = readoutText(out).join('\n');
        expect(text).toMatch(/^Coin curves, minutes of one hero's selling from a stage on: everyday Starter Camp 5, Plane 2 9, .*Plane 7 361; big Starter Camp 30, Plane 1 45, Plane 2 66, .*Plane 7 720\.$/m);
        expect(text).toMatch(/^Coin prices: 1 asks coins \(ring 1\); 1 beyond the tolerance from its curve's proposal\.$/m);
    });

    it('⭐ a Guild Hall rank priced small is on no curve and never off: its payback judges it', () => {
        const world = structuredClone(WORLD_FIXTURE_RAW);
        world.prices[1] = { ...world.prices[1], coins: 30 };
        const ws = { ...worldWorkspace(), world };
        ws.items.item_copper_ore.value = 1;
        for (const star of Object.values(ws.hallStars)) for (const rank of star.ranks) rank.coins = 5;
        const out = ledgerReadout(ws, { layouts: false });
        const hall = out.coins.prices.filter((p) => p.kind === 'hall');
        expect(hall.length).toBe(Object.values(ws.hallStars).reduce((n, s) => n + s.ranks.length, 0));
        for (const p of hall) {
            expect(p).toMatchObject({ coins: 5, curve: null, minutes: null, proposed: null, off: false });
            expect(p.why).toMatch(/payback/);
        }
        // A ring keeps its curve.
        expect(out.coins.prices.find((p) => p.kind === 'ring')).toMatchObject({ curve: 'big', off: true });
        const text = readoutText(out).join('\n');
        expect(text).toMatch(new RegExp(`^Coin prices: ${hall.length + 1} ask coins \\(hall ${hall.length}, ring 1\\); 1 beyond the tolerance from its curve's proposal \\(Guild Hall ranks on no curve: judged by their payback\\)\\.$`, 'm'));
        const coins = coinsText(workspaceCoins(ws));
        expect(coins).toMatch(/^Guild Hall ranks: \d+, \d+ asking coins\. On no coin curve: a rank is a small step judged by its payback/m);
        expect(coins).toMatch(/^- Ring 2 Star rank 1 at .+: asks 5$/m);
        expect(coins).not.toMatch(/Ring 2 Star.*proposed/);
        expect(coins).toMatch(/^- Ring 1 \(ring at .+\): asks 30 .*proposed \d+/m);
    });

    it('lists no prices when nothing asks coins, and still shows the curves', () => {
        const out = ledgerReadout(worldWorkspace(), { layouts: false });
        expect(out.coins.prices).toEqual([]);
        expect(readoutText(out).join('\n')).toMatch(/^Coin prices: none ask coins\.$/m);
    });
});
