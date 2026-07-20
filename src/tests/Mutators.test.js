import { describe, it, expect } from 'vitest';
import { TOKENS, getToken, getAllTokens, tokenMatchesTags } from '../systems/effects/TokenRegistry.js';
import { CARD_TYPES } from '../config/registries/cardConstants.js';
import {
    ModifierAggregator,
    combineMultipliers,
    applyTwoBucket
} from '../systems/effects/ModifierAggregator.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from '../systems/effects/constants.js';

/**
 * Card Mutators & Tokens — test scaffold (mutator_roadmap_v1.md).
 *
 * Phase 0 is inert scaffolding, so these tests only pin the scaffolding
 * itself. Later phases append their own describe blocks here:
 *   Phase 1 — Two-Bucket math rules (§15.3)
 *   Phase 2 — card tag derivation (§15.4)
 *   Phase 3 — slot token lifecycle & Cycle wipe (F1/F2/F3)
 *   Phase 4 — stamping, charge waste, area-wide targeting (§15.5/§15.14)
 */
describe('Phase 0 — Mutator scaffolding', () => {
    it('CARD_TYPES exposes the ACTION type (§15.16)', () => {
        expect(CARD_TYPES.ACTION).toBe('action');
    });

    it('ACTION is a single type with no subtype field — traits distinguish mutators from consumables', () => {
        const actionish = Object.keys(CARD_TYPES).filter(k => k.startsWith('ACTION'));
        expect(actionish).toEqual(['ACTION']);
    });

    it('adding ACTION did not disturb the existing card types', () => {
        expect(CARD_TYPES.TASK).toBe('task');
        expect(CARD_TYPES.COMBAT).toBe('combat');
        expect(CARD_TYPES.STATION).toBe('station');
    });

    it('TokenRegistry ships empty in Phase 0 — content lands in Phase 10', () => {
        expect(TOKENS).toEqual({});
        expect(getAllTokens()).toBe(TOKENS);
    });

    it('getToken returns null for an unknown id rather than throwing', () => {
        expect(getToken('trawler_net')).toBeNull();
        expect(getToken(undefined)).toBeNull();
    });

    describe('tokenMatchesTags', () => {
        it('matches a declared tag regardless of casing (§15.4)', () => {
            const def = { target_tags: ['Aquatic'] };
            expect(tokenMatchesTags(def, ['fishing', 'aquatic'])).toBe(true);
            expect(tokenMatchesTags(def, ['AQUATIC'])).toBe(true);
        });

        it('does not match a card without the tag', () => {
            expect(tokenMatchesTags({ target_tags: ['Aquatic'] }, ['Mining'])).toBe(false);
        });

        it("'*' targets any card (the Cursed / Dam case, §14)", () => {
            expect(tokenMatchesTags({ target_tags: ['*'] }, ['Mining'])).toBe(true);
            expect(tokenMatchesTags({ target_tags: ['*'] }, [])).toBe(true);
        });

        it('a token declaring no target_tags matches nothing', () => {
            expect(tokenMatchesTags({}, ['Mining'])).toBe(false);
            expect(tokenMatchesTags(null, ['Mining'])).toBe(false);
        });
    });
});

/**
 * Phase 1 — Two-Bucket modifier engine (status_effects_plan.md §15.3, LOCKED).
 *
 *      Final = (Base + Σ additive) × (Σ multipliers)
 *
 * These tests exist to STOP a future reader "fixing" the counter-intuitive
 * parts of the model. Multipliers summing rather than compounding, and an
 * empty bucket meaning ×1, are both deliberate.
 */
describe('Phase 1 — Two-Bucket math (§15.3)', () => {
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

    describe('applyTwoBucket', () => {
        it('base sits INSIDE the additive bucket', () => {
            expect(applyTwoBucket(10, { additive: [5] })).toBe(15);
            // and the multiplier applies to base+additive together, not to base alone
            expect(applyTwoBucket(10, { additive: [5], multipliers: [2] })).toBe(30);
        });

        it('an untouched base survives unchanged (empty multiplier bucket = ×1)', () => {
            expect(applyTwoBucket(10)).toBe(10);
            expect(applyTwoBucket(10, {})).toBe(10);
        });

        it('additive resolves fully before any multiplier is applied', () => {
            // (10 + 2 + 3) × (2 + 2) = 60 — NOT ((10+2)×2 + 3)×2
            expect(applyTwoBucket(10, { additive: [2, 3], multipliers: [2, 2] })).toBe(60);
        });

        it('a fully-cursed stack floors at 0, never negative', () => {
            expect(applyTwoBucket(10, { additive: [5], multipliers: [-3] })).toBe(0);
        });

        it('negative additives are legal and can pull the additive bucket below base', () => {
            expect(applyTwoBucket(10, { additive: [-4], multipliers: [2] })).toBe(12);
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

        it('legacy fractional buffs (no bucket field) read as 1 + value', () => {
            const agg = new ModifierAggregator('test');
            agg.addModifier(speedMod('station', 0.25));
            expect(agg.getMultiplierBucket(EFFECT_TYPES.SPEED)).toBeCloseTo(1.25);
        });

        it('multiplier-bucket entries do not leak into the additive bucket', () => {
            const agg = new ModifierAggregator('test');
            agg.addModifier(speedMod('a', 2, { bucket: 'multiplier' }));
            agg.addModifier(speedMod('b', 5, { bucket: 'additive' }));
            expect(agg.getAdditive(EFFECT_TYPES.SPEED)).toBe(5);
            expect(agg.getMultiplierBucket(EFFECT_TYPES.SPEED)).toBe(2);
        });

        it('getAdditive is the additive bucket sum and excludes Base', () => {
            const agg = new ModifierAggregator('test');
            agg.addModifier({ source: 'gear', type: EFFECT_TYPES.DAMAGE, value: 8 });
            agg.addModifier({ source: 'gear2', type: EFFECT_TYPES.DAMAGE, value: 3 });
            expect(agg.getAdditive(EFFECT_TYPES.DAMAGE)).toBe(11);
            expect(applyTwoBucket(20, { additive: [agg.getAdditive(EFFECT_TYPES.DAMAGE)] })).toBe(31);
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
