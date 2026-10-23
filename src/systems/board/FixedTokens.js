// which Tokens stay where they are

import { getTokenType, getAllTokenTypes, registryVersion } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as MatCap from './MatCap.js';
import * as Landmarks from './Landmarks.js';

/**
 * Fixed and movable Tokens on the post-Atlas mat.
 *
 * Fixed: a fixture (`BoardState.isFixture`: a map's node, or a Token the Starter Camp laid), a
 * landmark (`MatCap.isLandmark`) and a planted Token ({@link isPlanted}). A fixed Token is never
 * dragged, binned or pushed; it still answers a click. Everything else is movable.
 *
 * ⚠️ The Guild Hall is movable but never pushed ({@link holdsItsGround}): the player drags it,
 * nothing else moves it, and it never leaves the mat (`Placement.isPermanentToken`,
 * `Demolition.canDemolish`).
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

/**
 * Whether a Token stays where it is, refusing a drag: a fixture (a map's node or a Token the
 * Starter Camp laid), a landmark or planted.
 *
 * ⚠️ The dev layout tool (`Landmarks.setLayoutEditing`) lifts the landmarks and the camp's
 * fixtures, so the owner can lay the camp out again from a new game.
 */
export function isFixed(instance) {
    if (!instance) return false;
    const editing = Landmarks.isLayoutEditing();
    return (BoardState.isFixture(instance) && !(editing && BoardState.isCampFixture(instance)))
        || (MatCap.isLandmark(instance) && !editing)
        || isPlanted(instance);
}

/**
 * Make the Tokens a Starter Camp has just laid down its fixtures (`BoardState.FIXTURE.CAMP`), all
 * but the Guild Hall, which the player may still move. Called as a new game's camp is laid
 * (`StarterCamp.layOnLiveBoard`); a Token the player buys, crafts or builds there later is not one.
 *
 * @param {object[]} instances the camp's Tokens, as they stand on the mat
 * @returns {object[]} the same instances
 */
export function fixCampTokens(instances) {
    for (const instance of instances || []) {
        if (instance && !MatCap.isGuildHall(instance)) instance.fixture = BoardState.FIXTURE.CAMP;
    }
    return instances;
}

/** Whether nothing but the player may move a Token: a fixed one, and the Guild Hall. */
export function holdsItsGround(instance) {
    return isFixed(instance) || MatCap.isGuildHall(instance);
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
