import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildRateBook, LIFECYCLE, LIMIT, WORK } from '../../cms/src/engine/ledger/rates.js';
import { buildPace, gainOf } from '../../cms/src/engine/ledger/pace.js';
import { PROFILE, PROFILES } from '../../cms/src/engine/ledger/profiles.js';
import { runChecks, CHECKS } from '../../cms/src/engine/ledger/checks.js';
import { settingsOf, levelAtMinutes, minutesToReach } from '../../cms/src/engine/ledger/settings.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { paceContent, potionWebContent } from './fixtures/paceWorld.js';

/**
 * The progression ledger's pace (brief 290 L5): every kind of work rated, the three profiles (Bare,
 * Typical by payback, Maxed), supply fed by the gatherers each input needs (brief 880 L3), level tracks, path time and
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
        // Six 10-minute laps an hour with no lap star (`DropLap.test.js` buys it).
        expect(r).toMatchObject({ ok: true, kind: WORK.PASSIVE, limitedBy: LIMIT.CLOCK, cyclesPerHour: 6 });
        expect(r.items.item_water).toBeCloseTo(20 * 6);
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
        c.tokens.token_wolf = { id: 'token_wolf', name: 'Wolf', uses: 1, enemy: { level: 4, style: 'melee' }, config: { skill: '', cycleTimeMs: 12000, xp: 0, inputs: [], outputs: [{ itemId: 'item_fish', chance: 50, minQty: 1, maxQty: 1 }] } };
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

    it('a fight is coarse: one kill a fight cycle, as fast as its den spawns it', () => {
        const b = buildRateBook(content());
        const r = b.rateOf({ token: 'token_wolf' }, { family: { spawner: 'token_den' } });
        expect(r).toMatchObject({ ok: true, kind: WORK.FIGHT, cyclesPerHour: 60, limitedBy: LIMIT.SUPPLY });
        expect(r.items.item_fish).toBeCloseTo(30);
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
        // Beer pays as it is drunk (+10 % XP); the camp and each of four Mines pay back in minutes (four 25 % doubles: a sure double, in yield's four places).
        expect(ids).toEqual(expect.arrayContaining(['item_beer', 'token_mining_camp', 'token_mine']));
        expect(typical.chosen.filter(c => c.id === 'token_mine')).toHaveLength(4);
        // The Gold Statue's 1 % for 1000 wood never pays back within the two hours.
        expect(ids).not.toContain('token_statue');
        expect(typical.chosen.find(c => c.id === 'token_mine').payback).toBeLessThan(2);
        // The camp's two veins (the sparse layout), 240 cycles an hour each.
        expect(typical.items.item_copper_ore).toBeCloseTo(480 * 1.5 * 2);
        expect(typical.xp.mining).toBeCloseTo(480 * 1.1);

        // Maxed takes everything that lifts the vein and has a place: the Mines fill yield's four, so the Statue's yield has none.
        const maxed = vein(PROFILE.MAXED);
        expect(maxed.chosen.map(c => c.id)).toEqual(expect.arrayContaining(ids));
        expect(maxed.chosen.map(c => c.id)).not.toContain('token_statue');
        expect(maxed.items.item_copper_ore).toBeGreaterThanOrEqual(typical.items.item_copper_ore);
        const roomy = buildPace(paceContent(), buildLedger(paceContent()), { sitePlaces: { buildings: 8, perKind: 5 } });
        expect(roomy.rateAt({ token: 'token_vein' }, PROFILE.MAXED).chosen.map(c => c.id)).toContain('token_statue');
    });

    it('a longer payback horizon lets Typical buy the statue too', () => {
        const content = paceContent();
        const ledger = buildLedger(content);
        // Yield's places have room for it beside the four Mines.
        const pace = buildPace(content, ledger, { paybackHours: 1000, sitePlaces: { buildings: 8, perKind: 5 } });
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
    it('a build is fed by the foresters it needs: two at Bare, so Construction levels at the pace of the build itself', () => {
        const { pace } = world();
        // The oak gives 900 wood an hour; a build wants 15 at 120 builds an hour, 1800: two foresters (brief 880 L3; one, and half the pace, before).
        expect(pace.supplyOf('item_oak_wood', PROFILE.BARE).perHour).toBeCloseTo(900);
        const hut = pace.rateAt({ token: 'token_plot', recipe: 'recipe_build_hut' }, PROFILE.BARE);
        expect(hut.scale).toBeCloseTo(1);
        expect(hut.gatherers.item_oak_wood.heroes).toBeCloseTo(2);
        expect(hut.xp.construction).toBeCloseTo(600);

        const track = pace.trackOf('construction');
        expect(track.top).toBe(15);
        // Every level at 600 XP an hour, Bare, for three heroes' work: the Starter Camp's one hero builds and fells in turn, a third as fast.
        expect(track.levels[13].cumulative.bare).toBeCloseTo(xpForLevel(15) / (600 / 3));
        expect(track.levels[13].cumulativeWork.bare).toBeCloseTo(xpForLevel(15) / (600 / 3));
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

describe('a loop through the drinks', () => {
    // The Oak drinks Tea, brewed at the Still from Oak Wood: 1200 brews an hour want 1200 wood, which
    // the Oak gives at Typical (1980 with its Sawmill and its Tea) but not at Bare (900). A cooking
    // Elixir adds yield and is spent one a brew, but the Spring makes only 1000 an hour: it starves
    // the brewing to 1000 / 1200 of its pace. A Stew asks Cooking 3, so Cooking has levels to time.
    const TEA = { token: 'token_still', recipe: 'recipe_tea' };
    const content = (elixirYield) => {
        const c = paceContent();
        const one = (itemId) => ({ itemId, chance: 100, minQty: 1, maxQty: 1 });
        const carried = (id, effectId, skill) => ({ id: `stm_${id}`, keyword: 'applies', to: { mode: 'all', value: '' }, target: { role: 'actor' }, when: { event: 'WORK_START', scope: 'self', skill }, payload: { effectId, scale: 1, durationMs: 0, forCycle: true, chance: 100 } });
        const yieldUp = (id, value) => ({ id: `stm_${id}`, keyword: 'provides', to: { mode: 'all', value: '' }, reach: 'nearby', payload: { type: 'YIELD', bucket: 'percentage', value } });
        c.effects.lp_fx_steady = { id: 'lp_fx_steady', name: 'Steady', statements: [yieldUp('lp_steady', 0.1)] };
        c.effects.lp_fx_tea = { id: 'lp_fx_tea', name: 'Tea drink', statements: [carried('lp_tea', 'lp_fx_steady', 'forestry')] };
        c.effects.lp_fx_quick = { id: 'lp_fx_quick', name: 'Quick', statements: [yieldUp('lp_quick', elixirYield)] };
        c.effects.lp_fx_elixir = { id: 'lp_fx_elixir', name: 'Elixir potion', statements: [carried('lp_elixir', 'lp_fx_quick', 'cooking')] };
        c.items.item_tea = { id: 'item_tea', name: 'Tea', type: 'drink', equipSlot: 'drink', stackable: true, effects: [{ effectId: 'lp_fx_tea', scale: 1 }], plan: { tier: 0 } };
        c.items.item_elixir = { id: 'item_elixir', name: 'Elixir', type: 'potion', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'lp_fx_elixir', scale: 1 }], plan: { tier: 0 } };
        c.items.item_stew = { id: 'item_stew', name: 'Stew', type: 'food', plan: { tier: 0 } };
        c.tokens.token_spring = { id: 'token_spring', name: 'Spring', uses: null, config: { skill: 'alchemy', skillRequired: 1, cycleTimeMs: 3600, xp: 1, inputs: [], outputs: [one('item_elixir')] } };
        c.tokens.token_sawmill = {
            id: 'token_sawmill', name: 'Sawmill', tokenType: 'buff', uses: null, requiresHero: false, config: null,
            statements: [{ id: 'stm_lp_sawmill', keyword: 'provides', to: { mode: 'id', value: 'token_oak' }, reach: 'nearby', payload: { type: 'DOUBLE_DROP', bucket: 'flat', value: 100, category: 'item_oak_wood' } }]
        };
        c.recipes.push(
            { id: 'recipe_tea', name: 'Tea', skill: 'cooking', levelRequirement: 1, stationKinds: ['still'], durationMs: 3000, xp: 1, inputs: [{ itemId: 'item_oak_wood', quantity: 1 }], outputs: [one('item_tea')] },
            { id: 'recipe_stew', name: 'Stew', skill: 'cooking', levelRequirement: 3, stationKinds: ['still'], durationMs: 60000, xp: 1, inputs: [{ itemId: 'item_oak_wood', quantity: 1 }], outputs: [one('item_stew')] },
            { id: 'recipe_build_sawmill', name: 'Build Sawmill', skill: 'construction', levelRequirement: 1, xp: 5, durationMs: 30000, foundationKinds: ['wood'], inputs: [{ itemId: 'item_oak_wood', quantity: 5 }], outputs: [{ tokenId: 'token_sawmill', chance: 100, minQty: 1, maxQty: 1 }] }
        );
        c.starterCamp.tokens.push({ typeId: 'token_spring', x: 3, y: 0 });
        return c;
    };
    /** A fresh pace for the content, with `first` asked before anything else. */
    const paceAsked = (c, first) => {
        const pace = buildPace(c, buildLedger(c), null);
        pace.rateAt(first, PROFILE.MAXED);
        return pace;
    };
    const setupOf = (r) => ({ chosen: r.chosen.map(x => x.id).sort(), scale: r.scale, xp: r.xp.cooking });

    it('a profile weighs what a boost spends against the guild one profile down, so the question asked first changes nothing', () => {
        const c = content(0.2);
        const teaFirst = paceAsked(c, TEA);
        // The Oak's choices weigh its Tea, so asking the Oak first asks Tea's choices inside the Oak's: a
        // loop. Read at its own profile's supply, the loop stood the Oak in at Bare, Tea was short of wood
        // either way, and the Elixir's own shortage hid behind it.
        const oakFirst = paceAsked(c, { token: 'token_oak' });
        for (const profile of PROFILES) expect(setupOf(oakFirst.rateAt(TEA, profile))).toEqual(setupOf(teaFirst.rateAt(TEA, profile)));

        const typical = oakFirst.rateAt(TEA, PROFILE.TYPICAL);
        expect(oakFirst.supplyOf('item_oak_wood', PROFILE.TYPICAL).perHour).toBeCloseTo(1980);
        expect(typical.scale).toBeCloseTo(1);
        const maxed = oakFirst.rateAt(TEA, PROFILE.MAXED);
        expect(maxed.chosen.map(x => x.id)).not.toContain('item_elixir');
        expect(maxed.scale).toBeCloseTo(1);
        expect(maxed.xp.cooking).toBeGreaterThanOrEqual(typical.xp.cooking);
    });

    it('a level never takes longer at Maxed than at Typical, though Maxed takes a potion for its yield that starves the levelling', () => {
        const c = content(0.5);
        for (const first of [TEA, { token: 'token_oak' }]) {
            const pace = paceAsked(c, first);
            // Half again as much Tea is worth the starving, so Maxed takes the Elixir: fewer brews, less XP.
            const typical = pace.rateAt(TEA, PROFILE.TYPICAL);
            const maxed = pace.rateAt(TEA, PROFILE.MAXED);
            expect(maxed.chosen.map(x => x.id)).toContain('item_elixir');
            expect(maxed.short).toBe('item_elixir');
            expect(maxed.xp.cooking).toBeLessThan(typical.xp.cooking);
            // A hero levelling at Maxed may leave it off: it levels as Typical does.
            const track = pace.trackOf('cooking');
            expect(track.levels.length).toBeGreaterThan(0);
            for (const row of track.levels) {
                expect(row.hours.maxed).toBeLessThanOrEqual(row.hours.typical + 1e-9);
                expect(row.hours.typical).toBeLessThanOrEqual(row.hours.bare + 1e-9);
                expect(row.source.maxed).toMatchObject({ work: { key: 'token_still|recipe_tea|' }, profile: PROFILE.TYPICAL });
                // At the chain's staffing: the Starter Camp's one hero brews and fells the Tea's wood in turn.
                expect(row.source.maxed.xp).toBeCloseTo(typical.xp.cooking * row.source.maxed.chain);
                expect(row.source.maxed.chain).toBeLessThan(1);
            }
        }
    });
});

describe('a web of potions', () => {
    // Nine bushes, nine potions each brewed from one bush's herb, every potion lifting every bush: at Maxed
    // each herb's supply runs through all the others. Worked out afresh down every path through that
    // loop, the pace took a minute here and nine times longer with each potion more, and a change pack's
    // gate on the real content never finished.
    const POTIONS = 9;
    const supplies = (pace) => {
        const out = {};
        for (let j = 0; j < POTIONS; j++) {
            for (const profile of PROFILES) {
                out[`item_herb_${j}|${profile}`] = pace.supplyOf(`item_herb_${j}`, profile).perHour;
                out[`item_potion_${j}|${profile}`] = pace.supplyOf(`item_potion_${j}`, profile).perHour;
            }
        }
        return out;
    };

    it('is worked out in moments, each herb fed by all nine potions, whichever question is asked first', () => {
        const c = potionWebContent(POTIONS);
        const pace = buildPace(c, buildLedger(c), null);
        const maxed = pace.rateAt({ token: 'token_bush_0' }, PROFILE.MAXED);
        for (let j = 0; j < POTIONS; j++) expect(maxed.chosen.map(x => x.id)).toContain(`item_potion_${j}`);
        expect(maxed.scale).toBeCloseTo(1);
        // 900 herbs an hour, 90 % more with nine potions; each potion brewed as fast as the Still can, 1200 an hour.
        expect(pace.supplyOf('item_herb_0', PROFILE.MAXED).perHour).toBeCloseTo(1710);
        expect(pace.supplyOf('item_potion_0', PROFILE.MAXED).perHour).toBeCloseTo(1200);
        // Typical takes no potion (a potion costs more than its 10 % gives); Bare brews as fast as the Still can, fed by the bushes it needs.
        expect(pace.supplyOf('item_herb_0', PROFILE.TYPICAL).perHour).toBeCloseTo(900);
        expect(pace.supplyOf('item_potion_0', PROFILE.BARE).perHour).toBeCloseTo(1200);
        for (const row of pace.trackOf('construction').levels) {
            expect(row.hours.maxed).toBeLessThanOrEqual(row.hours.typical + 1e-9);
            expect(row.hours.typical).toBeLessThanOrEqual(row.hours.bare + 1e-9);
        }

        const brewFirst = buildPace(c, buildLedger(c), null);
        brewFirst.rateAt({ token: 'token_still', recipe: `recipe_potion_${POTIONS - 1}` }, PROFILE.MAXED);
        expect(supplies(brewFirst)).toEqual(supplies(pace));
    }, 10000);
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

    it('a stage with no way out to time, Bare out of its bounds, a long gather', () => {
        const f = findings();
        // The Starter Camp's budget, 35 minutes, times its way out (LedgerStageGate); this world has no world map, so no place to settle.
        expect(f.find(x => x.check === 'stage-budget' && x.key === 'stage:0')).toMatchObject({
            severity: 'info',
            message: expect.stringMatching(/^Starter Camp has no place of Plane 1 to settle, so its way out is not timed against its budget of 35 min\. Its full content \(\d+ entries, had .+ in\) is information\.$/)
        });
        // Against the curve: Bare past its 3x and, the curve's player being Maxed, Typical past its 2x.
        expect(f.filter(x => x.check === 'profile-bounds' && x.key === 'skill:construction').map(x => x.message.split(':')[0]).sort()).toEqual(['Bare', 'Typical']);
        expect(f.find(x => x.check === 'unlock-wall' && x.key === 'token:token_statue').message).toMatch(/gathering Oak Wood/);
    });

    it('Beer at +10 % XP is a true 10 % on a 1-XP cycle, so it stays under the consumable target', () => {
        // The buildings' own target is another matter: four Mines' sure double is past the 30 % once given a building.
        expect(findings().filter(x => x.check === 'boost-target' && /\(consumables\)/.test(x.message))).toEqual([]);
    });

    it('Guild Hall ranks that add no rate are named, not priced; Bunk Beds pay back in hours of wood', () => {
        const { pace } = world();
        const f = pace.findings();
        expect(f).toContainEqual(expect.objectContaining({ check: 'unmodelled', key: 'hall:bank_tabs' }));
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
    it('shows no Construction wall from the builds\' XP, only where one hero builds and gathers in turn, and the Copper Mine on copper ore, switchable', () => {
        const content = { items: load('items.json'), tokens: load('tokens.json'), recipes: load('tokenRecipes.json'), effects: load('effects.json'), starterCamp: load('starterCamp.json') };
        const ledger = buildLedger(content);
        const pace = buildPace(content, ledger, null);
        // The ledger fix pack raised the build recipes' XP; the wall the check found before is gone with heroes to spare.
        const spare = buildPace(content, ledger, { heroesByTier: [{ tier: 0, heroes: 8 }] });
        expect(spare.findings().filter(f => f.check === 'wall' && f.key === 'skill:construction')).toEqual([]);
        // With the reference guild's heroes, a Construction wall is only its chain short of heroes.
        for (const run of pace.walls('construction')) expect(run.source.chain).toBeLessThan(1);

        const vein = pace.rateAt({ token: 'token_copper_ore_vein' }, PROFILE.TYPICAL);
        expect(vein.chosen.map(c => c.id)).toContain('token_copper_mine');
        const mine = vein.rate.factors.find(f => f.id === 'support:token_copper_mine');
        expect(mine.axes).toContain('DOUBLE_DROP');
        const without = pace.book.rateOf({ token: 'token_copper_ore_vein' }, { ...vein.setup, off: ['support:token_copper_mine'] });
        // Each Copper Mine in reach is a 25 % double, and Typical stands it in as many places as pay back.
        const mines = pace.siteOf({ token: 'token_copper_ore_vein' }, PROFILE.TYPICAL).buildings.find(b => b.id === 'token_copper_mine').count;
        expect(mines).toBeGreaterThan(1);
        expect(without.items.item_copper_ore).toBeCloseTo(vein.rate.items.item_copper_ore / (1 + 0.25 * mines));

        // Every skill's levels: Maxed never slower than Typical, Typical never slower than Bare.
        for (const skill of pace.skills()) {
            for (const row of pace.trackOf(skill).levels) {
                expect([skill, row.level, row.hours.typical <= row.hours.bare + 1e-9]).toEqual([skill, row.level, true]);
                expect([skill, row.level, row.hours.maxed <= row.hours.typical + 1e-9]).toEqual([skill, row.level, true]);
            }
        }
    });
});
