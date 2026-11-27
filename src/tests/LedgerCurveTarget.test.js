import { describe, it, expect } from 'vitest';

import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildPace, PROFILE, TARGET } from '../../cms/src/engine/ledger/pace.js';
import { CHECKS } from '../../cms/src/engine/ledger/checks.js';
import {
    settingsOf, minutesPerLevelAt, minutesToReach, stageBudgetMs, DEFAULT_LEDGER_SETTINGS, boostBudgetAt,
} from '../../cms/src/engine/ledger/settings.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { paceContent } from './fixtures/paceWorld.js';
import { WORLD_FIXTURE_TABLES, worldWorkspace, contentOf as worldContentOf } from './fixtures/ledgerWorldMap.js';

/**
 * ⭐ The ledger follows the smooth curve and the optimized player (brief 880 L3, T-383, T-338 part 2):
 * the pace curve is one rule read from the settings (3 minutes at level 1, each level 6.25 % longer,
 * the owner's range 6 to 6.5 %), the stage budgets follow from it and the ladder; the curve's player
 * is Maxed, Typical stays within 2x the curve and Bare within 3x; supply counts the gatherers a
 * crafter needs rather than one hero per input; and every boost a profile holds is counted against
 * the boost budget, per tier and kind, with Maxed's speed never cut past 65 %.
 */

const paceOf = (content = paceContent(), settings = null) => buildPace(content, buildLedger(content), settings);
/** A batch factor every drink meets: Typical drinks what its own weighing takes, as these tests were written for. */
const ANY_BATCH = { batchPayback: 1e-6 };

describe('the pace curve is one rule', () => {
    it('⭐ is 3 minutes at level 1, each level 6.25 % longer: BALANCE_RULES section 1\'s points', () => {
        const s = settingsOf(null);
        expect(s.paceRule).toEqual({ startMinutes: 3, stepPct: 6.25, minPct: 6, maxPct: 6.5 });
        const points = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99].map(l => Math.round(minutesPerLevelAt(s, l)));
        expect(points).toEqual([3, 5, 9, 17, 32, 59, 107, 197, 361, 661, 1141]);
        for (const l of [1, 33, 98]) expect(minutesPerLevelAt(s, l)).toBeCloseTo(3 * 1.0625 ** (l - 1), 9);
        // One skill's climb, about 12.6 days for the curve's player.
        expect(minutesToReach(s, 99) / 1440).toBeCloseTo(12.65, 2);
        let sum = 0;
        for (let l = 1; l < 40; l++) sum += minutesPerLevelAt(s, l);
        expect(minutesToReach(s, 40)).toBeCloseTo(sum, 6);
    });

    it('reads the start and the step from the settings, the step kept within the owner\'s range, saved points ignored', () => {
        const s = settingsOf({ paceRule: { startMinutes: 4, stepPct: 6.5 }, paceCurve: [{ level: 1, minutesPerLevel: 99 }] });
        expect(minutesPerLevelAt(s, 1)).toBe(4);
        expect(minutesPerLevelAt(s, 11)).toBeCloseTo(4 * 1.065 ** 10, 9);
        expect(settingsOf({ paceRule: { stepPct: 9 } }).paceRule.stepPct).toBe(6.5);
        expect(settingsOf({ paceRule: { stepPct: 1 } }).paceRule.stepPct).toBe(6);
        expect(settingsOf({ paceRule: { stepPct: 7, maxPct: 8 } }).paceRule).toMatchObject({ stepPct: 7, maxPct: 8 });
        expect(settingsOf({ paceRule: 'x' }).paceRule).toEqual(DEFAULT_LEDGER_SETTINGS.paceRule);
        expect(settingsOf({ paceCurve: [{ level: 1, minutesPerLevel: 99 }] })).not.toHaveProperty('paceCurve');
    });

    it('⭐ sets each stage\'s budget: the curve\'s time to the level the next tier opens at, the last tier\'s to 99', () => {
        const s = settingsOf(null);
        const ends = [10, 20, 30, 40, 50, 60, 80, 99];
        expect(s.stages.map(x => x.tier)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
        s.stages.forEach((st, i) => expect(st.budgetMinutes, `tier ${st.tier}`).toBeCloseTo(minutesToReach(s, ends[i]), 6));
        expect(s.stages.map(x => x.endsAt)).toEqual(ends);
        expect(Math.round(stageBudgetMs(s, 2) / 60000)).toBe(230);
        // Hand budgets are not read: the curve and the ladder set them.
        const saved = settingsOf({ stages: [{ tier: 0, budgetMinutes: 5 }] });
        expect(saved.stages).toEqual(s.stages);
        const later = settingsOf({ tierLevels: [{ tier: 0, level: 1 }, { tier: 1, level: 15 }] });
        expect(later.stages.map(x => x.endsAt)).toEqual([15, 99]);
    });
});

describe('the curve\'s player is Maxed', () => {
    it('⭐ walls and long waits are read at Maxed; Typical and Bare against their bounds', () => {
        expect(TARGET).toBe(PROFILE.MAXED);
        const pace = paceOf();
        const track = pace.trackOf('construction');
        for (const run of pace.walls('construction')) {
            for (let l = run.from; l <= run.to; l++) {
                const row = track.levels[l - 1];
                expect(row.hours.maxed * 60 / row.curveMinutes).toBeGreaterThan(pace.settings.wallFactor);
            }
        }
        const wall = pace.findings().find(f => f.check === 'wall' && f.key === 'skill:construction');
        expect(wall.message).toMatch(/at Maxed/);
        expect(settingsOf(null).profileBounds).toEqual({ typical: 1.45, bare: 3, maxed: 3 });
        expect(settingsOf({ profileBounds: 4 }).profileBounds).toEqual({ typical: 1.45, bare: 4, maxed: 4 });
    });

    it('⭐ Typical over its bound is found, against the curve, where it was not before', () => {
        // Typical at most twice the curve: Construction's Typical climb to 15 is checked.
        const loose = paceOf(paceContent(), { profileBounds: { typical: 1000, bare: 1000, maxed: 1000 } });
        expect(loose.findings().filter(f => f.check === 'profile-bounds')).toEqual([]);
        const tight = paceOf(paceContent(), { profileBounds: { typical: 1.01, bare: 1000, maxed: 1000 } });
        const typical = tight.findings().filter(f => f.check === 'profile-bounds' && /^Typical/.test(f.message));
        expect(typical.length).toBeGreaterThan(0);
        expect(typical[0].message).toMatch(/bound 1\.01×/);
    });

    it('a stage is timed at Maxed against its budget', () => {
        const pace = paceOf();
        const stage = pace.stageOf(0);
        const slowest = Math.max(...stage.timed.map(t => t.hours));
        expect(stage.hours).toBe(slowest);
        expect(stage.profile).toBe(PROFILE.MAXED);
        expect(stage.hours).toBeCloseTo(Math.max(...stage.timed.map(t => pace.pathOf(t.key, PROFILE.MAXED).hours)), 9);
    });
});

describe('supply counts the gatherers a crafter needs', () => {
    it('⭐ a build is fed in full by as many foresters as it needs, and says how many', () => {
        const pace = paceOf();
        // 120 builds an hour want 15 wood each: 1800 an hour, the oak gives 900 to one forester at Bare.
        const hut = pace.rateAt({ token: 'token_plot', recipe: 'recipe_build_hut' }, PROFILE.BARE);
        expect(hut.scale).toBe(1);
        expect(hut.xp.construction).toBeCloseTo(600);
        expect(hut.gatherers.item_oak_wood.heroes).toBeCloseTo(2);
        expect(hut.gatherers.item_oak_wood.work.key).toBe('token_oak||');
        expect(pace.heroesOf({ token: 'token_plot', recipe: 'recipe_build_hut' }, PROFILE.BARE)).toBeCloseTo(3);
        // Fed in full, but the Starter Camp's one hero builds and fells in turn: a third as fast.
        const track = pace.trackOf('construction');
        expect(track.levels[13].cumulative.bare).toBeCloseTo(xpForLevel(15) / (600 / 3));
    });

    it('⭐ counts the heroes down a chain: an Ale from two Beers, each Beer from an Oak\'s wood', () => {
        const c = paceContent();
        c.items.item_ale = { id: 'item_ale', name: 'Ale', type: 'food', plan: { tier: 0 } };
        c.recipes.push({ id: 'recipe_ale', name: 'Ale', skill: 'cooking', levelRequirement: 1, stationKinds: ['still'], durationMs: 10000, xp: 1, inputs: [{ itemId: 'item_beer', quantity: 2 }], outputs: [{ itemId: 'item_ale', chance: 100, minQty: 1, maxQty: 1 }] });
        const pace = paceOf(c);
        const ale = { token: 'token_still', recipe: 'recipe_ale' };
        const r = pace.rateAt(ale, PROFILE.BARE);
        // 360 Ales an hour want 720 Beers; a brewer makes 360, so two brewers, each on 360 wood (0.4 of an Oak's 900).
        expect(r.gatherers.item_beer.heroes).toBeCloseTo(2);
        expect(pace.heroesOf(ale, PROFILE.BARE)).toBeCloseTo(1 + 2 * 1.4);
    });

    it('⭐ times a maker as the reference chain runs it: past the heroes its chain has, at their share of what it needs', () => {
        // A chain's heroes are the guild's, at most one maker and
        // `gatherersPerMaker` gatherers, and they share all its work, the maker's too (the 2.2 cap counted gatherers alone).
        const hut = { token: 'token_plot', recipe: 'recipe_build_hut' };
        const eight = [{ tier: 0, heroes: 8 }];
        const loose = paceOf(paceContent(), { heroesByTier: eight });
        // Eight heroes, a chain of one maker and one gatherer: two heroes for the Hut builder's three heroes' work.
        const tight = paceOf(paceContent(), { heroesByTier: eight, gatherersPerMaker: 1 });
        expect(tight.settings.gatherersPerMaker).toBe(1);
        // The count stays the full one.
        expect(tight.rateAt(hut, PROFILE.BARE).gatherers.item_oak_wood.heroes).toBeCloseTo(2);
        expect(tight.heroesOf(hut, PROFILE.BARE)).toBeCloseTo(3);
        expect(tight.chainOf(hut, PROFILE.BARE)).toBeCloseTo(2 / 3);
        expect(loose.chainOf(hut, PROFILE.BARE)).toBe(1);
        const first = (pace) => pace.trackOf('construction').levels[0];
        expect(first(loose).source.bare.xp).toBeCloseTo(600);
        expect(first(tight).source.bare.xp).toBeCloseTo(400);
        expect(first(tight).source.bare.chain).toBeCloseTo(2 / 3);
        expect(first(tight).hours.bare).toBeCloseTo(first(loose).hours.bare * 1.5);
        // The path waits on Construction 15 the longer.
        const gate = (pace) => pace.trackOf('construction').levels[13].cumulative.bare;
        expect(gate(tight)).toBeCloseTo(gate(loose) * 1.5);
        expect(tight.pathOf('token:token_big_hut', PROFILE.BARE).hours).toBeGreaterThan(loose.pathOf('token:token_big_hut', PROFILE.BARE).hours * 1.4);
    });

    it('⭐ finds a maker needing more gatherers than the reference guild gives one, at Typical', () => {
        // Two foresters a Hut builder: within the reference guild's 2.2 a maker, over 1.
        expect(paceOf().findings().filter(f => f.check === 'gatherers')).toEqual([]);
        expect(settingsOf(null).gatherersPerMaker).toBe(2.2);
        const tight = paceOf(paceContent(), { gatherersPerMaker: 1 }).findings().filter(f => f.check === 'gatherers');
        expect(tight.map(f => f.key)).toEqual(['skill:construction']);
        expect(tight[0].message).toMatch(/^Construction 1 → \d+ at Typical: Build \w+ at Plot needs 2 gatherers down its chain to run in full, over the reference guild's 1 a maker/);
        expect(CHECKS.gatherers).toMatchObject({ group: 'D' });
    });

    it('a drink or potion a boost spends is brewed by one hero, and counts no gatherer', () => {
        const pace = paceOf(paceContent(), ANY_BATCH);
        // Typical drinks Beer at the vein: one brewer at the Still, not counted as the vein's gatherer.
        const vein = pace.rateAt({ token: 'token_vein' }, PROFILE.TYPICAL);
        expect(vein.chosen.map(c => c.id)).toContain('item_beer');
        expect(vein.rate.boostInputs.item_beer).toBeGreaterThan(0);
        expect(vein.brewers.item_beer.heroes).toBeGreaterThan(0);
        expect(vein.brewers.item_beer.heroes).toBeLessThanOrEqual(1);
        expect(vein.gatherers).toEqual({});
        expect(pace.heroesOf({ token: 'token_vein' }, PROFILE.TYPICAL)).toBe(1);
    });

    it('⭐ prices a made thing in the hero-hours of its whole chain: a Beer is its brewer and two fifths of a forester', () => {
        const pace = paceOf();
        // 360 Beers an hour at the Still want 360 wood: 0.4 of a forester's 900.
        expect(pace.heroHoursOf('item_beer', PROFILE.BARE)).toBeCloseTo(1.4 / 360, 9);
        expect(pace.heroHoursOf('item_oak_wood', PROFILE.BARE)).toBeCloseTo(1 / 900, 9);
    });

    it('an input nothing makes still starves its work', () => {
        const c = paceContent();
        c.items.item_nothing = { id: 'item_nothing', name: 'Nothing', type: 'material', plan: { tier: 0 } };
        c.recipes.push({ id: 'recipe_odd', name: 'Odd', skill: 'cooking', levelRequirement: 1, stationKinds: ['still'], durationMs: 10000, xp: 1, inputs: [{ itemId: 'item_nothing', quantity: 1 }], outputs: [{ itemId: 'item_beer', chance: 100, minQty: 1, maxQty: 1 }] });
        const r = paceOf(c).rateAt({ token: 'token_still', recipe: 'recipe_odd' }, PROFILE.BARE);
        expect(r.scale).toBe(0);
        expect(r.short).toBe('item_nothing');
    });
});

describe('the boost budget', () => {
    it('⭐ judges a work by the cell of the tier its entry is planned for, not its level alone', () => {
        // A Rush Hut cuts the vein's work 25 %: over copper's 20 % at Maxed, within silver's 35 %.
        const c = paceContent();
        c.tokens.token_rush = { id: 'token_rush', name: 'Rush Hut', tokenType: 'buff', uses: null, requiresHero: false, config: null, statements: [{ id: 'stm_rush', keyword: 'provides', to: { mode: 'id', value: 'token_vein' }, reach: 'nearby', payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.25 } }] };
        c.recipes.push({ id: 'recipe_build_rush', name: 'Build Rush Hut', skill: 'construction', levelRequirement: 1, xp: 5, durationMs: 30000, foundationKinds: ['wood'], inputs: [{ itemId: 'item_oak_wood', quantity: 5 }], outputs: [{ tokenId: 'token_rush', chance: 100, minQty: 1, maxQty: 1 }] });
        // One place a kind, so the Rush Hut stands once: the cell is what is tested, not how copies stack.
        const one = { sitePlaces: { buildings: 8, perKind: 1 } };
        const speedOf = (pace) => pace.budgetRows().find(r => r.work.key === 'token_vein||' && r.kind === 'speed' && r.profile === PROFILE.MAXED);
        const copper = speedOf(paceOf(c, one));
        expect(copper).toMatchObject({ budget: 20, tier: 0 });
        expect(copper.pct).toBeCloseTo(25);
        // Planned for silver (tier 3), it is held against silver's cell from its opening, level 1 or not.
        c.tokens.token_vein.plan = { tier: 3 };
        const silver = speedOf(paceOf(c, one));
        expect(silver).toMatchObject({ budget: 35, entryTier: 3, level: 1 });
        expect(paceOf(c, one).findings().filter(f => f.check === 'boost-budget' && /^Speed at Maxed/.test(f.message) && f.related.includes('token:token_vein'))).toEqual([]);
    });

    it('⭐ judges a work by the tier it is had at, where its entry is planned earlier', () => {
        // A ring-3 node (tier 3 on the world map) planned for Plane 1, cut 30 % by a hut in the camp:
        // over Plane 1's cell, within silver's 35 %, the cell of the tier where the boost is held.
        const ws = worldWorkspace();
        ws.tokens.token_rush = { id: 'token_rush', name: 'Rush Hut', tokenType: 'buff', uses: null, requiresHero: false, config: null, statements: [{ id: 'stm_rush', keyword: 'provides', to: { mode: 'id', value: 'token_ores_3' }, reach: 'nearby', payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.3 } }] };
        ws.starterCamp.tokens.push({ typeId: 'token_rush', x: 9, y: 9 });
        ws.tokens.token_ores_3.plan = { tier: 1 };
        const content = { ...worldContentOf(ws), worldTables: WORLD_FIXTURE_TABLES };
        // One place a kind, so the hut stands once: the cell is what is tested.
        const pace = buildPace(content, buildLedger(content), { sitePlaces: { buildings: 8, perKind: 1 } });
        const row = pace.budgetRows().find(r => r.work.key === 'token_ores_3||' && r.kind === 'speed' && r.profile === PROFILE.MAXED);
        expect(row).toMatchObject({ tier: 3, entryTier: 3, budget: 35 });
        expect(row.pct).toBeCloseTo(30);
    });

    it('⭐ holds BALANCE_RULES section 5\'s table, the 65 % speed cap its last row', () => {
        const s = settingsOf(null);
        expect(s.boostBudget.map(r => r.tier)).toEqual([0, 2, 3, 4, 5, 6, 7]);
        expect(s.boostBudget[0]).toEqual({ tier: 0, speed: { typical: 15, maxed: 20 }, xp: { typical: 7.5, maxed: 10 }, yield: { typical: 7.5, maxed: 10 }, rare: { typical: 0, maxed: 100 } });
        expect(s.boostBudget[6]).toEqual({ tier: 7, speed: { typical: 45, maxed: 60 }, xp: { typical: 15, maxed: 20 }, yield: { typical: 157.5, maxed: 210 }, rare: { typical: 50, maxed: 250 } });
        expect(s.speedCapPct).toBe(65);
        // Speed and XP climb level by level between tier openings; yield and rare finds step.
        expect(boostBudgetAt(s, 25)).toMatchObject({ speed: { typical: 24.375, maxed: 32.5 }, yield: { typical: 45, maxed: 60 } });
        expect(boostBudgetAt(s, 1)).toMatchObject({ speed: { typical: 15, maxed: 20 } });
        expect(boostBudgetAt(s, 95)).toMatchObject({ speed: { typical: 45, maxed: 60 } });
    });

    it('defaults hold the balancer yield column (2026-11-26), three quarters of it at Typical', () => {
        const s = settingsOf(null);
        const maxed = { 0: 10, 2: 60, 3: 60, 4: 110, 5: 110, 6: 160, 7: 210 };
        for (const r of s.boostBudget) {
            expect(r.yield.maxed).toBe(maxed[r.tier]);
            expect(r.yield.typical).toBe(0.75 * r.yield.maxed);
        }
    });

    it('leaves world events and bonus drops out of the boost budget check', () => {
        // A Rush Hut cuts the vein's work 70 %: over the cap. Tagged a world event, it is not counted.
        const rush = (tags) => {
            const c = paceContent();
            c.tokens.token_rush = { id: 'token_rush', name: 'Rush Hut', tokenType: 'buff', tags, uses: null, requiresHero: false, config: null, statements: [{ id: 'stm_rush', keyword: 'provides', to: { mode: 'id', value: 'token_vein' }, reach: 'nearby', payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.7 } }] };
            c.recipes.push({ id: 'recipe_build_rush', name: 'Build Rush Hut', skill: 'construction', levelRequirement: 1, xp: 5, durationMs: 30000, foundationKinds: ['wood'], inputs: [{ itemId: 'item_oak_wood', quantity: 5 }], outputs: [{ tokenId: 'token_rush', chance: 100, minQty: 1, maxQty: 1 }] });
            return paceOf(c).budgetRows().find(r => r.work.key === 'token_vein||' && r.kind === 'speed' && r.profile === PROFILE.MAXED);
        };
        expect(rush([]).pct).toBeGreaterThan(65);
        expect(rush(['Event'])?.pct ?? 0).toBeLessThan(65);
        // A Gem Hut adds a bonus drop of the gem the vein already finds now and then: no rare-finds total from it.
        const gems = (grant) => {
            const c = paceContent();
            c.items.item_gem = { id: 'item_gem', name: 'Gem', type: 'material', plan: { tier: 0 } };
            c.tokens.token_vein.config.outputs.push({ itemId: 'item_gem', chance: 1, minQty: 1, maxQty: 1 });
            c.tokens.token_gem_hut = { id: 'token_gem_hut', name: 'Gem Hut', tokenType: 'buff', tags: [], uses: null, requiresHero: false, config: null, statements: [grant] };
            c.recipes.push({ id: 'recipe_build_gem_hut', name: 'Build Gem Hut', skill: 'construction', levelRequirement: 1, xp: 5, durationMs: 30000, foundationKinds: ['wood'], inputs: [{ itemId: 'item_oak_wood', quantity: 5 }], outputs: [{ tokenId: 'token_gem_hut', chance: 100, minQty: 1, maxQty: 1 }] });
            return paceOf(c).budgetRows().find(r => r.work.key === 'token_vein||' && r.kind === 'rare' && r.profile === PROFILE.MAXED);
        };
        // The same gems doubled half the time count as rare finds; as a bonus drop they are not counted.
        const doubled = gems({ id: 'stm_double', keyword: 'provides', to: { mode: 'id', value: 'token_vein' }, reach: 'nearby', payload: { type: 'DOUBLE_DROP', bucket: 'flat', value: 50, category: 'item_gem' } });
        expect(doubled.pct).toBeGreaterThan(40);
        const bonus = gems({ id: 'stm_gem', keyword: 'grants', to: { mode: 'id', value: 'token_vein' }, reach: 'nearby', payload: { type: 'BONUS_DROP', itemId: 'item_gem', quantity: 1, chance: 5 } });
        expect(bonus?.pct ?? 0).toBeLessThan(1);
    });

    it('defaults hold three quarters of each speed and XP boost at Typical', () => {
        const s = settingsOf(null);
        expect(s.profileBounds.typical).toBe(1.45);
        const rows = { 0: [15, 7.5], 2: [22.5, 7.5], 3: [26.25, 11.25], 4: [30, 11.25], 5: [33.75, 15], 6: [37.5, 15], 7: [45, 15] };
        for (const r of s.boostBudget) {
            expect(r.speed.typical).toBe(rows[r.tier][0]);
            expect(r.xp.typical).toBe(rows[r.tier][1]);
            expect(r.speed.typical).toBe(0.75 * r.speed.maxed);
            expect(r.xp.typical).toBe(0.75 * r.xp.maxed);
        }
    });

    it('⭐ counts every boost a profile holds against its cell, and finds a total over it', () => {
        // Beer's +10 % XP is the whole of copper's XP budget at Maxed: within it. Typical drinks it too, twice its 5 %.
        const pace = paceOf(paceContent(), ANY_BATCH);
        const vein = pace.budgetRows().filter(r => r.work.key === 'token_vein||');
        const xp = vein.find(r => r.kind === 'xp' && r.profile === PROFILE.MAXED);
        expect(xp.pct).toBeCloseTo(10);
        expect(xp.budget).toBe(10);
        const found = pace.findings().filter(f => f.check === 'boost-budget');
        expect(found.filter(f => /^XP at Maxed/.test(f.message))).toEqual([]);
        expect(found.find(f => /^XP at Typical/.test(f.message)).message).toMatch(/6 pieces of work over the boost budget, .*\+10 % against 8 %/);
        expect(vein.find(r => r.kind === 'xp' && r.profile === PROFILE.TYPICAL)).toMatchObject({ budget: 7.5 });
        // Halve the budget and it is over.
        const tight = paceOf(paceContent(), { boostBudget: [{ tier: 0, speed: { typical: 10, maxed: 20 }, xp: { typical: 2, maxed: 5 }, yield: { typical: 50, maxed: 50 }, rare: { typical: 0, maxed: 100 } }] });
        const over = tight.findings().filter(f => f.check === 'boost-budget');
        expect(over.some(f => /^XP at Maxed: \d+ pieces of work over the boost budget/.test(f.message) && f.related.includes('token:token_vein'))).toBe(true);
        expect(tight.budgetRows().find(r => r.work.key === 'token_vein||' && r.kind === 'xp' && r.profile === PROFILE.MAXED)).toMatchObject({ budget: 5 });
        expect(CHECKS['boost-budget']).toMatchObject({ group: 'D' });
    });

    it('⭐ finds Maxed\'s speed cut past the cap', () => {
        const c = paceContent();
        c.tokens.token_rush = { id: 'token_rush', name: 'Rush Hut', tokenType: 'buff', uses: null, requiresHero: false, config: null, statements: [{ id: 'stm_rush', keyword: 'provides', to: { mode: 'id', value: 'token_vein' }, reach: 'nearby', payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.7 } }] };
        c.recipes.push({ id: 'recipe_build_rush', name: 'Build Rush Hut', skill: 'construction', levelRequirement: 1, xp: 5, durationMs: 30000, foundationKinds: ['wood'], inputs: [{ itemId: 'item_oak_wood', quantity: 5 }], outputs: [{ tokenId: 'token_rush', chance: 100, minQty: 1, maxQty: 1 }] });
        const pace = paceOf(c);
        const speed = pace.budgetRows().find(r => r.work.key === 'token_vein||' && r.kind === 'speed' && r.profile === PROFILE.MAXED);
        expect(speed.pct).toBeGreaterThan(65);
        const cap = pace.findings().filter(f => f.check === 'boost-budget' && /cap/.test(f.message));
        expect(cap.length).toBe(1);
        expect(cap[0].message).toMatch(/Copper Vein/);
    });
});
