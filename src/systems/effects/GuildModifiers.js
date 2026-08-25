// Fantasy Guild — Guild-Wide Modifier Aggregator
// (Area Deck Rework C-11; renamed from GlobalModifiers.js by the 7×7 playmat
//  rework, Phase 1 §C — see playmat_roadmap_v1.md, decision G-19.)

import { ModifierAggregator } from './ModifierAggregator.js';

/**
 * GuildModifiers — ONE runtime-only ModifierAggregator for the whole guild.
 *
 * ## Why this survived the playmat rework
 * Grid concept §10.3 listed the buff/modifier rebuild without mentioning this
 * module at all. It is kept deliberately, for three reasons:
 *
 *  - It is **the only proof in the codebase that an aura can reach across
 *    scopes.** Every other axis is card-local (see `buff_diversification_
 *    orientation.md` §3), so this is the working example the tile scope copies.
 *  - It carries the **additive-stacking source-id discipline** (D-23) that any
 *    board-wide modifier needs. Those rules are pinned in `ModifierScopes.test.js`.
 *  - It is the shape the Guild Hall's **Global**-reach upgrades take (D-121):
 *    bank capacity, roster cap, sell rates — effects that are not spatial at all.
 *
 * Its former consumer (Outpost station auras) is deleted with the deck loop, so
 * it is **currently unused**. That is expected: the Guild Hall aura track lands
 * in a later pass, and the tile scope (`TileModifiers`) arrives in Phase 5.
 *
 * ## The original reasoning, still valid
 * This is one scope up from a per-location aggregator. A guild-wide aura reaches
 * everything, so its modifiers cannot live on any one location's aggregator —
 * there is no single location they belong to.
 *
 * ## Additive stacking (D-23)
 * Two Smithies must give twice one Smithy, not the square of it. That falls out
 * of the Three-Bucket math for free **provided each installed copy registers
 * under a DISTINCT source**: the buckets sum their members, so two `+25%`
 * entries resolve to `+50%` (§15.3), never `×1.5625`.
 *
 * Source ids must therefore be **per installed copy**, e.g.
 * `"<tileIndex>:<tokenTypeId>"`, never the bare type id — otherwise the second
 * copy's `removeModifiersBySource` would silently strip the first one's entry
 * too, and removing one would cancel both.
 *
 * ## Not serialized
 * This is rebuilt from state rather than saved. Whatever installs a guild-wide
 * modifier owns replaying it on boot and after every load; a silently-empty
 * aggregator after a reload is the classic failure here. `ModifierScopes.test.js`
 * pins the rule.
 *
 * ## How consumers must read it
 * Push these contributions into the **same buckets** as every other scope, then
 * resolve once. Resolving each scope separately and multiplying the results
 * compounds them — three +25% sources would give ×1.95 instead of ×1.75, which
 * is exactly how D-120's deliberately small adjacency effects would turn into
 * large ones.
 *
 * ⚠️ Corrected 2026-08-24 (CR2-081). This used to point at
 * `StatProcessor.calculateWorkcycleStats` as the pattern to copy;
 * **`StatProcessor` was deleted with the card system.** The live example is
 * `TileModifiers.resolveAxis`, which `BoardRunner` calls for WORK_TIME and
 * INPUT_COST: it collects every scope into one aggregator and resolves once.
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

/**
 * The source id one installed thing registers its aura under (D-23).
 * `ownerId` must identify the **copy** (a tile index, an upgrade rank), not the
 * type — see the additive-stacking note above.
 */
export function auraSourceId(ownerId, templateId) {
    return `${ownerId}:${templateId}`;
}

/**
 * Read an authored `passiveBuff` as a LIST of modifiers.
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
