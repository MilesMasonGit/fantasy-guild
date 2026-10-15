// which Tokens stay where they are

import { getTokenType, getAllTokenTypes, registryVersion } from '../../config/registries/tokenRegistry.js';
import { QUEST_TOKEN_TYPE } from '../../config/registries/engineTokens.js';
import * as BoardState from './BoardState.js';
import * as MatCap from './MatCap.js';
import * as Landmarks from './Landmarks.js';

/**
 * Fixed and movable Tokens on the post-Atlas mat.
 *
 * Fixed: a map's node (`BoardState.isFixture`), a landmark (`MatCap.isLandmark`) and a planted
 * Token ({@link isPlanted}). A fixed Token is never dragged, binned or pushed; it still answers a
 * click. Everything else is movable.
 *
 * ⚠️ The Guild Hall is movable but never pushed ({@link holdsItsGround}): the player drags it,
 * nothing else moves it, and it never leaves the mat (`Placement.isPermanentToken`,
 * `Demolition.canDemolish`).
 *
 * A movable Token bought or built, and the Hall, carry the faint marker at rest
 * ({@link showsMoveMarker}); enemies and quests move as they always have, without it.
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

/** Whether a Token stays where it is, refusing a drag: a map's node, a landmark or planted. */
export function isFixed(instance) {
    if (!instance) return false;
    return BoardState.isFixture(instance)
        || (MatCap.isLandmark(instance) && !Landmarks.isLayoutEditing())
        || isPlanted(instance);
}

/** Whether nothing but the player may move a Token: a fixed one, and the Guild Hall. */
export function holdsItsGround(instance) {
    return isFixed(instance) || MatCap.isGuildHall(instance);
}

/**
 * Whether a Token shows the faint "you can move me" marker at rest (the grab cursor goes with
 * it): a movable Token that is neither an enemy nor a quest.
 */
export function showsMoveMarker(instance) {
    if (!instance || isFixed(instance)) return false;
    if (instance.typeId === QUEST_TOKEN_TYPE) return false;
    return !getTokenType(instance.typeId)?.enemy;
}

/**
 * The ids of every Token on the mat no push may move ({@link holdsItsGround}), except `exceptId`.
 * A Token that is about to be replaced (a transform's old self) is named in `exceptId`.
 */
export function fixedTokenIds(exceptId = null) {
    const ids = [];
    for (const t of BoardState.tokens()) {
        if (t.id !== exceptId && holdsItsGround(t)) ids.push(t.id);
    }
    return ids;
}

/**
 * The ids of every Token a spawn, a growth or a build may not push, except `exceptId`: every
 * `placed` Token, every planted one (`spawned` but fixed), and the Guild Hall.
 */
export function unpushableIds(exceptId = null) {
    const ids = [];
    for (const t of BoardState.tokens()) {
        if (t.id === exceptId) continue;
        if (BoardState.originOf(t) === BoardState.ORIGIN.PLACED || isPlanted(t) || MatCap.isGuildHall(t)) ids.push(t.id);
    }
    return ids;
}
