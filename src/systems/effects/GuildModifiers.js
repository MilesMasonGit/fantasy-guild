import { ModifierAggregator } from './ModifierAggregator.js';

/**
 * ONE runtime-only ModifierAggregator for the whole guild, for modifiers that reach
 * across every scope. `TileModifiers.resolveAxis` reads it; the active Region's own rules
 * register into it (`atlas/RegionRules.js`), and so do the Guild Hall's stars
 * (`progression/HallRules.js`).
 *
 * Beside it, the guild's **aimed** modifiers: guild-wide rules that name some Tokens (a Guild Hall
 * star's "−20% Grow Time to Copper Veins"). The aggregator cannot tell one Token from another, so
 * these are added to each matching Token's own aggregator as it is rebuilt
 * (`TileModifiers.rebuildToken`); whoever changes them rebuilds the mat.
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

/** Each owner's aimed modifiers (`{ to, modifier }`), and the flat list every rebuild reads. */
const aimedByOwner = new Map();
let aimedFlat = [];

/**
 * Replace one owner's aimed modifiers: `[{ to, modifier }]`, `to` the rule's Token selector, read
 * only off a Token's definition. The caller rebuilds the mat when the list changed.
 */
export function setAimedModifiers(owner, list) {
    if (list && list.length) aimedByOwner.set(owner, list);
    else aimedByOwner.delete(owner);
    aimedFlat = [...aimedByOwner.values()].flat();
}

/** Every owner's aimed modifiers. Empty when there are none. */
export function aimedModifiers() {
    return aimedFlat;
}
