import { describe, it, expect } from 'vitest';
import {
    ModifierAggregator,
    combineMultipliers,
    combinePercentages,
    applyThreeBucket
} from '../systems/effects/ModifierAggregator.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from '../systems/effects/constants.js';
import {
    resolveYield,
    resolveWorkTime,
    resolveInputCost,
    MIN_WORK_TIME_MS,
    MIN_INPUT_COST
} from '../systems/effects/EffectAxes.js';

/**
 * Effect-engine rules, inherited from the Card Mutators & Tokens pass.
 *
 * ## Trimmed by the 7×7 playmat rework, Phase 1
 * The **card-mutator system this file was written for is deleted** — it stamped
 * modifiers onto deck slot indices and wiped them at the Cycle boundary, and
 * both concepts are gone. Removing it is what frees the name "Token" for board
 * objects (grid concept §10.3).
 *
 * What survived is the machinery underneath it, which the board depends on:
 *
 *   Phase 1 — **Three-Bucket math** (§15.3). The single most load-bearing set of
 *             rules in the effect engine, and the reason a stack of small
 *             adjacency buffs (D-120) stays small.
 *   Phase 2 — **card tag derivation** (§15.4). Tags are derived from a
 *             definition's own skill / subskill / type / outputs, so a Token
 *             catalogue needs no hand-audit.
 *   Phase 5 — **the yield / time / cost axes and their hard floors** (§15.8/§10),
 *             now `systems/effects/EffectAxes.js`. ⚠️ These are the ONLY
 *             consumer path in the game for YIELD, WORK_TIME and INPUT_COST —
 *             the board's whole economy resolves through them.
 *   Phase 7 — **the combat axis**, routed into StatusEffectSystem (§15.13).
 *
 * Deleted with the mutator system: Phase 0 scaffolding, Phase 3 slot-token
 * lifecycle, Phase 4 stamping, Phase 8 Area Anchor, Phase 9 badge data.
 *
 * Scope rules (additive stacking, source ids, rehydration) live in
 * `ModifierScopes.test.js`; card work failure states in `CardFailure.test.js`.
 */
describe('Phase 1 — Three-Bucket math (§15.3)', () => {
    describe('combineMultipliers', () => {
        it('defaults to ×1 when the bucket is empty', () => {
            expect(combineMultipliers([])).toBe(1);
            expect(combineMultipliers(undefined)).toBe(1);
        });

        it('SUMS multipliers, it does NOT compound them — three ×2 give ×6, not ×8', () => {
            expect(combineMultipliers([2, 2, 2])).toBe(6);
            expect(combineMultipliers([2, 2, 2])).not.toBe(8);
        });

        it('a single multiplier passes through unchanged', () => {
            expect(combineMultipliers([2])).toBe(2);
            expect(combineMultipliers([1.25])).toBe(1.25);
        });

        it('negative multipliers are legal and genuinely subtract (a curse is -2, not ×0)', () => {
            expect(combineMultipliers([2, 2, -2])).toBe(2);
        });

        it('clamps the summed bucket at 0 so results never go negative', () => {
            expect(combineMultipliers([-2])).toBe(0);
            expect(combineMultipliers([2, -5])).toBe(0);
        });
    });

    describe('combinePercentages', () => {
        it('an empty percentage bucket resolves to ×1', () => {
            expect(combinePercentages([])).toBe(1);
            expect(combinePercentages(undefined)).toBe(1);
        });

        it('percentages SUM as percentages and never inflate one another', () => {
            // +25% and +50% = +75% → ×1.75
            expect(combinePercentages([0.25, 0.5])).toBeCloseTo(1.75);
            // NOT compounded (1.25 × 1.5)
            expect(combinePercentages([0.25, 0.5])).not.toBeCloseTo(1.875);
            // NOT summed as factors (1.25 + 1.5) — the bug this bucket prevents
            expect(combinePercentages([0.25, 0.5])).not.toBeCloseTo(2.75);
        });

        it('a lone percentage behaves exactly as authored', () => {
            expect(combinePercentages([0.25])).toBeCloseTo(1.25);
        });

        it('negative percentages are legal and clamp at 0', () => {
            expect(combinePercentages([0.5, -0.25])).toBeCloseTo(1.25);
            expect(combinePercentages([-2])).toBe(0);
        });
    });

    describe('applyThreeBucket', () => {
        it('§15.3 canonical example — the Shrimp case resolves to 5', () => {
            // Base 1 Shrimp, +1 Shrimp flat, ×2 Fishing output, +25% Shrimp yield
            // (1 + 1) × 2 × 1.25 = 5
            expect(applyThreeBucket(1, {
                flat: [1],
                multipliers: [2],
                percentages: [0.25]
            })).toBe(5);
        });

        it('the three buckets resolve in sequence, each settled before the next', () => {
            // (10 + 2 + 3) × (2 + 2) × (1 + 0.25 + 0.25) = 15 × 4 × 1.5 = 90
            expect(applyThreeBucket(10, {
                flat: [2, 3],
                multipliers: [2, 2],
                percentages: [0.25, 0.25]
            })).toBe(90);
        });

        it('an empty percentage bucket leaves the other two untouched', () => {
            expect(applyThreeBucket(10, { flat: [5], multipliers: [2] })).toBe(30);
        });

        it('base sits INSIDE the flat bucket', () => {
            expect(applyThreeBucket(10, { flat: [5] })).toBe(15);
            // and the multiplier applies to base+flat together, not to base alone
            expect(applyThreeBucket(10, { flat: [5], multipliers: [2] })).toBe(30);
        });

        it('an untouched base survives unchanged (empty buckets = ×1)', () => {
            expect(applyThreeBucket(10)).toBe(10);
            expect(applyThreeBucket(10, {})).toBe(10);
        });

        it('the flat bucket resolves fully before any multiplier is applied', () => {
            // (10 + 2 + 3) × (2 + 2) = 60 — NOT ((10+2)×2 + 3)×2
            expect(applyThreeBucket(10, { flat: [2, 3], multipliers: [2, 2] })).toBe(60);
        });

        it('a fully-cursed stack floors at 0, never negative', () => {
            expect(applyThreeBucket(10, { flat: [5], multipliers: [-3] })).toBe(0);
        });

        it('negative flats are legal and can pull the flat bucket below base', () => {
            expect(applyThreeBucket(10, { flat: [-4], multipliers: [2] })).toBe(12);
        });
    });

    describe('ModifierAggregator buckets', () => {
        const speedMod = (source, value, extra = {}) => ({
            source,
            type: EFFECT_TYPES.SPEED,
            value,
            ...extra
        });

        it('an empty aggregator resolves to ×1', () => {
            const agg = new ModifierAggregator('test');
            expect(agg.getMultiplierBucket(EFFECT_TYPES.SPEED)).toBe(1);
            expect(agg.collectMultipliers(EFFECT_TYPES.SPEED)).toEqual([]);
        });

        it("explicit bucket:'multiplier' entries carry raw factors and sum", () => {
            const agg = new ModifierAggregator('test');
            agg.addModifier(speedMod('a', 2, { bucket: 'multiplier' }));
            agg.addModifier(speedMod('b', 2, { bucket: 'multiplier' }));
            agg.addModifier(speedMod('c', 2, { bucket: 'multiplier' }));
            expect(agg.getMultiplierBucket(EFFECT_TYPES.SPEED)).toBe(6);
        });

        it('legacy fractional buffs (no bucket field) land in the PERCENTAGE bucket', () => {
            const agg = new ModifierAggregator('test');
            agg.addModifier(speedMod('station', 0.25));
            expect(agg.getPercentageBucket(EFFECT_TYPES.SPEED)).toBeCloseTo(1.25);
            // and must NOT be read as a raw factor by the multiplier bucket
            expect(agg.getMultiplierBucket(EFFECT_TYPES.SPEED)).toBe(1);
        });

        it('§15.3 — two percentage buffs SUM as percentages, never as factors', () => {
            const agg = new ModifierAggregator('test');
            agg.addModifier(speedMod('station', 0.25));
            agg.addModifier(speedMod('area', 0.5));
            // +25% and +50% = +75%
            expect(agg.getPercentageBucket(EFFECT_TYPES.SPEED)).toBeCloseTo(1.75);
            expect(agg.getPercentageBucket(EFFECT_TYPES.SPEED)).not.toBeCloseTo(1.875); // compounded
            expect(agg.getPercentageBucket(EFFECT_TYPES.SPEED)).not.toBeCloseTo(2.75);  // summed as factors
        });

        it('multiplier-bucket entries do not leak into the flat bucket', () => {
            const agg = new ModifierAggregator('test');
            agg.addModifier(speedMod('a', 2, { bucket: 'multiplier' }));
            agg.addModifier(speedMod('b', 5, { bucket: 'flat' }));
            expect(agg.getFlat(EFFECT_TYPES.SPEED)).toBe(5);
            expect(agg.getMultiplierBucket(EFFECT_TYPES.SPEED)).toBe(2);
        });

        it('getFlat is the flat bucket sum and excludes Base', () => {
            const agg = new ModifierAggregator('test');
            agg.addModifier({ source: 'gear', type: EFFECT_TYPES.DAMAGE, value: 8 });
            agg.addModifier({ source: 'gear2', type: EFFECT_TYPES.DAMAGE, value: 3 });
            expect(agg.getFlat(EFFECT_TYPES.DAMAGE)).toBe(11);
            expect(applyThreeBucket(20, { flat: [agg.getFlat(EFFECT_TYPES.DAMAGE)] })).toBe(31);
        });

        it('a curse token can fully cancel a stacked card, clamping at 0', () => {
            const agg = new ModifierAggregator('test');
            agg.addModifier(speedMod('boon', 2, { bucket: 'multiplier' }));
            agg.addModifier(speedMod('curse', -2, { bucket: 'multiplier' }));
            expect(agg.getMultiplierBucket(EFFECT_TYPES.SPEED)).toBe(0);
        });

        it('category targeting still applies per bucket', () => {
            const agg = new ModifierAggregator('test');
            agg.addModifier(speedMod('fish', 2, {
                bucket: 'multiplier',
                target: { category: TARGET_CATEGORIES.FISHING }
            }));
            expect(agg.getMultiplierBucket(EFFECT_TYPES.SPEED, TARGET_CATEGORIES.FISHING)).toBe(2);
            expect(agg.getMultiplierBucket(EFFECT_TYPES.SPEED, TARGET_CATEGORIES.MINING)).toBe(1);
        });

        it('§15.12 — one shared bucket pair: separate sources merge before summing', () => {
            const heroAgg = new ModifierAggregator('hero');
            const areaAgg = new ModifierAggregator('area');
            heroAgg.addModifier(speedMod('haste', 2, { bucket: 'multiplier' }));
            areaAgg.addModifier(speedMod('station', 2, { bucket: 'multiplier' }));

            const merged = [
                ...heroAgg.collectMultipliers(EFFECT_TYPES.SPEED),
                ...areaAgg.collectMultipliers(EFFECT_TYPES.SPEED)
            ];
            // Summed, not chained: 4, not 4-by-compounding coincidence elsewhere
            expect(combineMultipliers(merged)).toBe(4);
        });
    });
});

describe('Phase 5 — token effect axes (§15.8 / §10)', () => {
    const speedMod = (source, value, bucket, effectType) => ({
        source, type: effectType, value, bucket,
        target: { category: TARGET_CATEGORIES.ALL }
    });

    describe('ModifierAggregator.resolveAxis', () => {
        it('an axis with no modifiers returns the base untouched', () => {
            const agg = new ModifierAggregator('t');
            expect(agg.resolveAxis(EFFECT_TYPES.YIELD, 3)).toBe(3);
        });

        it('runs the canonical Shrimp case through one aggregator', () => {
            // Base 1, +1 flat, ×2, +25% → (1+1) × 2 × 1.25 = 5
            const agg = new ModifierAggregator('t');
            agg.addModifier(speedMod('a', 1, 'flat', EFFECT_TYPES.YIELD));
            agg.addModifier(speedMod('b', 2, 'multiplier', EFFECT_TYPES.YIELD));
            agg.addModifier(speedMod('c', 0.25, 'percentage', EFFECT_TYPES.YIELD));
            expect(agg.resolveAxis(EFFECT_TYPES.YIELD, 1)).toBe(5);
        });

        it('keeps axes separate — a YIELD token does not touch WORK_TIME', () => {
            const agg = new ModifierAggregator('t');
            agg.addModifier(speedMod('a', 2, 'multiplier', EFFECT_TYPES.YIELD));
            expect(agg.resolveAxis(EFFECT_TYPES.WORK_TIME, 4000)).toBe(4000);
        });
    });

    describe('resolveYield', () => {
        it('doubles a base quantity under a ×2 Trawler', () => {
            const agg = new ModifierAggregator('t');
            agg.addModifier(speedMod('trawler', 2, 'multiplier', EFFECT_TYPES.YIELD));
            expect(resolveYield(agg, 3)).toBe(6);
        });
        it('never goes negative under a curse', () => {
            const agg = new ModifierAggregator('t');
            agg.addModifier(speedMod('curse', -5, 'multiplier', EFFECT_TYPES.YIELD));
            expect(resolveYield(agg, 3)).toBe(0);
        });
        it('tolerates a missing aggregator', () => {
            expect(resolveYield(null, 3)).toBe(3);
        });
    });

    describe('resolveWorkTime (floor 1000ms, §10)', () => {
        it('doubles time under a ×2 Trawler', () => {
            const agg = new ModifierAggregator('t');
            agg.addModifier(speedMod('trawler', 2, 'multiplier', EFFECT_TYPES.WORK_TIME));
            expect(resolveWorkTime(agg, 4000)).toBe(8000);
        });
        it('floors at 1s no matter how much Haste stacks against it', () => {
            const agg = new ModifierAggregator('t');
            // Five −20% Haste percentages sum to −100% → would be 0ms.
            for (let i = 0; i < 5; i++) agg.addModifier(speedMod(`haste${i}`, -0.2, 'percentage', EFFECT_TYPES.WORK_TIME));
            expect(resolveWorkTime(agg, 4000)).toBe(MIN_WORK_TIME_MS);
        });
        it('leaves a sub-second base card alone when no tokens act', () => {
            const agg = new ModifierAggregator('t');
            expect(resolveWorkTime(agg, 500)).toBe(500);
        });
    });

    describe('resolveInputCost (floor 1 unit, §10)', () => {
        it('doubles cost under a ×2 penalty and rounds to a whole unit', () => {
            const agg = new ModifierAggregator('t');
            agg.addModifier(speedMod('greedy', 2, 'multiplier', EFFECT_TYPES.INPUT_COST));
            expect(resolveInputCost(agg, 2)).toBe(4);
        });
        it('never drops below 1 unit however much it is reduced', () => {
            const agg = new ModifierAggregator('t');
            agg.addModifier(speedMod('thrift', -5, 'multiplier', EFFECT_TYPES.INPUT_COST));
            expect(resolveInputCost(agg, 3)).toBe(MIN_INPUT_COST);
        });
        it('passes an untouched cost through unchanged', () => {
            expect(resolveInputCost(new ModifierAggregator('t'), 2)).toBe(2);
        });
    });
});
