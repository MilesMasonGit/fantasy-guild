/**
 * Economic simulator — pass 5, the MAP check (phase P7).
 *
 * Covers `cms/src/engine/sim/mapPass.js`: derived pool weights (CMS-124), the
 * aggregate-first scrap allocation (CMS-48), the burst expectation with
 * CMS-129's Token-led first slot, the five entry-kind rules, and the two-sided
 * verdict on whether a Map's burst pays for itself.
 *
 * ## ⚠️ Which arms are fixture-proven only
 *
 * **Enemy, gold and raw-item entries are exercised by fixtures and by nothing
 * else.** Every pool entry across all seven shipped Maps is `kind: "token"`;
 * the Map editor offers `token` and `item` kinds only; `data/enemies.json` is
 * not loaded by the CMS store at all, so an enemy entry is unauthorable today.
 * Those three arms are therefore built to the plan's rules and proven against
 * hand-made pools, not against anything that ships. Stating that here is this
 * project's precedent, and the honest reading of the coverage.
 *
 * ## ⚠️ No test here names a shipped Map, Token or item id
 *
 * The owner authors in this workspace continuously and content-naming tests
 * have broken a dozen times. Everything specific is a fixture; everything
 * asserted against the real corpus is a **rule** that holds whatever the corpus
 * happens to contain.
 */

import { describe, it, expect } from 'vitest';

import {
    runMapPass, allocateByRarity, burstExpectation, derivedWeight,
    enemyLootValue, mapCost, isGuildHallMap,
} from '../../cms/src/engine/sim/mapPass.js';
import { runSim } from '../../cms/src/engine/sim/simRunner.js';
import { applyMapResults } from '../../cms/src/engine/sim/writeBack.js';
import { normaliseDials, RARITY_WEIGHTS } from '../../cms/src/engine/sim/dials.js';
import { adaptCorpus } from '../../cms/src/engine/sim/fieldAdapter.js';
import { BURST_SIZE } from '../../src/systems/board/Cartographer.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';

import tokenData from '../../data/tokens.json';
import recipeData from '../../data/tokenRecipes.json';
import itemData from '../../data/items.json';
import mapData from '../../data/maps.json';

const DIALS = normaliseDials();

// === Fixtures ================================================================
//
// A pool shaped like a real one: a producer that works, a Context tool that
// only helps its neighbours, and enough rarity spread that the allocation has
// something to do.

const fixtureItems = {
    fx_log: { id: 'fx_log', name: 'Fixture Log', value: 10 },
    fx_plank: { id: 'fx_plank', name: 'Fixture Plank', value: 25 },
};

const producer = (id, { rarity = 'common', uses = 100, level = 1, itemId = 'fx_log' } = {}) => ({
    id, name: id, rarity, uses, tokenType: 'resource',
    sim: { tempo: 'medium', purpose: 'gph' },
    config: {
        skill: 'woodcutting', skillRequired: level, cycleTimeMs: 16000,
        inputs: [], outputs: [{ itemId, minQty: 1, maxQty: 1, chance: 100 }],
    },
});

const contextTool = (id, { rarity = 'common', uses = 100 } = {}) => ({
    id, name: id, rarity, uses, tokenType: 'context', config: null,
});

const unlimitedProducer = (id) => {
    const token = producer(id);
    delete token.uses;
    return token;
};

/**
 * Run the pass over a hand-made corpus.
 *
 * Cycle times come from the real TIME/TUNE passes, so the productive side is
 * computed exactly as it is in production. **Item values are the fixture's
 * own**, not the pricing pass's: a fixture item with no producer is an orphan
 * the pricing pass rightly refuses to price, and the arithmetic these tests
 * pin is the Map pass's, not the pricing pass's.
 */
function runFixture({ tokens, maps, items = fixtureItems, enemies = {}, dials = DIALS }) {
    const sim = runSim({ tokens, recipes: {}, items }, dials);
    const values = new Map(
        Object.entries(items)
            .filter(([, item]) => Number.isFinite(item?.value))
            .map(([id, item]) => [id, item.value])
    );
    return runMapPass(maps, {
        entities: adaptCorpus({ tokens, recipes: {} }),
        values,
        cycleTimes: sim.cycleTimes,
        items, tokens, enemies, dials,
    });
}

const poolMap = (id, price, pool, extra = {}) => ({ [id]: { id, name: id, price, pool, ...extra } });
const tokenEntry = (refId) => ({ kind: 'token', refId });

// === CMS-124: weights are derived from rarity ================================

describe('Map pass — derived pool weights (CMS-124)', () => {
    it('reads every tier off the one global table', () => {
        for (const [tier, weight] of Object.entries(RARITY_WEIGHTS)) {
            expect(derivedWeight(tier, DIALS)).toBe(weight);
        }
    });

    it('treats a missing or unknown rarity as Common — the table\'s neutral row', () => {
        expect(derivedWeight(undefined, DIALS)).toBe(RARITY_WEIGHTS.common);
        expect(derivedWeight('legendarium', DIALS)).toBe(RARITY_WEIGHTS.common);
    });

    it('renormalises shares within the pool, so composition sets the experience', () => {
        // The same Rare Token is a third of one pool and a sliver of another.
        const tokens = {
            fx_rare: producer('fx_rare', { rarity: 'rare' }),
            fx_a: producer('fx_a'), fx_b: producer('fx_b'), fx_c: producer('fx_c'),
        };
        const small = runFixture({
            tokens,
            maps: poolMap('fx_small', 1000, [tokenEntry('fx_rare'), tokenEntry('fx_a')]),
        }).reports.get('fx_small');
        const large = runFixture({
            tokens,
            maps: poolMap('fx_large', 1000, ['fx_rare', 'fx_a', 'fx_b', 'fx_c'].map(tokenEntry)),
        }).reports.get('fx_large');

        const shareOf = (report) => report.entries.find((e) => e.refId === 'fx_rare').share;
        expect(shareOf(small)).toBeCloseTo(12 / 112, 6);
        expect(shareOf(large)).toBeCloseTo(12 / 312, 6);
    });

    it('writes the derived weights back to the Map, and touches nothing else', () => {
        const tokens = { fx_rare: producer('fx_rare', { rarity: 'rare' }), fx_a: producer('fx_a') };
        const maps = poolMap('fx_w', 1000, [tokenEntry('fx_rare'), tokenEntry('fx_a')]);
        maps.fx_w.materials = [{ itemId: 'fx_log', quantity: 3 }];
        const pass = runFixture({ tokens, maps });

        const written = applyMapResults(maps, { mapWeights: pass.weights });
        expect(written.fx_w.pool.map((e) => e.weight)).toEqual([12, 100]);
        // Authored fields survive untouched: the check refuses, it does not adjust.
        expect(written.fx_w.price).toBe(1000);
        expect(written.fx_w.materials).toEqual([{ itemId: 'fx_log', quantity: 3 }]);
        expect(written.fx_w.pool.map((e) => e.refId)).toEqual(['fx_rare', 'fx_a']);
    });
});

// === CMS-48: aggregate first, allocate second ================================

describe('Map pass — the scrap allocation (CMS-48)', () => {
    it('sums to the budget exactly, whatever the pool length or premium', () => {
        // The whole point of CMS-48: the total is a property of the Map, so
        // adding another entry to a pool must not make the Map richer.
        for (const premium of [0, 0.35, 0.8, 1]) {
            for (const size of [1, 2, 3, 7, 13, 40]) {
                const weights = Array.from({ length: size }, (_, i) => [100, 40, 12, 4, 1][i % 5]);
                for (const budget of [0, 1, 7, 137, 4001, 99999]) {
                    const slices = allocateByRarity(budget, weights, premium);
                    const sum = slices.reduce((a, b) => a + b, 0);
                    expect(sum, `budget ${budget}, ${size} entries, premium ${premium}`).toBe(budget);
                    expect(slices.every((s) => Number.isInteger(s) && s >= 0)).toBe(true);
                }
            }
        }
    });

    it('the premium dial travels from flat (0) to hard inverse (1)', () => {
        const weights = [100, 40, 12, 4, 1];

        // 0 — every entry takes an equal slice; rarity stops mattering to price.
        const flat = allocateByRarity(100000, weights, 0);
        expect(Math.max(...flat) - Math.min(...flat)).toBeLessThanOrEqual(1);

        // 1 — a hard inverse: the EXPECTED scrap of one draw is the same for
        // every entry, so a Mythic is worth exactly what the Common it
        // displaced was.
        const total = weights.reduce((a, b) => a + b, 0);
        const inverse = allocateByRarity(1000000, weights, 1);
        const perDraw = inverse.map((slice, i) => (weights[i] / total) * slice);
        // Relative, not absolute: the slices are whole gold, so the last penny
        // of the largest-remainder split is allowed to show up here.
        for (const v of perDraw) expect(Math.abs(v - perDraw[0]) / perDraw[0]).toBeLessThan(0.001);

        // 0.8 — §13.4's column: between the two, and monotone in rarity.
        const between = allocateByRarity(1000000, weights, 0.8);
        for (let i = 1; i < between.length; i++) expect(between[i]).toBeGreaterThan(between[i - 1]);
        expect(between[4] / between[0]).toBeLessThan(inverse[4] / inverse[0]);
        expect(between[4] / between[0]).toBeGreaterThan(1);
    });

    it('anchors the budget on the Map\'s cost — its price plus its materials (CMS-108)', () => {
        const values = new Map([['fx_log', 10]]);
        expect(mapCost({ price: 500, materials: [{ itemId: 'fx_log', quantity: 5 }] }, values)).toBe(550);
        expect(mapCost({ price: 500 }, values)).toBe(500);
        // An unpriced material contributes nothing rather than NaN.
        expect(mapCost({ price: 500, materials: [{ itemId: 'nope', quantity: 5 }] }, values)).toBe(500);
    });

    it('splits that budget across the pool and nothing more', () => {
        const tokens = {
            fx_p1: producer('fx_p1'), fx_p2: producer('fx_p2', { rarity: 'rare' }),
            fx_p3: producer('fx_p3', { rarity: 'mythic' }),
        };
        const maps = poolMap('fx_sum', 1000, ['fx_p1', 'fx_p2', 'fx_p3'].map(tokenEntry));
        const report = runFixture({ tokens, maps }).reports.get('fx_sum');

        expect(report.scrapBudget).toBe(400); // 1000 × the 40% scrap ratio
        const sum = report.entries.reduce((s, e) => s + e.scrapValue, 0);
        expect(sum).toBe(report.scrapBudget);
    });
});

// === CMS-129: the burst expectation ==========================================

describe('Map pass — the burst expectation (CMS-129)', () => {
    it('uses the live burst constant, never a literal', () => {
        const shares = [0.5, 0.5];
        const expected = burstExpectation(shares, [true, true]);
        expect(expected.reduce((a, b) => a + b, 0)).toBeCloseTo(BURST_SIZE, 9);
    });

    it('renormalises slot one over the Token entries only', () => {
        // Half the pool by weight is a raw item, so the guarantee that slot one
        // is a Token materially changes what a burst is expected to contain.
        const shares = [0.5, 0.5];
        const [tokenCount, itemCount] = burstExpectation(shares, [true, false]);
        expect(tokenCount).toBeCloseTo(1 + (BURST_SIZE - 1) * 0.5, 9);
        expect(itemCount).toBeCloseTo((BURST_SIZE - 1) * 0.5, 9);
        expect(tokenCount).toBeGreaterThan(BURST_SIZE * 0.5); // more than a free draw would give
    });

    it('falls back to free draws when a pool has no Token entries, exactly as rollBurst does', () => {
        const expected = burstExpectation([0.25, 0.75], [false, false]);
        expect(expected[0]).toBeCloseTo(BURST_SIZE * 0.25, 9);
        expect(expected[1]).toBeCloseTo(BURST_SIZE * 0.75, 9);
    });

    it('counts a whole burst however the pool is composed', () => {
        const shares = [0.2, 0.3, 0.5];
        for (const flags of [[true, false, false], [true, true, false], [true, true, true]]) {
            const sum = burstExpectation(shares, flags).reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(BURST_SIZE, 9);
        }
    });
});

// === The entry-kind rules ====================================================

describe('Map pass — raw-item entries (F10) ⚠️ fixture-proven only', () => {
    it('counts a raw item at face value on both sides, outside the rarity allocation', () => {
        const tokens = { fx_p: producer('fx_p') };
        const maps = poolMap('fx_item', 1000, [
            tokenEntry('fx_p'),
            { kind: 'item', refId: 'fx_plank', quantity: 4 },
        ]);
        const report = runFixture({ tokens, maps }).reports.get('fx_item');
        const item = report.entries.find((e) => e.kind === 'item');
        const token = report.entries.find((e) => e.kind === 'token');

        expect(item.scrapValue).toBe(100);            // 4 × the item's 25g value
        expect(item.productiveValue).toBe(100);       // identical on both sides
        expect(token.scrapValue).toBe(report.scrapBudget - 100); // the premium splits the rest
        expect(report.entries.reduce((s, e) => s + e.scrapValue, 0)).toBe(report.scrapBudget);
    });

    it('warns when the item entries alone exceed the whole scrap budget', () => {
        const tokens = { fx_p: producer('fx_p') };
        const maps = poolMap('fx_heavy', 100, [
            tokenEntry('fx_p'),
            { kind: 'item', refId: 'fx_plank', quantity: 20 }, // 500g against a 40g budget
        ]);
        const pass = runFixture({ tokens, maps });
        const row = pass.rows.find((r) => r.code === 'map-item-heavy');

        expect(row).toBeTruthy();
        expect(row.severity).toBe('warning');
        expect(row.why).toMatch(/before any Token is counted/);
        expect(row.remedies.length).toBeGreaterThan(0);
        // Nothing is allocated to the Tokens, and no slice goes negative.
        const report = pass.reports.get('fx_heavy');
        expect(report.entries.find((e) => e.kind === 'token').scrapValue).toBe(0);
    });
});

describe('Map pass — gold entries (A7) ⚠️ fixture-proven only, and an implementation default', () => {
    it('counts a gold entry\'s face amount on both sides, outside the allocation', () => {
        // ⚠️ Extending F10's raw-item rule to gold is this phase's default, not
        // the plan's: §13.6 never names the kind. `Cartographer.openMap` pays
        // out `amount || quantity || 2000`, and this prices exactly that.
        const tokens = { fx_p: producer('fx_p') };
        const maps = poolMap('fx_gold', 1000, [
            tokenEntry('fx_p'),
            { kind: 'gold', amount: 150 },
        ]);
        const report = runFixture({ tokens, maps }).reports.get('fx_gold');
        const gold = report.entries.find((e) => e.kind === 'gold');

        expect(gold.scrapValue).toBe(150);
        expect(gold.productiveValue).toBe(150);
        expect(report.entries.reduce((s, e) => s + e.scrapValue, 0)).toBe(report.scrapBudget);
    });

    it('accepts the `currency` spelling the runtime also accepts', () => {
        const tokens = { fx_p: producer('fx_p') };
        const maps = poolMap('fx_cur', 1000, [tokenEntry('fx_p'), { kind: 'currency', amount: 90 }]);
        const report = runFixture({ tokens, maps }).reports.get('fx_cur');
        expect(report.entries.find((e) => e.kind === 'gold').scrapValue).toBe(90);
    });
});

describe('Map pass — support and deferred-kind entries (CMS-138)', () => {
    it('counts a Context Token at its acquisition slice, so it is neutral in the verdict', () => {
        const tokens = { fx_p: producer('fx_p'), fx_tool: contextTool('fx_tool') };
        const maps = poolMap('fx_support', 1000, [tokenEntry('fx_p'), tokenEntry('fx_tool')]);
        const pass = runFixture({ tokens, maps });
        const entry = pass.reports.get('fx_support').entries.find((e) => e.refId === 'fx_tool');

        expect(entry.productiveValue).toBe(entry.scrapValue);
        const row = pass.rows.find((r) => r.code === 'map-support-entry' && r.message.includes('fx_tool'));
        expect(row).toBeTruthy();
        expect(row.severity).toBe('info');
    });

    it('files an Info row naming each one, rather than dropping them silently', () => {
        const tokens = {
            fx_p: producer('fx_p'),
            fx_tool: contextTool('fx_tool'),
            fx_buff: { id: 'fx_buff', name: 'fx_buff', rarity: 'common', uses: 5, tokenType: 'buff', config: null },
        };
        const maps = poolMap('fx_two', 1000, ['fx_p', 'fx_tool', 'fx_buff'].map(tokenEntry));
        const rows = runFixture({ tokens, maps }).rows.filter((r) => r.code === 'map-support-entry');
        expect(rows).toHaveLength(2);
    });
});

describe('Map pass — enemy entries ⚠️ fixture-proven only', () => {
    const enemy = (id, drops, level = 1) => ({ id, name: id, level, drops });

    it('values an enemy at its lifetime loot — one kill is one charge (CMS-51)', () => {
        const values = new Map([['fx_log', 10], ['fx_plank', 25]]);
        const loot = enemyLootValue(enemy('fx_e', [
            { itemId: 'fx_log', minQty: 2, maxQty: 4, chance: 50 },   // 3 × 0.5 × 10 = 15
            { itemId: 'fx_plank', minQty: 1, maxQty: 1, chance: 20 }, // 1 × 0.2 × 25 = 5
        ]), values);
        expect(loot).toBeCloseTo(20, 9);
        // No time dimension at all: an enemy is consumed by being killed.
        expect(enemyLootValue(enemy('fx_none', []), values)).toBe(0);
    });

    it('warns when the loot is wildly generous against what the burst charged', () => {
        const tokens = { fx_p: producer('fx_p') };
        const enemies = {
            fx_rich: enemy('fx_rich', [{ itemId: 'fx_plank', minQty: 40, maxQty: 40, chance: 100 }]),
        };
        const maps = poolMap('fx_enemy', 1000, [tokenEntry('fx_p'), { kind: 'enemy', refId: 'fx_rich' }]);
        const pass = runFixture({ tokens, maps, enemies });
        const row = pass.rows.find((r) => r.code === 'map-enemy-band');

        expect(row).toBeTruthy();
        expect(row.why).toMatch(/pays several times what it cost/);
        // Its scrap slice still comes out of the ordinary rarity allocation.
        const report = pass.reports.get('fx_enemy');
        expect(report.entries.reduce((s, e) => s + e.scrapValue, 0)).toBe(report.scrapBudget);
    });

    it('warns the other way when it is a rip-off, and stays quiet inside the band', () => {
        const tokens = { fx_p: producer('fx_p') };
        const maps = poolMap('fx_enemy2', 1000, [tokenEntry('fx_p'), { kind: 'enemy', refId: 'fx_e' }]);

        const poor = runFixture({
            tokens, maps,
            enemies: { fx_e: enemy('fx_e', [{ itemId: 'fx_log', minQty: 1, maxQty: 1, chance: 10 }]) },
        }).rows.find((r) => r.code === 'map-enemy-band');
        expect(poor.why).toMatch(/costs several times what killing it ever gives back/);

        // A slice of 200g against loot in the same order of magnitude: silent.
        const fair = runFixture({
            tokens, maps,
            enemies: { fx_e: enemy('fx_e', [{ itemId: 'fx_plank', minQty: 8, maxQty: 8, chance: 100 }]) },
        }).rows.find((r) => r.code === 'map-enemy-band');
        expect(fair).toBeUndefined();
    });
});

describe('Map pass — an unlimited Token in an ordinary pool (CMS-131)', () => {
    it('warns, because an unlimited Token opts out of the supply-line loop', () => {
        const tokens = { fx_forever: unlimitedProducer('fx_forever'), fx_p: producer('fx_p') };
        const maps = poolMap('fx_unl', 1000, [tokenEntry('fx_forever'), tokenEntry('fx_p')]);
        const pass = runFixture({ tokens, maps });
        const row = pass.rows.find((r) => r.code === 'map-unlimited-token');

        expect(row).toBeTruthy();
        expect(row.severity).toBe('warning');
        expect(row.remedies.length).toBeGreaterThan(0);
    });

    it('values it over the assumed-lifetime dial, and the dial moves the answer', () => {
        const tokens = { fx_forever: unlimitedProducer('fx_forever') };
        const maps = poolMap('fx_unl2', 1000, [tokenEntry('fx_forever')]);
        const short = runFixture({ tokens, maps, dials: normaliseDials({ unlimitedLifetimeHours: 1 }) });
        const long = runFixture({ tokens, maps, dials: normaliseDials({ unlimitedLifetimeHours: 100 }) });

        const value = (pass) => pass.reports.get('fx_unl2').entries[0].productiveValue;
        expect(value(long)).toBeCloseTo(value(short) * 100, 3);
    });

    it('reads charges through `uses`, never the dead `charges` field (S6)', () => {
        // A Token whose retired `charges` field disagrees twentyfold with its
        // live `uses` must be valued on `uses`.
        const honest = producer('fx_honest', { uses: 10 });
        const lying = { ...producer('fx_lying', { uses: 10 }), charges: 200 };
        const maps = poolMap('fx_charges', 1000, [tokenEntry('fx_honest'), tokenEntry('fx_lying')]);
        const report = runFixture({ tokens: { fx_honest: honest, fx_lying: lying }, maps }).reports.get('fx_charges');
        const [a, b] = report.entries;
        expect(a.productiveValue).toBeCloseTo(b.productiveValue, 6);
    });
});

// === The two-sided verdict ===================================================

describe('Map pass — the two-sided check (§13.6)', () => {
    const tokens = { fx_p1: producer('fx_p1'), fx_p2: producer('fx_p2'), fx_p3: producer('fx_p3') };
    const maps = poolMap('fx_verdict', 1000, ['fx_p1', 'fx_p2', 'fx_p3'].map(tokenEntry));

    it('bounds the scrap side by the Map\'s scrap budget', () => {
        const report = runFixture({ tokens, maps }).reports.get('fx_verdict');
        expect(report.scrapBound).toBe(report.scrapBudget);
        expect(report.scrapRich).toBe(report.scrapSide > report.scrapBound);
    });

    it('a short pool concentrates the scrap and reads as scrap-rich', () => {
        // Three draws out of a one-entry pool hand over three full slices of a
        // budget that was meant to cover the whole pool.
        const one = runFixture({ tokens, maps: poolMap('fx_one', 1000, [tokenEntry('fx_p1')]) });
        const report = one.reports.get('fx_one');
        expect(report.scrapSide).toBeCloseTo(report.scrapBudget * BURST_SIZE, 6);
        expect(report.scrapRich).toBe(true);
        expect(one.rows.some((r) => r.code === 'map-scrap-rich')).toBe(true);
    });

    it('⚠️ a non-finite earning counts as zero, never as a silent pass', () => {
        // The failure mode this guards was real, and it was found in this
        // phase's own first draft. `earningsPerHour` reads each output's
        // **precomputed** `abundance`; an output object that lacks it earns
        // NaN an hour. NaN then fails every comparison silently — crucially
        // `NaN < bound` is `false` — so a Map that produces nothing read as
        // PASSING its productive bound instead of failing it. A verdict that
        // is wrong in the reassuring direction is the worst kind.
        const broken = {
            fx_nan: {
                id: 'fx_nan', name: 'Broken Producer', rarity: 'common', tokenType: 'resource', uses: 10,
                config: {
                    skill: 'logging', skillRequired: 1, cycleTimeMs: 10000, inputs: [],
                    // No minQty/maxQty and no baseQty: nothing to derive an
                    // abundance from.
                    outputs: [{ itemId: 'item_fx_nowhere', chance: 100 }],
                },
                sim: { tempo: 'fast', purpose: 'gph' },
            },
        };
        const result = runFixture({ tokens: broken, maps: poolMap('fx_nan_map', 1000, [tokenEntry('fx_nan')]) });
        const report = result.reports.get('fx_nan_map');

        expect(Number.isFinite(report.productiveSide)).toBe(true);
        expect(report.productiveSide).toBe(0);
        // And the verdict is the honest one.
        expect(report.underwater).toBe(true);
    });

    it('flips the productive verdict when a pin dial moves', () => {
        const generous = runFixture({
            tokens, maps, dials: normaliseDials({ mapProductiveReturn: { early: 0.01, late: 0.01 } }),
        }).reports.get('fx_verdict');
        const demanding = runFixture({
            tokens, maps, dials: normaliseDials({ mapProductiveReturn: { early: 10000, late: 10000 } }),
        }).reports.get('fx_verdict');

        expect(generous.underwater).toBe(false);
        expect(demanding.underwater).toBe(true);
        expect(generous.productiveSide).toBeCloseTo(demanding.productiveSide, 6);
    });

    it('flips the scrap verdict when the scrap-ratio dial moves', () => {
        const tight = runFixture({ tokens, maps, dials: normaliseDials({ mapScrapRatio: 0.01 }) });
        const loose = runFixture({ tokens, maps, dials: normaliseDials({ mapScrapRatio: 0.9 }) });
        expect(tight.reports.get('fx_verdict').scrapBound)
            .toBeLessThan(loose.reports.get('fx_verdict').scrapBound);
    });

    it('interpolates the productive return over the Map\'s derived level', () => {
        const low = runFixture({
            tokens: { fx_low: producer('fx_low', { level: 1 }) },
            maps: poolMap('fx_lvl', 1000, [tokenEntry('fx_low')]),
        }).reports.get('fx_lvl');
        const high = runFixture({
            tokens: { fx_high: producer('fx_high', { level: 99 }) },
            maps: poolMap('fx_lvl', 1000, [tokenEntry('fx_high')]),
        }).reports.get('fx_lvl');

        expect(low.level).toBe(1);
        expect(high.level).toBe(99);
        expect(low.productiveReturn).toBeCloseTo(10, 6);
        expect(high.productiveReturn).toBeCloseTo(1.5, 6);
    });

    it('derives the Map\'s level as the share-weighted mean of what its entries ask', () => {
        const tokens = {
            fx_l10: producer('fx_l10', { level: 10 }),
            fx_l50: producer('fx_l50', { level: 50, rarity: 'rare' }),
        };
        const report = runFixture({
            tokens, maps: poolMap('fx_mean', 1000, [tokenEntry('fx_l10'), tokenEntry('fx_l50')]),
        }).reports.get('fx_mean');
        // Common 100 against Rare 12: the Rare pulls the mean much less.
        expect(report.level).toBeCloseTo((100 * 10 + 12 * 50) / 112, 6);
    });

    it('a gold entry has no skill requirement and does not drag the level to zero', () => {
        const tokens = { fx_l20: producer('fx_l20', { level: 20 }) };
        const report = runFixture({
            tokens,
            maps: poolMap('fx_goldlvl', 1000, [tokenEntry('fx_l20'), { kind: 'gold', amount: 50 }]),
        }).reports.get('fx_goldlvl');
        expect(report.level).toBe(20);
    });
});

describe('Map pass — guild-hall Maps are skipped (owner ruling 24)', () => {
    it('recognises the same two ids the runtime\'s own burst branch does', () => {
        expect(isGuildHallMap('map_guild_hall')).toBe(true);
        expect(isGuildHallMap('map_guild_hall_anything')).toBe(true);
        expect(isGuildHallMap('map_somewhere_else')).toBe(false);
    });

    it('reports one as skipped and files no verdict against it', () => {
        const tokens = { fx_p: producer('fx_p') };
        const maps = {
            map_guild_hall_fixture: {
                id: 'map_guild_hall_fixture', name: 'Fixture Hall', price: 5000,
                pool: [tokenEntry('fx_p')],
            },
        };
        const pass = runFixture({ tokens, maps });
        expect(pass.reports.get('map_guild_hall_fixture').skipped).toBe('guild-hall');
        expect(pass.rows).toHaveLength(0);
    });
});

// === The game half (S5) ======================================================

describe('TokenBank.sellValue — the derived scrap value, with a fallback', () => {
    it('prefers the simulator\'s per-Token scrap value over the rarity table', () => {
        registerTokenTypes({
            fx_sell_derived: {
                id: 'fx_sell_derived', name: 'Fixture Derived', tokenType: 'resource',
                rarity: 'common', scrapValue: 137,
            },
        });
        expect(TokenBank.sellValue('fx_sell_derived')).toBe(137);
        expect(TokenBank.sellValue('fx_sell_derived')).not.toBe(TokenBank.SELL_VALUE.common);
    });

    it('falls back to the rarity table for a Token no Map hands over', () => {
        // The safety net through the re-authoring window: a Token in no pool
        // carries no scrap value at all, and must still sell for something.
        registerTokenTypes({
            fx_sell_plain: {
                id: 'fx_sell_plain', name: 'Fixture Plain', tokenType: 'resource', rarity: 'rare',
            },
        });
        expect(TokenBank.sellValue('fx_sell_plain')).toBe(TokenBank.SELL_VALUE.rare);
    });

    it('still pays nothing for a Token that does not exist', () => {
        expect(TokenBank.sellValue('fx_sell_ghost')).toBe(0);
    });
});

// === Against the real corpus: rules only, no content named ===================

describe('Map pass — over the shipped corpus', () => {
    const sim = () => runSim({ tokens: tokenData, recipes: recipeData, items: itemData, maps: mapData });

    it('runs over every shipped Map without throwing, and reports on each', () => {
        const result = sim();
        expect(result.maps.size).toBe(Object.keys(mapData).length);
    });

    it('is idempotent — two runs produce the same table (plan §11)', () => {
        const snap = (r) => JSON.stringify([...r.maps.entries()]);
        expect(snap(sim())).toBe(snap(sim()));
    });

    it('writes nothing to a Map\'s authored fields', () => {
        const before = JSON.stringify(mapData);
        sim();
        expect(JSON.stringify(mapData)).toBe(before);
    });

    it('every checked Map\'s slices sum exactly to its own scrap budget', () => {
        for (const report of sim().maps.values()) {
            if (report.skipped) continue;
            const sum = report.entries.reduce((s, e) => s + e.scrapValue, 0);
            expect(sum, `${report.id} allocated ${sum} of ${report.scrapBudget}`).toBe(report.scrapBudget);
        }
    });

    it('every derived weight is a row of the rarity table', () => {
        const allowed = new Set(Object.values(RARITY_WEIGHTS));
        for (const weights of sim().mapWeights.values()) {
            for (const weight of weights) expect(allowed.has(weight)).toBe(true);
        }
    });

    it('every failing Map has a row with remedies naming what to change', () => {
        const result = sim();
        const byMap = new Map();
        for (const row of result.rows.filter((r) => r.code.startsWith('map-'))) {
            if (!byMap.has(row.entityId)) byMap.set(row.entityId, []);
            byMap.get(row.entityId).push(row);
        }
        for (const report of result.maps.values()) {
            if (report.skipped || report.pass) continue;
            const rows = byMap.get(report.id) || [];
            expect(rows.length, `${report.id} failed with no row`).toBeGreaterThan(0);
            for (const row of rows) {
                expect(row.what, `${row.code} has no observation`).toBeTruthy();
                expect(row.why, `${row.code} has no reason`).toBeTruthy();
                expect(row.remedies.length, `${row.code} has no remedies`).toBeGreaterThan(0);
            }
        }
    });

    it('gives a scrap value to exactly the Tokens some pool hands over', () => {
        const result = sim();
        const inAPool = new Set();
        for (const [mapId, map] of Object.entries(mapData)) {
            if (isGuildHallMap(map?.id ?? mapId)) continue;
            for (const entry of map.pool || []) if (entry.kind === 'token') inAPool.add(entry.refId);
        }
        expect(new Set(result.scrapValues.keys())).toEqual(inAPool);
    });
});
