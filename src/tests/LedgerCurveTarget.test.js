import { describe, it, expect } from 'vitest';

import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildPace, PROFILE, TARGET } from '../../cms/src/engine/ledger/pace.js';
import { CHECKS } from '../../cms/src/engine/ledger/checks.js';
import {
    settingsOf, minutesPerLevelAt, minutesToReach, stageBudgetMs, DEFAULT_LEDGER_SETTINGS, boostBudgetAt,
} from '../../cms/src/engine/ledger/settings.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { paceContent } from './fixtures/paceWorld.js';

/**
 * ⭐ The ledger follows the smooth curve and the optimized player (brief 880 L3, T-383, T-338 part 2):
 * the pace curve is one rule read from the settings (3 minutes at level 1, each level 6.25 % longer,
 * the owner's range 6 to 6.5 %), the stage budgets follow from it and the ladder; the curve's player
 * is Maxed, Typical stays within 2x the curve and Bare within 3x; supply counts the gatherers a
 * crafter needs rather than one hero per input; and every boost a profile holds is counted against
 * the boost budget, per tier and kind, with Maxed's speed never cut past 65 %.
 */

const paceOf = (content = paceContent(), settings = null) => buildPace(content, buildLedger(content), settings);

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
        expect(settingsOf(null).profileBounds).toEqual({ typical: 2, bare: 3, maxed: 3 });
        expect(settingsOf({ profileBounds: 4 }).profileBounds).toEqual({ typical: 2, bare: 4, maxed: 4 });
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
        const track = pace.trackOf('construction');
        expect(track.levels[13].cumulative.bare).toBeCloseTo(xpForLevel(15) / 600);
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
    it('⭐ holds BALANCE_RULES section 5\'s table, the 65 % speed cap its last row', () => {
        const s = settingsOf(null);
        expect(s.boostBudget.map(r => r.tier)).toEqual([0, 2, 3, 4, 5, 6, 7]);
        expect(s.boostBudget[0]).toEqual({ tier: 0, speed: { typical: 10, maxed: 20 }, xp: { typical: 5, maxed: 10 }, yield: { typical: 2, maxed: 27 }, rare: { typical: 0, maxed: 100 } });
        expect(s.boostBudget[6]).toEqual({ tier: 7, speed: { typical: 30, maxed: 60 }, xp: { typical: 10, maxed: 20 }, yield: { typical: 300, maxed: 400 }, rare: { typical: 50, maxed: 250 } });
        expect(s.speedCapPct).toBe(65);
        // Speed and XP climb level by level between tier openings; yield and rare finds step.
        expect(boostBudgetAt(s, 25)).toMatchObject({ speed: { typical: 16.5, maxed: 32.5 }, yield: { typical: 41, maxed: 77 } });
        expect(boostBudgetAt(s, 1)).toMatchObject({ speed: { typical: 10, maxed: 20 } });
        expect(boostBudgetAt(s, 95)).toMatchObject({ speed: { typical: 30, maxed: 60 } });
    });

    it('⭐ counts every boost a profile holds against its cell, and finds a total over it', () => {
        // Beer's +10 % XP is the whole of copper's XP budget at Maxed: within it. Typical drinks it too, twice its 5 %.
        const pace = paceOf();
        const vein = pace.budgetRows().filter(r => r.work.key === 'token_vein||');
        const xp = vein.find(r => r.kind === 'xp' && r.profile === PROFILE.MAXED);
        expect(xp.pct).toBeCloseTo(10);
        expect(xp.budget).toBe(10);
        const found = pace.findings().filter(f => f.check === 'boost-budget');
        expect(found.filter(f => /^XP at Maxed/.test(f.message))).toEqual([]);
        expect(found.find(f => /^XP at Typical/.test(f.message)).message).toMatch(/6 pieces of work over the boost budget, .*\+10 % against 5 %/);
        expect(vein.find(r => r.kind === 'xp' && r.profile === PROFILE.TYPICAL)).toMatchObject({ budget: 5 });
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
