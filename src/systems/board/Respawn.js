// respawning fixtures: Tokens that rest and come back

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { respawnOf as respawnBlockOf } from '../../config/registries/tokenConstants.js';
import * as BoardState from './BoardState.js';

/**
 * A Token type with a `respawn` block does not leave the mat when its charges run out: it rests.
 * - **refill**: it stays where it stands at 0 charges, nobody can work it, and after its rest
 *   ({@link restMsOf}) it refills to its starting charges all at once.
 * - **regrow**: at 0 it becomes its `into` Token (an Oak Tree becomes an Oak Sapling), whose own
 *   `grows` block brings it back.
 *
 * Resting is not a state of its own: a Token rests while it holds 0 charges and its type
 * respawns ({@link isResting}). Where a Token would be removed for running out
 * (`Charges.destroyToken`, a support worn out by a kill in `BoardCombat`), {@link restInstead}
 * keeps it. The way back is two rows of `TimedChanges.HANDLERS` on one clock
 * (`clocks.respawnMs`), so a catch-up plays it with every other clock, and a regrow, which puts
 * a new instance in the Token's place, waits while the Token is in the player's hand.
 *
 * A resting Token is never depleted: no `TOKEN_DEPLETED`, no red alert, nothing for the catch-up
 * summary to count as used up. Its hero lets go on the next flag pass (`Flags`) and works the
 * next thing; `WorkCheck` says `resting`, which is not a problem the player fixes, so it raises
 * no badge.
 *
 * ⚠️ What a resting Token offers by standing on the mat (context tags, a buff's aura) it still
 * offers: only working it and spending its charges stop.
 */

/** The clock a rest counts on, in `instance.clocks`. */
export const CLOCK = 'respawnMs';

/**
 * The respawn a Token type runs, or null. The authored block through its one reader
 * (`tokenConstants.respawnOf`), minus the types the engine never lets respawn whatever is
 * authored: an enemy (its spawner replaces it), a spawner and a Foundation. The content audit
 * reports those as errors.
 */
export function respawnOf(def) {
    if (!def?.respawn || def.enemy || def.spawner || def.foundation) return null;
    return respawnBlockOf(def);
}

/**
 * How long a resting Token rests before it refills, in ms. The one reader of the time, so a
 * future time axis (a grove, a minecart) widens it here and nowhere else. A regrow's time is
 * its `into` Token's growth.
 */
export function restMsOf(instance, def = getTokenType(instance?.typeId)) {
    return respawnOf(def)?.afterMs ?? 0;
}

/** Whether this Token is resting: out of charges, of a type that comes back. */
export function isResting(instance, def) {
    const left = instance?.usesRemaining;
    if (left == null || left > 0) return false;
    return respawnOf(def ?? getTokenType(instance.typeId)) != null;
}

/** How a resting Token comes back (`'refill'` or `'regrow'`), or null when it is not resting. */
export function restingMode(instance, def) {
    return isResting(instance, def) ? respawnOf(def ?? getTokenType(instance.typeId)).mode : null;
}

/**
 * Put a Token that has just run out to rest, instead of removing it. Called where it would be
 * removed; returns true when it rests (the caller must not remove it), false when its type does
 * not respawn or it is not on the mat (the caller goes on as before).
 */
export function restInstead(instance, { heroId = null, exhaustedBy = heroId } = {}) {
    if (!instance?.id || !instance.typeId) return false;
    const respawn = respawnOf(getTokenType(instance.typeId));
    if (!respawn) return false;
    const token = BoardState.getTokenById(instance.id);
    if (!token) return false;
    // Every rest starts its clock from nothing: a charge given back mid-rest (a restock) ends a
    // rest without the clock finishing.
    if (token.clocks && CLOCK in token.clocks) delete token.clocks[CLOCK];
    EventBus.publish(BOARD_EVENTS.TOKEN_RESTING, {
        instanceId: token.id, typeId: token.typeId, mode: respawn.mode,
        x: token.x, y: token.y, heroId, exhaustedBy
    });
    return true;
}

/** A refill falls due: back to its starting charges. `TimedChanges`' handler; returns the Token. */
export function refill(instance) {
    const full = tokenStartingUses(instance.typeId);
    const delta = (full ?? 0) - (instance.usesRemaining ?? 0);
    instance.usesRemaining = full;
    EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
        instanceId: instance.id, delta, remaining: instance.usesRemaining, typeId: instance.typeId
    });
    EventBus.publish(BOARD_EVENTS.TOKEN_RESPAWNED, {
        instanceId: instance.id, typeId: instance.typeId, mode: 'refill', x: instance.x, y: instance.y
    });
    return instance;
}

/** A regrow happened: `from` (now off the mat) became `into`, which grows back. */
export function regrown(from, into) {
    EventBus.publish(BOARD_EVENTS.TOKEN_RESPAWNED, {
        instanceId: into.id, fromInstanceId: from.id, fromTypeId: from.typeId,
        typeId: into.typeId, mode: 'regrow', x: into.x, y: into.y
    });
}

/**
 * What the inspection says about a Token's respawn: `{ mode, into, afterMs, resting, inMs }`, its
 * type's way back and, while it rests, how long a refill has left (`inMs`, null otherwise). Null
 * for a Token whose type never respawns.
 */
export function respawnState(instance) {
    const def = getTokenType(instance?.typeId);
    const respawn = respawnOf(def);
    if (!respawn) return null;
    const next = nextRespawn(instance);
    return {
        mode: respawn.mode, into: respawn.into, afterMs: restMsOf(instance, def),
        resting: !!next, inMs: next ? next.inMs : null
    };
}

/**
 * A resting Token's way back, for the countdown bubble and the inspection lines: `{ mode, inMs,
 * totalMs, into }`. A refill counts down its rest; a regrow happens on the next tick (`inMs` 0),
 * or on the drop while it is in the player's hand. Null for a Token that is not resting.
 */
export function nextRespawn(instance) {
    if (!instance) return null;
    const def = getTokenType(instance.typeId);
    if (!isResting(instance, def)) return null;
    const respawn = respawnOf(def);
    if (respawn.mode === 'regrow') return { mode: 'regrow', inMs: 0, totalMs: 0, into: respawn.into };
    const totalMs = restMsOf(instance, def);
    const clockMs = Number(instance.clocks?.[CLOCK]) || 0;
    return { mode: 'refill', inMs: Math.max(0, totalMs - clockMs), totalMs, into: null };
}
