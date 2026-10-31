// a settled place's arrival: the enemies it is written with, and the moment they are all beaten

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import * as BoardState from '../board/BoardState.js';
import * as Placement from '../board/Placement.js';
import * as Occupation from '../board/Occupation.js';
import { matW, matH } from '../../config/matGeometry.js';
import { mulberry32 } from '../atlas/seededRandom.js';
import * as Atlas from '../atlas/Atlas.js';
import { logger } from '../../utils/Logger.js';

/**
 * A newly settled place arrives occupied (owner): its mat darkened, with a small fixed
 * encounter on it, 3 to 6 enemies sized to the ring, sometimes a boss (the cell's `arrival`,
 * `generate.js` step 10). They stand together in a lair in the mat's outer band, belong to no camp
 * and never come back: each has one use. Until every one is beaten the mat is held
 * (`board/Occupation.js`): heroes may fight and nothing else, and the mat is drawn dark. The last
 * one beaten brightens it ({@link ARRIVAL_TEXT}).
 *
 * The enemies are put on the live mat once the guild has travelled there, through the same
 * placement as any arrival (`Placement.placeArrivalNear`), so they never stand where a Token could
 * not. Nothing here draws from `Math.random`: the lair comes from the place's seed, the ids from
 * the Region's.
 */

/** Player-facing words, kept together for translation. */
export const ARRIVAL_TEXT = Object.freeze({
    cleared: (name) => `The enemies are beaten: ${name} is the guild's to work`
});

/** How far out the lair stands (0 the Hall, 1 the mat's edge), and how far apart its enemies aim. */
export const LAIR_BAND = 0.72;
export const LAIR_SPREAD = 84;

/** Where each enemy of a lair aims, as steps of the spread from its middle. */
const LAIR_OFFSETS = Object.freeze([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]);

/** An arrival enemy's instance id: named after its Region, as a settled node's is. */
export function arrivalId(regionId, index) {
    return `tok_${regionId}_arrival_${index}`;
}

/** The lair's middle on a mat of `w` × `h`: a seeded direction from the middle, out to the band. */
export function lairOf(seed, w = matW(), h = matH()) {
    const random = mulberry32((Number(seed) >>> 0) ^ 0x5eed1a1);
    let ux = 1;
    let uy = 0;
    for (let k = 0; k < 32; k++) {
        const x = random() * 2 - 1;
        const y = random() * 2 - 1;
        const d = x * x + y * y;
        if (d > 0.04 && d <= 1) {
            const l = Math.sqrt(d);
            ux = x / l;
            uy = y / l;
            break;
        }
    }
    const art = 64;
    return {
        x: Math.round(w / 2 + ux * LAIR_BAND * (w / 2 - art)),
        y: Math.round(h / 2 + uy * LAIR_BAND * (h / 2 - art))
    };
}

/**
 * Put a place's arrival on the live mat and mark the mat held. Call once the guild is there.
 *
 * @param {{typeId: string, count: number, boss?: boolean}[]} arrival the cell's arrival
 * @param {{seed?: number}} [options] the place's seed, for the lair
 * @returns {{ids: string[], unplaced: string[]}} the enemies written, and any that found no room
 */
export function occupy(arrival, { seed = 0 } = {}) {
    const board = GameState.state?.board;
    const ids = [];
    const unplaced = [];
    if (!board || !Array.isArray(arrival) || !arrival.length) return { ids, unplaced };
    const lair = lairOf(seed);
    const regionId = Atlas.activeRegionId() || 'mat';
    let k = 0;
    for (const row of arrival) {
        for (let n = 0; n < (row?.count || 0); n++) {
            const [ox, oy] = LAIR_OFFSETS[k % LAIR_OFFSETS.length];
            k++;
            // Named after the Region, as its nodes are: no random id, so settling never moves
            // what the game rolls next.
            const instance = BoardState.createTokenInstance(row.typeId, 1, null, BoardState.ORIGIN.SPAWNED, arrivalId(regionId, k - 1));
            // ⚠️ `tether: null`, not absent: an enemy with no tether key is tied to the nearest camp
            // of its kind on load (`EnemyMotion.attachUntethered`), and these belong to none.
            instance.tether = null;
            instance.arrival = true;
            const res = Placement.placeArrivalNear(instance, { x: lair.x + ox * LAIR_SPREAD, y: lair.y + oy * LAIR_SPREAD });
            if (res?.success) ids.push(instance.id);
            else unplaced.push(row.typeId);
        }
    }
    if (ids.length) {
        board.arrival = { ids, cleared: false };
        EventBus.publish(ENGINE_EVENTS.ATLAS_CHANGED, { reason: 'occupied', regionId: Atlas.activeRegionId() });
    }
    if (unplaced.length) logger.warn('World', `The arrival found no room for ${unplaced.join(', ')}`);
    return { ids, unplaced };
}

/**
 * If the live mat's arrival is all beaten, the mat is the guild's: marked cleared, announced, and
 * (unless `quiet`, as on a load) said to the player.
 *
 * @returns {boolean} whether it was cleared just now
 */
export function checkCleared({ quiet = false } = {}) {
    const a = Occupation.arrivalOf();
    if (!a || a.cleared === true || Occupation.standingEnemies().length) return false;
    a.cleared = true;
    const region = Atlas.activeRegion();
    EventBus.publish(ENGINE_EVENTS.ATLAS_CHANGED, { reason: 'cleared', regionId: region?.id ?? null });
    if (!quiet) NotificationSystem.notify(ARRIVAL_TEXT.cleared(region?.flavourName || region?.practicalName || 'This place'), 'success');
    logger.info('World', `The arrival on ${region?.id ?? 'the mat'} is beaten`);
    return true;
}

let unsubscribers = [];

/** Listen for the arrival's enemies falling, and settle a mat brought back by a load or a travel. */
export function init() {
    teardown();
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, ({ instanceId } = {}) => {
        if (Occupation.isOccupied() && Occupation.isArrivalId(instanceId)) checkCleared();
    }));
    for (const event of [ENGINE_EVENTS.GAME_LOADED, ENGINE_EVENTS.BOARD_SWAPPED]) {
        unsubscribers.push(EventBus.subscribe(event, () => checkCleared({ quiet: true })));
    }
}

export function teardown() {
    for (const off of unsubscribers) off();
    unsubscribers = [];
}
