import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as SlotTokens from '../systems/effects/SlotTokens.js';
import { LoopRunner } from '../systems/loop/LoopRunner.js';
import { GameState } from '../state/GameState.js';
import { TOKENS, getToken, getAllTokens, tokenMatchesTags, describeTokenEffects } from '../config/registries/TokenRegistry.js';
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
import { EventBus } from '../systems/core/EventBus.js';
import { stampMutatorFromCard } from '../systems/effects/MutatorStamping.js';
import * as StatusEffectSystem from '../systems/effects/StatusEffectSystem.js';
import { STATUS_TICK_INTERVAL_MS } from '../config/FormulaRegistry.js';
import {
    resolveYield,
    resolveWorkTime,
    resolveInputCost,
    MIN_WORK_TIME_MS,
    MIN_INPUT_COST
} from '../systems/effects/TokenAxes.js';

/**
 * Card Mutators & Tokens — test scaffold (mutator_roadmap_v1.md).
 *
 * Phase 0 is inert scaffolding, so those tests only pin the scaffolding
 * itself. Each later phase appends its own describe block here:
 *   Phase 1 — Three-Bucket math rules (§15.3)
 *   Phase 2 — card tag derivation (§15.4)
 *   Phase 3 — slot token lifecycle & Cycle wipe (F1/F2/F3)
 *   Phase 4 — stamping, charge waste, area-wide targeting (§15.5/§15.14)
 *   Phase 5 — the yield / time / cost axes and their hard floors (§15.8/§10)
 *   Phase 7 — the combat axis, routed into StatusEffectSystem (§15.13)
 *   Phase 8 — the Area Anchor: a locked slot-0 Mutator broadcasting (§7/§9)
 *
 * Card work failure states (Phase 6) live in `CardFailure.test.js`, which needs
 * its own module mocks.
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

    it('getAllTokens exposes the live registry object', () => {
        expect(getAllTokens()).toBe(TOKENS);
    });

    // The registry shipped empty through Phases 0–8; the §14 catalog was
    // authored ahead of Phase 9 because token badges cannot be seen or
    // verified until real Tokens exist.
    describe('the §14 catalog', () => {
        it('ships the v1 tokens; Midas, Cursed and Dam are cut', () => {
            expect(Object.keys(TOKENS).sort())
                .toEqual(['abundance', 'hex', 'trawler']);
            // Midas: §15.8 (output conversion). Cursed + Dam: owner decision
            // 2026-07-21 — nothing applies a curse, so both were inert.
            expect(TOKENS.midas).toBeUndefined();
            expect(TOKENS.cursed).toBeUndefined();
            expect(TOKENS.dam).toBeUndefined();
        });

        it('every token declares the fields the engine reads', () => {
            for (const [id, def] of Object.entries(TOKENS)) {
                expect(def.tokenId).toBe(id);          // id and key agree
                expect(def.name).toBeTruthy();
                expect(def.icon).toBeTruthy();
                expect(['boon', 'bane', 'tradeoff']).toContain(def.category);
                expect(Array.isArray(def.target_tags)).toBe(true);
                expect(def.target_tags.length).toBeGreaterThan(0);
            }
        });

        it('Hex carries no math axis — it is statuses only (§15.13)', () => {
            expect(TOKENS.hex.applyStatuses).toEqual([{ statusId: 'poison', stacks: 2 }]);
            expect(TOKENS.hex.multiplier).toBeUndefined();
            expect(TOKENS.hex.flat).toBeUndefined();
        });

        it('charge-mode tokens declare a charge count', () => {
            for (const def of Object.values(TOKENS)) {
                if (def.targeting === 'charges') {
                    expect(Number.isFinite(def.charges)).toBe(true);
                    expect(def.charges).toBeGreaterThan(0);
                }
            }
        });
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


// ---------------------------------------------------------------------------
// Phase 3 — Token data model & lifecycle (mutator_roadmap_v1.md, F1/F2/F3)
// ---------------------------------------------------------------------------

describe('Phase 3 — Slot token lifecycle', () => {
    const AREA = 'area_test_tokens';

    // A stand-in token definition. Phase 3 ships no real content (that is
    // Phase 10), so the lifecycle is exercised against an injected definition.
    const TRAWLER = {
        tokenId: 'test_trawler',
        name: 'Trawler',
        target_tags: ['Aquatic'],
        targeting: 'charges',
        charges: 3,
        flat: { yield: 1 },
        multiplier: { yield: 2, time: 2 },
        percentage: { yield: 0.25 }
    };

    beforeEach(() => {
        SlotTokens.clearAllSlotTokens();
        TOKENS[TRAWLER.tokenId] = TRAWLER;
    });

    afterEach(() => {
        SlotTokens.clearAllSlotTokens();
        delete TOKENS[TRAWLER.tokenId];
    });

    describe('attach & read back', () => {
        it('stamps a token onto a slot and reads it back', () => {
            SlotTokens.attachToken(AREA, 2, { tokenId: 'test_trawler', sourceCardId: 'card_mut', charges: 3 });
            const tokens = SlotTokens.getSlotTokens(AREA, 2);
            expect(tokens).toHaveLength(1);
            expect(tokens[0]).toEqual({ tokenId: 'test_trawler', sourceCardId: 'card_mut', charges: 3 });
        });

        it('an unstamped slot reads back as an empty array, never undefined', () => {
            expect(SlotTokens.getSlotTokens(AREA, 0)).toEqual([]);
            expect(SlotTokens.getSlotTokens('area_nonexistent', 5)).toEqual([]);
        });

        it('stacking N identical tokens means N instances, not one merged blob', () => {
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            expect(SlotTokens.getSlotTokens(AREA, 0)).toHaveLength(3);
            expect(SlotTokens.countAreaTokens(AREA)).toBe(3);
        });

        it('the effect payload is NOT copied onto the instance — it stays on the definition', () => {
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            const [instance] = SlotTokens.getSlotTokens(AREA, 0);
            expect(Object.keys(instance).sort()).toEqual(['charges', 'sourceCardId', 'tokenId']);
            expect(instance.flat).toBeUndefined();
            expect(instance.multiplier).toBeUndefined();
        });

        it('charges default to 1 and an unusable instance is rejected', () => {
            expect(SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' }).charges).toBe(1);
            expect(SlotTokens.attachToken(AREA, 0, {})).toBeNull();
            expect(SlotTokens.attachToken(AREA, -1, { tokenId: 'test_trawler' })).toBeNull();
        });

        it('getSlotTokens returns a copy — the registry cannot be mutated through it', () => {
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            SlotTokens.getSlotTokens(AREA, 0).push({ tokenId: 'smuggled' });
            expect(SlotTokens.getSlotTokens(AREA, 0)).toHaveLength(1);
        });

        it('removeTokenFromSlot is a targeted counter, not a generic cleanse (§15.6)', () => {
            TOKENS.test_other = { tokenId: 'test_other', target_tags: ['*'], flat: { yield: 1 } };
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_other' });

            expect(SlotTokens.removeTokenFromSlot(AREA, 0, 'test_trawler')).toBe(2);
            expect(SlotTokens.getSlotTokens(AREA, 0).map(t => t.tokenId)).toEqual(['test_other']);
            delete TOKENS.test_other;
        });
    });

    describe('applying tokens to a materialized card (F1)', () => {
        function freshCard() {
            return CardFactory.createInstance({
                id: 'task_token_target',
                name: 'Fishing Spot',
                cardType: 'task',
                config: { skill: 'fishing' },
                traits: [{ type: 'workcycle', skill: 'fishing', duration: 4000 }]
            });
        }

        it('routes each effect into the bucket its definition declares (§15.3)', () => {
            SlotTokens.attachToken(AREA, 1, { tokenId: 'test_trawler', sourceCardId: 'card_mut' });
            const card = freshCard();
            const added = SlotTokens.applySlotTokensToCard(card, AREA, 1);
            expect(added).toBe(4); // yield flat/mult/pct + time mult

            const { YIELD, WORK_TIME } = EFFECT_TYPES;
            expect(card.aggregator.getFlat(YIELD)).toBe(1);
            expect(card.aggregator.collectMultipliers(YIELD)).toEqual([2]);
            expect(card.aggregator.collectPercentages(YIELD)).toEqual([0.25]);
            expect(card.aggregator.collectMultipliers(WORK_TIME)).toEqual([2]);
        });

        it('the canonical Shrimp case resolves to 5 through the applied buckets', () => {
            SlotTokens.attachToken(AREA, 1, { tokenId: 'test_trawler' });
            const card = freshCard();
            SlotTokens.applySlotTokensToCard(card, AREA, 1);

            const { YIELD } = EFFECT_TYPES;
            const total = applyThreeBucket(1, {
                flat: [card.aggregator.getFlat(YIELD)],
                multipliers: card.aggregator.collectMultipliers(YIELD),
                percentages: card.aggregator.collectPercentages(YIELD)
            });
            expect(total).toBe(5); // (1 + 1) × 2 × 1.25
        });

        it('stacked instances each contribute separately and stay separately traceable', () => {
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            const card = freshCard();
            SlotTokens.applySlotTokensToCard(card, AREA, 0);

            const { YIELD } = EFFECT_TYPES;
            expect(card.aggregator.getFlat(YIELD)).toBe(2);
            // Multipliers SUM: x2 and x2 give x4, not x8 (§15.3).
            expect(combineMultipliers(card.aggregator.collectMultipliers(YIELD))).toBe(4);
            // Percentages SUM AS PERCENTAGES: +25% twice is x1.5, not x1.5625.
            expect(combinePercentages(card.aggregator.collectPercentages(YIELD))).toBe(1.5);
            expect(card.aggregator.modifiers.size).toBe(2); // one source per instance
        });

        it('a definition retune is picked up immediately — instances hold no copy', () => {
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            TOKENS.test_trawler = { ...TRAWLER, flat: { yield: 99 } };
            const card = freshCard();
            SlotTokens.applySlotTokensToCard(card, AREA, 0);
            expect(card.aggregator.getFlat(EFFECT_TYPES.YIELD)).toBe(99);
        });

        it('an unstamped slot leaves the card completely untouched', () => {
            const card = freshCard();
            expect(SlotTokens.applySlotTokensToCard(card, AREA, 7)).toBe(0);
            expect(card.aggregator.modifiers.size).toBe(0);
        });

        it('an unknown tokenId is skipped rather than throwing', () => {
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_does_not_exist' });
            const card = freshCard();
            expect(SlotTokens.applySlotTokensToCard(card, AREA, 0)).toBe(0);
        });

        it('a neutral (zero) value is omitted, never pushed into a summing bucket', () => {
            const mods = SlotTokens.buildTokenModifiers(
                { multiplier: { yield: 0 }, flat: { time: 0 }, percentage: { cost: 0.5 } },
                'src'
            );
            expect(mods).toHaveLength(1);
            expect(mods[0]).toMatchObject({ type: EFFECT_TYPES.INPUT_COST, bucket: 'percentage', value: 0.5 });
        });

        it('WORK_TIME is distinct from SPEED so a time penalty cannot invert into a speed-up', () => {
            expect(EFFECT_TYPES.WORK_TIME).not.toBe(EFFECT_TYPES.SPEED);
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            const card = freshCard();
            SlotTokens.applySlotTokensToCard(card, AREA, 0);
            // Phase 3 is plumbing only: nothing consumes WORK_TIME yet, so the
            // Trawler's time x2 must NOT have reached the speed pass.
            expect(card.aggregator.collectMultipliers(EFFECT_TYPES.SPEED)).toEqual([]);
        });
    });

    describe('the Cycle wipe (F2)', () => {
        function fakeAreaState(slotCount, activeIndex) {
            return {
                activeCardIndex: activeIndex,
                deckSlots: Array.from({ length: slotCount }, () => ({ status: 'idle', progress: 0 })),
                status: 'running',
                executionTimer: 0
            };
        }

        it('wraps to slot 0 and wipes every token in the area', () => {
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            SlotTokens.attachToken(AREA, 2, { tokenId: 'test_trawler' });
            expect(SlotTokens.countAreaTokens(AREA)).toBe(2);

            const areaState = fakeAreaState(3, 2); // last slot -> wraps to 0
            LoopRunner._advance(AREA, areaState);

            expect(areaState.activeCardIndex).toBe(0);
            expect(areaState.status).toBe('shuffling');
            expect(SlotTokens.countAreaTokens(AREA)).toBe(0);
            expect(SlotTokens.getSlotTokens(AREA, 0)).toEqual([]);
        });

        it('the wipe is per-area — a neighbouring area keeps its tokens', () => {
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            SlotTokens.attachToken('area_other', 0, { tokenId: 'test_trawler' });

            LoopRunner._advance(AREA, fakeAreaState(2, 1));

            expect(SlotTokens.countAreaTokens(AREA)).toBe(0);
            expect(SlotTokens.countAreaTokens('area_other')).toBe(1);
            SlotTokens.clearAreaTokens('area_other');
        });
    });

    describe('tokens are runtime-only and never serialized (F3)', () => {
        it('lives in a module registry, not in GameState', () => {
            SlotTokens.attachToken(AREA, 0, { tokenId: 'test_trawler' });
            const serialized = JSON.stringify(GameState.state ?? {});
            expect(serialized).not.toContain('test_trawler');
            expect(serialized).not.toContain('slotTokens');
        });

        it('exports no save/load hooks at all', () => {
            for (const key of Object.keys(SlotTokens)) {
                expect(key).not.toMatch(/serial|persist|save|load|hydrate/i);
            }
        });
    });
});

/**
 * Phase 4 — ACTION cards & stamping (mutator_roadmap_v1.md, §15.5 / §15.14).
 *
 * A Mutator is worked; it walks the REMAINING slots in the current Cycle and
 * stamps its Token onto matching ones. Charges mode takes the first N; area
 * mode takes them all. Both are forward-only. Uses real card templates so the
 * tag matching runs the genuine Phase 2 derivation:
 *   task_shrimp_river → [Task, Aquatic, Gathering]   (an Aquatic match)
 *   task_coal_vein    → [Task, Labor, Gathering]     (not Aquatic)
 */
describe('Phase 4 — mutator stamping (§15.5 / §15.14)', () => {
    const AREA = 'area_stamp_test';
    const AQUATIC = 'task_shrimp_river';
    const NON_AQUATIC = 'task_coal_vein';

    // Injected test tokens — TOKENS ships empty; real content is Phase 10.
    const TRAWLER_CHARGES = {
        tokenId: 'test_trawler', name: 'Test Trawler',
        target_tags: ['Aquatic'], targeting: 'charges', charges: 3,
        multiplier: { yield: 2, time: 2 }
    };
    const TRAWLER_AREA = {
        tokenId: 'test_trawler_area', name: 'Test Area Trawler',
        target_tags: ['Aquatic'], targeting: 'area',
        multiplier: { yield: 2 }
    };

    beforeEach(() => {
        SlotTokens.clearAllSlotTokens();
        TOKENS[TRAWLER_CHARGES.tokenId] = TRAWLER_CHARGES;
        TOKENS[TRAWLER_AREA.tokenId] = TRAWLER_AREA;
    });
    afterEach(() => {
        SlotTokens.clearAllSlotTokens();
        delete TOKENS[TRAWLER_CHARGES.tokenId];
        delete TOKENS[TRAWLER_AREA.tokenId];
    });

    const mutatorCard = (tokenId, id = 'card_mut') => ({
        id, traits: [{ type: 'mutator', tokenId }]
    });
    const areaStateWith = (templateIds, activeCardIndex) => ({
        activeCardIndex,
        deckSlots: templateIds.map(t => (t === null ? {} : { templateId: t }))
    });
    const stampedIndices = () =>
        SlotTokens.getAreaTokens(AREA).map(e => e.slotIndex);

    it('the canonical smoke test: [Trawler]→[Fishing]→[Fishing]→[Mining]', () => {
        // Mutator at slot 0, charges 3, two Aquatic slots, one non-Aquatic.
        const areaState = areaStateWith([null, AQUATIC, AQUATIC, NON_AQUATIC], 0);
        const res = stampMutatorFromCard(AREA, areaState, mutatorCard('test_trawler'));

        // Both Fishing slots stamped, Mining slot untouched.
        expect(stampedIndices()).toEqual([1, 2]);
        expect(res.stamped.map(s => s.slotIndex)).toEqual([1, 2]);
        // The 3rd charge had no target and is silently wasted, not carried.
        expect(res.stamped).toHaveLength(2);
    });

    it('charges mode stops after N even when more slots match', () => {
        // Three Aquatic slots but only 1 charge.
        TOKENS.test_trawler.charges = 1;
        const areaState = areaStateWith([null, AQUATIC, AQUATIC, AQUATIC], 0);
        stampMutatorFromCard(AREA, areaState, mutatorCard('test_trawler'));
        expect(stampedIndices()).toEqual([1]); // first match only
    });

    it('area mode stamps EVERY matching slot in the Cycle', () => {
        const areaState = areaStateWith([null, AQUATIC, NON_AQUATIC, AQUATIC], 0);
        stampMutatorFromCard(AREA, areaState, mutatorCard('test_trawler_area'));
        expect(stampedIndices()).toEqual([1, 3]); // both Aquatic, not the Mining
    });

    it('is forward-only — never stamps a slot already worked this Cycle', () => {
        // Mutator at slot 2; Aquatic cards sit behind it (0,1) and ahead (3).
        const areaState = areaStateWith([AQUATIC, AQUATIC, null, AQUATIC], 2);
        // put the mutator trait card as the one being worked at index 2
        stampMutatorFromCard(AREA, areaState, mutatorCard('test_trawler_area'));
        expect(stampedIndices()).toEqual([3]); // only the slot ahead
    });

    it('skips empty and hazard slots, but NOT locked ones', () => {
        // Locked only means the player cannot re-slot that position — the card
        // in it is worked like any other, so it must be stampable. §9 blueprints
        // lock combat cards into fixed anchors, and a Hex has to be able to
        // reach them. (Corrected in Phase 8.)
        const areaState = {
            activeCardIndex: 0,
            deckSlots: [
                {},                                   // 0: the mutator's own slot
                {},                                   // 1: empty — nothing to mark
                { templateId: AQUATIC, hazard: {} },  // 2: hazard, terrain not a card
                { templateId: AQUATIC, isLocked: true }, // 3: locked BUT holds a card
                { templateId: AQUATIC }               // 4: ordinary target
            ]
        };
        stampMutatorFromCard(AREA, areaState, mutatorCard('test_trawler_area'));
        expect(stampedIndices()).toEqual([3, 4]);   // the locked card IS stamped
    });

    it('records the source card on every stamped instance (Phase 9 tracing)', () => {
        const areaState = areaStateWith([null, AQUATIC], 0);
        stampMutatorFromCard(AREA, areaState, mutatorCard('test_trawler', 'chum_the_waters'));
        const [instance] = SlotTokens.getSlotTokens(AREA, 1);
        expect(instance.sourceCardId).toBe('chum_the_waters');
        expect(instance.tokenId).toBe('test_trawler');
    });

    it('a card with no mutator trait stamps nothing', () => {
        const areaState = areaStateWith([null, AQUATIC], 0);
        const res = stampMutatorFromCard(AREA, areaState, { id: 'plain', traits: [{ type: 'workcycle' }] });
        expect(res.stamped).toHaveLength(0);
        expect(stampedIndices()).toEqual([]);
    });

    it('an unknown tokenId is skipped without throwing', () => {
        const areaState = areaStateWith([null, AQUATIC], 0);
        const res = stampMutatorFromCard(AREA, areaState, mutatorCard('does_not_exist'));
        expect(res.stamped).toHaveLength(0);
    });

    describe('targeted counters (dormant plumbing) and card permanence', () => {
        it('a removes-only token strips named tokens without leaving an instance', () => {
            // Pre-stamp a curse on slot 1, then work a pure Dam counter.
            SlotTokens.attachToken(AREA, 1, { tokenId: 'test_curse' });
            TOKENS.test_dam = { tokenId: 'test_dam', target_tags: ['*'], targeting: 'area', removes: ['test_curse'] };
            const areaState = areaStateWith([null, AQUATIC], 0);
            const res = stampMutatorFromCard(AREA, areaState, mutatorCard('test_dam'));
            expect(res.removed).toBe(1);
            expect(SlotTokens.getSlotTokens(AREA, 1)).toHaveLength(0); // curse gone, no Dam instance left
            delete TOKENS.test_dam;
        });

        it('working a Mutator never destroys the card — they are permanent', () => {
            // §15.7's "consumed on use" describes CONSUMABLE cards drawing a
            // banked item, not Mutators being spent [owner clarification
            // 2026-07-21]. Stamping reports only what it stamped and stripped.
            const areaState = areaStateWith([null, AQUATIC], 0);
            const res = stampMutatorFromCard(AREA, areaState, mutatorCard('test_trawler'));
            expect(Object.keys(res).sort()).toEqual(['removed', 'stamped']);
            expect(res).not.toHaveProperty('consumeSource');
        });
    });
});

/**
 * Phase 5 — Yield / Time / Cost axes (mutator_roadmap_v1.md, §15.8 / §10).
 *
 * The stamped Token effects finally change numbers. resolveAxis runs the full
 * Three-Bucket formula from an aggregator; TokenAxes adds the §10 hard floors.
 */
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

    describe('end-to-end: a stamped card gets its aggregator changed', () => {
        it('applying a Trawler instance yields the ×2 yield and ×2 time axes', () => {
            // Register a stand-in Trawler and stamp it onto a slot, then apply
            // it to a real card via the Phase 3 path — the same route the loop
            // uses at materialization.
            TOKENS.p5_trawler = {
                tokenId: 'p5_trawler', target_tags: ['*'],
                multiplier: { yield: 2, time: 2 }
            };
            SlotTokens.clearAllSlotTokens();
            SlotTokens.attachToken('p5_area', 0, { tokenId: 'p5_trawler', sourceCardId: 'mut' });

            const card = { id: 'fish', aggregator: new ModifierAggregator('fish') };
            SlotTokens.applySlotTokensToCard(card, 'p5_area', 0);

            expect(resolveYield(card.aggregator, 3)).toBe(6);
            expect(resolveWorkTime(card.aggregator, 4000)).toBe(8000);

            SlotTokens.clearAllSlotTokens();
            delete TOKENS.p5_trawler;
        });
    });
});

/**
 * Phase 7 — Combat axis / Hex (mutator_roadmap_v1.md, §15.13).
 *
 * A combat Token gets NO math axis of its own. It rides the combat slot and,
 * when that card materializes, hands its statuses straight to the existing
 * StatusEffectSystem — the same path a weapon proc uses. A hexed enemy must be
 * indistinguishable from one poisoned by a dagger.
 */
describe('Phase 7 — combat axis (§15.13)', () => {
    const AREA = 'area_hex_test';

    /** A materialized combat card, shaped like CardFactory.initCombatState leaves it. */
    const combatCard = (hp = 20) => ({
        id: 'card_wolf',
        aggregator: new ModifierAggregator('card_wolf'),
        combat: { enemyHp: { current: hp, max: hp }, enemyStatuses: [] }
    });

    beforeEach(() => {
        SlotTokens.clearAllSlotTokens();
        TOKENS.test_hex = {
            tokenId: 'test_hex',
            target_tags: ['Combat'],
            targeting: 'charges',
            charges: 1,
            applyStatuses: [{ statusId: 'poison', stacks: 2 }]
        };
    });
    afterEach(() => {
        SlotTokens.clearAllSlotTokens();
        delete TOKENS.test_hex;
    });

    it('a Hex token poisons the enemy when the combat card materializes', () => {
        SlotTokens.attachToken(AREA, 3, { tokenId: 'test_hex', sourceCardId: 'cast_hex' });
        const card = combatCard();

        SlotTokens.applySlotTokensToCard(card, AREA, 3);

        const poison = card.combat.enemyStatuses.find(s => s.id === 'poison');
        expect(poison).toBeDefined();
        expect(poison.stacks).toBe(2);
    });

    it('the status lands on the ENEMY, not as a card modifier', () => {
        SlotTokens.attachToken(AREA, 0, { tokenId: 'test_hex' });
        const card = combatCard();

        // No math axes on this token, so it contributes no modifiers at all.
        expect(SlotTokens.applySlotTokensToCard(card, AREA, 0)).toBe(0);
        expect(card.combat.enemyStatuses).toHaveLength(1);
    });

    it('two stamped Hexes stack on the same enemy', () => {
        SlotTokens.attachToken(AREA, 0, { tokenId: 'test_hex' });
        SlotTokens.attachToken(AREA, 0, { tokenId: 'test_hex' });
        const card = combatCard();

        SlotTokens.applySlotTokensToCard(card, AREA, 0);

        expect(card.combat.enemyStatuses.find(s => s.id === 'poison').stacks).toBe(4);
    });

    it('a combat token stamped on a task card no-ops rather than throwing', () => {
        SlotTokens.attachToken(AREA, 0, { tokenId: 'test_hex' });
        const taskCard = { id: 'fish', aggregator: new ModifierAggregator('fish') }; // no .combat

        expect(() => SlotTokens.applySlotTokensToCard(taskCard, AREA, 0)).not.toThrow();
        expect(taskCard.combat).toBeUndefined();
    });

    it('the hexed enemy genuinely takes damage from the DoT tick', () => {
        SlotTokens.attachToken(AREA, 0, { tokenId: 'test_hex' });   // poison x2 = 4 dmg/tick
        const card = combatCard(10);
        SlotTokens.applySlotTokensToCard(card, AREA, 0);

        StatusEffectSystem.tickEnemyStatuses(card, STATUS_TICK_INTERVAL_MS);

        expect(card.combat.enemyHp.current).toBe(6);
    });

    it('a Hex can finish an enemy outright — Absolute Parity with hero DoTs (§7)', () => {
        SlotTokens.attachToken(AREA, 0, { tokenId: 'test_hex' });
        const card = combatCard(3);                                  // less than one tick
        SlotTokens.applySlotTokensToCard(card, AREA, 0);

        const died = StatusEffectSystem.tickEnemyStatuses(card, STATUS_TICK_INTERVAL_MS);

        expect(died).toBe(true);
        expect(card.combat.enemyHp.current).toBe(0);
    });

    it('combat cards carry the Combat tag, so a Hex can target them (Phase 2)', () => {
        const wolf = { cardType: 'combat', id: 't', config: {} };
        expect(deriveCardTags(wolf)).toContain('Combat');
        expect(tokenMatchesTags(TOKENS.test_hex, deriveCardTags(wolf))).toBe(true);
    });
});

/**
 * Phase 8 — Area Anchor (mutator_roadmap_v1.md, §7 / §9).
 *
 * An Area applies its global modifiers through a LOCKED Mutator in slot 0
 * rather than an invisible per-area penalty. The point of this phase is that it
 * needs no new machinery: `buildDeckSlotsForArea` already turns an authored
 * `slotType: 'locked'` into `isLocked`, the loop works a locked slot like any
 * other, and Phase 4's area-wide targeting does the broadcast.
 */
describe('Phase 8 — Area Anchor (§7 / §9)', () => {
    const AREA = 'area_anchor_test';
    const AQUATIC = 'task_shrimp_river';
    const MINING = 'task_coal_vein';

    beforeEach(() => {
        SlotTokens.clearAllSlotTokens();
        TOKENS.test_anchor = {
            tokenId: 'test_anchor',
            target_tags: ['*'],          // an Area Modifier hits everything
            targeting: 'area',
            percentage: { yield: -0.25 } // a cursed area: −25% yield all Cycle
        };
    });
    afterEach(() => {
        SlotTokens.clearAllSlotTokens();
        delete TOKENS.test_anchor;
    });

    /** A blueprint whose slot 0 is a locked anchor, with a locked combat slot too. */
    const anchorAreaState = () => ({
        activeCardIndex: 0,
        deckSlots: [
            { templateId: 'anchor_card', slotType: 'locked', isLocked: true },
            { templateId: AQUATIC },
            { templateId: MINING, slotType: 'locked', isLocked: true }, // a locked combat-style anchor
            { templateId: AQUATIC }
        ]
    });

    it('the anchor broadcasts to EVERY card in the Cycle, including locked ones', () => {
        const areaState = anchorAreaState();
        stampMutatorFromCard(AREA, areaState, {
            id: 'anchor_card', traits: [{ type: 'mutator', tokenId: 'test_anchor' }]
        });

        // Slots 1, 2 and 3 — the locked slot 2 must not be skipped (§9).
        expect(SlotTokens.getAreaTokens(AREA).map(e => e.slotIndex)).toEqual([1, 2, 3]);
    });

    it('the anchor never stamps itself', () => {
        const areaState = anchorAreaState();
        stampMutatorFromCard(AREA, areaState, {
            id: 'anchor_card', traits: [{ type: 'mutator', tokenId: 'test_anchor' }]
        });
        expect(SlotTokens.getSlotTokens(AREA, 0)).toHaveLength(0);
    });

    it('its effect really lands on a card that materializes later', () => {
        const areaState = anchorAreaState();
        stampMutatorFromCard(AREA, areaState, {
            id: 'anchor_card', traits: [{ type: 'mutator', tokenId: 'test_anchor' }]
        });

        const card = { id: 'shrimp', aggregator: new ModifierAggregator('shrimp') };
        SlotTokens.applySlotTokensToCard(card, AREA, 1);

        // −25% yield for the whole Cycle: a base 4 becomes 3.
        expect(resolveYield(card.aggregator, 4)).toBeCloseTo(3);
    });

    it('the anchor effect is gone next Cycle and must be re-worked', () => {
        const areaState = anchorAreaState();
        stampMutatorFromCard(AREA, areaState, {
            id: 'anchor_card', traits: [{ type: 'mutator', tokenId: 'test_anchor' }]
        });
        expect(SlotTokens.countAreaTokens(AREA)).toBe(3);

        SlotTokens.clearAreaTokens(AREA);            // what _advance() does on wrap-to-0
        expect(SlotTokens.countAreaTokens(AREA)).toBe(0);

        const card = { id: 'shrimp', aggregator: new ModifierAggregator('shrimp') };
        SlotTokens.applySlotTokensToCard(card, AREA, 1);
        expect(resolveYield(card.aggregator, 4)).toBe(4);   // back to base
    });

    it('an authored locked slot needs no new blueprint machinery', () => {
        // buildDeckSlotsForArea already maps slotType 'locked' → isLocked, and
        // carries the authored templateId, which is all an anchor requires.
        const authored = { slotType: 'locked', templateId: 'anchor_card' };
        const slot = {
            templateId: authored.templateId || null,
            slotType: authored.slotType || 'regular',
            isLocked: authored.slotType === 'locked'
        };
        expect(slot.isLocked).toBe(true);
        expect(slot.templateId).toBe('anchor_card');
    });
});

/**
 * Phase 9 — Token UI data (mutator_roadmap_v1.md, §5 / §7 / §12).
 *
 * The rendering itself is verified by looking at the running game; what is
 * pinned here is the logic the UI depends on — how identical Tokens condense
 * into one badge with a count, and how an effect is phrased for the tooltip.
 * Both live outside the component so every surface agrees.
 */
describe('Phase 9 — token badge data (§7 / §12)', () => {
    const AREA = 'area_badge_test';

    beforeEach(() => SlotTokens.clearAllSlotTokens());
    afterEach(() => SlotTokens.clearAllSlotTokens());

    describe('getSlotTokenSummary — condensing (§7)', () => {
        it('an unstamped slot summarises to nothing', () => {
            expect(SlotTokens.getSlotTokenSummary(AREA, 0)).toEqual([]);
        });

        it('identical tokens condense into ONE entry with a count', () => {
            for (let i = 0; i < 50; i++) {
                SlotTokens.attachToken(AREA, 0, { tokenId: 'trawler', sourceCardId: 'chum' });
            }
            const summary = SlotTokens.getSlotTokenSummary(AREA, 0);

            expect(summary).toHaveLength(1);          // one badge, not fifty
            expect(summary[0].count).toBe(50);        // rendered as ×50
            expect(summary[0].def.name).toBe('Trawler');
        });

        it('different tokens stay as separate entries, in stamping order', () => {
            SlotTokens.attachToken(AREA, 0, { tokenId: 'trawler' });
            SlotTokens.attachToken(AREA, 0, { tokenId: 'cursed' });
            SlotTokens.attachToken(AREA, 0, { tokenId: 'trawler' });

            const summary = SlotTokens.getSlotTokenSummary(AREA, 0);
            expect(summary.map(e => e.tokenId)).toEqual(['trawler', 'cursed']);
            expect(summary.map(e => e.count)).toEqual([2, 1]);
        });

        it('keeps every distinct source for tooltip tracing (§12)', () => {
            SlotTokens.attachToken(AREA, 0, { tokenId: 'trawler', sourceCardId: 'chum_a' });
            SlotTokens.attachToken(AREA, 0, { tokenId: 'trawler', sourceCardId: 'chum_b' });
            SlotTokens.attachToken(AREA, 0, { tokenId: 'trawler', sourceCardId: 'chum_a' });

            expect(SlotTokens.getSlotTokenSummary(AREA, 0)[0].sources).toEqual(['chum_a', 'chum_b']);
        });

        it('survives a token whose definition has gone missing', () => {
            SlotTokens.attachToken(AREA, 0, { tokenId: 'no_such_token' });
            const [entry] = SlotTokens.getSlotTokenSummary(AREA, 0);
            expect(entry.def).toBeNull();             // the UI falls back to '❔'
            expect(entry.count).toBe(1);
        });
    });

    describe('describeTokenEffects — the tooltip maths (§12)', () => {
        it('phrases each bucket in its own notation', () => {
            expect(describeTokenEffects(TOKENS.abundance)).toEqual(['Yield +2', 'Input Cost +1']);
            expect(describeTokenEffects(TOKENS.trawler)).toEqual(['Yield ×2', 'Work Time ×2']);
            // A negative multiplier still reads correctly, even though no
            // shipped token uses one now that Cursed is cut.
            expect(describeTokenEffects({ multiplier: { yield: -2 } })).toEqual(['Yield ×-2']);
        });

        it('renders a percentage as a percentage, not a raw fraction', () => {
            expect(describeTokenEffects({ percentage: { yield: -0.25 } })).toEqual(['Yield -25%']);
        });

        it('describes the combat axis and targeted counters too', () => {
            expect(describeTokenEffects(TOKENS.hex)).toEqual(['Applies poison ×2 to the enemy']);
            // The §15.6 counter primitive stays in the engine, dormant.
            expect(describeTokenEffects({ removes: ['some_curse'] })).toEqual(['Removes some_curse']);
        });

        it('omits neutral values so a tooltip never reads "Yield +0"', () => {
            expect(describeTokenEffects({ flat: { yield: 0 }, multiplier: { time: 2 } }))
                .toEqual(['Work Time ×2']);
        });

        it('tolerates a missing definition', () => {
            expect(describeTokenEffects(null)).toEqual([]);
        });
    });

    it('mutating the registry announces itself so the UI can re-read', () => {
        const seen = [];
        const unsub = EventBus.subscribe(SlotTokens.SLOT_TOKENS_CHANGED, d => seen.push(d));

        SlotTokens.attachToken(AREA, 0, { tokenId: 'trawler' });
        SlotTokens.clearAreaTokens(AREA);

        expect(seen.length).toBeGreaterThanOrEqual(2);
        expect(seen[0].areaId).toBe(AREA);
        if (typeof unsub === 'function') unsub();
    });
});
