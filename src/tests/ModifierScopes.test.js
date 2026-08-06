import { describe, it, expect } from 'vitest';
import {
    ModifierAggregator,
    combinePercentages,
    applyThreeBucket
} from '../systems/effects/ModifierAggregator.js';
import { normalizeAuras } from '../systems/loop/GlobalModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

/**
 * Modifier scope rules — the successor to `GlobalAuras.test.js`.
 *
 * ## Why this file exists
 * `GlobalAuras.test.js` pinned three rules that the 7×7 board still needs, but
 * it pinned them *through* the Outpost/Station machinery, which the playmat
 * rework deletes in Phase 1. Deleting that suite would delete the rules with it.
 *
 * This file re-pins the same rules against **bare aggregators**, so they survive
 * the demolition and are ready for the scopes that replace the old ones:
 *
 *     OLD                          NEW
 *     card.aggregator      →       the Token's own aggregator
 *     AreaModifiers        →       TileModifiers   (Phase 5)
 *     GlobalModifiers      →       GuildModifiers  (Phase 1 rename)
 *
 * ## The three rules, and what each one prevents
 *  1. **Duplicate sources stack additively** (D-23). Two +20% give +40%, never
 *     +44%. The Guild Hall's Aura upgrades hit this the moment two ranks apply.
 *  2. **Distinct source ids per copy.** Sharing a source means removing one copy
 *     silently strips the other — the recurring bug in this system.
 *  3. **Runtime aggregators rebuild from state.** They are never serialized, so
 *     a silently-empty aggregator after a reload is the classic failure.
 *
 * Plus the rule that makes all three work, and that Phase 5 §B is most likely to
 * get wrong: **every scope pushes into the SAME buckets** rather than being
 * resolved separately and multiplied together.
 *
 * @see playmat_roadmap_v1.md Phase 0 §D, Phase 5 §B
 * @see playmat_gap_analysis.md §1.3
 *
 * NOTE (Phase 1): `normalizeAuras` moves with its module —
 * `systems/loop/GlobalModifiers.js` → `systems/effects/GuildModifiers.js`.
 * Update the import above when that rename lands.
 */

/** A percentage-bucket SPEED modifier, the shape auras are authored in. */
const pct = (source, value, category = 'mining') => ({
    source,
    type: EFFECT_TYPES.SPEED,
    target: { category },
    bucket: 'percentage',
    value
});

/** The resolved percentage factor one aggregator contributes for a skill. */
const factor = (agg, category = 'mining') =>
    combinePercentages(agg.collectPercentages(EFFECT_TYPES.SPEED, category));

describe('normalizeAuras — one or many (free-form authoring)', () => {
    it('reads a single modifier, a list, and nothing at all', () => {
        expect(normalizeAuras(null)).toEqual([]);
        expect(normalizeAuras(undefined)).toEqual([]);
        expect(normalizeAuras(pct('a', 0.2))).toHaveLength(1);
        expect(normalizeAuras([pct('a', 0.2), pct('a', 0.1, 'fishing')])).toHaveLength(2);
    });

    it('drops empty entries from an authored list', () => {
        expect(normalizeAuras([pct('a', 0.2), null])).toHaveLength(1);
    });
});

describe('Rule 1 — duplicates stack additively (D-23)', () => {
    it('two +20% sources give +40%, NOT the compounded +44%', () => {
        const agg = new ModifierAggregator('guild');
        agg.addModifier(pct('outpost_1:smithy', 0.2));
        agg.addModifier(pct('outpost_2:smithy', 0.2));

        // 1 + 0.2 + 0.2 = 1.4. Compounding gives 1.2 × 1.2 = 1.44 — the exact
        // bug the three-bucket rule exists to prevent (§15.3).
        expect(factor(agg)).toBeCloseTo(1.4);
        expect(factor(agg)).not.toBeCloseTo(1.44);
    });

    it('multipliers SUM too — ×2 and ×3 give ×5, not ×6', () => {
        const agg = new ModifierAggregator('guild');
        agg.addModifier({ ...pct('a', 2), bucket: 'multiplier' });
        agg.addModifier({ ...pct('b', 3), bucket: 'multiplier' });
        expect(agg.getMultiplierBucket(EFFECT_TYPES.SPEED, 'mining')).toBe(5);
    });

    it('a neutral source contributes NOTHING, not a 1.0', () => {
        // In a bucket that sums, a stray 1 inflates the total. This is why
        // callers must omit neutral sources rather than pass an identity value.
        const agg = new ModifierAggregator('guild');
        agg.addModifier(pct('real', 0.2));
        agg.addModifier(pct('neutral', 0));
        expect(factor(agg)).toBeCloseTo(1.2);
    });

    it('leaves unrelated skills alone', () => {
        const agg = new ModifierAggregator('guild');
        agg.addModifier(pct('smithy', 0.2, 'mining'));
        expect(factor(agg, 'fishing')).toBeCloseTo(1.0);
    });
});

describe('Rule 2 — distinct source ids per copy', () => {
    it('removing one copy leaves the other standing', () => {
        const agg = new ModifierAggregator('guild');
        agg.addModifier(pct('outpost_1:smithy', 0.2));
        agg.addModifier(pct('outpost_2:smithy', 0.2));

        agg.removeModifiersBySource('outpost_1:smithy');

        // Per-copy sourcing is what makes this work. A bare template id shared
        // by both copies would have stripped both entries here.
        expect(factor(agg)).toBeCloseTo(1.2);
    });

    it('a SHARED source id is the bug — removing one strips both', () => {
        // Pinned deliberately as the failure mode, so the next scope that adds
        // a registration path can see what it must not do.
        const agg = new ModifierAggregator('guild');
        agg.addModifier(pct('smithy', 0.2));
        agg.addModifier(pct('smithy', 0.2));
        expect(factor(agg)).toBeCloseTo(1.4);

        agg.removeModifiersBySource('smithy');
        expect(factor(agg)).toBeCloseTo(1.0);   // both gone — not 1.2
    });

    it('re-registering a source idempotently does not double-count it', () => {
        // The registration pattern: remove-then-add, so re-registering the same
        // source is safe. (This is what `LoopBuffs.register()` did, and what any
        // tile/guild registration must keep doing.)
        const agg = new ModifierAggregator('guild');
        const register = (source, value) => {
            agg.removeModifiersBySource(source);
            agg.addModifier(pct(source, value));
        };

        register('outpost_1:smithy', 0.2);
        register('outpost_1:smithy', 0.2);
        expect(factor(agg)).toBeCloseTo(1.2);
    });
});

describe('Rule 3 — runtime aggregators rebuild from state', () => {
    /**
     * Stands in for a real rehydrate (`StationSlotManager.rehydrateBuffs`, and
     * whatever Phase 5/7 builds for tiles and the Guild Hall). The rule being
     * pinned is the *shape*: read the authoritative list from state, re-register
     * every entry under its own source id.
     */
    const rehydrate = (agg, installed) => {
        for (const { id, templateId, value } of installed) {
            agg.addModifier(pct(`${id}:${templateId}`, value));
        }
    };

    it('rebuilds every installed aura after the aggregator is cleared', () => {
        const installed = [
            { id: 'tile_12', templateId: 'sawmill', value: 0.2 },
            { id: 'tile_30', templateId: 'sawmill', value: 0.15 }
        ];
        let agg = new ModifierAggregator('guild');
        rehydrate(agg, installed);
        expect(factor(agg)).toBeCloseTo(1.35);

        // Simulate a load: runtime-only, so it comes back empty.
        agg = new ModifierAggregator('guild');
        expect(factor(agg)).toBeCloseTo(1.0);

        rehydrate(agg, installed);

        // A silently-empty aggregator after a reload is the classic failure
        // this pins.
        expect(factor(agg)).toBeCloseTo(1.35);
    });

    it('keeps duplicate stacking intact through a rehydrate', () => {
        const installed = [
            { id: 'tile_12', templateId: 'smithy', value: 0.2 },
            { id: 'tile_30', templateId: 'smithy', value: 0.2 }
        ];
        const agg = new ModifierAggregator('guild');
        rehydrate(agg, installed);
        expect(factor(agg)).toBeCloseTo(1.4);
    });

    it('does not resurrect a source that is no longer in state', () => {
        const agg = new ModifierAggregator('guild');
        rehydrate(agg, [{ id: 'tile_12', templateId: 'smithy', value: 0.2 }]);
        expect(factor(agg)).toBeCloseTo(1.2);

        // The Token was picked up; state no longer lists it.
        const cleared = new ModifierAggregator('guild');
        rehydrate(cleared, []);
        expect(factor(cleared)).toBeCloseTo(1.0);
    });
});

describe('Scope composition — the rule Phase 5 must not get wrong', () => {
    /**
     * ⚠️ This is the crux of the adjacency work (G-5, roadmap Phase 5 §B).
     *
     * When a Token resolves an axis it will consult THREE scopes: its own
     * aggregator, its 8 neighbours', and the guild's. Those contributions must
     * be merged into ONE set of buckets and resolved once — not resolved per
     * scope and multiplied together.
     *
     * `StatProcessor.calculateWorkcycleStats` already does this correctly for
     * SPEED today; the test below is what stops the new scopes doing it wrong.
     */
    it('merging scopes into one bucket stacks additively', () => {
        const self = new ModifierAggregator('token');
        const neighbour = new ModifierAggregator('tile_neighbour');
        const guild = new ModifierAggregator('guild');

        self.addModifier(pct('token:self', 0.25));
        neighbour.addModifier(pct('tile_11:sawmill', 0.25));
        guild.addModifier(pct('guild:aura_1', 0.25));

        const percentages = [
            ...self.collectPercentages(EFFECT_TYPES.SPEED, 'mining'),
            ...neighbour.collectPercentages(EFFECT_TYPES.SPEED, 'mining'),
            ...guild.collectPercentages(EFFECT_TYPES.SPEED, 'mining')
        ];

        // +25% three times = +75%.
        expect(applyThreeBucket(1, { percentages })).toBeCloseTo(1.75);
    });

    it('resolving scopes separately and multiplying is WRONG — pinned as such', () => {
        const self = new ModifierAggregator('token');
        const neighbour = new ModifierAggregator('tile_neighbour');
        const guild = new ModifierAggregator('guild');

        self.addModifier(pct('token:self', 0.25));
        neighbour.addModifier(pct('tile_11:sawmill', 0.25));
        guild.addModifier(pct('guild:aura_1', 0.25));

        const compounded = factor(self) * factor(neighbour) * factor(guild);

        // 1.25³ = 1.953…, not 1.75. The gap is small at three sources and grows
        // fast — this is exactly how "small adjacency nudges" (D-120) would
        // quietly become large ones.
        expect(compounded).toBeCloseTo(1.953125);
        expect(compounded).not.toBeCloseTo(1.75);
    });

    it('an empty scope contributes nothing to the merge', () => {
        // Callers must be able to consult all three scopes unconditionally —
        // most tiles have no neighbouring buff at all.
        const self = new ModifierAggregator('token');
        const empty = new ModifierAggregator('tile_neighbour');
        self.addModifier(pct('token:self', 0.25));

        const percentages = [
            ...self.collectPercentages(EFFECT_TYPES.SPEED, 'mining'),
            ...empty.collectPercentages(EFFECT_TYPES.SPEED, 'mining')
        ];
        expect(applyThreeBucket(1, { percentages })).toBeCloseTo(1.25);
    });
});
