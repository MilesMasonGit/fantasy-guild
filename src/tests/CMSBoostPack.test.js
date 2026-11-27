import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

import { runCli } from '../../cms/cliCommands.mjs';
import { saveWorkspaceFile } from '../../cms/workspaceFile.js';
import { validatePack, setValue, proposedValue, entryConflict } from '../../cms/src/engine/changePacks.js';
import { writeBoostPack, BOOST_RULE } from '../../cms/src/engine/boostPack.js';

/**
 * The boosts pack writer (`npm run cms -- pack boosts`, `cms/src/engine/boostPack.js`): every
 * effect statement that moves work time, XP, yield or doubles, rare finds or regrowth, sized by
 * its source (BALANCE_RULES section 5). Runs on a fixture workspace in a throwaway folder; nothing
 * here reads or writes the real workspace.
 */

const root = path.resolve(__dirname, '../..');
const cmsDir = path.join(root, 'cms');
const load = (p) => import(/* @vite-ignore */ path.join(cmsDir, p));
const tmpRoots = [];

const live = (tier) => ({ status: 'live', tier });
const provides = (type, bucket, value, extra = {}) => ({ keyword: 'provides', payload: { type, bucket, value, ...(extra.category ? { category: extra.category } : {}) }, to: extra.to || { mode: 'all', value: '' }, reach: extra.reach, when: null });
const effect = (id, ...statements) => ({ id, name: id, statements });
const applies = (effectId, event = 'WORK_START', scale = 1) => ({ keyword: 'applies', payload: { effectId, scale, durationMs: 0, forCycle: true, chance: 100 }, when: { event }, reach: 'nearby' });
const ref = (effectId, scale = 1) => ({ effectId, scale });
const rank = (tier, ...rules) => ({ tier, price: [], rules, lines: [] });

/** One bearer of every source the rule sizes, and of every kind it leaves for someone to decide. */
const fixtureWorkspace = () => ({
    items: {
        item_ore: { id: 'item_ore', name: 'Ore', type: 'material', plan: live(0) },
        item_pickaxe: { id: 'item_pickaxe', name: 'Pickaxe', type: 'tool', equipSlot: 'hand', effects: [ref('eff_tool')], plan: live(0) },
        item_tea: { id: 'item_tea', name: 'Tea', type: 'drink', equipSlot: 'drink', effects: [ref('eff_tea')], plan: live(3) },
        item_coffee: { id: 'item_coffee', name: 'Coffee', type: 'drink', equipSlot: 'drink', effects: [ref('eff_coffee')], plan: live(7) },
        item_bounty: { id: 'item_bounty', name: 'Bounty Potion', type: 'potion', equipSlot: 'consumable', effects: [ref('eff_bounty')], plan: live(2) },
        item_luck: { id: 'item_luck', name: 'Luck Potion', type: 'potion', equipSlot: 'consumable', effects: [ref('eff_luck')], plan: live(4) },
        item_great_luck: { id: 'item_great_luck', name: 'Great Luck Potion', type: 'potion', equipSlot: 'consumable', effects: [ref('eff_great_luck')], plan: live(6) },
        item_harvest: { id: 'item_harvest', name: 'Harvest Draught', type: 'potion', equipSlot: 'consumable', effects: [ref('eff_harvest')], plan: live(7) },
        item_nest_potion: { id: 'item_nest_potion', name: 'Birdwatcher', type: 'potion', equipSlot: 'consumable', effects: [ref('eff_nest_potion')], plan: live(2) },
        item_masters: { id: 'item_masters', name: 'Masters Draught', type: 'potion', equipSlot: 'consumable', effects: [ref('eff_masters')], plan: live(3) },
        item_beer: { id: 'item_beer', name: 'Beer', type: 'drink', equipSlot: 'drink', effects: [ref('eff_beer')], plan: live(2) },
        item_mead: { id: 'item_mead', name: 'Mead', type: 'drink', equipSlot: 'drink', effects: [ref('eff_mead')], plan: live(3) },
        item_valor: { id: 'item_valor', name: 'Elixir of Valor', type: 'potion', equipSlot: 'consumable', effects: [ref('eff_valor_elixir')], plan: live(3) },
    },
    tokens: {
        token_vein: { id: 'token_vein', name: 'Vein', tokenType: 'resource', tags: ['Ore'], config: { skill: 'mining' }, respawn: { mode: 'refill', afterMs: 30000 }, plan: live(0) },
        token_field: { id: 'token_field', name: 'Field', tokenType: 'station', tags: ['Field'], config: { skill: 'farming' }, field: { crops: [] }, plan: live(0) },
        token_cart: { id: 'token_cart', name: 'Ore Cart', tokenType: 'buff', tags: [], effects: [ref('eff_cart')], plan: live(0) },
        token_school: { id: 'token_school', name: 'School', tokenType: 'buff', tags: [], effects: [ref('eff_xp_hut')], plan: live(1) },
        token_mine: { id: 'token_mine', name: 'Mine', tokenType: 'buff', tags: [], effects: [ref('eff_double')], plan: live(0) },
        token_lodge: { id: 'token_lodge', name: 'Lodge', tokenType: 'buff', tags: [], effects: [ref('eff_loot')], plan: live(2) },
        token_shrine: { id: 'token_shrine', name: 'Lucky Shrine', tokenType: 'buff', tags: [], effects: [ref('eff_lucky')], plan: live(4) },
        token_head: { id: 'token_head', name: 'Mine Head', tokenType: 'buff', tags: [], effects: [ref('eff_rest')], plan: live(3) },
        token_well: { id: 'token_well', name: 'Well', tokenType: 'buff', tags: [], effects: [ref('eff_water')], plan: live(0) },
        token_bank: { id: 'token_bank', name: 'Counting House', tokenType: 'buff', tags: [], effects: [ref('eff_coin')], plan: live(0) },
        token_foundry: { id: 'token_foundry', name: 'Foundry', tokenType: 'station', tags: [], config: { skill: 'smithing' }, effects: [ref('eff_step', 2), ref('eff_station_loot')], plan: live(3) },
        token_bakery: { id: 'token_bakery', name: 'Bakery', tokenType: 'station', tags: [], config: { skill: 'cooking' }, effects: [ref('eff_step', 1)], plan: live(3) },
        token_market: { id: 'token_market', name: 'Market', tokenType: 'buff', tags: [], effects: [ref('eff_mixed')], plan: live(3) },
        token_sawmill: { id: 'token_sawmill', name: 'Sawmill', tokenType: 'camp', tags: [], camp: { skill: 'forestry' }, effects: [ref('eff_camp')], plan: live(3) },
        token_rainfall: { id: 'token_rainfall', name: 'Rainfall', tokenType: 'buff', tags: ['Event'], effects: [ref('eff_rain')] },
        token_ore_market: { id: 'token_ore_market', name: 'Ore Market', tokenType: 'camp', tags: [], camp: { skill: 'mining' }, effects: [ref('eff_camp_speed')], plan: live(3) },
        token_camp_head: { id: 'token_camp_head', name: 'Mine Head', tokenType: 'camp', tags: [], camp: { skill: 'mining' }, effects: [ref('eff_camp_rest')], plan: live(3) },
        token_study: { id: 'token_study', name: "Master's Study", tokenType: 'station', tags: [], config: { skill: 'alchemy' }, effects: [ref('eff_study')], plan: live(3) },
        token_bush: { id: 'token_bush', name: 'Blackberry Bush', tokenType: 'resource', tags: [], config: { skill: 'farming' }, effects: [ref('eff_bonus')], plan: live(0) },
        token_oak: { id: 'token_oak', name: 'Oak', tokenType: 'resource', tags: [], config: { skill: 'forestry' }, mastery: { ranks: [{ effectId: 'eff_mastery' }] }, plan: live(0) },
        token_old_yard: { id: 'token_old_yard', name: 'Old Yard', tokenType: 'buff', tags: [], effects: [ref('eff_old')], plan: { status: 'parked' } },
    },
    effects: {
        eff_tool: effect('eff_tool', provides('WORK_TIME', 'percentage', -0.05, { category: 'mining' })),
        eff_cart: effect('eff_cart', provides('WORK_TIME', 'percentage', -0.2, { to: { mode: 'id', value: 'token_vein' } })),
        eff_xp_hut: effect('eff_xp_hut', provides('XP_BONUS', 'percentage', 0.1)),
        eff_double: effect('eff_double', provides('DOUBLE_DROP', 'flat', 25, { category: 'item_ore', to: { mode: 'id', value: 'token_vein' } })),
        eff_loot: effect('eff_loot', provides('LOOT_MULT', 'flat', 10, { category: 'forestry' })),
        eff_lucky: effect('eff_lucky', provides('LUCKY', 'percentage', 0.25)),
        eff_rest: effect('eff_rest', provides('GROW_TIME', 'percentage', -0.2, { category: 'mining' })),
        eff_water: effect('eff_water', provides('GROW_TIME', 'percentage', -0.09, { to: { mode: 'tag', value: 'Field' } })),
        eff_coin: effect('eff_coin', provides('COIN_FIND', 'percentage', 0.2)),
        eff_step: effect('eff_step', provides('WORK_TIME', 'percentage', -0.15, { reach: 'self' })),
        eff_station_loot: effect('eff_station_loot', provides('LOOT_MULT', 'flat', 10, { reach: 'self' })),
        eff_mixed: effect('eff_mixed', provides('WORK_TIME', 'percentage', -0.1), provides('XP_BONUS', 'percentage', 0.1)),
        eff_camp: effect('eff_camp', provides('LOOT_MULT', 'flat', 10, { category: 'forestry' })),
        eff_rain: effect('eff_rain', provides('LOOT_MULT', 'flat', 20, { category: 'farming' })),
        eff_camp_speed: effect('eff_camp_speed', provides('WORK_TIME', 'percentage', -0.1, { category: 'smithing' })),
        eff_camp_rest: effect('eff_camp_rest', provides('GROW_TIME', 'percentage', -0.2, { category: 'mining' })),
        eff_study: effect('eff_study', provides('XP_BONUS', 'percentage', 0.1, { reach: 'self' })),
        eff_bonus: effect('eff_bonus', { keyword: 'grants', payload: { type: 'BONUS_DROP', itemId: 'item_ore', quantity: 1 }, to: { mode: 'all', value: '' }, reach: 'nearby', when: null }),
        eff_mastery: effect('eff_mastery', provides('WORK_TIME', 'percentage', -0.05, { reach: 'self' })),
        eff_great_luck: effect('eff_great_luck', applies('st_great_luck')),
        st_great_luck: effect('st_great_luck', provides('LUCKY', 'percentage', 0.5, { reach: 'nearby' })),
        eff_harvest: effect('eff_harvest', applies('st_harvest')),
        st_harvest: effect('st_harvest', provides('LOOT_MULT', 'flat', 5, { reach: 'nearby' })),
        eff_nest_potion: effect('eff_nest_potion', applies('st_nest')),
        st_nest: effect('st_nest', { keyword: 'grants', payload: { type: 'BONUS_DROP', itemId: 'item_ore', quantity: 1 }, to: { mode: 'all', value: '' }, reach: 'nearby', when: null }),
        eff_old: effect('eff_old', provides('WORK_TIME', 'percentage', -0.3)),
        eff_orphan: effect('eff_orphan', provides('WORK_TIME', 'percentage', -0.3)),
        eff_perk_early: effect('eff_perk_early', provides('WORK_TIME', 'percentage', -0.08, { category: 'mining' })),
        eff_perk_late: effect('eff_perk_late', provides('WORK_TIME', 'percentage', -0.02, { category: 'mining' })),
        eff_perk_xp: effect('eff_perk_xp', provides('XP_BONUS', 'percentage', 0.1, { category: 'fishing' })),
        eff_tea: effect('eff_tea', applies('st_tea')),
        st_tea: effect('st_tea', provides('XP_BONUS', 'percentage', 0.1, { reach: 'nearby' })),
        eff_coffee: effect('eff_coffee', applies('st_coffee')),
        st_coffee: effect('st_coffee', provides('WORK_TIME', 'percentage', -0.04, { reach: 'nearby' })),
        eff_bounty: effect('eff_bounty', applies('st_bounty')),
        st_bounty: effect('st_bounty', provides('YIELD', 'percentage', 0.04, { reach: 'nearby' })),
        eff_luck: effect('eff_luck', applies('st_luck')),
        st_luck: effect('st_luck', provides('LUCKY', 'percentage', 0.5, { reach: 'nearby' })),
        eff_masters: effect('eff_masters', applies('st_masters')),
        st_masters: effect('st_masters', provides('WORK_TIME', 'percentage', -0.04), provides('YIELD', 'percentage', 0.04)),
        eff_beer: effect('eff_beer', applies('st_merry')),
        eff_mead: effect('eff_mead', applies('st_merry')),
        st_merry: effect('st_merry', provides('XP_BONUS', 'percentage', 0.1)),
        eff_valor_elixir: effect('eff_valor_elixir', applies('st_valor', 'COMBAT_ENGAGED')),
        st_valor: effect('st_valor', provides('DAMAGE', 'flat', 1)),
    },
    recipePools: {},
    skillPerks: {
        mining: { id: 'mining', perks: [{ level: 10, effectId: 'eff_perk_early', scale: 1 }, { level: 85, effectId: 'eff_perk_late', scale: 1 }] },
        fishing: { id: 'fishing', perks: [{ level: 10, effectId: 'eff_perk_xp', scale: 1 }] },
    },
    hallStars: {
        star_speed: { id: 'star_speed', constellation: 'mining', name: 'Quick Picks', links: ['hall'], ranks: [rank(0, provides('WORK_TIME', 'percentage', -0.06, { category: 'mining', reach: 'board' })), rank(2, provides('WORK_TIME', 'percentage', -0.126, { category: 'mining', reach: 'board' }))] },
        star_yield: { id: 'star_yield', constellation: 'farming', name: 'Bumper Crops', links: ['hall'], ranks: [rank(0, provides('YIELD', 'percentage', 0.07, { category: 'farming' })), rank(1, provides('YIELD', 'percentage', 0.152, { category: 'farming' })), rank(2, provides('YIELD', 'percentage', 0.25, { category: 'farming' }))] },
        star_rest: { id: 'star_rest', constellation: 'mining', name: 'Deep Veins', links: ['hall'], ranks: [rank(0, provides('GROW_TIME', 'percentage', -0.1, { to: { mode: 'tag', value: 'Ore' } }))] },
        star_lap: { id: 'star_lap', constellation: 'hall', name: 'Swift Laps', links: ['hall'], ranks: [rank(0, provides('PASSIVE_LAP', 'percentage', -0.2))] },
        star_mixed: { id: 'star_mixed', constellation: 'mining', name: 'Odd Star', links: ['hall'], ranks: [rank(0, provides('WORK_TIME', 'percentage', -0.05, { category: 'mining' }), provides('YIELD', 'percentage', 0.05, { category: 'mining' }))] },
    },
});

const hashOf = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function setUp() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-boost-pack-'));
    tmpRoots.push(dir);
    fs.mkdirSync(path.join(dir, 'workspace'));
    const workspaceFile = path.join(dir, 'workspace', 'workspace.json');
    saveWorkspaceFile(workspaceFile, fixtureWorkspace(), { baseRevision: 0, savedBy: 'test' });
    fs.mkdirSync(path.join(dir, 'out'));
    return { dir, workspaceFile, packFile: path.join(dir, 'out', 'test-boosts.json'), unclearFile: path.join(dir, 'out', 'unclear.txt') };
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

/** The value a pack gives one effect's statement, or a star rank's rule. */
const effectValue = (pack, id, i = 0) => pack.entries.find((e) => e.kind === 'effect' && e.id === id)?.value.statements[i].payload.value;
const starValues = (pack, id) => pack.entries.find((e) => e.kind === 'hallStar' && e.id === id)?.value.ranks.map((r) => r.rules[0].payload.value);

describe('pack boosts: the rule\'s numbers', () => {
    let result;
    beforeAll(() => {
        result = writeBoostPack(fixtureWorkspace(), { id: 'test-boosts', createdAt: '2026-11-26T00:00:00.000Z' });
    });

    it('sizes a placed building by its kind: 5 % speed, +2.5 % XP, +50 % yield, +12.5 % rare finds, 10 % regrowth, coins +10 %', () => {
        const { pack } = result;
        expect(BOOST_RULE.building).toEqual({ speed: 5, xp: 2.5, yield: 50, rare: 12.5, regrow: 10, coin: 10 });
        expect(effectValue(pack, 'eff_cart')).toBe(-0.05);
        expect(effectValue(pack, 'eff_xp_hut')).toBe(0.025);
        expect(effectValue(pack, 'eff_double')).toBe(50);
        expect(effectValue(pack, 'eff_loot')).toBe(50);
        expect(effectValue(pack, 'eff_lucky')).toBe(0.125);
        expect(effectValue(pack, 'eff_rest')).toBe(-0.1);
        expect(effectValue(pack, 'eff_coin')).toBe(0.1);
        // Growth time on a Field is its crop's growth, which the budget counts as speed.
        expect(effectValue(pack, 'eff_water')).toBe(-0.05);
    });

    it('sizes a station\'s own upgrade at 5 % a step, a step one scale of its own speed rule', () => {
        // Foundry holds it at scale 2 (two steps, 10 %), Bakery at 1: the base is one step.
        expect(effectValue(result.pack, 'eff_step')).toBe(-0.05);
    });

    it('sizes skill perks to a quarter of the tier\'s speed total, reached by darkmetal', () => {
        // Level 10 is copper's row (20 % maxed): 5 %. Level 85 is darkmetal's (60 %): 15 % in all, so 10 % more.
        expect(effectValue(result.pack, 'eff_perk_early')).toBe(-0.05);
        expect(effectValue(result.pack, 'eff_perk_late')).toBe(-0.1);
    });

    it('sizes a Guild Hall star\'s ranks to 10 % of its kind in all, in even steps', () => {
        expect(starValues(result.pack, 'star_speed')).toEqual([-0.05, -0.1]);
        expect(starValues(result.pack, 'star_yield')).toEqual([0.0333, 0.0667, 0.1]);
        // Already at the rule: no entry, and counted as written.
        expect(result.pack.entries.some((e) => e.id === 'star_rest')).toBe(false);
        expect(result.filled.some((f) => f.where.includes('star_rest') && f.from === f.to)).toBe(true);
    });

    it('sizes the one consumable by its tier: speed a quarter of the speed total, XP the XP total, yield 10 to 50 %, rare finds +100 % then +200 % from adamantine', () => {
        // Coffee is darkmetal (speed 60 %): 15 %. Tea is silver (XP 15 %). Luck is mythril.
        expect(effectValue(result.pack, 'st_coffee')).toBe(-0.15);
        expect(effectValue(result.pack, 'st_tea')).toBe(0.15);
        // Bounty is iron: +15 % yield. Harvest is darkmetal: +50 %. Luck is mythril (+100 %), Great Luck adamantine (+200 %).
        expect(effectValue(result.pack, 'st_bounty')).toBe(0.15);
        expect(effectValue(result.pack, 'st_harvest')).toBe(50);
        expect(effectValue(result.pack, 'st_luck')).toBe(1);
        expect(effectValue(result.pack, 'st_great_luck')).toBe(2);
        // The item's own rule (Applies) is left as it is.
        expect(result.pack.entries.some((e) => e.id === 'eff_tea')).toBe(false);
    });

    it('keeps every edited statement\'s name and what it does: only the number moves', () => {
        const ws = fixtureWorkspace();
        for (const entry of result.pack.entries) {
            const before = entry.kind === 'effect' ? ws.effects[entry.id] : ws.hallStars[entry.id];
            const strip = (v) => JSON.parse(JSON.stringify(v, (k, x) => (k === 'value' && typeof x === 'number' ? 0 : x)));
            expect(strip(entry.value)).toEqual(strip(before));
        }
    });

    it('lists what fits none of the sources, or mixes kinds, and writes none of it', () => {
        const reasons = Object.fromEntries(result.unclear.map((u) => [u.where, u.reason]));
        const unclearOf = (fragment) => Object.entries(reasons).find(([w]) => w.includes(fragment))?.[1];
        expect(unclearOf('eff_tool')).toMatch(/tool/);
        expect(unclearOf('eff_mixed')).toMatch(/more than one kind/);
        expect(unclearOf('eff_perk_xp')).toMatch(/perk/);
        expect(unclearOf('st_masters')).toMatch(/more than one kind/);
        expect(unclearOf('st_merry')).toMatch(/Beer.*Mead|Mead.*Beer/);
        expect(unclearOf('star_mixed')).toMatch(/more than one kind/);
        const written = new Set(result.pack.entries.map((e) => e.id));
        for (const id of ['eff_tool', 'eff_mixed', 'eff_perk_xp', 'st_masters', 'st_merry', 'star_mixed']) expect(written.has(id)).toBe(false);
    });

    it('skips what is left alone on purpose: a parked bearer, an effect nothing carries; fight and other axes are not counted', () => {
        const skipped = result.skipped.map((s) => s.where).join('\n');
        expect(skipped).toContain('eff_old');
        expect(skipped).toContain('eff_orphan');
        const all = [...result.filled, ...result.unclear, ...result.skipped].map((x) => x.where).join('\n');
        expect(all).not.toContain('st_valor');
        expect(all).not.toContain('star_lap');
    });

    it('applies cleanly to the workspace it was made against', () => {
        let next = fixtureWorkspace();
        expect(validatePack(result.pack, { fileName: 'test-boosts.json' })).toEqual({ ok: true });
        for (const entry of result.pack.entries) {
            expect(entryConflict(next, entry).conflict).toBe(false);
            next = { ...next, ...setValue(next, entry.kind, entry.id, proposedValue(entry)) };
        }
        expect(next.effects.eff_cart.statements[0].payload.value).toBe(-0.05);
        // Run again on the result: nothing left to write.
        expect(writeBoostPack(next, { id: 'again' }).pack).toBeNull();
    });
});

describe('pack boosts on the command line', () => {
    let f;
    let run;
    let pack;
    let hashBefore;

    beforeAll(async () => {
        f = setUp();
        hashBefore = hashOf(f.workspaceFile);
        run = await cms(['pack', 'boosts', `--workspace=${f.workspaceFile}`, `--out=${f.packFile}`, `--unclear=${f.unclearFile}`]);
        pack = fs.existsSync(f.packFile) ? JSON.parse(fs.readFileSync(f.packFile, 'utf8')) : null;
    }, 60000);

    it('writes a pack the CMS takes, named after its file, with no conflicts', async () => {
        expect(run.code, run.err).toBe(0);
        expect(pack?.id).toBe('test-boosts');
        expect(validatePack(pack, { fileName: 'test-boosts.json' })).toEqual({ ok: true });
        const check = await cms(['pack', 'check', f.packFile, `--workspace=${f.workspaceFile}`]);
        expect(check.code, check.err).toBe(0);
        expect(check.out).toMatch(/No entry conflicts/);
        const r = spawnSync(process.execPath, [path.join(cmsDir, 'changePackTool.mjs'), 'check', f.packFile], { encoding: 'utf8' });
        expect(r.status, r.stdout + r.stderr).toBe(0);
    });

    it('prints the counts and writes the unclear list beside the pack', () => {
        expect(run.out).toMatch(/\d+ statements? written/);
        expect(run.out).toMatch(/\d+ unclear/);
        expect(run.out).toMatch(/\d+ skipped/);
        const listed = fs.readFileSync(f.unclearFile, 'utf8');
        expect(listed).toContain('eff_tool');
        expect(listed).toContain('st_merry');
    });

    it('never writes the workspace', () => {
        expect(hashOf(f.workspaceFile)).toBe(hashBefore);
    });

    it('writes the unclear list beside the pack when --unclear names none', async () => {
        const g = setUp();
        const r = await cms(['pack', 'boosts', `--workspace=${g.workspaceFile}`, `--out=${g.packFile}`]);
        expect(r.code, r.err).toBe(0);
        expect(fs.readFileSync(path.join(path.dirname(g.packFile), 'test-boosts-unclear.txt'), 'utf8')).toContain('st_merry');
    }, 60000);
});

describe('pack boosts refuses', () => {
    it('without --out, naming the option', async () => {
        const f = setUp();
        const r = await cms(['pack', 'boosts', `--workspace=${f.workspaceFile}`]);
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/--out/);
    });

    it('to write into cms/incoming/, the inbox', async () => {
        const f = setUp();
        const r = await cms(['pack', 'boosts', `--workspace=${f.workspaceFile}`, `--out=${path.join(cmsDir, 'incoming', 'x-boosts.json')}`]);
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/incoming/);
        expect(fs.existsSync(path.join(cmsDir, 'incoming', 'x-boosts.json'))).toBe(false);
    });
});
