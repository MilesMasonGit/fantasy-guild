// Landmarks: the endgame sites, which stand where the Starter Camp put them

import { isLandmarkType, tokenName } from '../../config/registries/tokenRegistry.js';

/**
 * A landmark is a Token whose type is marked `landmark` in the CMS: one of the endgame sites, one
 * per skill, standing in the Starter Camp from the first minute. It counts toward the Token cap like
 * any placed Token (`MatCap`), is never pushed by an arrival (`MatPlacement`), cannot be moved by the
 * player (`Placement.moveTokenTo`) and cannot be demolished (`Demolition.canDemolish`).
 *
 * The one exception is the owner laying out the Starter Camp: the dev layout tool
 * ({@link setLayoutEditing}) lets landmarks, and the Tokens the camp laid (`FixedTokens.isFixed`),
 * be moved and taken off while it is on. Never saved.
 */

let layoutEditing = false;
const layoutListeners = new Set();

/** Whether `instance` is a landmark. */
export function isLandmark(instance) {
    return isLandmarkType(instance?.typeId);
}

/** Dev only (the QA panel's Starter Camp tools): let the owner move and remove landmarks. */
export function setLayoutEditing(on) {
    const next = !!on;
    if (next === layoutEditing) return;
    layoutEditing = next;
    for (const listener of layoutListeners) listener();
}

/** Whether the dev layout tool is on. */
export function isLayoutEditing() {
    return layoutEditing;
}

/**
 * Be told when the dev layout tool is switched on or off. Returns the unsubscribe. The mat's
 * Tokens read whether they are fixed once (`MatToken`), so they need telling.
 */
export function onLayoutEditingChange(listener) {
    layoutListeners.add(listener);
    return () => layoutListeners.delete(listener);
}

/** Whether the player may pick `instance` up and put it somewhere else. */
export function canMove(instance) {
    return !isLandmark(instance) || layoutEditing;
}

/** Why a landmark refuses to move, in the player's words. */
export function cannotMoveReason(instance) {
    return `${tokenName(instance?.typeId)} cannot be moved`;
}
