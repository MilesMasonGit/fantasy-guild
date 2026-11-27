import { describe, it, expect } from 'vitest';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildPace, roundDown } from '../../cms/src/engine/ledger/pace.js';
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

describe("a chain's XP per hour of the gathering behind it, against its tier's median", () => {
    it('every link pays its own XP, at its authored numbers, over the hours its raw inputs take to gather', () => {
        const pace = paceOf(ruleContent({ sky: false }));
        const rows = pace.chainXpRows();
        const row = (item) => rows.find(r => r.item === item);
        // Each raw input at its own Bare source's rate.
        const perHour = (item) => pace.supplyOf(item, 'bare', 0).perHour;
        // The vein gives 1 to 2 ore a cycle for 1 XP: 2/3 XP an ore; the oak 1 XP a wood.
        expect(row('item_beer')).toMatchObject({ tier: 0, links: 2 });
        expect(row('item_plank').xp).toBeCloseTo(2);
        expect(row('item_plank').rawHours * perHour('item_oak_wood')).toBeCloseTo(1);
        expect(row('item_plank').xpPerHour).toBeCloseTo(2 * perHour('item_oak_wood'));
        // Cake: 30 + 2 Mash (3 + 2 ore each): 38.67 XP over 4 ore's gathering.
        expect(row('item_cake')).toMatchObject({ links: 3 });
        expect(row('item_cake').xp).toBeCloseTo(30 + 2 * (3 + 2 * 2 / 3));
        expect(row('item_cake').raw).toBeCloseTo(4);
        expect(row('item_cake').rawHours * perHour('item_copper_ore')).toBeCloseTo(4);
        expect(row('item_cake').xpPerHour).toBeCloseTo(row('item_cake').xp / row('item_cake').rawHours);
        // Mash is spent by Cake: not a chain's end.
        expect(row('item_mash')).toBeUndefined();
        const median = [...rows.map(r => r.xpPerHour)].sort((x, y) => x - y)[1];
        expect(row('item_cake').median).toBeCloseTo(median);
        expect(row('item_cake').off).toBeCloseTo(row('item_cake').xpPerHour / median - 1);
    });

    it('a rare drop counts at its find rate', () => {
        const c = ruleContent({ sky: false });
        c.items.item_gem = { id: 'item_gem', name: 'Gem', type: 'material', plan: { tier: 0 } };
        c.items.item_ring = { id: 'item_ring', name: 'Gem Ring', type: 'material', plan: { tier: 0 } };
        c.tokens.token_vein.rareTable = { chance: 1, entries: [{ itemId: 'item_gem', weight: 1, minQty: 1, maxQty: 1 }] };
        c.recipes.push({ ...c.recipes.find(r => r.id === 'recipe_plank'), id: 'recipe_ring', name: 'Gem Ring', inputs: [{ itemId: 'item_gem', quantity: 1 }], outputs: [{ itemId: 'item_ring', chance: 100, minQty: 1, maxQty: 1 }] });
        const pace = paceOf(c);
        const ring = pace.chainXpRows().find(r => r.item === 'item_ring');
        const gemPerHour = pace.supplyOf('item_gem', 'bare', 0).perHour;
        expect(gemPerHour).toBeLessThan(pace.supplyOf('item_copper_ore', 'bare', 0).perHour / 50);
        expect(ring.rawHours * gemPerHour).toBeCloseTo(1);
        expect(ring.raw).toBeCloseTo(1);
    });

    it('past the tolerance is information; beyond twice or half its median, a warning', () => {
        // The Cake at 30 XP is 93 % over its median, within twice it: information.
        const info = paceOf(ruleContent({ sky: false })).findings().filter(x => x.check === 'chain-xp');
        expect(info.map(x => [x.key, x.severity])).toEqual([['item:item_cake', 'info']]);
        expect(info[0].message).toMatch(/Information: within the warning factor\.$/);
        // At 60 XP it is over three times it: a warning.
        const c = ruleContent({ sky: false });
        c.recipes.find(r => r.id === 'recipe_cake').xp = 60;
        const pace = paceOf(c);
        const f = pace.findings().filter(x => x.check === 'chain-xp');
        const rows = pace.chainXpRows();
        const past = rows.filter(r => r.off !== null && Math.abs(r.off) > 0.25);
        expect(past.length).toBeGreaterThan(0);
        expect(f.map(x => x.key).sort()).toEqual(past.map(r => `item:${r.item}`).sort());
        expect(settingsOf().chainXpWarnFactor).toBe(2);
        for (const r of past) {
            const ratio = r.off + 1;
            const finding = f.find(x => x.key === `item:${r.item}`);
            expect([r.item, finding.severity]).toEqual([r.item, ratio > 2 || ratio < 1 / 2 ? 'warn' : 'info']);
        }
        const cake = f.find(x => x.key === 'item:item_cake');
        expect(cake.severity).toBe('warn');
        expect(cake.message).toMatch(/^Copper Cake \(Starter Camp, a chain of 3 links\) pays 6180 XP an hour of the gathering behind it \(68\.67 XP over 1 min of gathering 4 raw\), 243 % over its tier's median of 1800 XP an hour \(±25 %, a warning beyond 2× either way; BALANCE_RULES section 1/);
        expect(cake.message).toMatch(/Move a link's XP, or its ingredient counts, toward the median\.$/);
        expect(CHECKS['chain-xp'].group).toBe('D');
        // A wider warning factor makes every one information; a wider tolerance lets them all pass.
        const wide = paceOf(c, { chainXpWarnFactor: 1000 }).findings().filter(x => x.check === 'chain-xp');
        expect(wide.length).toBe(f.length);
        expect(wide.every(x => x.severity === 'info')).toBe(true);
        expect(paceOf(c, { tolerancePct: 100000 }).findings().some(x => x.check === 'chain-xp')).toBe(false);
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

    it('the proposed price aims at the curve over all the work it boosts, and the rank pays by it, not by its one work', () => {
        const pace = paceOf(ruleContent(), twoHeroes);
        const gold = rowOf(pace, 'ph_gold', 1);
        const row = gold.row;
        expect(row.guildGain).toBe(gold.gain);
        const p = row.proposed;
        const perHour = p.quantity / p.priceHours;
        expect(p.quantity).toBe(roundDown((gold.curve * gold.gain - row.opening.cost) * perHour));
        expect(p.payback).toBeCloseTo((p.priceHours + row.opening.cost) / gold.gain);
        // Over the guild's two heroes it costs more than one hero's saving would allow.
        const lone = rowOf(paceOf(ruleContent(), { heroesByTier: [{ tier: 0, heroes: 1 }] }), 'ph_gold', 1).row.proposed;
        expect(p.quantity).toBeGreaterThan(lone.quantity);
        // The page's colours follow the same sum: the Gold Leaf is red, as its finding warns.
        const shown = hallRows(pace).find(r => r.id === 'ph_gold' && r.rank === 1);
        expect(shown).toMatchObject({ pays: false, guildPaybackText: expect.any(String), curveText: '1 h 2 min' });
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

    it('the one-work, one-day payback check is retired: the payback over all the work is the one', () => {
        expect(CHECKS['hall-payback']).toBeUndefined();
        const pace = paceOf(ruleContent(), twoHeroes);
        expect(pace.findings().some(x => x.check === 'hall-payback')).toBe(false);
        // The Gold Leaf, a day too slow on its one work, is still found, over all its work.
        expect(pace.findings().some(x => x.check === 'hall-guild-payback' && x.key === 'hall:ph_gold')).toBe(true);
    });

    it('a rank whose price cannot be gathered by its stage is a price fault of its own, not a payback', () => {
        const c = ruleContent();
        c.items.item_moonstone = { id: 'item_moonstone', name: 'Moonstone', type: 'material', plan: { tier: 0 } };
        c.hallSky.stars.ph_lore.ranks[0].price = [{ itemId: 'item_moonstone', quantity: 5 }];
        const pace = paceOf(c, twoHeroes);
        const f = pace.findings().filter(x => x.key === 'hall:ph_lore');
        const fault = f.find(x => x.check === 'hall-price-unreachable');
        expect(fault).toMatchObject({ severity: 'warn' });
        expect(fault.message).toMatch(/^Lore rank 1 \(Starter Camp\) costs 5 Moonstone, which cannot be gathered by Starter Camp/);
        expect(CHECKS['hall-price-unreachable'].group).toBe('D');
        // Its payback is not worked out on a price no one can pay.
        expect(f.some(x => x.check === 'hall-guild-payback' && /rank 1 /.test(x.message))).toBe(false);
        // A price that can be gathered is no fault.
        expect(paceOf(ruleContent(), twoHeroes).findings().some(x => x.check === 'hall-price-unreachable')).toBe(false);
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
        expect(rc.chainXpWarnFactor).toBe(2);
        expect(rc.chainXp.find(c => c.item === 'item_cake')).toMatchObject({ links: 3, raw: 4, rawMinutes: 0.667, xpPerHour: 3480, median: 1800, offPct: 93.3, off: true, warn: false });
        expect(rc.chainXp.find(c => c.item === 'item_plank')).toMatchObject({ off: false, warn: false });
        expect(rc.batches.factor).toBe(4);
        expect(rc.batches.rows.find(b => b.item === 'item_beer')).toMatchObject({ doseCycles: DOSE_LENGTH[DOSE.DRINK], short: true });
        expect(rc.hallGuild.find(h => h.id === 'ph_gold' && h.rank === 1)).toMatchObject({ off: true });
        for (const check of ['chain-xp', 'batch-payback', 'hall-guild-payback']) expect(out.checks.some(x => x.check === check), check).toBe(true);
        expect(readoutText(out).join('\n')).toMatch(/Rule checks \(±25 %\): 3 chains, 1 off their tier's median XP an hour of gathering \(0 beyond 2x\); 1 drink and potion batches, 1 under 4x their making; \d+ Guild Hall ranks over all their work, \d+ slower and \d+ quicker than the payback curve\./);
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
