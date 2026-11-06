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
import { isGuildHall } from '../board/MatCap.js';
import { mulberry32 } from '../atlas/seededRandom.js';
import * as Atlas from '../atlas/Atlas.js';
import { logger } from '../../utils/Logger.js';

/**
 * A newly settled place arrives occupied (owner): its mat darkened, with a small fixed
 * encounter on it, 3 to 6 enemies sized to the ring, sometimes a boss (the cell's `arrival`,
 * `generate.js` step 10). They stand spread out across the mat ({@link spreadOf}), each alone, out
 * of the Guild Hall's clearing, belong to no camp and never come back: each has one use. They
 * stand still until a hero is sent at them (no ambushes, brief 500). Until every one is beaten the
 * mat is held (`board/Occupation.js`): heroes may fight and nothing else, and the mat is drawn
 * dark. The last one beaten brightens it ({@link ARRIVAL_TEXT}).
 *
 * The enemies are put on the live mat once the guild has travelled there, through the same
 * placement as any arrival (`Placement.placeArrivalNear`), so they never stand where a Token could
 * not. Nothing here draws from `Math.random`: the spots come from the place's seed, the ids from
 * the Region's.
 */

/** Player-facing words, kept together for translation. */
export const ARRIVAL_TEXT = Object.freeze({
    cleared: (name) => `The enemies are beaten: ${name} is the guild's to work`
});

/**
 * The Guild Hall's clearing, kept free of enemies: an ellipse round the Hall, its half-width and
 * half-height in mat units. Tall enough below the Hall that no enemy stands among the heroes
 * waiting in their row in front of it (`HeroMotion.homeSpot`).
 */
export const CLEARING = Object.freeze({ rx: 300, ry: 260 });

/** How far in from the mat's edge an enemy aims, in mat units: clear of the item stubs and the fight tabs. */
export const SPREAD_MARGIN = 120;

/** Where between the clearing (0) and the margin (1) an enemy aims: never right at either. */
export const SPREAD_BAND = Object.freeze({ from: 0.15, to: 0.85 });

/** How far an enemy's direction may stray from the middle of its even share of the circle, as a fraction of that share. */
const SPREAD_JITTER = 0.25;

/** An arrival enemy's instance id: named after its Region, as a settled node's is. */
export function arrivalId(regionId, index) {
    return `tok_${regionId}_arrival_${index}`;
}

/** How far a ray from `centre` at angle `a` runs before it leaves the box `[m, w − m] × [m, h − m]`. */
function rayToBox(centre, a, w, h, m) {
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    let t = Infinity;
    if (cx > 1e-9) t = Math.min(t, (w - m - centre.x) / cx);
    if (cx < -1e-9) t = Math.min(t, (m - centre.x) / cx);
    if (cy > 1e-9) t = Math.min(t, (h - m - centre.y) / cy);
    if (cy < -1e-9) t = Math.min(t, (m - centre.y) / cy);
    return Math.max(0, t);
}

/** How far the clearing's edge is from its middle at angle `a`. */
function clearingAt(a) {
    const cx = Math.cos(a) / CLEARING.rx;
    const cy = Math.sin(a) / CLEARING.ry;
    return 1 / Math.sqrt(cx * cx + cy * cy);
}

/**
 * Where each of `count` arrival enemies aims on a mat of `w` × `h`, the Hall at `centre`: one to
 * each even share of the circle round the Hall, turned by the place's seed and strayed a little
 * within its share, out past the Hall's clearing and short of the mat's margin. So they stand
 * spread across the mat, each alone, and the same place always stands them the same way.
 *
 * @returns {{x: number, y: number}[]}
 */
export function spreadOf(seed, count, { w = matW(), h = matH(), centre = null } = {}) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    const random = mulberry32((Number(seed) >>> 0) ^ 0x5eed1a1);
    const mid = centre && Number.isFinite(centre.x) && Number.isFinite(centre.y) ? centre : { x: w / 2, y: h / 2 };
    const share = (2 * Math.PI) / Math.max(1, n);
    const turn = random() * 2 * Math.PI;
    const out = [];
    for (let k = 0; k < n; k++) {
        const a = turn + k * share + (random() * 2 - 1) * SPREAD_JITTER * share;
        const inner = clearingAt(a);
        const outer = Math.max(inner, rayToBox(mid, a, w, h, SPREAD_MARGIN));
        const f = SPREAD_BAND.from + random() * (SPREAD_BAND.to - SPREAD_BAND.from);
        const r = inner + f * (outer - inner);
        out.push({ x: Math.round(mid.x + Math.cos(a) * r), y: Math.round(mid.y + Math.sin(a) * r) });
    }
    return out;
}

/** The Guild Hall's point on the live mat, or null. */
function hallPoint() {
    const hall = BoardState.tokens().find(isGuildHall);
    return hall ? { x: hall.x, y: hall.y } : null;
}

/**
 * Put a place's arrival on the live mat and mark the mat held. Call once the guild is there.
 *
 * @param {{typeId: string, count: number, boss?: boolean}[]} arrival the cell's arrival
 * @param {{seed?: number}} [options] the place's seed, for where they stand
 * @returns {{ids: string[], unplaced: string[]}} the enemies written, and any that found no room
 */
export function occupy(arrival, { seed = 0 } = {}) {
    const board = GameState.state?.board;
    const ids = [];
    const unplaced = [];
    if (!board || !Array.isArray(arrival) || !arrival.length) return { ids, unplaced };
    const total = arrival.reduce((n, row) => n + Math.max(0, row?.count || 0), 0);
    const spots = spreadOf(seed, total, { centre: hallPoint() });
    const regionId = Atlas.activeRegionId() || 'mat';
    let k = 0;
    for (const row of arrival) {
        for (let n = 0; n < (row?.count || 0); n++) {
            const aim = spots[k];
            k++;
            // Named after the Region, as its nodes are: no random id, so settling never moves
            // what the game rolls next.
            const instance = BoardState.createTokenInstance(row.typeId, 1, null, BoardState.ORIGIN.SPAWNED, arrivalId(regionId, k - 1));
            // ⚠️ `tether: null`, not absent: an enemy with no tether key is tied to the nearest camp
            // of its kind on load (`EnemyMotion.attachUntethered`), and these belong to none.
            BoardState.setTether(instance, null);
            instance.arrival = true;
            const res = Placement.placeArrivalNear(instance, aim);
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
