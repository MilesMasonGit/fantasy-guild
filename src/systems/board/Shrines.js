// a shrine's blessing holds while it is lit; offerings keep it lit

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { getRecipe } from '../../config/registries/recipePoolRegistry.js';
import { shrineOf, offeringTermsOf } from '../../config/registries/tokenConstants.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';

/**
 * A shrine is a station (Works as Faith, kind `shrine`) with a `shrine` block
 * (`tokenConstants.shrineOf`). Its rules, the blessing on the Tokens in its reach, hold only while
 * it is **lit**: every one of them is off while it is out (`BlockUpkeep.isStatementPaid`, the gate
 * every rule reader already asks), and its Works as is read off its definition, so an unlit shrine
 * can always be tended.
 *
 * * **Lighting.** Its recipes are offerings: each cycle a Faith hero works there spends the
 *   recipe's inputs as any station does, and when the cycle ends the shrine is lit for the offering's
 *   time more (`offeringTermsOf`: `offering.litMs`), up to the shrine's most (`maxLitMs`).
 * * **Burning down.** Its lit time runs down by every tick's game time, tended or not, in the hand
 *   too ({@link burn}); at nothing the blessing goes out. That is the fade: a timer the card and the
 *   mat's lit bar show, topped up by each offering.
 * * **Full.** A lit shrine with no room left for a whole offering's time is not worked
 *   (`ALERT.SHRINE_FULL`, one of `WorkCheck.AWAY`): its hero lets go and waits by it, and tends it
 *   again once it has burned down that far, so no offering is spent for nothing. A shrine that is
 *   out always takes one, its lit time held at its most.
 *
 * Saved on the instance as `shrine: { litMs }`; absent, or 0, is out. A frozen Region's shrine does
 * not burn (nothing on that board ticks), and a catch-up burns it step by step with the rest.
 */

const NO_STATE = Object.freeze({ litMs: 0 });

/** Whether a Token type is a shrine. */
export function isShrine(def) {
    return shrineOf(def) != null;
}

/** A shrine's most lit time, or 0 for a Token that is not one. */
export function maxLitMsOf(def) {
    return shrineOf(def)?.maxLitMs ?? 0;
}

/** How long a Token stays lit, in game ms; 0 when it is out or no shrine. */
export function litMsOf(instance) {
    const ms = Number((instance?.shrine || NO_STATE).litMs);
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/** Whether a Token is a lit shrine. */
export function isLit(instance) {
    return litMsOf(instance) > 0;
}

/**
 * Whether a Token is a shrine that is out: every one of its rules is off. Cheap for any Token: a
 * Token whose type has no shrine block answers at its first test.
 */
export function isOut(instance, def = getTokenType(instance?.typeId)) {
    return !!def?.shrine && isShrine(def) && !isLit(instance);
}

function announce(instance, def) {
    EventBus.publish(BOARD_EVENTS.SHRINE_LIT, {
        instanceId: instance.id, lit: isLit(instance), litMs: litMsOf(instance), maxLitMs: maxLitMsOf(def)
    });
}

/**
 * A tick's `delta` of game time burns from a lit shrine. Returns true when it just went out, so
 * the caller rebuilds the Tokens its blessing reached: an aura going dark must stop applying.
 */
export function burn(instance, def, delta) {
    if (!def?.shrine || !(delta > 0)) return false;
    const left = litMsOf(instance);
    if (left <= 0) return false;
    const next = Math.max(0, left - delta);
    instance.shrine.litMs = next;
    if (next > 0) return false;
    announce(instance, def);
    return true;
}

/**
 * An offering landed: the shrine is lit for `recipe`'s offering time more, at most its most.
 * Returns true when it was out and is lit now, so the caller rebuilds its reach.
 */
export function light(instance, def, recipe) {
    if (!isShrine(def)) return false;
    const was = litMsOf(instance);
    instance.shrine = { litMs: Math.min(maxLitMsOf(def), was + offeringTermsOf(recipe).litMs) };
    announce(instance, def);
    return was <= 0;
}

/** The recipe a shrine is set to, read straight off its pick (the pool check is the resolver's). */
function pickOf(instance) {
    return instance?.selectedRecipeId ? getRecipe(instance.selectedRecipeId) : null;
}

/**
 * Whether a lit shrine has no room for a whole offering of `recipe` (its pick when not given):
 * then nobody works it. Out, it always has room.
 */
export function isFull(instance, def = getTokenType(instance?.typeId), recipe = pickOf(instance)) {
    if (!isShrine(def)) return false;
    const left = litMsOf(instance);
    if (left <= 0) return false;
    return left + offeringTermsOf(recipe).litMs > maxLitMsOf(def);
}

/** `ALERT.SHRINE_FULL` for a shrine too full to take its offering, else null. */
export function workReason(instance, def = getTokenType(instance?.typeId), recipe = pickOf(instance)) {
    return isFull(instance, def, recipe) ? ALERT.SHRINE_FULL : null;
}

/**
 * A shrine as the card and the mat read it: `{ lit, litMs, maxLitMs, full }`, or null for a Token
 * that is not one.
 */
export function shrineState(instance) {
    const def = getTokenType(instance?.typeId);
    if (!instance || !isShrine(def)) return null;
    return { lit: isLit(instance), litMs: litMsOf(instance), maxLitMs: maxLitMsOf(def), full: isFull(instance, def) };
}
