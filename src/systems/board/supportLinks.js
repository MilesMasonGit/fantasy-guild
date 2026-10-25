// which Tokens a support helps and is helped by: for the drag highlight, the card's lists and a bonus's spark

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { recipesForToken } from '../../config/registries/recipePoolRegistry.js';
import { catchItemIds, hasCatchPools } from '../../config/registries/catchPools.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { reachOf, reachCovers, RELATION } from '../../config/registries/reachRegistry.js';
import { KEYWORD, statementsOf, stationSkillOf } from '../effects/statements.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from '../effects/constants.js';
import { MAX_SPEED_UP_CUT } from '../../config/loopConstants.js';
import { isStatementPaid } from './BlockUpkeep.js';
import { nearRadius, tokensWithin, centreOf, distanceSq } from './nearby.js';
import * as BoardState from './BoardState.js';
import * as TileModifiers from './TileModifiers.js';

/**
 * A support is a Token whose standing rule changes a neighbour's number (`Provides`: Grow Time,
 * Work Time, Crop Load, Double Item Chance...) or grants it an extra item (`Grants` a Bonus Drop).
 * Everything here only reads: the engine's own walk (`TileModifiers.inboundSupports`) for a Token
 * on the mat, and the same tests (reach, filter, upkeep) for a Token still in the hand.
 */

/** What a rule gives, when it is a support's: its payload, else null. */
export function supportPayloadOf(statement) {
    if (!statement || statement.when?.event) return null;
    const p = statement.payload;
    if (statement.keyword === KEYWORD.PROVIDES) return p?.type ? p : null;
    if (statement.keyword === KEYWORD.GRANTS) return p?.type === EFFECT_TYPES.BONUS_DROP && p.itemId ? p : null;
    return null;
}

/** Whether a rule's reach turns on where its Token stands (Near), not the whole mat or itself. */
function reachesNear(statement) {
    const reach = reachOf(statement);
    return reachCovers(reach, RELATION.NEARBY) && !reachCovers(reach, RELATION.DISTANT);
}

/** A Token type's work skill: its own, its station's, or that of what it grows into. */
export function skillOfType(def) {
    let d = def;
    for (let step = 0; step < 8 && d; step++) {
        const skill = d.config?.skill || d.foundation?.skill || stationSkillOf(d);
        if (typeof skill === 'string' && skill) return skill;
        d = typeof d.grows?.into === 'string' ? getTokenType(d.grows.into) : null;
    }
    return null;
}

/** Every item a Token type can make: its outputs, its recipes' outputs, its waters' catch. */
function itemsOfType(def) {
    const ids = new Set();
    for (const o of def?.config?.outputs || []) if (o?.itemId) ids.add(o.itemId);
    for (const r of recipesForToken(def)) for (const o of r?.outputs || []) if (o?.itemId) ids.add(o.itemId);
    if (hasCatchPools(def)) for (const id of catchItemIds(def)) ids.add(id);
    return ids;
}

/**
 * Whether a payload's narrowing lets it reach a Token of this type: a skill rule only that skill's
 * Tokens, an item rule only Tokens that make the item. The aggregator holds a narrowed rule on
 * every Token it reaches and only its reader picks it out, so without this a Mining rule would
 * light a Field.
 */
export function narrowingFits(payload, def) {
    const category = payload?.category;
    if (!category || category === TARGET_CATEGORIES.ALL) return true;
    const kind = getPaletteEntry(payload.type)?.categories;
    if (kind === 'item') return itemsOfType(def).has(category);
    if (kind === 'skill') return String(skillOfType(def) || '').toLowerCase() === String(category).toLowerCase();
    return true;
}

/** Group `{id, payload}` pairs by id, in first-seen order: one row per Token. */
function grouped(pairs) {
    const rows = new Map();
    for (const { id, payload } of pairs) {
        if (!rows.has(id)) rows.set(id, { id, typeId: BoardState.getTokenById(id)?.typeId ?? null, payloads: [] });
        rows.get(id).payloads.push(payload);
    }
    return [...rows.values()];
}

/** The supports reaching a Token on the mat now, one row per Token: `{id, typeId, payloads}`. */
export function boostedBy(instanceId) {
    const self = BoardState.getTokenById(instanceId);
    if (!self) return [];
    const def = getTokenType(self.typeId);
    const pairs = [];
    for (const { sourceId, statement } of TileModifiers.inboundSupports(instanceId)) {
        const payload = supportPayloadOf(statement);
        if (payload && narrowingFits(payload, def)) pairs.push({ id: sourceId, payload });
    }
    return grouped(pairs);
}

/** The Tokens within reach that this one's rules reach now, one row per Token. */
export function boosts(instanceId) {
    const self = BoardState.getTokenById(instanceId);
    if (!self || !statementsOf(getTokenType(self.typeId)).some(supportPayloadOf)) return [];
    const pairs = [];
    for (const id of tokensWithin(centreOf(self), nearRadius(), instanceId)) {
        const def = getTokenType(BoardState.getTokenById(id)?.typeId);
        for (const { sourceId, statement } of TileModifiers.inboundSupports(id)) {
            if (sourceId !== instanceId) continue;
            const payload = supportPayloadOf(statement);
            if (payload && narrowingFits(payload, def)) pairs.push({ id, payload });
        }
    }
    return grouped(pairs);
}

/**
 * Whether the speed-ups reaching a Token are held at the standard floor (`floorSpeedUp`): its
 * work time, and its grow or refill time. Resolved through the aggregator, as the engine reads it.
 * @returns {{work: boolean, grow: boolean}}
 */
export function floorHits(instanceId) {
    const self = BoardState.getTokenById(instanceId);
    if (!self) return { work: false, grow: false };
    const skill = skillOfType(getTokenType(self.typeId)) || TARGET_CATEGORIES.ALL;
    const base = 1000;
    const floor = base - base * MAX_SPEED_UP_CUT;
    const below = (type) => TileModifiers.resolveAxis(instanceId, type, base, skill) < floor - 1e-6;
    return { work: below(EFFECT_TYPES.WORK_TIME), grow: below(EFFECT_TYPES.GROW_TIME) };
}

/**
 * The first Token whose rule of this kind reaches `instanceId` (narrowed to `category` when it
 * names one), or null: where a bonus pop's spark starts. Several supports merge into one number,
 * so the first stands for them.
 */
export function firstSupportOf(instanceId, effectType, category = null) {
    for (const { sourceId, statement } of TileModifiers.inboundSupports(instanceId)) {
        const payload = supportPayloadOf(statement);
        if (payload?.type !== effectType) continue;
        const cat = payload.category;
        if (category && cat && cat !== TARGET_CATEGORIES.ALL && cat !== category) continue;
        return sourceId;
    }
    return null;
}

/** The link roles: the held Token helps this one, or this one helps the held Token. */
export const LINK = Object.freeze({ HELPS: 'helps', HELPED_BY: 'helpedBy' });

/**
 * Every Token on the mat a Token of `typeId` would trade support with if it stood within reach of
 * it, worked out once as a drag starts: `{id, x, y, typeId, links: [{role, payload}]}`. While the
 * drag runs only the distance is asked ({@link linksAt}), because Near is centre to centre and
 * nothing else changes mid-drag.
 *
 * A Token being moved (`movingId`) is left out of the candidates and lends its instance to the
 * filters and its upkeep to the paid test; a new one counts as paid. A board-wide rule is left out:
 * where the Token stands does not change it.
 *
 * @param {string} typeId
 * @param {string|null} [movingId]
 */
export function placementCandidates(typeId, movingId = null) {
    const heldDef = getTokenType(typeId);
    if (!heldDef) return [];
    const moving = movingId ? BoardState.getTokenById(movingId) : null;
    const heldRules = statementsOf(heldDef).filter(s => supportPayloadOf(s) && reachesNear(s)
        && (!moving || isStatementPaid(moving, s.id)));
    const radiusSq = nearRadius() ** 2;
    const all = BoardState.tokens();
    const out = [];
    for (const other of all) {
        if (other.id === movingId) continue;
        const centre = centreOf(other);
        if (!centre) continue;
        const def = getTokenType(other.typeId);
        if (!def) continue;
        const links = [];
        // Already served by another copy that does not stack: one more adds nothing.
        const served = heldDef.noStackDuplicates && all.some(t => t.id !== movingId && t.id !== other.id
            && t.typeId === typeId && centreOf(t) && distanceSq(centreOf(t), centre) <= radiusSq);
        if (!served) {
            for (const s of heldRules) {
                const payload = supportPayloadOf(s);
                if (!narrowingFits(payload, def)) continue;
                if (!TileModifiers.matchesTokenTarget(s.to, def, { instance: other, tokenId: other.id })) continue;
                links.push({ role: LINK.HELPS, payload });
            }
        }
        for (const s of statementsOf(def)) {
            const payload = supportPayloadOf(s);
            if (!payload || !reachesNear(s) || !isStatementPaid(other, s.id)) continue;
            if (!narrowingFits(payload, heldDef)) continue;
            if (!TileModifiers.matchesTokenTarget(s.to, heldDef, moving ? { instance: moving } : null)) continue;
            links.push({ role: LINK.HELPED_BY, payload });
        }
        if (links.length) out.push({ id: other.id, x: centre.x, y: centre.y, typeId: other.typeId, links });
    }
    return out;
}

/** The candidates within reach of where the held Token would land. */
export function linksAt(candidates, point, radius = nearRadius()) {
    if (!point || !candidates?.length) return [];
    const r2 = radius * radius;
    return candidates.filter(c => distanceSq(point, c) <= r2);
}
