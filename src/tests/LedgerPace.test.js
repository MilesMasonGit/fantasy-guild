import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildRateBook, LIFECYCLE, LIMIT, WORK } from '../systems/progression/ledger/rates.js';
import { buildPace, gainOf } from '../systems/progression/ledger/pace.js';
import { PROFILE } from '../systems/progression/ledger/profiles.js';
import { runChecks, CHECKS } from '../systems/progression/ledger/checks.js';
import { settingsOf, levelAtMinutes, minutesToReach } from '../systems/progression/ledger/settings.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { paceContent } from './fixtures/paceWorld.js';

/**
 * The progression ledger's pace (brief 290 L5): every kind of work rated, the three profiles (Bare,
 * Typical by payback, Maxed), supply fed by one hero on each input, level tracks, path time and
 * checks D, on a small world whose numbers read by hand (`fixtures/paceWorld.js`). The calculator
 * against the real engine is `npm run bench:calibrate`.
 */

const world = () => {
    const content = paceContent();
    const ledger = buildLedger(content);
    return { content, ledger, pace: buildPace(content, ledger, null) };
};

describe('the kinds of work the calculator now rates', () => {
    const book = () => buildRateBook(paceContent());

    it('a build: the recipe and the Foundation it stands on are its inputs, the build its cycle, its XP Construction', () => {
        const r = book().rateOf({ token: 'token_plot', recipe: 'recipe_build_hut' });
        expect(r).toMatchObject({ ok: true, kind: WORK.BUILD, skill: 'construction', cycleMs: 30000, cyclesPerHour: 120 });
        // 5 wood for the Hut and 10 for the Plot, every build.
        expect(r.inputs.item_oak_wood).toBeCloseTo(15 * 120);
        expect(r.xp.construction).toBeCloseTo(600);
        expect(r.tokens.token_hut).toBeCloseTo(120);
        expect(r.assumptions).toContainEqual(expect.objectContaining({ what: 'build' }));
        // A Foundation alone is no work, and a build of a kind it does not take is refused.
        expect(book().rateOf({ token: 'token_plot' })).toMatchObject({ ok: false });
    });

    it('a camp hands one hero several copies of a refilling Token; switched off or of another skill, one', () => {
        const b = book();
        expect(b.rateOf({ token: 'token_vein' }, { camp: { id: 'token_mining_camp', members: 3 } }).cyclesPerHour).toBeCloseTo(720);
        expect(b.rateOf({ token: 'token_vein' }, { camp: { id: 'token_mining_camp', members: 3 }, off: ['support:token_mining_camp'] }).cyclesPerHour).toBeCloseTo(240);
        expect(b.rateOf({ token: 'token_oak' }, { camp: { id: 'token_mining_camp', members: 3 } }).cyclesPerHour).toBeCloseTo(900);
        const camped = b.rateOf({ token: 'token_vein' }, { camp: { id: 'token_mining_camp', members: 3 } });
        expect(camped.factors.find(f => f.id === 'support:token_mining_camp')).toMatchObject({ on: true, axes: ['family'] });
    });

    it('Passive Production: the Guild Hall pays the Wishing Well\'s Water by rank, no hero', () => {
        const b = book();
        const r = b.rateOf({ token: 'token_guild_hall' }, { hallRanks: { wishing_well: 2 } });
        expect(r).toMatchObject({ ok: true, kind: WORK.PASSIVE, limitedBy: LIMIT.CLOCK, cyclesPerHour: 12 });
        expect(r.items.item_water).toBeCloseTo(20 * 12);
        expect(b.rateOf({ token: 'token_guild_hall' }).items.item_water).toBeUndefined();
    });
});

describe('water, a Field and a coarse fight', () => {
    const content = () => {
        const c = paceContent();
        c.items.item_fish = { id: 'item_fish', name: 'Fish', type: 'food' };
        c.items.item_eel = { id: 'item_eel', name: 'Eel', type: 'food' };
        c.items.item_bait = { id: 'item_bait', name: 'Bait', type: 'material', equipSlot: 'consumable' };
        c.items.item_rod = { id: 'item_rod', name: 'Rod', type: 'tool', equipSlot: 'hand', tool: { kind: 'fishing_rod', tier: 1, starter: true } };
        c.items.item_sickle = { id: 'item_sickle', name: 'Sickle', type: 'tool', equipSlot: 'hand', tool: { kind: 'sickle', tier: 1, starter: true } };
        c.items.item_wheat = { id: 'item_wheat', name: 'Wheat', type: 'material' };
        c.items.item_seed = { id: 'item_seed', name: 'Seed', type: 'material' };
        c.tokens.token_pond = {
            id: 'token_pond', name: 'Pond', uses: null, config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 8000, xp: 1, inputs: [], outputs: [] },
            catchPools: [
                { tool: 'fishing_rod', catches: [{ itemId: 'item_fish', weight: 3 }, { itemId: 'item_eel', weight: 1 }] },
                { tool: 'fishing_rod', bait: 'item_bait', catches: [{ itemId: 'item_eel', weight: 1 }] }
            ]
        };
        c.tokens.token_field = {
            id: 'token_field', name: 'Field', uses: null, needsTool: { kind: 'sickle', minTier: 1 }, field: {},
            config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] },
            statements: [{ keyword: 'station', payload: { skill: 'farming', stationKind: 'field' } }]
        };
        c.tokens.token_wolf = { id: 'token_wolf', name: 'Wolf', uses: 1, enemy: { level: 4, style: 'melee' }, config: { skill: '', cycleTimeMs: 12000, xp: 0, inputs: [], outputs: [{ itemId: 'item_fish', chance: 50, minQty: 1, maxQty: 1 }, { itemId: 'item_eel', chance: 100, minQty: 1, maxQty: 1, firstKill: true }] } };
        c.tokens.token_den = { id: 'token_den', name: 'Den', uses: null, config: null, spawner: { spawns: [{ typeId: 'token_wolf', weight: 1 }], allowance: 1, intervalMs: 60000, upkeep: [] } };
        c.recipes.push({ id: 'recipe_wheat', name: 'Wheat', skill: 'farming', levelRequirement: 1, stationKinds: ['field'], durationMs: 3000, xp: 1, crop: { growMs: 600000, load: 5 }, inputs: [{ itemId: 'item_seed', quantity: 1 }], outputs: [{ itemId: 'item_wheat', chance: 100, minQty: 2, maxQty: 2 }] });
        return c;
    };

    it('water lands one catch a cycle by weight, the bait pool spending a bait a catch', () => {
        const b = buildRateBook(content());
        const basic = b.rateOf({ token: 'token_pond', pool: 'fishing_rod|' });
        expect(basic).toMatchObject({ ok: true, kind: WORK.WATER, cyclesPerHour: 450, target: { pool: 'fishing_rod|' } });
        expect(basic.items.item_fish).toBeCloseTo(450 * 0.75);
        expect(basic.items.item_eel).toBeCloseTo(450 * 0.25);
        expect(basic.xp.fishing).toBeCloseTo(450);
        const baited = b.rateOf({ token: 'token_pond', pool: 'fishing_rod|item_bait' });
        expect(baited.items.item_eel).toBeCloseTo(450);
        expect(baited.inputs.item_bait).toBeCloseTo(450);
        expect(b.workTargets().filter(t => t.token === 'token_pond')).toHaveLength(2);
    });

    it('a Field is harvested its load, then regrows; its seed is paid once a sowing', () => {
        const r = buildRateBook(content()).rateOf({ token: 'token_field', recipe: 'recipe_wheat' });
        expect(r).toMatchObject({ ok: true, kind: WORK.FIELD, limitedBy: LIMIT.SUPPLY });
        expect(r.lifecycle).toMatchObject({ kind: LIFECYCLE.REFILL, cycles: 5, restMs: 600000 });
        const cycles = 5 * 3600000 / (5 * 3000 + 600000);
        expect(r.cyclesPerHour).toBeCloseTo(cycles);
        expect(r.items.item_wheat).toBeCloseTo(cycles * 2);
        expect(r.inputs.item_seed).toBeCloseTo(cycles / 5);
    });

    it('a fight is coarse: one kill a fight cycle, as fast as its den spawns it; a first-kill drop is not a rate', () => {
        const b = buildRateBook(content());
        const r = b.rateOf({ token: 'token_wolf' }, { family: { spawner: 'token_den' } });
        expect(r).toMatchObject({ ok: true, kind: WORK.FIGHT, cyclesPerHour: 60, limitedBy: LIMIT.SUPPLY });
        expect(r.items.item_fish).toBeCloseTo(30);
        expect(r.items.item_eel).toBeUndefined();
        expect(r.assumptions).toContainEqual(expect.objectContaining({ what: 'first kill' }));
    });
});

describe('the profiles', () => {
    it('Bare brings only what the work needs; Typical takes what pays for itself; Maxed everything that lifts it', () => {
        const { pace } = world();
        const vein = (p) => pace.rateAt({ token: 'token_vein' }, p);
        expect(vein(PROFILE.BARE).chosen).toEqual([]);
        expect(vein(PROFILE.BARE).items.item_copper_ore).toBeCloseTo(360);
        expect(vein(PROFILE.BARE).xp.mining).toBeCloseTo(240);

        const typical = vein(PROFILE.TYPICAL);
        const ids = typical.chosen.map(c => c.id);
        // Beer pays as it is drunk (XP doubled on a 1-XP cycle, the XP floor); the camp and the Mine pay back in minutes.
        expect(ids).toEqual(expect.arrayContaining(['item_beer', 'token_mining_camp', 'token_mine']));
        // The Gold Statue's 1 % for 1000 wood never pays back within the two hours.
        expect(ids).not.toContain('token_statue');
        expect(typical.chosen.find(c => c.id === 'token_mine').payback).toBeLessThan(2);
        expect(typical.items.item_copper_ore).toBeCloseTo(720 * 1.5 * 1.25);
        expect(typical.xp.mining).toBeCloseTo(1440);

        const maxed = vein(PROFILE.MAXED);
        expect(maxed.chosen.map(c => c.id)).toEqual(expect.arrayContaining([...ids, 'token_statue']));
        expect(maxed.items.item_copper_ore).toBeGreaterThan(typical.items.item_copper_ore);
    });

    it('a longer payback horizon lets Typical buy the statue too', () => {
        const content = paceContent();
        const ledger = buildLedger(content);
        const pace = buildPace(content, ledger, { paybackHours: 1000 });
        expect(pace.rateAt({ token: 'token_vein' }, PROFILE.TYPICAL).chosen.map(c => c.id)).toContain('token_statue');
    });

    it('a profile never takes what the guild cannot make by then', () => {
        const content = paceContent();
        delete content.tokens.token_still;
        content.starterCamp.tokens = content.starterCamp.tokens.filter(t => t.typeId !== 'token_still');
        const ledger = buildLedger(content);
        const pace = buildPace(content, ledger, null);
        expect(pace.rateAt({ token: 'token_vein' }, PROFILE.MAXED).chosen.map(c => c.id)).not.toContain('item_beer');
    });
});

describe('supply, level tracks and path time', () => {
    it('a build is fed by one forester: its wood sets the pace of Construction', () => {
        const { pace } = world();
        // The oak gives 900 wood an hour; a build wants 15 at 120 builds an hour: fed half the time.
        expect(pace.supplyOf('item_oak_wood', PROFILE.BARE).perHour).toBeCloseTo(900);
        const hut = pace.rateAt({ token: 'token_plot', recipe: 'recipe_build_hut' }, PROFILE.BARE);
        expect(hut.scale).toBeCloseTo(0.5);
        expect(hut.xp.construction).toBeCloseTo(300);

        const track = pace.trackOf('construction');
        expect(track.top).toBe(15);
        // Every level at 300 XP an hour, Bare: XP to 15 over 300.
        expect(track.levels[13].cumulative.bare).toBeCloseTo(xpForLevel(15) / 300);
        expect(track.levels[13].cumulative.typical).toBeLessThan(track.levels[13].cumulative.bare);
    });

    it('a path waits for its level gate, then takes its own step', () => {
        const { pace } = world();
        const path = pace.pathOf('token:token_big_hut', PROFILE.TYPICAL);
        const gate = pace.trackOf('construction').levels[13].cumulative.typical;
        expect(path.steps.map(s => s.key)).toEqual(['token:token_big_hut', 'recipe:recipe_build_big_hut']);
        expect(path.steps[1].waitsOn).toEqual({ skill: 'construction', level: 15 });
        expect(path.steps[1].start).toBeCloseTo(gate);
        // Then 10 wood (a minute at 900 an hour, by one forester) and the minute's build.
        expect(path.hours).toBeCloseTo(gate + 10 / 900 + 1 / 60);
        expect(path.complete).toBe(true);
    });

    it('Maxed is never slower than Typical, Typical never slower than Bare', () => {
        const { pace } = world();
        for (const skill of pace.skills()) {
            for (const row of pace.trackOf(skill).levels) {
                expect(row.hours.typical).toBeLessThanOrEqual(row.hours.bare + 1e-9);
                expect(row.hours.maxed).toBeLessThanOrEqual(row.hours.typical + 1e-9);
            }
        }
    });
});

describe('checks D', () => {
    const findings = () => world().pace.findings();

    it('a wall: Construction 1 to 15 far over the curve at Typical, naming its source and what waits on it', () => {
        const wall = findings().find(f => f.check === 'wall' && f.key === 'skill:construction');
        expect(wall).toBeTruthy();
        expect(wall.message).toMatch(/Construction 1 → 15/);
        expect(wall.message).toMatch(/Build Hut at Plot/);
        expect(wall.related).toContain('token:token_big_hut');
    });

    it('a stage over its budget, Bare out of its bounds, a long gather', () => {
        const f = findings();
        expect(f.find(x => x.check === 'stage-budget' && x.key === 'stage:0').message).toMatch(/over its budget of 30 min/);
        expect(f.filter(x => x.check === 'profile-bounds' && x.key === 'skill:construction')).toHaveLength(1);
        expect(f.find(x => x.check === 'unlock-wall' && x.key === 'token:token_statue').message).toMatch(/gathering Oak Wood/);
    });

    it('Beer over the consumable target, once, with every work it lifts', () => {
        const beer = findings().filter(x => x.check === 'boost-target');
        expect(beer).toHaveLength(1);
        expect(beer[0].key).toBe('item:item_beer');
        expect(beer[0].message).toMatch(/Copper Vein \+100 %/);
    });

    it('Guild Hall ranks that add no rate are named, not priced; Bunk Beds pay back in hours of wood', () => {
        const { pace } = world();
        const f = pace.findings();
        expect(f).toContainEqual(expect.objectContaining({ check: 'unmodelled', key: 'hall:token_cap' }));
        const beds = pace.hallPaybacks().filter(r => r.id === 'roster_size');
        expect(beds[0]).toMatchObject({ rank: 1, payback: 0 });
        // Rank 2 is 20 Oak Wood: 20 / 900 of an hour for a whole hero.
        expect(beds[1].payback).toBeCloseTo(20 / 900);
    });

    it('every D finding has a check the Problems list knows, and passes through runChecks with its name', () => {
        const { content, ledger, pace } = world();
        const extra = pace.findings();
        for (const f of extra) expect(CHECKS[f.check]?.group).toBe('D');
        const all = runChecks(ledger, content, { extra });
        expect(all.find(f => f.key === 'skill:construction').name).toBe('Construction');
    });

    it('the pace allows a wait of at least a check-in, or a level where the curve has the player', () => {
        const s = settingsOf(null);
        expect(levelAtMinutes(s, 0)).toBe(1);
        expect(levelAtMinutes(s, minutesToReach(s, 10))).toBe(10);
    });
});

describe('boost strength', () => {
    it('is the larger of what the items are worth and the XP, what is spent left out', () => {
        const r0 = { ok: true, items: { a: 10 }, xp: { s: 10 }, inputs: {} };
        const r1 = { ok: true, items: { a: 12.5 }, xp: { s: 10 }, inputs: { b: 100 } };
        expect(gainOf(r0, r1, () => 1)).toBeCloseTo(0.25);
        expect(gainOf(r0, { ...r0, xp: { s: 20 } }, () => 1)).toBeCloseTo(1);
    });
});

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const load = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));

describe('the shipped content', () => {
    it('shows plane 2\'s Construction 15 wall at Typical, and the Copper Mine on copper ore, switchable', () => {
        const content = { items: load('items.json'), tokens: load('tokens.json'), recipes: load('tokenRecipes.json'), effects: load('effects.json'), starterCamp: load('starterCamp.json') };
        const ledger = buildLedger(content);
        const pace = buildPace(content, ledger, null);
        const wall = pace.findings().find(f => f.check === 'wall' && f.key === 'skill:construction');
        expect(wall?.message).toMatch(/Construction 1 → 15/);
        expect(wall.related).toContain('recipe:recipe_build_iron_smithy');

        const vein = pace.rateAt({ token: 'token_copper_ore_vein' }, PROFILE.TYPICAL);
        expect(vein.chosen.map(c => c.id)).toContain('token_copper_mine');
        const mine = vein.rate.factors.find(f => f.id === 'support:token_copper_mine');
        expect(mine.axes).toContain('DOUBLE_DROP');
        const without = pace.book.rateOf({ token: 'token_copper_ore_vein' }, { ...vein.setup, off: ['support:token_copper_mine'] });
        expect(without.items.item_copper_ore).toBeCloseTo(vein.rate.items.item_copper_ore / 1.25);
    });
});
