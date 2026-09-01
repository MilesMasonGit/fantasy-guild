/**
 * Economic simulator — the lever policy, the refusal catalogue and the churn
 * report (phase P6).
 *
 * Covers `cms/src/engine/sim/tuningPass.js`, `refusals.js` and `churn.js`.
 *
 * ## ⚠️ Why nothing here names a shipped Token, item or recipe
 *
 * The content in `data/` is the owner's live workspace and it moves under the
 * tests: on 2026-09-01 twenty-five Tokens arrived, twenty items arrived, six
 * recipes were authored and one Token was deleted — mid-phase. Several tests
 * broke *while nothing was wrong*, because they named specific content.
 *
 * So: behaviour is proven on **fixtures**, and the real corpus is asserted
 * against **rules** that hold whatever it contains ("no source ever has two
 * levers moved") rather than against any particular source's numbers. Three of
 * the owner's recipes are deliberately unfinished with no outputs at all; the
 * passes must tolerate that, and the corpus sweep below is what says so.
 *
 * ⚠️ Every number in the fixtures comes from the plan's curves and dials
 * (§13.1, §13.3, §13.5) via the engine's own helpers, never from `data/`.
 */

import { describe, it, expect } from 'vitest';

import { adaptCorpus } from '../../cms/src/engine/sim/fieldAdapter.js';
import { runTempoPass } from '../../cms/src/engine/sim/tempoPass.js';
import {
    runTuningPass, snapChanceLadder, inBand, CORRECTION_CAP,
} from '../../cms/src/engine/sim/tuningPass.js';
import { REFUSAL_CATALOGUE, isRefusal, makeRefusal } from '../../cms/src/engine/sim/refusals.js';
import { buildChurnReport } from '../../cms/src/engine/sim/churn.js';
import { runSim } from '../../cms/src/engine/sim/simRunner.js';
import { normaliseDials, toleranceFor } from '../../cms/src/engine/sim/dials.js';
import { applyTokenResults } from '../../cms/src/engine/sim/writeBack.js';

import tokenData from '../../data/tokens.json';
import recipeData from '../../data/tokenRecipes.json';
import itemData from '../../data/items.json';

// === Fixtures ================================================================

const out = (itemId, over = {}) => ({ itemId, chance: 100, minQty: 1, maxQty: 1, ...over });

const token = (id, { level = 1, tempo = 'medium', purpose = 'gph', inputs = [], outputs = [out('item_x')] } = {}) => ({
    id, name: id, rarity: 'common', tokenType: 'resource', uses: 10,
    config: { skill: 'logging', skillRequired: level, cycleTimeMs: 10000, inputs, outputs },
    sim: { tempo, purpose },
});

const recipe = (id, { level = 1, tempo = 'medium', purpose = 'gph', inputs = [], outputs = [out('item_x')] } = {}) => ({
    id, name: id, skill: 'crafting', levelRequirement: level, durationMs: 10000,
    inputs, outputs, sim: { tempo, purpose },
});

/**
 * Run the TUNE pass alone, over hand-made values.
 *
 * Driving the pass directly rather than through `runSim` is what makes these
 * tests readable: an item's value is stated, not reverse-engineered out of an
 * anchor's curve, so a fixture says what it means.
 *
 * `anchors` maps an item id to the source that anchors it; anything absent is
 * inherited, which is the case the policy exists for.
 */
function tune({ tokens = {}, recipes = {}, values = {}, anchors = {}, dials } = {}) {
    const entities = adaptCorpus({ tokens, recipes });
    const time = runTempoPass(entities);
    return runTuningPass(entities, {
        timing: time.timing,
        values: new Map(Object.entries(values)),
        elections: new Map(Object.entries(anchors).map(([itemId, sourceId]) => [itemId, { itemId, sourceId }])),
        dials: normaliseDials(dials),
    });
}

/** How many of the three levers actually moved between before and after. */
function leversMoved(record) {
    if (!record.after) return 0;
    let moved = 0;
    if (record.after.cycleTimeMs !== record.before.cycleTimeMs) moved += 1;
    const qty = record.after.outputs.some((o, i) =>
        o.minQty !== record.before.outputs[i].minQty || o.maxQty !== record.before.outputs[i].maxQty);
    const chance = record.after.outputs.some((o, i) =>
        o.chancePercent !== record.before.outputs[i].chancePercent);
    if (qty) moved += 1;
    if (chance) moved += 1;
    return moved;
}

// === The levers, one at a time ===============================================

describe('EconSim — the lever policy (plan §5)', () => {
    describe('step 0: the band may already forgive it', () => {
        it('leaves an inheritor alone inside the doubled non-anchor band', () => {
            // Earns ~32% over target: outside the ±25% an anchor gets, inside
            // the ±50% an inheritor gets.
            const { tunings } = tune({
                tokens: { t: token('token_second', { outputs: [out('item_x')] }) },
                values: { item_x: 7 },
            });

            const record = tunings.get('token_second');
            expect(record.lever).toBe('none');
            expect(record.inBand).toBe(true);
            const miss = Math.abs(record.before.profitPerHour - record.targetPerHour) / record.targetPerHour;
            expect(miss).toBeGreaterThan(toleranceFor(1, undefined, { isAnchor: true }));
        });

        it('does not forgive the same miss when the source is the anchor', () => {
            const { tunings } = tune({
                tokens: { t: token('token_second', { outputs: [out('item_x')] }) },
                values: { item_x: 7 },
                anchors: { item_x: 'token_second' },
            });
            const record = tunings.get('token_second');
            expect(record.isAnchor).toBe(true);
            expect(record.inBand === true && record.lever === 'none').toBe(false);
        });
    });

    describe('step 1: quantity range', () => {
        it('slides the midpoint and preserves the authored spread', () => {
            const { tunings } = tune({
                tokens: { t: token('token_second', { outputs: [out('item_x', { minQty: 2, maxQty: 3 })] }) },
                values: { item_x: 1 },
            });

            const record = tunings.get('token_second');
            expect(record.lever).toBe('quantity');
            expect(record.inBand).toBe(true);
            const before = record.before.outputs[0];
            const after = record.after.outputs[0];
            expect(after.maxQty - after.minQty).toBe(before.maxQty - before.minQty);
            expect(record.diff).toBe('item_x: 2–3 → 5–6');
        });

        it('steps the integer when the output is a fixed quantity', () => {
            const { tunings } = tune({
                tokens: { t: token('token_second', { outputs: [out('item_x', { minQty: 2, maxQty: 2 })] }) },
                values: { item_x: 1 },
            });
            const record = tunings.get('token_second');
            expect(record.lever).toBe('quantity');
            expect(record.after.outputs[0].minQty).toBe(record.after.outputs[0].maxQty);
        });

        it('never slides a guaranteed drop down to "sometimes nothing"', () => {
            // Needs to produce far less; the floor is 1, not 0.
            const { tunings } = tune({
                tokens: { t: token('token_second', { purpose: 'iph', outputs: [out('item_x', { minQty: 4, maxQty: 6 })] }) },
                values: { item_x: 2 },
            });
            const record = tunings.get('token_second');
            if (record.after) expect(record.after.outputs[0].minQty).toBeGreaterThanOrEqual(1);
        });
    });

    describe('step 2: chance, only where the author made it a dial', () => {
        it('turns a variable chance when the quantity lever cannot reach', () => {
            const { tunings } = tune({
                tokens: {
                    t: token('token_second', {
                        tempo: 'fast',
                        outputs: [out('item_x', { minQty: 1, maxQty: 1, chance: 95, variable: true })],
                    }),
                },
                values: { item_x: 8 },
            });

            const record = tunings.get('token_second');
            expect(record.lever).toBe('chance');
            expect(record.diff).toBe('item_x: 95% → 40% chance');
            expect(record.after.outputs[0].minQty).toBe(1);   // quantity untouched
        });

        it('snaps to 10s, then 5s, then 1s — the ported ladder', () => {
            expect(snapChanceLadder(41.46)).toEqual([40, 41]);
            expect(snapChanceLadder(37)).toEqual([40, 35, 37]);
            // The 5% floor on a primary output.
            expect(snapChanceLadder(2)).toEqual([5]);
            expect(snapChanceLadder(0)).toEqual([]);
        });

        it('NEVER makes a 100%-chance output random, even when that would land it', () => {
            // A chance move would close this exactly; the policy refuses anyway.
            const { tunings, rows } = tune({
                tokens: {
                    t: token('token_second', {
                        tempo: 'fast',
                        // `variable: true` and still 100% — the author kept the
                        // guarantee, so there is no dial to turn.
                        outputs: [out('item_x', { minQty: 1, maxQty: 1, chance: 100, variable: true })],
                    }),
                },
                values: { item_x: 8 },
            });

            const record = tunings.get('token_second');
            expect(record.lever).not.toBe('chance');
            expect(record.after).toBeNull();
            expect(record.refusalCode).toBe('levers-exhausted');
            expect(rows.some(r => r.code === 'levers-exhausted')).toBe(true);
        });
    });

    describe('step 3: cycle time', () => {
        it('moves off the band middle when quantity and chance cannot', () => {
            const { tunings } = tune({
                tokens: { t: token('token_second', { outputs: [out('item_x', { minQty: 1, maxQty: 1 })] }) },
                values: { item_x: 9 },
            });

            const record = tunings.get('token_second');
            expect(record.lever).toBe('cycle');
            expect(record.diff).toBe('cycle 16s → 20s');
            expect(record.after.outputs[0]).toEqual(record.before.outputs[0]);
        });

        it('never leaves the Tempo band', () => {
            const { tunings } = tune({
                tokens: { t: token('token_second', { outputs: [out('item_x', { minQty: 1, maxQty: 1 })] }) },
                values: { item_x: 9 },
            });
            // Medium at level 1 is 12–20s.
            const ms = tunings.get('token_second').after.cycleTimeMs;
            expect(ms).toBeGreaterThanOrEqual(12000);
            expect(ms).toBeLessThanOrEqual(20000);
            expect(ms % 1000).toBe(0);
        });
    });

    describe('the order, and one lever at a time', () => {
        it('prefers quantity over chance when both would work', () => {
            const { tunings } = tune({
                tokens: {
                    t: token('token_second', {
                        outputs: [out('item_x', { minQty: 2, maxQty: 3, chance: 95, variable: true })],
                    }),
                },
                values: { item_x: 1 },
            });
            expect(tunings.get('token_second').lever).toBe('quantity');
        });

        it('prefers chance over cycle when both would work', () => {
            const { tunings } = tune({
                tokens: {
                    t: token('token_second', {
                        outputs: [out('item_x', { minQty: 1, maxQty: 1, chance: 90, variable: true })],
                    }),
                },
                values: { item_x: 9 },
            });
            const record = tunings.get('token_second');
            expect(record.lever).toBe('chance');
            expect(record.after.cycleTimeMs).toBe(record.before.cycleTimeMs);
        });

        it('moves exactly one lever, never two', () => {
            const fixtures = [
                { outputs: [out('item_x', { minQty: 2, maxQty: 3 })], value: 1 },
                { outputs: [out('item_x', { minQty: 1, maxQty: 1, chance: 95, variable: true })], value: 8, tempo: 'fast' },
                { outputs: [out('item_x', { minQty: 1, maxQty: 1 })], value: 9 },
            ];
            for (const f of fixtures) {
                const { tunings } = tune({
                    tokens: { t: token('token_second', { outputs: f.outputs, tempo: f.tempo ?? 'medium' }) },
                    values: { item_x: f.value },
                });
                const record = tunings.get('token_second');
                expect(record.lever).not.toBe('none');
                expect(leversMoved(record)).toBe(1);
            }
        });
    });

    // === The budget rule =====================================================

    describe('a correction worse than 3× refuses instead of grinding', () => {
        it('refuses outright, naming remedies rather than numbers', () => {
            const { tunings, rows } = tune({
                tokens: { t: token('token_second', { tempo: 'fast', outputs: [out('item_x', { minQty: 3, maxQty: 3 })] }) },
                values: { item_x: 8 },
            });

            const record = tunings.get('token_second');
            expect(record.refusalCode).toBe('correction-too-large');
            expect(Math.max(record.ratio, 1 / record.ratio)).toBeGreaterThan(CORRECTION_CAP);
            expect(record.after).toBeNull();

            const row = rows.find(r => r.code === 'correction-too-large');
            expect(row.severity).toBe('warning');
            expect(row.what).toBeTruthy();
            expect(row.why).toBeTruthy();
            expect(row.remedies.length).toBeGreaterThan(0);
        });

        it('lets an IPH source move its quantity as far as it needs, and says so', () => {
            // A level-40 IPH source inheriting a 1g material: volume is exactly
            // what its tag asks for.
            const { tunings, rows } = tune({
                tokens: {
                    t: token('token_second', {
                        level: 40, purpose: 'iph',
                        outputs: [out('item_x', { minQty: 1, maxQty: 2 })],
                    }),
                },
                values: { item_x: 1 },
            });

            const record = tunings.get('token_second');
            expect(record.lever).toBe('quantity');
            expect(record.ratio).toBeGreaterThan(CORRECTION_CAP);
            // The authored spread survives even a move this large.
            expect(record.after.outputs[0].maxQty - record.after.outputs[0].minQty).toBe(1);

            const row = rows.find(r => r.code === 'iph-quantity-exemption');
            expect(row.severity).toBe('warning');   // Warning, not Info (ruled 2026-08-28)
        });

        it('does not extend the exemption to a Gold-tagged source', () => {
            const { tunings } = tune({
                tokens: {
                    t: token('token_second', {
                        level: 40, purpose: 'gph',
                        outputs: [out('item_x', { minQty: 1, maxQty: 2 })],
                    }),
                },
                values: { item_x: 1 },
            });
            expect(tunings.get('token_second').refusalCode).toBe('correction-too-large');
        });

        it('does not extend the exemption to an IPH source\'s chance or cycle', () => {
            const { tunings } = tune({
                tokens: {
                    t: token('token_second', {
                        level: 40, purpose: 'iph',
                        // Fixed at 1 and needing far less: quantity cannot go
                        // down, and the other two levers stay capped.
                        outputs: [out('item_x', { minQty: 1, maxQty: 1, chance: 50, variable: true })],
                    }),
                },
                values: { item_x: 40000 },
            });
            const record = tunings.get('token_second');
            expect(record.lever).toBe('none');
            expect(record.refusalCode).toBe('correction-too-large');
        });
    });

    // === F2: the band judges the whole source ================================

    describe('the band judges the source\'s TOTAL profit per hour (F2)', () => {
        it('leaves a source alone whose main output carries its earnings', () => {
            // item_main pays for the whole target; item_side is a cheap
            // low-level material that would look absurd judged on its own.
            const { tunings } = tune({
                tokens: {
                    t: token('token_second', {
                        outputs: [
                            out('item_main', { minQty: 1, maxQty: 1 }),
                            out('item_side', { minQty: 1, maxQty: 1 }),
                        ],
                    }),
                },
                values: { item_main: 5, item_side: 1 },
            });

            const record = tunings.get('token_second');
            expect(record.inBand).toBe(true);
            expect(record.lever).toBe('none');

            // And the side drop, judged alone, is nowhere near the target — so
            // a per-output implementation would have tuned it.
            const cph = record.before.cyclesPerHour;
            const sideAlone = cph * 1 * 1;
            expect(inBand(sideAlone, record.targetPerHour, record.band)).toBe(false);
        });

        it('tunes the output that contributes most when the miss is real', () => {
            const { tunings } = tune({
                tokens: {
                    t: token('token_second', {
                        outputs: [
                            out('item_side', { minQty: 1, maxQty: 1 }),
                            out('item_main', { minQty: 1, maxQty: 2 }),
                        ],
                    }),
                },
                values: { item_main: 1, item_side: 1 },
            });
            const record = tunings.get('token_second');
            expect(record.lever).toBe('quantity');
            expect(record.outputItemId).toBe('item_main');
            expect(record.after.outputs[0]).toEqual(record.before.outputs[0]);
        });
    });

    // === Training losses =====================================================

    describe('training losses (plan §6, CMS-122)', () => {
        it('allows a gold-negative XP recipe inside the cap, and says why', () => {
            const { tunings, rows } = tune({
                recipes: [recipe('recipe_train', {
                    purpose: 'xph',
                    inputs: [{ itemId: 'item_in', quantity: 2 }],
                    outputs: [out('item_out')],
                })],
                values: { item_in: 1, item_out: 1 },
            });

            const record = tunings.get('recipe_train');
            expect(record.before.profitPerHour).toBeLessThan(0);
            expect(record.inBand).toBe(true);
            expect(record.lever).toBe('none');
            expect(rows.some(r => r.code === 'training-loss-within-cap' && r.severity === 'info')).toBe(true);
        });

        it('refuses a training recipe that eats the level\'s income', () => {
            const { tunings, rows } = tune({
                recipes: [recipe('recipe_train', {
                    purpose: 'xph',
                    inputs: [{ itemId: 'item_in', quantity: 4 }],
                    outputs: [out('item_out')],
                })],
                values: { item_in: 5, item_out: 1 },
            });

            expect(tunings.get('recipe_train').refusalCode).toBe('training-loss-over-cap');
            const row = rows.find(r => r.code === 'training-loss-over-cap');
            expect(row.severity).toBe('warning');
            expect(row.remedies.join(' ')).toMatch(/dial/i);
        });

        it('honours the cap dial', () => {
            const loose = tune({
                recipes: [recipe('recipe_train', {
                    purpose: 'xph',
                    inputs: [{ itemId: 'item_in', quantity: 4 }],
                    outputs: [out('item_out')],
                })],
                values: { item_in: 5, item_out: 1 },
                dials: { trainingLossCap: 5 },
            });
            expect(loose.tunings.get('recipe_train').refusalCode).toBeNull();
        });
    });

    // === Cases the policy declines to judge ==================================

    describe('what it refuses to have an opinion about', () => {
        it('does not judge a source whose input has no value', () => {
            const { tunings, rows } = tune({
                recipes: [recipe('recipe_blocked', {
                    inputs: [{ itemId: 'item_unpriced', quantity: 1 }],
                    outputs: [out('item_out')],
                })],
                values: { item_out: 5 },
            });
            expect(tunings.get('recipe_blocked').skippedReason).toBe('unpriced-inputs');
            expect(rows.filter(r => isRefusal(r.code))).toHaveLength(0);
        });

        it('tolerates a recipe authored with no outputs at all', () => {
            expect(() => tune({
                recipes: [{ id: 'recipe_unfinished', name: 'unfinished', levelRequirement: 1, durationMs: 12000, inputs: [], outputs: [], sim: { tempo: 'medium', purpose: 'gph' } }],
                values: {},
            })).not.toThrow();
        });

        it('tolerates a context requirement written as a bare string', () => {
            expect(() => tune({
                recipes: [{ ...recipe('recipe_ctx'), context: 'station_forge' }],
                values: { item_x: 5 },
            })).not.toThrow();
        });
    });

    // === F3: the standing purpose-mismatch note ==============================

    it('files one standing note per item whose sources disagree about Purpose (F3)', () => {
        const result = runSim({
            tokens: {
                a: token('token_a_gold', { purpose: 'gph', outputs: [out('item_x')] }),
                b: token('token_b_items', { purpose: 'iph', outputs: [out('item_x')] }),
            },
            items: { item_x: { id: 'item_x' } },
        });
        const rows = result.rows.filter(r => r.code === 'purpose-mismatch');
        expect(rows).toHaveLength(1);
        expect(rows[0].severity).toBe('info');
        expect(rows[0].itemId).toBe('item_x');
    });
});

// === The refusal catalogue ===================================================

describe('EconSim — the refusal catalogue (plan §12)', () => {
    it('gives every card a severity the audit panel understands', () => {
        for (const entry of Object.values(REFUSAL_CATALOGUE)) {
            expect(['critical', 'warning', 'info']).toContain(entry.severity);
        }
    });

    it('gives every card at least one remedy', () => {
        for (const code of Object.keys(REFUSAL_CATALOGUE)) {
            const row = makeRefusal(code, { what: 'what', why: 'why' }, {});
            expect(row.remedies.length).toBeGreaterThan(0);
        }
    });

    /**
     * The §12 legibility test, made mechanical: *a designer who reads no
     * formulas knows which tag or dial to change next.* A remedy that hands
     * back a raw quantity — "set it to 17%", "make it 3g" — is the failure this
     * catches. Context numbers live in the card's `why`, which is the
     * observation, not the instruction.
     */
    it('never offers a raw number as the remedy', () => {
        for (const code of Object.keys(REFUSAL_CATALOGUE)) {
            const row = makeRefusal(code, { what: 'w', why: 'y' }, { tooFast: true, hasRange: true, purpose: 'iph' });
            for (const remedy of row.remedies) {
                expect(remedy).not.toMatch(/\d+(\.\d+)?\s*(g\b|%|×|s\b)/);
            }
        }
    });

    it('refuses to invent a card for a code it does not carry', () => {
        expect(() => makeRefusal('map-underwater', { what: 'w', why: 'y' })).toThrow(/Unknown refusal code/);
    });

    it('does not pretend the Map checks exist — those are a later phase', () => {
        expect(isRefusal('map-underwater')).toBe(false);
        expect(isRefusal('map-scrap-rich')).toBe(false);
    });
});

// === The churn report ========================================================

describe('EconSim — the churn report (plan §15.2)', () => {
    const orphanCorpus = {
        tokens: { a: token('token_a', { outputs: [out('item_x')] }) },
        items: { item_x: { id: 'item_x' }, item_lonely: { id: 'item_lonely' } },
    };
    const fixedCorpus = {
        tokens: {
            a: token('token_a', { outputs: [out('item_x')] }),
            b: token('token_b', { outputs: [out('item_lonely')] }),
        },
        items: { item_x: { id: 'item_x' }, item_lonely: { id: 'item_lonely' } },
    };

    it('counts the values that moved and names the largest movers', () => {
        const sim = runSim(orphanCorpus);
        const report = buildChurnReport(sim, {
            itemsBefore: { item_x: { id: 'item_x', value: 1 }, item_lonely: { id: 'item_lonely', value: null } },
            ranAt: 0,
        });
        expect(report.valuesChanged).toBe(1);
        expect(report.largestMovers[0].itemId).toBe('item_x');
        expect(report.largestMovers[0].from).toBe(1);
        expect(report.itemsPriced).toBe(sim.values.size);
    });

    it('lists the sources the lever policy re-tuned', () => {
        const sim = runSim({
            tokens: {
                a: token('token_a_anchor', { outputs: [out('item_x', { minQty: 1, maxQty: 2 })] }),
                b: token('token_b_second', { tempo: 'fast', outputs: [out('item_x', { minQty: 1, maxQty: 2 })] }),
            },
            items: { item_x: { id: 'item_x' } },
        });
        const report = buildChurnReport(sim, { ranAt: 0 });
        for (const entry of report.tuned) {
            expect(entry.lever).not.toBe('none');
            expect(entry.diff).toBeTruthy();
        }
        expect(report.tuned.length).toBe([...sim.tunings.values()].filter(t => t.lever !== 'none').length);
    });

    it('claims nothing new on a first run — there is nothing to diff against', () => {
        const report = buildChurnReport(runSim(orphanCorpus), { ranAt: 0 });
        expect(report.refusals.total).toBeGreaterThan(0);
        expect(report.refusals.new).toHaveLength(0);
        expect(report.refusals.cleared).toHaveLength(0);
    });

    it('reports a refusal cleared by a scripted edit, and a new one when it returns', () => {
        const before = buildChurnReport(runSim(orphanCorpus), { ranAt: 0 });
        // The scripted edit: give the orphan a producer.
        const after = buildChurnReport(runSim(fixedCorpus), { previous: before, ranAt: 1 });
        expect(after.refusals.cleared.map(r => r.code)).toContain('orphan-item');
        expect(after.refusals.new).toHaveLength(0);

        // And undo it.
        const undone = buildChurnReport(runSim(orphanCorpus), { previous: after, ranAt: 2 });
        expect(undone.refusals.new.map(r => r.code)).toContain('orphan-item');
    });

    it('carries the keys the next run needs to do that diff', () => {
        const report = buildChurnReport(runSim(orphanCorpus), { ranAt: 0 });
        expect(report.refusalKeys).toEqual([...report.refusalKeys].sort());
        expect(report.refusalKeys.length).toBe(report.refusals.total);
    });
});

// === The write-back of a tuning ==============================================

describe('EconSim — landing a tuning on the records the game reads', () => {
    /** Two sources of one item; the second inherits and has to be tuned. */
    const corpus = () => ({
        a: token('token_a_anchor', { outputs: [out('item_x', { minQty: 1, maxQty: 2 })] }),
        b: token('token_b_second', { tempo: 'fast', outputs: [out('item_x', { minQty: 1, maxQty: 2 })] }),
    });

    it('writes the tuned quantities onto the fields the game reads', () => {
        const tokens = corpus();
        const sim = runSim({ tokens, items: { item_x: { id: 'item_x' } } });
        const written = applyTokenResults(tokens, sim);

        for (const [id, record] of Object.entries(written)) {
            const tuning = sim.tunings.get(tokens[id].id);
            if (!tuning || tuning.lever !== 'quantity') continue;
            expect(record.config.outputs[0].minQty).toBe(tuning.after.outputs[0].minQty);
            expect(record.config.outputs[0].maxQty).toBe(tuning.after.outputs[0].maxQty);
        }
    });

    it('seeds the authored intent it is about to diverge from', () => {
        // ⚠️ The point: without `baseQty`, one Recalculate would quietly become
        // the new intent and the next would tune away from it again — a
        // ratchet, and the author's number gone for good.
        const tokens = {
            a: token('token_a_anchor', { outputs: [out('item_x', { minQty: 1, maxQty: 2 })] }),
            b: token('token_b_second', { level: 40, purpose: 'iph', outputs: [out('item_x', { minQty: 1, maxQty: 2 })] }),
        };
        const sim = runSim({ tokens, items: { item_x: { id: 'item_x' } } });
        expect(sim.tunings.get('token_b_second').lever).toBe('quantity');

        const written = applyTokenResults(tokens, sim);
        const output = written.b.config.outputs[0];
        expect(output.baseQty).toEqual({ min: 1, max: 2 });
        expect(output.minQty).not.toBe(1);
    });

    it('leaves an untouched output exactly as it was', () => {
        const tokens = { a: token('token_a_anchor', { outputs: [out('item_x', { minQty: 1, maxQty: 2 })] }) };
        const sim = runSim({ tokens, items: { item_x: { id: 'item_x' } } });
        const written = applyTokenResults(tokens, sim);
        expect(written.a.config.outputs[0].baseQty).toBeUndefined();
        expect(written.a.config.outputs[0].baseChance).toBeUndefined();
    });

    it('re-derives from intent rather than ratcheting, run after run', () => {
        const tokens = {
            a: token('token_a_anchor', { outputs: [out('item_x', { minQty: 1, maxQty: 2 })] }),
            b: token('token_b_second', { level: 40, purpose: 'iph', outputs: [out('item_x', { minQty: 1, maxQty: 2 })] }),
        };
        const items = { item_x: { id: 'item_x' } };

        const first = applyTokenResults(tokens, runSim({ tokens, items }));
        const second = applyTokenResults(first, runSim({ tokens: first, items }));
        expect(second.b.config.outputs[0]).toEqual(first.b.config.outputs[0]);
        // The authored intent is still there to be read on the third run.
        expect(second.b.config.outputs[0].baseQty).toEqual({ min: 1, max: 2 });
    });
});

// === The real corpus, asserted as rules ======================================

describe('EconSim — the lever policy over the shipped corpus', () => {
    // ⚠️ Rules only. Nothing below may name a Token, item or recipe id: the
    // owner authors in this workspace continuously.
    const result = runSim({ tokens: tokenData, recipes: recipeData, items: itemData });
    const records = [...result.tunings.values()];

    it('runs over whatever is in data/ without throwing', () => {
        expect(records.length).toBeGreaterThan(0);
    });

    it('never moves two levers on one source', () => {
        for (const record of records) expect(leversMoved(record)).toBeLessThanOrEqual(1);
    });

    it('reaches exactly one verdict per source it judged', () => {
        for (const record of records) {
            const verdicts = [
                Boolean(record.skippedReason),
                Boolean(record.refusalCode),
                record.inBand === true,
            ].filter(Boolean);
            expect(verdicts).toHaveLength(1);
        }
    });

    it('every refusal it raises carries what, why and ranked remedies', () => {
        for (const row of result.rows.filter(r => isRefusal(r.code))) {
            expect(row.what).toBeTruthy();
            expect(row.why).toBeTruthy();
            expect(row.remedies.length).toBeGreaterThan(0);
        }
    });

    it('never hands back a raw number as a remedy', () => {
        for (const row of result.rows) {
            for (const remedy of row.remedies) {
                expect(remedy).not.toMatch(/\d+(\.\d+)?\s*(g\b|%|×)/);
            }
        }
    });

    it('leaves every tuned cycle inside whole seconds', () => {
        for (const ms of result.cycleTimes.values()) expect(ms % 1000).toBe(0);
    });

    it('never turns a 100%-chance output into a random one', () => {
        for (const record of records) {
            if (!record.after) continue;
            record.before.outputs.forEach((before, i) => {
                if (before.chancePercent !== 100) return;
                expect(record.after.outputs[i].chancePercent).toBe(100);
            });
        }
    });

    it('changes no item value — tuning never re-opens a price', () => {
        const second = runSim({ tokens: tokenData, recipes: recipeData, items: itemData });
        expect([...second.values.entries()].sort()).toEqual([...result.values.entries()].sort());
    });
});
