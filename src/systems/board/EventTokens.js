// event Tokens on the mat: what an event Token is, when it leaves, and the leaving

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { GameState } from '../../state/GameState.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { EVENT_KIND } from '../../config/eventTable.js';
import * as BoardState from './BoardState.js';
import * as WorkCheck from './WorkCheck.js';
import { workConfigOf } from './StationRecipe.js';

/**
 * An **event Token** is an ordinary Token that landed as an event (`events/EventClock.js`). It
 * carries one extra field, saved with the board:
 *
 * ```js
 * instance.event = { id, kind: 'node' | 'buff', name, lastsMs? }   // lastsMs: a buff's time on the mat
 * ```
 *
 * Everything else about it is its Token type's: a rich node is worked like any node (every boost,
 * Lucky, Giant Harvest and its rare table apply) and leaves at 0 charges like any Token without a
 * `respawn` (`Charges.destroyToken`); a buff Token's `Provides` reaches the Tokens around it like
 * any building's, adding to theirs inside the same limits.
 *
 * Two ways out are clocks, rows of `TimedChanges.HANDLERS` on `clocks[EVENT_CLOCK]`:
 * - a **buff** leaves when its time is up ({@link lastsMsOf});
 * - a **rich node no current hero can work** leaves after {@link UNWORKED_LEAVE_MS}. Its clock is
 *   held at zero while some hero can ({@link someHeroCanWork}), so a node the guild can work stays
 *   until it is worked out, and the hour starts again whenever nobody can.
 *
 * Demolishing one removes it at once (`Demolition.mark`). It never counts toward the mat's Token
 * cap (`MatCap.countsTowardCap`): an event must not stop the player building.
 *
 * ⚠️ A leaf below `TimedChanges`, `EventClock` and the UI: it imports nothing that imports them.
 */

/** The key in `instance.clocks` an event Token's way out counts on. */
export const EVENT_CLOCK = 'eventMs';

/** ⭐ Game value: how long a rich node nobody can work stays on the mat. */
export const UNWORKED_LEAVE_MS = 60 * 60 * 1000;

/** Why an event Token left the mat (`BOARD_EVENTS.EVENT_ENDED`'s `reason`). */
export const ENDED = Object.freeze({
    WORKED_OUT: 'worked_out',
    TIME_UP: 'time_up',
    UNWORKED: 'unworked',
    DEMOLISHED: 'demolished'
});

/** The event an instance landed as, or null. */
export function eventOf(instance) {
    const event = instance?.event;
    return event && typeof event === 'object' && event.id ? event : null;
}

/** Whether a Token landed as an event. */
export function isEventToken(instance) {
    return eventOf(instance) !== null;
}

/** Whether a Token is an event buff. */
export function isEventBuff(instance) {
    return eventOf(instance)?.kind === EVENT_KIND.BUFF;
}

/** Whether a Token is an event's rich node. */
export function isEventNode(instance) {
    return eventOf(instance)?.kind === EVENT_KIND.NODE;
}

/** A buff's whole time on the mat, in game ms (0 for anything else). */
export function lastsMsOf(instance) {
    if (!isEventBuff(instance)) return 0;
    const ms = Number(instance.event.lastsMs);
    return ms > 0 ? ms : 0;
}

/**
 * **The "can work" test**: whether some hero of the guild could work this Token as things stand,
 * by the same gate a hero's order uses (`WorkCheck.heroReason`): holds the skill, at the level the
 * Token's work asks, with the tool it needs in hand. Every hero on the roster counts, wherever
 * they are and whatever they are doing; a hero carried home wounded still counts.
 */
export function someHeroCanWork(instance) {
    const config = workConfigOf(getTokenType(instance?.typeId), instance);
    if (!config) return false;
    for (const hero of GameState.state?.heroes || []) {
        if (hero?.id && WorkCheck.heroReason(hero.id, config, instance) === null) return true;
    }
    return false;
}

/**
 * How long until an event Token leaves by its clock, in game ms, for the hover plate and the card:
 * a buff's time left; a rich node nobody can work, its hour left. Null when no clock is running
 * (a node someone can work, which leaves when worked out, and any other Token).
 */
export function leavesInMs(instance) {
    const elapsed = Number(instance?.clocks?.[EVENT_CLOCK]) || 0;
    if (isEventBuff(instance)) return Math.max(0, lastsMsOf(instance) - elapsed);
    if (isEventNode(instance) && !someHeroCanWork(instance)) return Math.max(0, UNWORKED_LEAVE_MS - elapsed);
    return null;
}

/** What `BOARD_EVENTS.EVENT_ENDED` says about an event Token that left from `at`. */
export function endedPayload(instance, reason, at = null) {
    const event = eventOf(instance) || {};
    const point = at || (Number.isFinite(instance?.x) && Number.isFinite(instance?.y) ? { x: instance.x, y: instance.y } : {});
    return {
        instanceId: instance?.id ?? null,
        typeId: instance?.typeId ?? null,
        eventId: event.id ?? null,
        kind: event.kind ?? null,
        name: event.name ?? getTokenType(instance?.typeId)?.name ?? instance?.typeId ?? null,
        reason,
        ...point
    };
}

/**
 * Take an event Token off the mat because its clock ran out (`reason`: {@link ENDED}): no loot, no
 * depletion. The heroes working it let go on their next pass, as for any Token that leaves.
 *
 * @returns {boolean} whether it was on the mat and left
 */
export function leave(instance, reason) {
    const token = BoardState.getTokenById(instance?.id);
    if (!token) return false;
    const at = { x: token.x, y: token.y };
    BoardState.removeToken(token.id);
    EventBus.publish(BOARD_EVENTS.EVENT_ENDED, endedPayload(token, reason, at));
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: token.id, ...at, typeId: null });
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [at] });
    return true;
}
