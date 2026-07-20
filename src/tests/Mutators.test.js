import { describe, it, expect } from 'vitest';
import { TOKENS, getToken, getAllTokens, tokenMatchesTags } from '../config/registries/TokenRegistry.js';
import { CARD_TYPES } from '../config/registries/cardConstants.js';
import {
    ModifierAggregator,
    combineMultipliers,
    combinePercentages,
    applyThreeBucket
} from '../systems/effects/ModifierAggregator.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from '../systems/effects/constants.js';
import {
    deriveCardTags,
    normalizeTag,
    normalizeTags,
    cardHasTag,
    CARD_TAG_OVERRIDES,
    FLAVOUR_TAGS
} from '../config/registries/tagRegistry.js';
import { CardFactory } from '../systems/cards/logic/CardFactory.js';

/**
 * Card Mutators & Tokens — test scaffold (mutator_roadmap_v1.md).
 *
 * Phase 0 is inert scaffolding, so these tests only pin the scaffolding
 * itself. Later phases append their own describe blocks here:
 *   Phase 1 — Three-Bucket math rules (§15.3)
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
 * Phase 1 — Three-Bucket modifier engine (status_effects_plan.md §15.3, LOCKED).
 *
 *      Final = (Base + Σ flat) × (Σ multipliers) × (1 + Σ percentages)
 *
 * These tests exist to STOP a future reader "fixing" the counter-intuitive
 * parts of the model. All of these are deliberate: multipliers summing rather
 * than compounding, percentages summing as percentages rather than as factors,
 * and an empty bucket meaning ×1.
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

/**
 * Phase 2 â€” Card tags (status_effects_plan.md Â§15.4).
 *
 * Tags are DERIVED from data the cards already carry. The whole point is that
 * the catalog needs no hand-audit: if these tests ever start needing authored
 * `tags` arrays to pass, the derivation has regressed.
 */
describe('Phase 2 â€” Card tags (Â§15.4)', () => {
    describe('canonical casing', () => {
        it('normalises to Title Case so only one casing ever circulates', () => {
            expect(normalizeTag('fishing')).toBe('Fishing');
            expect(normalizeTag('FISHING')).toBe('Fishing');
            expect(normalizeTag('  Fishing  ')).toBe('Fishing');
        });

        it('splits snake/kebab/spaced ids into Title Case words', () => {
            expect(normalizeTag('rapid_river')).toBe('Rapid River');
            expect(normalizeTag('rapid-river')).toBe('Rapid River');
        });

        it('rejects empty and non-tag input rather than emitting junk tags', () => {
            expect(normalizeTag('')).toBeNull();
            expect(normalizeTag('   ')).toBeNull();
            expect(normalizeTag(null)).toBeNull();
            expect(normalizeTag(undefined)).toBeNull();
        });

        it('de-duplicates across casings â€” Fishing and fishing collapse to one tag', () => {
            expect(normalizeTags(['Fishing', 'fishing', 'FISHING'])).toEqual(['Fishing']);
        });

        it('preserves authoring order for the tags that survive', () => {
            expect(normalizeTags(['nature', 'gathering', 'nature'])).toEqual(['Nature', 'Gathering']);
        });

        it('agrees with tokenMatchesTags â€” a derived tag matches a token that names it', () => {
            const tags = deriveCardTags({ id: 't', cardType: 'task', config: { skill: 'fishing' } });
            expect(tokenMatchesTags({ target_tags: ['aquatic'] }, tags)).toBe(true);
            expect(tokenMatchesTags({ target_tags: ['Aquatic'] }, tags)).toBe(true);
        });
    });

    describe('derivation â€” gathering cards', () => {
        it('a Fishing task comes out tagged Fishing with no authoring at all', () => {
            const tags = deriveCardTags({
                id: 'task_fishing_hole',
                cardType: 'task',
                config: { skill: 'fishing' }
            });
            expect(tags).toContain('Fishing');
            // ...plus its parent skill and category, which is what makes
            // "all Aquatic cards" and "all Gathering cards" targetable.
            expect(tags).toContain('Aquatic');
            expect(tags).toContain('Gathering');
            expect(tags).toContain('Task');
        });

        it('a legacy skill id resolves to the canonical skill and does NOT leak its old name', () => {
            // 'nautical' is a pre-15-skill alias for 'aquatic'
            const tags = deriveCardTags({
                id: 'task_shrimp_river',
                cardType: 'task',
                config: { skill: 'nautical' }
            });
            expect(tags).toContain('Aquatic');
            expect(tags).not.toContain('Nautical');
        });

        it('a mining task lands under Labor / Gathering', () => {
            const tags = deriveCardTags({
                id: 'task_copper_vein',
                cardType: 'task',
                config: { skill: 'mining' }
            });
            expect(tags).toEqual(expect.arrayContaining(['Task', 'Mining', 'Labor', 'Gathering']));
        });
    });

    describe('derivation â€” processing cards', () => {
        it('a smelting task lands under Forge / Processing, not Gathering', () => {
            const tags = deriveCardTags({
                id: 'task_copper_smelter',
                cardType: 'task',
                config: { skill: 'smelting' }
            });
            expect(tags).toEqual(expect.arrayContaining(['Smelting', 'Forge', 'Processing']));
            expect(tags).not.toContain('Gathering');
        });

        it('a culinary card resolves through its legacy alias to Cooking / Processing', () => {
            const tags = deriveCardTags({
                id: 'station_kitchen',
                cardType: 'station',
                config: { skill: 'culinary' }
            });
            expect(tags).toEqual(expect.arrayContaining(['Station', 'Cooking', 'Processing']));
            expect(tags).not.toContain('Culinary');
        });
    });

    describe('derivation â€” combat cards (Phase 7 depends on this, Â§15.13)', () => {
        it('a combat card carries a Combat tag even with no skill declared', () => {
            const tags = deriveCardTags({
                id: 'combat_wolf_forest',
                cardType: 'combat',
                enemyId: 'forest_t1_wolf'
            });
            expect(tags).toContain('Combat');
        });

        it('a combat card is never tagged Hazard â€” the fight IS the card', () => {
            const tags = deriveCardTags({
                id: 'combat_wolf_forest',
                cardType: 'combat',
                enemyId: 'forest_t1_wolf'
            });
            expect(tags).not.toContain('Hazard');
        });

        it('a combat card is visible to a token that targets Combat', () => {
            const tags = deriveCardTags({ id: 'c', cardType: 'combat', enemyId: 'e' });
            expect(tokenMatchesTags({ target_tags: ['Combat'] }, tags)).toBe(true);
        });
    });

    describe('flavour tags', () => {
        it('Â§15.4 names exactly four flavour tags', () => {
            expect(FLAVOUR_TAGS).toEqual(['Aquatic', 'Gathering', 'Social', 'Hazard']);
        });

        it('Hazard is DERIVED from a combat_trigger output, not hand-authored', () => {
            const tags = deriveCardTags({
                id: 'task_berry_bush_patch',
                cardType: 'task',
                config: {
                    skill: 'nature',
                    outputs: [
                        { itemId: 'item_blueberry', quantity: 1, chance: 30 },
                        { type: 'combat_trigger', enemyId: 'enemy_thorn_elemental', chance: 30 }
                    ]
                }
            });
            expect(tags).toContain('Hazard');
        });

        it('a peaceful gathering card is not tagged Hazard', () => {
            const tags = deriveCardTags({
                id: 'task_wheat_field',
                cardType: 'task',
                config: { skill: 'nature', outputs: [{ itemId: 'item_wheat', quantity: 1 }] }
            });
            expect(tags).not.toContain('Hazard');
        });

        it('Social is DERIVED from the social skill', () => {
            const tags = deriveCardTags({
                id: 'task_community_garden',
                cardType: 'task',
                config: { skill: 'social' }
            });
            expect(tags).toContain('Social');
        });

        it('the hand-added override map stays small â€” it is an escape hatch, not a catalog', () => {
            expect(Object.keys(CARD_TAG_OVERRIDES).length).toBeLessThanOrEqual(5);
        });

        it('an override ADDS flavour without replacing derived tags', () => {
            const tags = deriveCardTags({
                id: 'task_wishing_well',
                cardType: 'task',
                config: { skill: 'nature' }
            });
            expect(tags).toContain('Aquatic'); // hand-added: a well is water
            expect(tags).toContain('Nature');  // still derived
        });
    });

    describe('authored tags', () => {
        it('tags authored on a template are merged in and normalised', () => {
            const tags = deriveCardTags({
                id: 'task_x',
                cardType: 'task',
                config: { skill: 'nature' },
                tags: ['rapid_river', 'NATURE']
            });
            expect(tags).toContain('Rapid River');
            expect(tags.filter(t => t === 'Nature')).toHaveLength(1);
        });

        it('a template with nothing to go on yields an empty list, never undefined', () => {
            expect(deriveCardTags({})).toEqual([]);
            expect(deriveCardTags(null)).toEqual([]);
            expect(deriveCardTags(undefined)).toEqual([]);
        });
    });

    describe('CardFactory.createInstance', () => {
        it('every card instance carries a tags array', () => {
            const card = CardFactory.createInstance({
                id: 'task_test_fishing',
                name: 'Test Fishing',
                cardType: 'task',
                config: { skill: 'fishing' }
            });
            expect(Array.isArray(card.tags)).toBe(true);
            expect(card.tags).toContain('Fishing');
            expect(card.tags).toContain('Aquatic');
        });

        it('a combat instance is tagged too', () => {
            const card = CardFactory.createInstance({
                id: 'combat_test',
                name: 'Test Fight',
                cardType: 'combat'
            });
            expect(card.tags).toContain('Combat');
        });

        it('explicit override tags win over derivation and are normalised', () => {
            const card = CardFactory.createInstance(
                { id: 'task_test', name: 'T', cardType: 'task', config: { skill: 'nature' } },
                { overrides: { tags: ['aquatic', 'AQUATIC'] } }
            );
            expect(card.tags).toEqual(['Aquatic']);
        });

        it('cardHasTag reads a card case-insensitively', () => {
            const card = CardFactory.createInstance({
                id: 'task_test_2',
                name: 'T',
                cardType: 'task',
                config: { skill: 'fishing' }
            });
            expect(cardHasTag(card, 'aquatic')).toBe(true);
            expect(cardHasTag(card, 'Aquatic')).toBe(true);
            expect(cardHasTag(card, 'Mining')).toBe(false);
        });
    });
});

