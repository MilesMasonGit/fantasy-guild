// building in place on a Foundation

import * as BoardState from './BoardState.js';
import * as MatPlacement from './MatPlacement.js';
import * as EffectActions from './EffectActions.js';
import { centreOf } from './nearby.js';

/**
 * A Foundation is a station whose recipes output a Token. A hero with the Foundation's skill works
 * it; when the cycle completes the recipe's inputs are paid as normal and the Foundation becomes
 * the output Token at the same point, keeping origin `placed`.
 *
 * `BoardRunner.completeCycle` owns the order; this module owns what a build makes, whether it has
 * room, and the transform itself.
 */

/** Whether a Token type is a Foundation. */
export function isFoundation(def) {
    return !!def?.foundation;
}

/**
 * The Token a Foundation's running recipe builds, or null. A building recipe outputs exactly one
 * `tokenId`; the first is taken if a hand-made fixture carries more.
 */
export function buildTargetOf(io) {
    return (io?.outputs || []).find(o => o?.tokenId)?.tokenId || null;
}

/**
 * The placed Tokens a building must not push: placed Tokens are fixed, as in the timed changes;
 * only spawned ones make way.
 */
function fixedIdsFor(instance) {
    return BoardState.placedTokenIds().filter(id => id !== instance.id);
}

/**
 * Whether `typeId` has somewhere legal to stand in place of this Foundation.
 * Pure: the same `forceSpot` question `transformInstance` asks, asked first,
 * so a build with no room spends nothing and keeps its progress.
 */
export function hasRoomToBuild(instance, typeId) {
    const from = centreOf(instance);
    if (!typeId || !from) return false;
    return !!MatPlacement.forceSpot(typeId, from, {
        excludeId: instance.id,
        fixedIds: fixedIdsFor(instance)
    });
}

/**
 * What a built Token remembers of how it was built: `{ foundationTypeId, buildCost: [{ itemId,
 * quantity }] }`, the Foundation's type and the build cost the cycle actually paid, merged per
 * item. The discard bin's refund is half of both, and nothing else keeps it once the Foundation has
 * become the station. Only item inputs are kept; a zero or unnamed line is dropped.
 */
export function builtFromRecord(foundationTypeId, paidInputs = []) {
    const merged = new Map();
    for (const input of paidInputs || []) {
        const quantity = Math.floor(Number(input?.quantity) || 0);
        if (!input?.itemId || quantity <= 0) continue;
        merged.set(input.itemId, (merged.get(input.itemId) || 0) + quantity);
    }
    return {
        foundationTypeId: foundationTypeId || null,
        buildCost: [...merged].map(([itemId, quantity]) => ({ itemId, quantity }))
    };
}

/**
 * The Foundation becomes `typeId` at its point, keeping its origin. Returns the new instance, or
 * null when there was no room after all.
 *
 * `paidInputs` is what the build cycle paid (after any `INPUT_COST` change); the new instance
 * remembers it with the Foundation's type as `builtFrom`, saved with the instance, for the discard
 * refund.
 */
export function buildInPlace(instance, typeId, paidInputs = []) {
    return EffectActions.transformInstance(instance, typeId, {
        fixPlaced: true,
        extra: { builtFrom: builtFromRecord(instance?.typeId, paidInputs) }
    });
}
