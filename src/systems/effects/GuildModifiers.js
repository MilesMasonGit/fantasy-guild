import { ModifierAggregator } from './ModifierAggregator.js';

/**
 * ONE runtime-only ModifierAggregator for the whole guild, for modifiers that reach
 * across every scope (Guild Hall global upgrades). `TileModifiers.resolveAxis` reads it;
 * nothing registers into it yet outside tests.
 *
 * ⚠️ Stack additively: each installed copy must register under a DISTINCT source id
 * (`auraSourceId`, e.g. `<tileIndex>:<tokenTypeId>`, never the bare type id). Otherwise
 * the second copy's `removeModifiersBySource` strips the first one's entry too.
 *
 * ⚠️ Not serialized. Whatever installs a guild-wide modifier must replay it on boot and
 * after every load, or the aggregator is silently empty after a reload.
 *
 * Consumers must push these contributions into the same buckets as every other scope
 * and resolve once; resolving each scope separately and multiplying compounds them
 * (three +25% sources give x1.95 instead of x1.75).
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

/**
 * The source id one installed thing registers its aura under.
 * `ownerId` must identify the **copy** (a tile index, an upgrade rank), not the
 * type — see the additive-stacking note above.
 */
export function auraSourceId(ownerId, templateId) {
    return `${ownerId}:${templateId}`;
}

/**
 * Read an authored `passiveBuff` as a LIST of modifiers: accepts one object or an array.
 *
 * @param {object|object[]|null} passiveBuff
 * @returns {object[]} always an array, empty when there's nothing to register
 */
export function normalizeAuras(passiveBuff) {
    if (!passiveBuff) return [];
    return Array.isArray(passiveBuff) ? passiveBuff.filter(Boolean) : [passiveBuff];
}
