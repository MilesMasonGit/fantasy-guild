// Fantasy Guild — Global Modifier Aggregator (Area Deck Rework, C-11)

import { ModifierAggregator } from '../effects/ModifierAggregator.js';

/**
 * GlobalModifiers — ONE runtime-only ModifierAggregator for the whole guild.
 *
 * This is `AreaModifiers` one scope up. An Outpost card's aura reaches **every
 * area** (D-16/D-23): that is the whole point of Outposts being scarce and
 * guild-wide rather than parked in one region. So its modifiers can't live on
 * an area aggregator — there is no single area they belong to.
 *
 * ## Additive stacking (D-23)
 * Two Smithies must give twice one Smithy, not the square of it. That falls out
 * of the Three-Bucket math for free **provided each installed copy registers
 * under a DISTINCT source**: the buckets sum their members, so two `+25%`
 * entries resolve to `+50%` (§15.3), never `×1.5625`.
 *
 * Source ids are therefore `"<outpostId>:<templateId>"`, not the bare template
 * id — otherwise the second Smithy's `removeModifiersBySource` would silently
 * strip the first one's entry too, and un-installing one would cancel both.
 *
 * ## Not serialized
 * Like the per-area aggregators, this is rebuilt from state rather than saved.
 * The source of truth is each outpost's `activeStationCardId` plus the card's
 * `passiveBuff`, and `StationSlotManager.rehydrateBuffs()` replays it on boot
 * and after every load. A silently-empty aggregator after a reload is the
 * classic failure here — `GlobalAuras.test.js` pins it.
 *
 * Consumer: `StatProcessor.calculateWorkcycleStats` pushes these into the SAME
 * buckets as the area's, which is what makes global and area auras stack
 * additively with each other instead of compounding.
 */

/** @type {ModifierAggregator|null} */
let aggregator = null;

/**
 * The guild-wide aggregator, created on first use.
 * An empty aggregator contributes nothing to any bucket, so callers may query
 * it unconditionally.
 */
export function getGlobalAggregator() {
    if (!aggregator) aggregator = new ModifierAggregator('global');
    return aggregator;
}

/** Drop every global modifier (used before a full rehydrate). */
export function clearGlobalAggregator() {
    aggregator = null;
}

/** The source id an installed Outpost card registers its aura under (D-23). */
export function auraSourceId(outpostId, templateId) {
    return `${outpostId}:${templateId}`;
}

/**
 * Read a card's `passiveBuff` as a LIST of modifiers.
 *
 * Aura strength is free-form by owner call (2026-08-01): there are no power
 * tiers to slot a card into — the designer sets the numbers, and the spread is
 * meant to be wide (a 0.1% loot nudge and a +40% speed swing are both valid
 * auras). Accepting one-or-many follows from that: a card that wants to do two
 * things at once shouldn't have to be split into two cards, the same reasoning
 * that made card effects a list in D-60.
 *
 * Authoring:  `"passiveBuff": { … }`  or  `"passiveBuff": [ { … }, { … } ]`
 *
 * @param {object|object[]|null} passiveBuff
 * @returns {object[]} always an array, empty when there's nothing to register
 */
export function normalizeAuras(passiveBuff) {
    if (!passiveBuff) return [];
    return Array.isArray(passiveBuff) ? passiveBuff.filter(Boolean) : [passiveBuff];
}
