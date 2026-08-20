// Fantasy Guild — Per-tile modifier scope (7×7 Playmat rework, Phase 5)

import { ModifierAggregator, applyThreeBucket } from '../effects/ModifierAggregator.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { TARGET_CATEGORIES } from '../effects/constants.js';
import { neighboursOf, neighboursOfFootprint } from './adjacency.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { KEYWORD, statementsOf } from '../effects/statements.js';
import { isStatementPaid } from './BlockUpkeep.js';
import * as BoardState from './BoardState.js';

/**
 * TileModifiers — one runtime `ModifierAggregator` per tile, and the resolver
 * that reads them.
 *
 * The successor to the deleted `AreaModifiers.js`. Same discipline, new scope:
 * **runtime-only, rebuilt from board state, never serialized.** Persisting a
 * derived aggregator would freeze a stale buff into the save, and a silently
 * empty one after a reload is the classic failure — `ModifierScopes.test.js`
 * pins both.
 *
 * ## ⚠️ Why this file matters more than it looks
 * The gap analysis found that **only `SPEED` crossed scopes** in the old engine.
 * `YIELD`, `WORK_TIME` and `INPUT_COST` were card-local, which meant a Context
 * Token could never actually change a neighbour's output — the exact thing
 * D-119/D-120 describe. That was flagged as significant work.
 *
 * It turned out cheap, for a reason worth recording: **Phase 4 replaced the
 * consumers.** `BoardRunner` and `InputAllocator` compute yield, cycle time and
 * input cost themselves, so widening those axes is adding this resolver at three
 * call sites rather than retrofitting `LootSystem`, `StatProcessor` and
 * `WorkProcessor`. Rewriting the consumer first made the hard problem small.
 *
 * ## The rule that must not be got wrong
 * Every scope pushes into the **same buckets**, resolved once:
 *
 * ```
 * Final = (Base + Σflat) × (Σmultipliers) × (1 + Σpercentages)
 * ```
 *
 * Resolving each scope separately and multiplying compounds them — three +25%
 * sources give ×1.95 instead of ×1.75. That is precisely how D-120's
 * deliberately *small* adjacency effects turn into large ones, and it is what
 * `ModifierScopes.test.js` exists to prevent.
 */

/** @type {Map<number, ModifierAggregator>} */
const aggregators = new Map();

/** The aggregator for a tile, created on first use. */
export function getTileAggregator(index) {
    let agg = aggregators.get(index);
    if (!agg) {
        agg = new ModifierAggregator(`tile:${index}`);
        aggregators.set(index, agg);
    }
    return agg;
}

/** Drop every tile aggregator (before a rehydrate, and in tests). */
export function clearAll() {
    aggregators.clear();
}

/** The source id one Token's buff registers under. Per COPY, never per type. */
const sourceIdFor = (tile, typeId) => `tile:${tile}:${typeId}`;

/**
 * Does a targeted buff apply to the Token on the tile being rebuilt? (CMS-18/23)
 *
 * ## Targeted vs untargeted
 * A buff with **no** `targetToken` is untargeted and applies to everything
 * adjacent — the existing D-119/D-120 behaviour, whose effects are deliberately
 * tiny precisely *because* they touch everything nearby.
 *
 * A buff **with** one is narrow: "double all adjacent Shrimp output" needs the
 * specific target beside it to matter at all, so it can afford real weight
 * without letting power come from stacking modifiers (CMS-17).
 *
 * ## Three modes, chosen per Token (CMS-18)
 * Different buffs want different precision, so this is a per-buff choice rather
 * than one fixed method:
 *
 * * `tag`       — "boost all adjacent seafood"       (a Token's `tags`)
 * * `id`        — "boost specifically Shrimp Beds"   (exact `typeId`)
 * * `tokenType` — "boost all adjacent resources"     (the coarse category)
 *
 * ⚠️ An unknown mode matches **nothing**. A typo in a target spec should make a
 * buff visibly inert, not silently universal — the failure that would otherwise
 * turn a narrow, large effect into a board-wide one.
 */
export function matchesTokenTarget(spec, def) {
    if (!spec || !spec.mode) return true;   // untargeted
    if (spec.mode === 'all') return !!def;  // every adjacent Token (owner Q2)
    if (!def) return false;

    switch (spec.mode) {
        case 'id':
            return def.id === spec.value;
        case 'tokenType':
            return def.tokenType === spec.value;
        case 'tag':
            return (def.tags || []).includes(spec.value);
        default:
            return false;
    }
}

/**
 * Rebuild one tile's inbound modifiers from its 8 neighbours.
 *
 * Called whenever the neighbourhood changes. Cheap: at most 8 lookups, and only
 * the tiles actually affected are rebuilt.
 *
 * ## Two rules land here
 * - **A Buff Token affects every adjacent Token** — the same scarce Sawmill
 *   nudges each Forge beside it (D-113's logic applied to buffs).
 * - **Duplicates stack, uncapped** (D-23). Eight Sawmills genuinely give eight
 *   times a very small number, which is still a small number. That is safe
 *   because *effects are small* (D-120), not because tiles are scarce — tiles
 *   are abundant now (D-115), and the old justification no longer holds.
 *   Individual Tokens may still opt out with `noStackDuplicates` (D-82).
 */

/**
 * Generator yielding every **statement** from neighbouring Tokens that applies
 * to this tile.
 *
 * Handles:
 *  - many statements per Token — each is considered independently
 *  - CMS-18/23: targeted statements matching tag, id, or `all`
 *  - D-82: duplicate protection (`noStackDuplicates: true`)
 *  - CMS-60/97: paid upkeep check, now keyed by the statement's stable id
 *
 * ⚠️ A statement carrying a `When` clause is skipped here, exactly as a
 * triggered block was: it belongs to `TriggerSystem`. The difference is that
 * the grammar no longer *lets* an ambient effect carry one, so the case where
 * both systems skipped the same authored effect can no longer be authored.
 */
function* applicableStatements(index) {
    const occ = BoardState.getOccupyingToken(index);
    const selfDef = getTokenType(occ?.instance?.typeId);
    const seenTypes = new Set();
    const seenAnchors = new Set();

    const neighbours = occ && occ.footprint.length > 1 ? neighboursOfFootprint(occ.footprint) : neighboursOf(index);

    for (const neighbour of neighbours) {
        const nOcc = BoardState.getOccupyingToken(neighbour);
        if (!nOcc?.instance) continue;
        if (seenAnchors.has(nOcc.anchorIndex)) continue;
        seenAnchors.add(nOcc.anchorIndex);

        const instance = nOcc.instance;
        const def = getTokenType(instance.typeId);

        // A Token may carry SEVERAL statements — two effects aimed at different
        // neighbours, say. Each is considered independently.
        const statements = statementsOf(def);
        if (!statements.length) continue;

        if (def.noStackDuplicates) {
            if (seenTypes.has(instance.typeId)) continue;
            seenTypes.add(instance.typeId);
        }

        for (const statement of statements) {
            if (statement?.when?.event) continue;
            if (statement?.keyword !== KEYWORD.PROVIDES && statement?.keyword !== KEYWORD.GRANTS) continue;
            if (!statement.payload?.type) continue;

            // CMS-18/23: a targeted statement only reaches Tokens it names.
            if (!matchesTokenTarget(statement.to, selfDef)) continue;

            // CMS-60/97: an unpaid statement is simply off until stock returns.
            if (!isStatementPaid(instance, statement.id)) continue;

            yield { statement, neighbour: nOcc.anchorIndex, instance };
        }
    }
}

export function rebuildTile(index) {
    const agg = getTileAggregator(index);
    agg.clearAll();

    for (const { statement, neighbour, instance } of applicableStatements(index)) {
        if (statement.keyword !== KEYWORD.PROVIDES) continue;
        // The source id carries the statement's **stable id** rather than its
        // position, so reordering a Token's rules cannot make one statement's
        // contribution look like another's.
        const source = `${sourceIdFor(neighbour, instance.typeId)}:${statement.id}`;
        agg.addModifier({ ...statement.payload, source });
    }
}

/**
 * Item-granting statements reaching this tile, as raw payloads (CMS-27/72).
 */
export function collectItemGrants(index, effectType) {
    const grants = [];
    for (const { statement } of applicableStatements(index)) {
        const payload = statement.payload;
        if (payload?.type === effectType && payload.itemId) grants.push(payload);
    }
    return grants;
}

/** Rebuild a tile and every tile it touches. */
export function rebuildAround(indexOrFootprint) {
    if (Array.isArray(indexOrFootprint)) {
        for (const t of indexOrFootprint) rebuildTile(t);
        for (const n of neighboursOfFootprint(indexOrFootprint)) rebuildTile(n);
    } else {
        const occ = BoardState.getOccupyingToken(indexOrFootprint);
        if (occ && occ.footprint.length > 1) {
            for (const t of occ.footprint) rebuildTile(t);
            for (const n of neighboursOfFootprint(occ.footprint)) rebuildTile(n);
        } else {
            rebuildTile(indexOrFootprint);
            for (const n of neighboursOf(indexOrFootprint)) rebuildTile(n);
        }
    }
}

/** Rebuild the whole board — on boot and after a save load. */
export function rebuildAll() {
    clearAll();
    for (const [index] of BoardState.occupiedTiles()) rebuildTile(index);
}

/**
 * Resolve one effect axis for a tile, merging **every scope into one set of
 * buckets** before applying the three-bucket formula.
 *
 * Scopes, all contributing to the same buckets:
 *  - the tile's own inbound modifiers (its neighbours' buffs)
 *  - the guild-wide aggregator (Guild Hall Global upgrades, D-121)
 *
 * @param {number} index      tile
 * @param {string} effectType EFFECT_TYPES key
 * @param {number} base       the authored value
 * @param {string} [category] skill category, for targeted buffs
 */
export function resolveAxis(index, effectType, base, category = TARGET_CATEGORIES.ALL) {
    const tile = getTileAggregator(index);
    const guild = getGlobalAggregator();

    const flat = [
        tile.getFlat(effectType, category),
        guild.getFlat(effectType, category)
    ];
    const multipliers = [
        ...tile.collectMultipliers(effectType, category),
        ...guild.collectMultipliers(effectType, category)
    ];
    const percentages = [
        ...tile.collectPercentages(effectType, category),
        ...guild.collectPercentages(effectType, category)
    ];

    return applyThreeBucket(base, { flat, multipliers, percentages });
}
