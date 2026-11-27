import { describe, it, expect } from 'vitest';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildPace } from '../../cms/src/engine/ledger/pace.js';
import { settingsOf, paybackHoursAt } from '../../cms/src/engine/ledger/settings.js';
import { CHECKS, runChecks } from '../../cms/src/engine/ledger/checks.js';
import { DOSE, DOSE_LENGTH } from '../systems/core/consumableRule.js';
import { ledgerReadout, readoutText } from '../../cms/src/engine/ledgerReadout.js';
import { hallRows } from '../../cms/src/engine/ledgerPace.js';
import { ruleContent } from './fixtures/ruleChecksWorld.js';

/**
 * Three checks the balance rules promise (BALANCE_RULES sections 1 and 5): a chain's total XP per
 * raw unit against its tier's median, a drink or work potion's batch paying back at least 4x its
 * making, and a Guild Hall rank's payback over all the work it boosts, on the payback curve. On the
 * pace world (`fixtures/paceWorld.js`) with a second vein, three chains at the Still and the small
 * sky (`fixtures/paceHallSky.js`). The dose length the batch check reads is the game's: the same
 * check with another dose length is `LedgerBatchDose.test.js`.
 */

const paceOf = (c, settings = null) => buildPace(c, buildLedger(c), settings);

describe("a chain's total XP per raw unit, against its tier's median", () => {
    it('every link pays its own XP, at its authored numbers, over the raw units the chain takes', () => {
        const pace = paceOf(ruleContent({ sky: false }));
        const rows = pace.chainXpRows();
        const row = (item) => rows.find(r => r.item === item);
        // The vein gives 1 to 2 ore a cycle for 1 XP: 2/3 XP an ore; the oak 1 XP a wood.
        expect(row('item_beer')).toMatchObject({ tier: 0, links: 2 });
        expect(row('item_beer').perRaw).toBeCloseTo(2);
        expect(row('item_plank').perRaw).toBeCloseTo(2);
        // Cake: 10 + 2 Mash (3 + 2 ore each): 18.67 XP over 4 ore.
        expect(row('item_cake')).toMatchObject({ links: 3 });
        expect(row('item_cake').xp).toBeCloseTo(10 + 2 * (3 + 2 * 2 / 3));
        expect(row('item_cake').raw).toBeCloseTo(4);
        // Mash is spent by Cake: not a chain's end.
        expect(row('item_mash')).toBeUndefined();
        expect(row('item_cake').median).toBeCloseTo(2);
        expect(row('item_cake').off).toBeCloseTo((10 + 2 * (3 + 4 / 3)) / 4 / 2 - 1);
    });

    it('a chain past the tolerance from its median is a finding; one near it is not', () => {
        const pace = paceOf(ruleContent({ sky: false }));
        const f = pace.findings().filter(x => x.check === 'chain-xp');
        expect(f.map(x => x.key)).toEqual(['item:item_cake']);
        expect(f[0].message).toMatch(/Copper Cake \(Starter Camp, a chain of 3 links\) pays 4\.67 XP per raw unit \(18\.67 XP over 4 raw\), 133 % over its tier's median of 2 XP \(±25 %; BALANCE_RULES section 1/);
        expect(f[0].message).toMatch(/BALANCE_RULES section 1/);
        expect(CHECKS['chain-xp'].group).toBe('D');
        // A wider tolerance lets it pass.
        expect(paceOf(ruleContent({ sky: false }), { tolerancePct: 150 }).findings().some(x => x.check === 'chain-xp')).toBe(false);
    });

    it('a tier with fewer than three chains has no median and flags nothing', () => {
        const c = ruleContent({ sky: false });
        c.recipes = c.recipes.filter(r => r.id !== 'recipe_plank');
        const rows = paceOf(c).chainXpRows();
        expect(rows.every(r => r.median === null && r.off === null)).toBe(true);
        expect(paceOf(c).findings().some(x => x.check === 'chain-xp')).toBe(false);
    });
});

describe("a drink or work potion's batch pays back at least 4x its making", () => {
    it('the work a dose saves, over the hero time its doses take to make, ingredients included, at the game\'s dose length', () => {
        const pace = paceOf(ruleContent({ sky: false }));
        const beer = pace.batchPaybackRows().find(r => r.item === 'item_beer');
        expect(beer).toBeTruthy();
        expect(beer.doseCycles).toBeCloseTo(DOSE_LENGTH[DOSE.DRINK]);
        expect(beer.unitHours).toBeCloseTo(pace.heroHoursOf('item_beer', 'bare', beer.cap));
        expect(beer.spends).toBeCloseTo(beer.doses * beer.unitHours);
        expect(beer.ratio).toBeCloseTo(beer.gain / beer.spends);
        // +10 % XP for ten cycles of a 3 s vein, for a 10 s brew of one 4 s oak: well short of 4x.
        expect(beer.ratio).toBeLessThan(settingsOf().batchPayback);
        expect(settingsOf().batchPayback).toBe(4);
    });

    it('a batch short of the factor is a finding, named with its best work and what to change', () => {
        const pace = paceOf(ruleContent({ sky: false }));
        const f = pace.findings().filter(x => x.check === 'batch-payback');
        expect(f.map(x => x.key)).toEqual(['item:item_beer']);
        expect(f[0].message).toMatch(/^Beer: a dose lasts 10 cycles of /);
        expect(f[0].message).toMatch(/under the 4× a batch must pay back \(BALANCE_RULES section 5/);
        // A lower factor lets it pass.
        const ratio = pace.batchPaybackRows().find(r => r.item === 'item_beer').ratio;
        expect(paceOf(ruleContent({ sky: false }), { batchPayback: ratio * 0.9 }).findings().some(x => x.check === 'batch-payback')).toBe(false);
    });
});

describe('Typical takes a drink or work potion only where its batch pays back', () => {
    const takes = (pace, row, profile) => (pace.profiles.profileOf(row.work.target, profile, row.cap).setup.consumables || []).includes(row.item);
    // Three beers a brew: worth its making (Typical's own weighing alone would take it), short of 4x.
    const threeBeers = () => {
        const c = ruleContent({ sky: false });
        const brew = c.recipes.find(r => r.id === 'recipe_beer').outputs[0];
        brew.minQty = brew.maxQty = 3;
        return c;
    };

    it('Typical leaves a drink whose batch pays back under the factor; Maxed still takes it; Bare takes none', () => {
        const pace = paceOf(threeBeers());
        const beer = pace.batchPaybackRows().find(r => r.item === 'item_beer');
        expect(beer.ratio).toBeGreaterThan(1);
        expect(beer.ratio).toBeLessThan(settingsOf().batchPayback);
        expect(takes(pace, beer, 'typical')).toBe(false);
        expect(takes(pace, beer, 'maxed')).toBe(true);
        expect(takes(pace, beer, 'bare')).toBe(false);
    });

    it('a factor its batch meets lets Typical take it, by the same measure as the batch-payback check', () => {
        const ratio = paceOf(threeBeers()).batchPaybackRows().find(r => r.item === 'item_beer').ratio;
        const low = paceOf(threeBeers(), { batchPayback: ratio * 0.99 });
        const beer = low.batchPaybackRows().find(r => r.item === 'item_beer');
        expect(beer.ratio).toBeCloseTo(ratio);
        expect(takes(low, beer, 'typical')).toBe(true);
        expect(takes(paceOf(threeBeers(), { batchPayback: ratio * 1.01 }), beer, 'typical')).toBe(false);
    });
});

describe("a Guild Hall rank's payback over all the work it boosts, on the payback curve", () => {
    const rowOf = (pace, id, rank) => pace.hallGuildPaybacks().find(r => r.id === id && r.rank === rank);
    const twoHeroes = { heroesByTier: [{ tier: 0, heroes: 2 }] };

    it('the payback curve is 1 hour x 24^(L / 80)', () => {
        expect(paybackHoursAt(0)).toBeCloseTo(1);
        expect(paybackHoursAt(20)).toBeCloseTo(2.21, 2);
        expect(paybackHoursAt(80)).toBeCloseTo(24);
    });

    it('counts every boosted work the guild\'s heroes can work at once, not the one it saves most on', () => {
        const pace = paceOf(ruleContent(), twoHeroes);
        const gold = rowOf(pace, 'ph_gold', 1);
        const one = pace.hallPaybacks().find(r => r.id === 'ph_gold' && r.rank === 1);
        const saves = ['token_vein', 'token_tin_vein'].map(t => pace.profiles.hallRankOn({ token: t }, 0, 'ph_gold', 1).saves);
        expect(saves.every(s => s > 0)).toBe(true);
        expect(gold).toMatchObject({ heroes: 2, works: 2, counted: 2 });
        expect(gold.gain).toBeCloseTo(saves[0] + saves[1]);
        expect(gold.gain).toBeGreaterThan(one.gain);
        expect(gold.payback).toBeCloseTo(gold.cost / gold.gain);
        expect(gold.curve).toBeCloseTo(paybackHoursAt(1));
        // One hero works one of them at a time.
        const lone = rowOf(paceOf(ruleContent(), { heroesByTier: [{ tier: 0, heroes: 1 }] }), 'ph_gold', 1);
        expect(lone).toMatchObject({ heroes: 1, works: 2, counted: 1 });
        expect(lone.gain).toBeCloseTo(Math.max(...saves));
    });

    it('a rank slower than the curve past the tolerance warns; one far faster is information', () => {
        const pace = paceOf(ruleContent(), twoHeroes);
        const f = pace.findings().filter(x => x.check === 'hall-guild-payback');
        const gold = f.find(x => x.key === 'hall:ph_gold');
        expect(gold.severity).toBe('warn');
        expect(gold.message).toMatch(/Gold Leaf rank 1 \(Starter Camp\) costs .* at Typical and saves .* over all the work it boosts \(2 pieces of work, the 2 best for the guild's 2 heroes\): it pays back in .*, \d+× the payback curve's 1 h 2 min at level 1/);
        const lore = f.find(x => x.key === 'hall:ph_lore');
        expect(lore.severity).toBe('info');
        expect(lore.message).toMatch(/under the payback curve's/);
        expect(CHECKS['hall-guild-payback'].group).toBe('D');
        // Within the tolerance, nothing.
        const row = rowOf(pace, 'ph_gold', 1);
        const wide = paceOf(ruleContent(), { ...twoHeroes, tolerancePct: (row.off + 1) * 100 });
        expect(wide.findings().some(x => x.check === 'hall-guild-payback' && x.key === 'hall:ph_gold')).toBe(false);
    });

    it('the three checks reach the ledger\'s list as the other pacing checks do', () => {
        const c = ruleContent();
        const ledger = buildLedger(c);
        const pace = buildPace(c, ledger, twoHeroes);
        const all = runChecks(ledger, c, { extra: pace.findings() });
        for (const check of ['chain-xp', 'batch-payback', 'hall-guild-payback']) expect(all.some(x => x.check === check)).toBe(true);
    });
});

describe('the read-out and the Ledger page carry them', () => {
    const workspace = () => {
        const c = ruleContent();
        const recipePools = {};
        for (const r of c.recipes) (recipePools[r.skill] ||= []).push(r);
        return { items: c.items, tokens: c.tokens, effects: c.effects, recipePools, starterCamp: c.starterCamp, hallConstellations: c.hallSky.constellations, hallStars: c.hallSky.stars, skillPerks: null };
    };

    it('the read-out holds each check\'s rows, its findings among the checks, and a summary line', () => {
        const out = ledgerReadout(workspace(), { layouts: false });
        const rc = out.ruleChecks;
        expect(rc.tolerancePct).toBe(25);
        expect(rc.chainXp.find(c => c.item === 'item_cake')).toMatchObject({ links: 3, perRaw: 4.667, median: 2, offPct: 133.3, off: true });
        expect(rc.chainXp.find(c => c.item === 'item_plank')).toMatchObject({ off: false });
        expect(rc.batches.factor).toBe(4);
        expect(rc.batches.rows.find(b => b.item === 'item_beer')).toMatchObject({ doseCycles: DOSE_LENGTH[DOSE.DRINK], short: true });
        expect(rc.hallGuild.find(h => h.id === 'ph_gold' && h.rank === 1)).toMatchObject({ off: true });
        for (const check of ['chain-xp', 'batch-payback', 'hall-guild-payback']) expect(out.checks.some(x => x.check === check), check).toBe(true);
        expect(readoutText(out).join('\n')).toMatch(/Rule checks \(±25 %\): 3 chains, 1 off their tier's median XP per raw unit; 1 drink and potion batches, 1 under 4x their making; \d+ Guild Hall ranks over all their work, \d+ slower and \d+ quicker than the payback curve\./);
    });

    it('the Hall paybacks table has the payback over all the work beside the one-work payback', () => {
        const pace = paceOf(ruleContent(), { heroesByTier: [{ tier: 0, heroes: 2 }] });
        const gold = hallRows(pace).find(r => r.id === 'ph_gold' && r.rank === 1);
        expect(gold.guild).toMatchObject({ off: true, slow: true });
        expect(gold.guild.text).toMatch(/ on 2 works$/);
        expect(gold.guild.curveText).toBe('curve 1 h 2 min');
        expect(hallRows(pace).find(r => r.id === 'ph_infirmary' && r.rank === 1).guild).toBeNull();
    });
});
