// something new that found no room on the mat: told once per wait, until it lands

import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { tokenName } from '../../config/registries/tokenRegistry.js';

/**
 * One rule for no room: nothing is paid or lost until a Token lands; it waits and retries, and the
 * player is told once. Each waiting source (a station, a spawner, the arrival, the event clock) has
 * a key; {@link tell} publishes `BOARD_EVENTS.NO_ROOM_WAIT` the first time that key starts waiting,
 * and {@link landed} ends the wait, so the next wait is told again.
 *
 * Not saved: a wait still standing after a load or a travel is told once more.
 * ⚠️ A wait that starts during a catch-up (a quiet bus, where nobody hears the banner) is not
 * remembered as told, so live play tells it once the player is back.
 */

/** The sources a wait comes from. */
export const SOURCE = Object.freeze({
    STATION: 'station',
    SPAWNER: 'spawner',
    ARRIVAL: 'arrival',
    EVENT: 'event'
});

/** Keys of the sources that have been told and have not landed since. */
const told = new Set();
/** Keys said only on a quiet bus (a catch-up): not said again until the bus is heard. */
const toldQuietly = new Set();

/** The key of the arrival's wait, and of the event clock's: one each per mat. */
export const ARRIVAL_KEY = 'arrival';
export const EVENT_KEY = 'event';

/**
 * Say that `key` waits for room, unless it has already been said since it last landed.
 *
 * @param {string} key the waiting source: a Token's instance id, {@link ARRIVAL_KEY} or {@link EVENT_KEY}
 * @param {{source: string, instanceId?: string|null, typeId?: string|null}} who
 * @returns {boolean} whether it was said just now
 */
export function tell(key, { source, instanceId = null, typeId = null } = {}) {
    if (!key || told.has(key)) return false;
    const quiet = EventBus.isQuiet();
    if (quiet && toldQuietly.has(key)) return false;
    (quiet ? toldQuietly : told).add(key);
    EventBus.publish(BOARD_EVENTS.NO_ROOM_WAIT, {
        key,
        source,
        instanceId,
        typeId,
        name: typeId ? tokenName(typeId) : null
    });
    return true;
}

/** `key` landed what it waited with (or stopped waiting): its next wait is told again. */
export function landed(key) {
    told.delete(key);
    toldQuietly.delete(key);
}

/** Whether `key`'s wait has been told. */
export function isTold(key) {
    return told.has(key);
}

/** Forget every told wait (a new game, a load, a travel, tests). */
export function reset() {
    told.clear();
    toldQuietly.clear();
}

let unsubscribers = [];

/** The waits belong to the board they were told on. Idempotent. */
export function init() {
    for (const off of unsubscribers) off();
    unsubscribers = [ENGINE_EVENTS.BOARD_SWAPPED, ENGINE_EVENTS.GAME_LOADED, ENGINE_EVENTS.GAME_RESET]
        .map(event => EventBus.subscribe(event, reset));
}
