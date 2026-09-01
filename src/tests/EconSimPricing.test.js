/**
 * Economic simulator — the PRICE pass (phase P3+4).
 *
 * Covers `cms/src/engine/sim/pricingPass.js`: the topological walk, the integer
 * problem, multi-output splits, the craft-margin floor, the downcycle cap, and
 * the two refusals.
 *
 * ⚠️ **Fixture-proven only:** no shipped recipe is flagged `downcycle` and none
 * outputs a Token (finding S15), so the downcycle path and the cycle refusal
 * are exercised by fixtures alone.
 *
 * ⚠️ The numbers below come from the plan's curves and dials (§13.1, §13.6),
 * never from `data/`. If a shipped Token prices oddly, that is placeholder
 * content, not a reason to move a curve.
 */

import { describe, it, expect } from 'vitest';

import { runSim } from '../../cms/src/engine/sim/simRunner.js';
import { chooseInteger, splitByScarcity } from '../../cms/src/engine/sim/pricingPass.js';
import { normaliseDials, gphAt, DEFAULT_DIALS } from '../../cms/src/engine/sim/dials.js';

const out = (itemId, over = {}) => ({ itemId, chance: 100, minQty: 1, maxQty: 1, ...over });

const token = (id, { level = 1, tempo = 'fast', purpose = 'gph', inputs = [], outputs = [out('item_a')], rarity = 'common', tokenType = 'resource' } = {}) => ({
    id, name: id, rarity, tokenType, uses: 10,
    config: { skill: 'logging', skillRequired: level, cycleTimeMs: 10000, inputs, outputs },
    sim: { tempo, purpose },
});

const recipe = (id, { level = 1, tempo = 'fast', purpose = 'gph', inputs = [], outputs = [out('item_a')], downcycle = false } = {}) => ({
    id, name: id, skill: 'crafting', levelRequirement: level, durationMs: 10000,
    inputs, outputs, downcycle, sim: { tempo, purpose },
});

const itemsFor = (...ids) => Object.fromEntries(ids.map(id => [id, { id }]));

describe('EconSim — PRICE pass', () => {
    describe('the integer problem (plan §3.3, problem P4)', () => {
        it('prefers the closer neighbour when both land in band', () => {
            const picked = chooseInteger(3.3167, 0.25);
            expect(picked.value).toBe(3);
            expect(picked.inBand).toBe(true);
        });

        it('takes the only neighbour that lands, even if it is the further one', () => {
            // 2.4 with a ±10% band: 2 is 16.7% out, 3 is 25% out — neither lands.
            expect(chooseInteger(2.4, 0.1).inBand).toBe(false);
            // 2.4 with a ±20% band: only 2 lands.
            expect(chooseInteger(2.4, 0.2)).toMatchObject({ value: 2, inBand: true });
        });

        it('never prices below 1g', () => {
            expect(chooseInteger(0.2, 0.25).value).toBe(1);
        });
    });

    describe('a worked single-output anchor', () => {
        it('lands on a neighbouring integer', () => {
            // Level 1, fast (band middle 10s), GPH (factor 1.0), one unit a cycle.
            //   units/hour = 1 ÷ 10s × 3600 × 1.005      = 361.8
            //   target     = GPH(1) × 1.0                = 1,200/h
            //   ideal      = 1200 ÷ 361.8                = 3.32g
            // Band at level 1 is ±25%, so both 3 and 4 land; 3 is closer.
            const result = runSim({ tokens: { a: token('token_grove') }, items: itemsFor('item_a') });

            expect(result.cycleTimes.get('token_grove')).toBe(10000);
            expect(result.details.get('item_a').unitsPerHour).toBeCloseTo(361.8, 1);
            expect(result.details.get('item_a').targetPerHour).toBe(1200);
            expect(result.details.get('item_a').ideal).toBeCloseTo(3.3167, 3);
            expect(result.values.get('item_a')).toBe(3);
            expect(result.rows.filter(r => r.severity !== 'info')).toHaveLength(0);
        });

        it('the Purpose tag is the only thing that changes the target', () => {
            const gph = runSim({ tokens: { a: token('token_g', { purpose: 'gph' }) }, items: itemsFor('item_a') });
            const iph = runSim({ tokens: { a: token('token_g', { purpose: 'iph' }) }, items: itemsFor('item_a') });
            expect(iph.details.get('item_a').targetPerHour).toBeCloseTo(gph.details.get('item_a').targetPerHour * 0.35, 6);
        });
    });

    describe('multi-output anchors split inversely to abundance (the Trout Stream shape)', () => {
        it('gives the scarcer output the bigger per-unit slice', () => {
            const shares = splitByScarcity(11, [1, 0.1]);
            expect(shares[0] + shares[1]).toBeCloseTo(11, 9);
            // The *target* splits inversely to abundance, so the 10×-scarcer
            // output takes 10× the gold …
            expect(shares[1] / shares[0]).toBeCloseTo(10, 9);
            // … and its per-unit value (share ÷ abundance) is 10× that again.
            // The square is deliberate: the weight is 1/abundance and the share
            // is then divided by abundance a second time.
            expect((shares[1] / 0.1) / (shares[0] / 1)).toBeCloseTo(100, 9);
        });

        it('prices both outputs of one Token in one pass', () => {
            const result = runSim({
                tokens: {
                    a: token('token_stream', {
                        outputs: [out('item_trout'), out('item_pearl', { chance: 10 })],
                    }),
                },
                items: itemsFor('item_trout', 'item_pearl'),
            });

            const trout = result.details.get('item_trout');
            const pearl = result.details.get('item_pearl');
            expect(pearl.ideal / trout.ideal).toBeCloseTo(100, 4);
            expect(pearl.ideal).toBeGreaterThan(trout.ideal);
            expect(result.elections.get('item_trout').sourceId).toBe('token_stream');
            expect(result.elections.get('item_pearl').sourceId).toBe('token_stream');
        });
    });

    describe('crafted anchors and the margin floor (plan §6, CMS-122)', () => {
        it('prices a crafted item at inputs + Purpose profit', () => {
            const result = runSim({
                tokens: { a: token('token_ore_vein', { outputs: [out('item_ore')] }) },
                recipes: [recipe('recipe_ingot', {
                    inputs: [{ itemId: 'item_ore', quantity: 1 }],
                    outputs: [out('item_ingot')],
                })],
                items: itemsFor('item_ore', 'item_ingot'),
            });

            const ore = result.values.get('item_ore');
            const ingot = result.details.get('item_ingot');
            // gross per cycle = input value + target profit per cycle
            expect(ingot.inputValue).toBe(ore);
            expect(ingot.ideal).toBeGreaterThan(ore);
            expect(result.values.get('item_ingot')).toBeGreaterThan(ore);
        });

        it('files an Info row when the floor, not the target, decides the price', () => {
            // An XPH craft (factor 0.10) on a slow, expensive input: the Purpose
            // target is smaller than 15% of the inputs, so the floor decides.
            const result = runSim({
                tokens: { a: token('token_gems', { level: 30, tempo: 'heavy', purpose: 'gph', outputs: [out('item_gem')] }) },
                recipes: [recipe('recipe_cut_gem', {
                    level: 30, tempo: 'heavy', purpose: 'xph',
                    inputs: [{ itemId: 'item_gem', quantity: 1 }],
                    outputs: [out('item_cut_gem')],
                })],
                items: itemsFor('item_gem', 'item_cut_gem'),
            });

            const row = result.rows.find(r => r.code === 'craft-margin-floor');
            expect(row.severity).toBe('info');
            expect(result.details.get('item_cut_gem').floorEngaged).toBe(true);
            expect(result.values.get('item_cut_gem'))
                .toBeGreaterThanOrEqual(Math.floor(result.values.get('item_gem') * 1.15));
        });

        it('a four-step chain compounds the 15% margin to about ×1.75', () => {
            // The plan's own arithmetic (§13.6): "four steps compound to ~×1.75".
            const steps = [1, 2, 3, 4].map(n => recipe(`recipe_step_${n}`, {
                level: 30, tempo: 'heavy', purpose: 'xph',
                inputs: [{ itemId: n === 1 ? 'item_raw' : `item_step_${n - 1}`, quantity: 1 }],
                outputs: [out(`item_step_${n}`)],
            }));

            const result = runSim({
                tokens: { a: token('token_raw', { level: 30, tempo: 'heavy', purpose: 'gph', outputs: [out('item_raw')] }) },
                recipes: steps,
                items: itemsFor('item_raw', 'item_step_1', 'item_step_2', 'item_step_3', 'item_step_4'),
            });

            // Every step must be the floor doing the work, or this is measuring
            // something else.
            expect(result.rows.filter(r => r.code === 'craft-margin-floor')).toHaveLength(4);

            const raw = result.values.get('item_raw');
            const final = result.values.get('item_step_4');
            expect(final / raw).toBeGreaterThan(1.70);
            expect(final / raw).toBeLessThan(1.80);
            expect(final / raw).toBeCloseTo(1.15 ** 4, 1);
        });
    });

    describe('an unclosed residual is a Warning, never a silent pass', () => {
        it('warns when neither neighbouring integer lands in band', () => {
            // A cheap, fast IPH source: ideal well under 1g, and 1g is the floor.
            const result = runSim({
                tokens: { a: token('token_clay', { purpose: 'iph', outputs: [out('item_clay', { minQty: 1, maxQty: 4 })] }) },
                items: itemsFor('item_clay'),
            });

            const row = result.rows.find(r => r.code === 'unclosed-residual');
            expect(row.severity).toBe('warning');
            expect(row.itemId).toBe('item_clay');
            // The remedy names phase P6 rather than pretending a lever exists.
            expect(row.remedies[0]).toContain('lever policy');
            expect(result.details.get('item_clay').inBand).toBe(false);
            // The value is still set — the residual is recorded, not fatal.
            expect(result.values.get('item_clay')).toBe(1);
        });
    });

    describe('cycles', () => {
        it('refuses a genuine cycle and names both recipes', () => {
            const result = runSim({
                recipes: [
                    recipe('recipe_a_from_b', { inputs: [{ itemId: 'item_b', quantity: 1 }], outputs: [out('item_a')] }),
                    recipe('recipe_b_from_a', { inputs: [{ itemId: 'item_a', quantity: 1 }], outputs: [out('item_b')] }),
                ],
                items: itemsFor('item_a', 'item_b'),
            });

            const row = result.rows.find(r => r.code === 'recipe-cycle');
            expect(row.severity).toBe('critical');
            expect(row.detail.cycle.sort()).toEqual(['recipe_a_from_b', 'recipe_b_from_a']);
            expect(result.values.has('item_a')).toBe(false);
            expect(result.values.has('item_b')).toBe(false);
        });

        it('terminates on a cycle rather than hanging, and reports it once', () => {
            const result = runSim({
                recipes: [
                    recipe('recipe_1', { inputs: [{ itemId: 'item_c', quantity: 1 }], outputs: [out('item_a')] }),
                    recipe('recipe_2', { inputs: [{ itemId: 'item_a', quantity: 1 }], outputs: [out('item_b')] }),
                    recipe('recipe_3', { inputs: [{ itemId: 'item_b', quantity: 1 }], outputs: [out('item_c')] }),
                ],
                items: itemsFor('item_a', 'item_b', 'item_c'),
            });
            expect(result.rows.filter(r => r.code === 'recipe-cycle')).toHaveLength(1);
            expect(result.rows.find(r => r.code === 'recipe-cycle').detail.cycle).toHaveLength(3);
        });

        it('files a Warning, not a cycle, when a chain is merely blocked', () => {
            const result = runSim({
                recipes: [recipe('recipe_needs_orphan', { inputs: [{ itemId: 'item_orphan', quantity: 1 }], outputs: [out('item_a')] })],
                items: itemsFor('item_a', 'item_orphan'),
            });
            expect(result.rows.some(r => r.code === 'recipe-cycle')).toBe(false);
            expect(result.rows.find(r => r.code === 'blocked-chain').severity).toBe('warning');
            expect(result.rows.find(r => r.code === 'orphan-item').itemId).toBe('item_orphan');
        });
    });

    describe('downcycling stands outside the walk (CMS-130)', () => {
        const downcycleFixture = {
            tokens: { a: token('token_ore_vein', { outputs: [out('item_ore')] }) },
            recipes: [
                recipe('recipe_ingot', { inputs: [{ itemId: 'item_ore', quantity: 4 }], outputs: [out('item_ingot')] }),
                recipe('recipe_melt_ingot', {
                    downcycle: true,
                    inputs: [{ itemId: 'item_ingot', quantity: 1 }],
                    outputs: [out('item_ore', { minQty: 4, maxQty: 4 })],
                }),
            ],
            items: itemsFor('item_ore', 'item_ingot'),
        };

        it('does not anchor, does not create a cycle, and prices nothing', () => {
            const result = runSim(downcycleFixture);
            expect(result.elections.get('item_ore').sourceId).toBe('token_ore_vein');
            expect(result.rows.some(r => r.code === 'recipe-cycle')).toBe(false);
            expect(result.values.get('item_ore')).toBeGreaterThan(0);
            expect(result.values.get('item_ingot')).toBeGreaterThan(0);
        });

        it('caps what comes back at recovery ratio × input value', () => {
            const result = runSim(downcycleFixture);
            const d = result.downcycles.get('recipe_melt_ingot');

            expect(d.cap).toBeCloseTo(0.5 * d.inputValue, 9);
            expect(d.derivedReturn).toBeLessThanOrEqual(d.cap + 1e-9);
            expect(d.authoredReturn).toBeGreaterThan(d.cap);   // the cap is doing work
            expect(result.rows.find(r => r.code === 'downcycle-capped').severity).toBe('info');
        });

        it('the recovery dial refuses to reach 100% — that would duplicate gold', () => {
            expect(() => normaliseDials({ downcycleRecoveryRatio: 1 })).toThrow(/under 1/);
            expect(() => normaliseDials({ downcycleRecoveryRatio: 1.2 })).toThrow();
            expect(normaliseDials({ downcycleRecoveryRatio: 0.9 }).downcycleRecoveryRatio).toBe(0.9);
        });
    });

    describe('⚠️ co-outputs are dependency edges, not just inputs', () => {
        /**
         * Regression test for a defect found by the P3+4 verification pass.
         *
         * `priceEntity` subtracts the value of the outputs it does NOT anchor
         * from its target before splitting the rest. That makes a co-output a
         * dependency, exactly like an input — but the topological walk's
         * readiness test originally waited on inputs alone. So whether the
         * co-output happened to be priced first came down to sorted-id order,
         * and **two economically identical corpora priced differently
         * depending on what the entities were named.**
         *
         * The build was invisible on the shipped corpus (no shipped producer
         * mixes anchored and non-anchored outputs) and idempotence still held,
         * because the wrong ordering was a *stable* wrong ordering. Only a
         * rename would have revealed it.
         */
        const buildPair = (mixedId) => {
            // `mixed` anchors item_p and also drops item_q, which it does not
            // anchor. `other` anchors item_q via an explicit flag.
            const mixed = token(mixedId, {
                outputs: [out('item_p'), out('item_q')],
            });
            const other = token('t_mmm', {
                outputs: [out('item_q', { anchor: true })],
            });
            return {
                tokens: { [mixedId]: mixed, t_mmm: other },
                recipes: {},
                items: itemsFor('item_p', 'item_q'),
            };
        };

        it('prices the same content the same way whatever the entities are named', () => {
            // The only difference between these two corpora is one id, chosen
            // to sort before and after the other entity respectively.
            const before = runSim(buildPair('t_aaa'));
            const after = runSim(buildPair('t_zzz'));

            expect(before.values.get('item_q')).toBe(after.values.get('item_q'));
            expect(before.values.get('item_p')).toBe(after.values.get('item_p'));
        });

        it('subtracts the co-output rather than counting it as zero', () => {
            // The mixed token must wait for item_q, then subtract item_q's
            // contribution from its own target before pricing item_p. The
            // control is the same token with NO co-output at all: it keeps the
            // whole target, so its item_p must come out strictly dearer.
            const withCoOutput = runSim(buildPair('t_aaa'));
            const alone = runSim({
                tokens: { t_aaa: token('t_aaa', { outputs: [out('item_p')] }) },
                recipes: {},
                items: itemsFor('item_p'),
            });

            expect(withCoOutput.details.get('item_p').ideal)
                .toBeLessThan(alone.details.get('item_p').ideal);

            // And the subtraction is exactly item_q's value per cycle, not an
            // arbitrary reduction.
            const q = withCoOutput.values.get('item_q');
            expect(q).toBeGreaterThan(0);
            expect(alone.details.get('item_p').ideal - withCoOutput.details.get('item_p').ideal)
                .toBeCloseTo(q, 6);
        });
    });

    describe('the GPH curve is pinned points, interpolated (plan §13.1)', () => {
        it('hits its endpoints and interpolates linearly between them and interpolates between them', () => {
            expect(gphAt(1, DEFAULT_DIALS)).toBe(1200);
            expect(gphAt(70, DEFAULT_DIALS)).toBe(177000);
            expect(gphAt(99, DEFAULT_DIALS)).toBe(314000);
            expect(gphAt(5, DEFAULT_DIALS)).toBeCloseTo(1200 + (4 / 9) * 1100, 6);
            // Flat outside the pins rather than extrapolated into nonsense.
            expect(gphAt(120, DEFAULT_DIALS)).toBe(314000);
        });
    });
});
