/**
 * Economic simulator — the TIME pass (phase P3+4).
 *
 * Covers `cms/src/engine/sim/tempoPass.js` and the field adapter beneath it.
 *
 * ## Where these tests live, and why
 * The CMS has no test runner of its own, so CMS engine code is tested across
 * the project boundary from `src/tests/` — the precedent set by
 * `CMSBalanceEngine.test.js` (finding S13).
 *
 * ## The pin that matters most
 * `yield agreement` imports the *game's* `expectedOutputQuantity` and pins the
 * simulator's average-quantity arithmetic against it. If the two formulas ever
 * diverge, every units/hour figure — and therefore every band, every price — is
 * quietly wrong (finding S17/A6).
 *
 * ⚠️ **What it compares changed at P6.** The simulator reads authored *intent*
 * (`baseQty`); the game reads the *derived* `minQty`/`maxQty`. Before the
 * tuning pass existed those were always the same numbers, so the pin could
 * compare the two functions on a shipped output and see them agree. Now a
 * tuned output has derived values deliberately different from its intent —
 * that difference IS the tuning — so comparing them on shipped data would fail
 * on exactly the outputs the simulator did its job on.
 *
 * The invariant that matters survives and is what is pinned below: given the
 * same numbers, both sides compute the same expected quantity. Alongside it, a
 * corpus check that any divergence between intent and derived is explained by
 * a recorded tuning move, never by drift.
 */

import { describe, it, expect } from 'vitest';

import { runTempoPass, bandMiddleMs, speedAt, unitsPerHour } from '../../cms/src/engine/sim/tempoPass.js';
import { runSim } from '../../cms/src/engine/sim/simRunner.js';
import { adaptCorpus, adaptToken, liveCharges, expectedQuantity } from '../../cms/src/engine/sim/fieldAdapter.js';
import { bandFor } from '../config/registries/tempoBands.js';
import { SKILL_SPEED_FACTOR } from '../config/FormulaRegistry.js';
import { expectedOutputQuantity } from '../config/registries/tokenRegistry.js';

import tokenData from '../../data/tokens.json';
import recipeData from '../../data/tokenRecipes.json';
import itemData from '../../data/items.json';

const cycledToken = (over = {}) => ({
    name: 'Test Grove',
    rarity: 'common',
    tokenType: 'resource',
    uses: 25,
    charges: 500,
    config: {
        skill: 'logging',
        skillRequired: 1,
        cycleTimeMs: 16000,
        inputs: [],
        outputs: [{ itemId: 'item_test_wood', chance: 100, minQty: 1, maxQty: 2, baseQty: { min: 1, max: 2 } }],
    },
    sim: { tempo: 'medium', purpose: 'iph' },
    ...over,
});

describe('EconSim — TIME pass', () => {
    describe('the field adapter (finding S24/B5: one normaliser at the edge)', () => {
        it('gives a Token and a Recipe the same shape from different field names', () => {
            const [recipe, token] = adaptCorpus({
                tokens: { token_a: cycledToken({ id: 'token_a' }) },
                recipes: [{
                    id: 'recipe_a', name: 'Test Recipe', skill: 'cooking', levelRequirement: 7,
                    durationMs: 12000, inputs: [{ itemId: 'item_x', quantity: 2 }],
                    outputs: [{ itemId: 'item_y', chance: 50, minQty: 2, maxQty: 4 }],
                    sim: { tempo: 'fast', purpose: 'gph' },
                }],
            });

            expect(recipe.id).toBe('recipe_a');
            expect(recipe.kind).toBe('recipe');
            expect(recipe.level).toBe(7);            // levelRequirement
            expect(recipe.authoredCycleTimeMs).toBe(12000);  // durationMs
            expect(recipe.outputs[0].chance).toBe(0.5);
            expect(recipe.inputs[0]).toEqual({ itemId: 'item_x', quantity: 2 });

            expect(token.kind).toBe('token');
            expect(token.level).toBe(1);             // config.skillRequired
            expect(token.authoredCycleTimeMs).toBe(16000);   // config.cycleTimeMs
            expect(token.skill).toBe('logging');

            // Same keys, either side.
            expect(Object.keys(token).sort()).toEqual(Object.keys(recipe).sort());
        });

        it('reads charges from `uses` and never from `charges` (finding S6/A5)', () => {
            // The shipped shape: the two fields disagree, and only `uses` has
            // ever meant anything to the game (tokenRegistry.js:146).
            expect(liveCharges({ uses: 25, charges: 500 })).toBe(25);
            expect(liveCharges({ charges: 500 })).toBe(null);
            expect(adaptToken(cycledToken({ id: 't' })).charges).toBe(25);
        });

        it('treats a missing required level as level 1', () => {
            const entity = adaptToken(cycledToken({ id: 't', config: { ...cycledToken().config, skillRequired: undefined } }));
            expect(entity.level).toBe(1);
        });
    });

    describe('cycle time', () => {
        it('is the middle of the tempo band, snapped to whole seconds', () => {
            const band = bandFor('medium', 1);
            expect(bandMiddleMs('medium', 1)).toBe(16000);   // (12000 + 20000) / 2
            expect(bandMiddleMs('medium', 1)).toBe(Math.round(((band.minMs + band.maxMs) / 2) / 1000) * 1000);

            // Every band middle, at a spread of levels, is a whole number of seconds.
            for (const tempo of ['fast', 'medium', 'slow', 'heavy']) {
                for (const level of [1, 5, 17, 40, 70, 99]) {
                    const ms = bandMiddleMs(tempo, level);
                    expect(ms % 1000).toBe(0);
                    const b = bandFor(tempo, level);
                    expect(ms).toBeGreaterThanOrEqual(Math.floor(b.minMs / 1000) * 1000);
                }
            }
        });

        it('uses the game\'s SKILL_SPEED_FACTOR rather than a copy of 0.005', () => {
            expect(speedAt(1)).toBe(1 + SKILL_SPEED_FACTOR);
            expect(speedAt(20)).toBeCloseTo(1.1, 10);
        });

        it('computes units/hour as avg qty × chance ÷ cycle × 3600 × speed', () => {
            const output = { abundance: 1.5 * 0.5 };
            expect(unitsPerHour(output, 10000, 1)).toBeCloseTo((0.75 / 10) * 3600 * 1.005, 8);
        });
    });

    describe('the untagged rule and the structural skip are different things', () => {
        it('an untagged producer is skipped and files exactly one Info row (A10)', () => {
            const entities = adaptCorpus({ tokens: { token_a: cycledToken({ id: 'token_a', sim: undefined }) } });
            const result = runTempoPass(entities);

            expect(result.skipped.get('token_a')).toBe('untagged');
            expect(result.cycleTimes.has('token_a')).toBe(false);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].severity).toBe('info');
            expect(result.rows[0].code).toBe('untagged-producer');
        });

        it('a half-tagged producer is untagged too', () => {
            const entities = adaptCorpus({ tokens: { t: cycledToken({ id: 't', sim: { tempo: 'medium' } }) } });
            expect(runTempoPass(entities).skipped.get('t')).toBe('untagged');
        });

        it('an inert Token (config: null) is skipped SILENTLY — no row (B11/S21)', () => {
            const entities = adaptCorpus({
                tokens: {
                    token_pickaxe: { id: 'token_pickaxe', name: 'Pickaxe', tokenType: 'context', config: null },
                    token_buff: { id: 'token_buff', name: 'Forge Altar', tokenType: 'buff', config: null },
                },
            });
            const result = runTempoPass(entities);

            expect(result.skipped.get('token_pickaxe')).toBe('inert');
            expect(result.skipped.get('token_buff')).toBe('inert');
            expect(result.rows).toHaveLength(0);
        });

        it('the shipped corpus files no row for its 23 config-less Tokens', () => {
            const entities = adaptCorpus({ tokens: tokenData, recipes: recipeData });
            const result = runTempoPass(entities);
            const inert = [...result.skipped.values()].filter(r => r === 'inert').length;

            expect(inert).toBeGreaterThanOrEqual(23);
            // Not one of them is allowed to produce a row: 23 permanent Info
            // entries would bury every real row.
            expect(result.rows.filter(r => r.code === 'untagged-producer')).toHaveLength(0);
        });

        it('an unknown tempo is reported rather than guessed at', () => {
            const entities = adaptCorpus({ tokens: { t: cycledToken({ id: 't', sim: { tempo: 'brisk', purpose: 'gph' } }) } });
            const result = runTempoPass(entities);
            expect(result.rows[0].code).toBe('unknown-tempo');
            expect(result.cycleTimes.has('t')).toBe(false);
        });

        it('an unknown purpose is reported rather than silently worth zero', () => {
            // ⚠️ Without this row a mistyped Purpose is invisible: the gold
            // factor lookup returns 0, the target becomes 0 g/hr, and every
            // item the entity anchors falls to the 1g floor with nothing
            // saying why. Tempo already named its own typos; the asymmetry was
            // unintended and was found by the P3+4 verification pass.
            const entities = adaptCorpus({ tokens: { t: cycledToken({ id: 't', sim: { tempo: 'fast', purpose: 'gold' } }) } });
            const result = runTempoPass(entities);
            expect(result.rows[0].code).toBe('unknown-purpose');
            expect(result.cycleTimes.has('t')).toBe(false);
        });
    });

    describe('yield agreement with the runtime (the S17/A6 pin)', () => {
        it('the two formulas agree given the same numbers', () => {
            // Strip the intent field so both sides read the same pair. This is
            // the arithmetic pin: (min + max) / 2, computed identically on
            // either side of the project boundary.
            const outputs = [
                ...Object.values(tokenData).flatMap(t => t.config?.outputs ?? []),
                ...recipeData.flatMap(r => r.outputs ?? []),
            ];
            expect(outputs.length).toBeGreaterThan(10);

            for (const output of outputs) {
                const { baseQty, ...derivedOnly } = output;
                expect(expectedQuantity(derivedOnly)).toBe(expectedOutputQuantity(derivedOnly));
            }
        });

        it('⚠️ every divergence between intent and derived is a recorded tuning move', () => {
            // The drift alarm for the seam itself. A derived quantity that does
            // not match its intent is either the tuning pass doing its job, or
            // something wrote a yield behind the simulator's back. The second
            // is the failure this catches — it would make the game roll
            // something the simulator never balanced.
            const sim = runSim({
                items: itemData,
                tokens: tokenData,
                recipes: Object.fromEntries(recipeData.map(r => [r.id, r])),
            });
            const tuned = new Set(
                [...(sim.tunings?.values() ?? [])]
                    .filter(t => t.lever === 'quantity' || t.lever === 'chance')
                    .map(t => t.outputItemId)
                    .filter(Boolean)
            );

            for (const [id, def] of Object.entries(tokenData)) {
                for (const output of def.config?.outputs ?? []) {
                    if (!output.baseQty) continue;
                    const intent = (output.baseQty.min + output.baseQty.max) / 2;
                    if (expectedOutputQuantity(output) === intent) continue;
                    expect(
                        tuned.has(output.itemId),
                        `${id}'s ${output.itemId} yield differs from its authored intent with no tuning move behind it`
                    ).toBe(true);
                }
            }
        });

        it('agrees on the degenerate and legacy shapes too', () => {
            for (const output of [
                { minQty: 1, maxQty: 1 },
                { minQty: 2, maxQty: 5 },
                { quantity: 3 },
                { minQty: 4, maxQty: 2 },   // inverted, tolerated both sides
            ]) {
                expect(expectedQuantity(output)).toBe(expectedOutputQuantity(output));
            }
        });
    });
});
