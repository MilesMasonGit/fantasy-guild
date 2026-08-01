// Fantasy Guild - Per-Area Modifier Aggregators (Deck Loop rework, Phase 4 §4G)

import { ModifierAggregator } from '../effects/ModifierAggregator.js';

/**
 * AreaModifiers — runtime-only ModifierAggregator instances, one per area.
 *
 * The area-scoped tier of the aura system: effects that reach every card in
 * ONE area's deck. Aggregators otherwise live only on cards and heroes; this
 * module is the area-level registry between them and `GlobalModifiers`.
 *
 * Deliberately NOT part of GameState (never serialized). Its members are
 * inherently ephemeral: in-deck **Boost card auras** (C-4), registered when the
 * card is drawn and cleared at loop wrap.
 *
 * Station passive buffs used to register here. They no longer do — an Outpost
 * card's aura is guild-wide (D-16/D-23) and lives on `GlobalModifiers` instead,
 * because there is no single area it belongs to.
 *
 * Consumer: StatProcessor pushes `getAreaAggregator(areaId)` into the same
 * three buckets as the global aggregator, so an area aura and a guild aura
 * stack additively rather than compounding (§15.3).
 */

/** @type {Map<string, ModifierAggregator>} */
const aggregators = new Map();

/**
 * Get (lazily creating) the aggregator for an area.
 * Empty aggregators return a 1.0 multiplier, so callers can query
 * unconditionally — flag-off behavior is unchanged.
 */
export function getAreaAggregator(areaId) {
    let agg = aggregators.get(areaId);
    if (!agg) {
        agg = new ModifierAggregator(`area:${areaId}`);
        aggregators.set(areaId, agg);
    }
    return agg;
}

/** Drop every area aggregator (used before a full rehydrate). */
export function clearAllAreaAggregators() {
    aggregators.clear();
}
