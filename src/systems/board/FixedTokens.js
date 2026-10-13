// which Tokens stay where they are

import { getTokenType, getAllTokenTypes, registryVersion } from '../../config/registries/tokenRegistry.js';
import { QUEST_TOKEN_TYPE } from '../../config/registries/engineTokens.js';
import * as BoardState from './BoardState.js';
import * as MatCap from './MatCap.js';
import * as Landmarks from './Landmarks.js';

/**
 * Fixed and movable Tokens on the post-Atlas mat.
 *
 * Fixed: a map's node (`BoardState.isFixture`), a landmark (`MatCap.isLandmark`), the Guild Hall,
 * and a planted Token ({@link isPlanted}). A fixed Token is never dragged, binned or pushed; it
 * still answers a click. Everything else is movable.
 *
 * A movable Token bought or built carries the faint marker at rest ({@link showsMoveMarker});
 * enemies and quests move as they always have, without it.
 *
 * ⚠️ Kept a leaf (the registries, `BoardState` and `MatCap` only) so the pushers (`EffectActions`,
 * `Foundations`) can ask it without importing `Placement` and everything above it.
 */

/** Type ids some other type `grows` into, memoised on the Token registry's version. */
let grownInto = { version: -1, ids: new Set() };

function grownIntoIds() {
    const version = registryVersion();
    if (grownInto.version === version) return grownInto.ids;
    const ids = new Set();
    for (const def of Object.values(getAllTokenTypes())) {
        if (typeof def?.grows?.into === 'string') ids.add(def.grows.into);
    }
    grownInto = { version, ids };
    return ids;
}

/**
 * Whether a Token was planted: spawned by a growing place (a Forest's Sapling, a Field's Sprout)
 * and either still growing (its type has `grows`) or grown (its type is some type's `grows.into`).
 * Read from data, so a save from before this rule needs nothing.
 *
 * ⚠️ `spawned` is what separates a planted Oak from one placed by hand or written by a map (a
 * map's node is fixed anyway, as a fixture). A Token a `Transforms` statement turns into a type
 * outside a growth chain is no longer planted.
 */
export function isPlanted(instance) {
    if (!instance || BoardState.originOf(instance) !== BoardState.ORIGIN.SPAWNED) return false;
    const def = getTokenType(instance.typeId);
    if (!def) return false;
    return !!def.grows || grownIntoIds().has(instance.typeId);
}

/** Whether a Token stays where it is: a map's node, a landmark, the Guild Hall or planted. */
export function isFixed(instance) {
    if (!instance) return false;
    return BoardState.isFixture(instance)
        || MatCap.isGuildHall(instance)
        || (MatCap.isLandmark(instance) && !Landmarks.isLayoutEditing())
        || isPlanted(instance);
}

/**
 * Whether a Token shows the faint "you can move me" marker at rest, and lifts with the grab cursor
 * on hover: a movable Token that is neither an enemy nor a quest.
 */
export function showsMoveMarker(instance) {
    if (!instance || isFixed(instance)) return false;
    if (instance.typeId === QUEST_TOKEN_TYPE) return false;
    return !getTokenType(instance.typeId)?.enemy;
}

/**
 * The ids of every fixed Token on the mat, except `exceptId`: what no push may move.
 * A Token that is about to be replaced (a transform's old self) is named in `exceptId`.
 */
export function fixedTokenIds(exceptId = null) {
    const ids = [];
    for (const t of BoardState.tokens()) {
        if (t.id !== exceptId && isFixed(t)) ids.push(t.id);
    }
    return ids;
}

/**
 * The ids of every Token a spawn, a growth or a build may not push, except `exceptId`: every
 * `placed` Token, and every fixed one (a planted Token is `spawned` but fixed).
 */
export function unpushableIds(exceptId = null) {
    const ids = [];
    for (const t of BoardState.tokens()) {
        if (t.id === exceptId) continue;
        if (BoardState.originOf(t) === BoardState.ORIGIN.PLACED || isPlanted(t)) ids.push(t.id);
    }
    return ids;
}
