// a station whose card picks one Token in its reach: a Hideout's camp, a Laboratory's node

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import * as BoardState from './BoardState.js';
import * as Demolition from './Demolition.js';
import { centreOf, distanceSq, isWithin } from './nearby.js';

/**
 * The shape a Hideout (`Hideouts.js`) and a Laboratory (`Laboratories.js`) share: the player picks,
 * on the station's card, one Token in its reach, kept on the station by instance id (`stealFrom`,
 * `studies`) and refused out of reach. Which Tokens each may pick is its own module's rule.
 */

/** Whether `token` stands in `station`'s reach: the one standard reach, centre to centre, inclusive. */
export function inReach(station, token) {
    return isWithin(centreOf(station), centreOf(token));
}

/** Every Token on the mat but `station` in its reach, nearest first (then the earlier placed). */
export function tokensInReach(station) {
    if (!station) return [];
    const at = centreOf(station);
    return BoardState.tokens()
        .filter(t => t.id !== station.id && inReach(station, t))
        .sort((a, b) => (distanceSq(at, centreOf(a)) - distanceSq(at, centreOf(b))) || ((a.placedAt ?? 0) - (b.placedAt ?? 0)));
}

/**
 * Write a station's pick, `station[field] = tokenId`, once its own module has checked the Token may
 * be picked. A new pick starts the station's cycle from zero and says so (`TILE_CHANGED`), as a
 * station's new recipe does; the same pick again changes nothing.
 * @returns {true}
 */
export function writePick(station, field, tokenId) {
    if (station[field] === tokenId) return true;
    station[field] = tokenId;
    if (station.cycleElapsedMs > 0 && !Demolition.isMarked(station)) {
        station.cycleElapsedMs = 0;
        EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: station.id, percent: 0 });
    }
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: station.id, typeId: station.typeId });
    return true;
}
