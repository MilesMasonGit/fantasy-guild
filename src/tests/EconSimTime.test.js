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
 * `yield agreement` imports the *game's* `expectedOutputQuantity` and asserts
 * the simulator's average quantity equals it for every shipped output. If those
 * two ever diverge, every units/hour figure — and therefore every band, every
 * price — is quietly wrong (finding S17/A6).
 */

import { describe, it, expect } from 'vitest';

import { runTempoPass, bandMiddleMs, speedAt, unitsPerHour } from '../../cms/src/engine/sim/tempoPass.js';
import { adaptCorpus, adaptToken, liveCharges, expectedQuantity } from '../../cms/src/engine/sim/fieldAdapter.js';
import { bandFor } from '../config/registries/tempoBands.js';
import { SKILL_SPEED_FACTOR } from '../config/FormulaRegistry.js';
import { expectedOutputQuantity } from '../config/registries/tokenRegistry.js';

import tokenData from '../../data/tokens.json';
import recipeData from '../../data/tokenRecipes.json';

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
        it('the simulator\'s average quantity equals the game\'s expectedOutputQuantity', () => {
            const outputs = [
                ...Object.values(tokenData).flatMap(t => t.config?.outputs ?? []),
                ...recipeData.flatMap(r => r.outputs ?? []),
            ];
            expect(outputs.length).toBeGreaterThan(10);

            for (const output of outputs) {
                expect(expectedQuantity(output)).toBe(expectedOutputQuantity(output));
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
