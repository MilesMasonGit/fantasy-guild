// Fantasy Guild - Per-Area Modifier Aggregators (Deck Loop rework, Phase 4 §4G)

import { ModifierAggregator } from '../effects/ModifierAggregator.js';

/**
 * AreaModifiers — runtime-only ModifierAggregator instances, one per area.
 *
 * The roadmap's §4G says station passive buffs register on "the area's
 * ModifierAggregator", but before Phase 4 no such thing existed — aggregators
 * lived only on cards and heroes. This module is that missing area-level
 * registry.
 *
 * Deliberately NOT part of GameState (never serialized): the source of truth
 * for what should be registered is `areaState.stationState.activeStationCardId`
 * plus the station template's `passiveBuff`. After a save load,
 * StationSlotManager.rehydrateBuffs() rebuilds every aggregator from that
 * state, the same pattern LoopRunner uses for its ephemeral cards.
 *
 * Consumers: StatProcessor multiplies `getAreaAggregator(areaId)` into the
 * active card's workcycle stats, which is how a slotted Water-Tower-style
 * station buffs the whole area in BOTH modes (the buff is a property of the
 * station being present, not of the hero being stationed).
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
