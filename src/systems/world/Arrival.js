// a settled place's arrival: the enemies it is written with, and the moment they are all beaten

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import * as BoardState from '../board/BoardState.js';
import * as Placement from '../board/Placement.js';
import * as Occupation from '../board/Occupation.js';
import * as MatPlacement from '../board/MatPlacement.js';
import { HOME_GAP, HOME_DROP } from '../board/HeroMotion.js';
import { matW, matH, artRadius, artRadiusOf, clampToMat } from '../../config/matGeometry.js';
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

/**
 * The way in below the Hall, kept free of enemies: no enemy aims within this angle (radians) of
 * straight down from it, where the heroes walk in from the mat's foot after a settle
 * (`HeroMotion.walkIn`).
 */
export const WALK_IN_LANE = 0.42;

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
 * each even share of the circle round the Hall but its way in ({@link WALK_IN_LANE}), turned by
 * the place's seed and strayed a little within its share, out past the Hall's clearing and short
 * of the mat's margin. So they stand spread across the mat, each alone, and the same place always
 * stands them the same way.
 *
 * @returns {{x: number, y: number}[]}
 */
export function spreadOf(seed, count, { w = matW(), h = matH(), centre = null } = {}) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    const random = mulberry32((Number(seed) >>> 0) ^ 0x5eed1a1);
    const mid = centre && Number.isFinite(centre.x) && Number.isFinite(centre.y) ? centre : { x: w / 2, y: h / 2 };
    const circle = 2 * Math.PI;
    const share = circle / Math.max(1, n);
    const turn = random() * circle;
    const out = [];
    for (let k = 0; k < n; k++) {
        // Round from the way in, squeezed into the rest of the circle.
        const round = (((turn + k * share + (random() * 2 - 1) * SPREAD_JITTER * share) % circle) + circle) % circle;
        const a = Math.PI / 2 + WALK_IN_LANE + round * (circle - 2 * WALK_IN_LANE) / circle;
        const inner = clearingAt(a);
        const outer = Math.max(inner, rayToBox(mid, a, w, h, SPREAD_MARGIN));
        const f = SPREAD_BAND.from + random() * (SPREAD_BAND.to - SPREAD_BAND.from);
        const r = inner + f * (outer - inner);
        out.push({ x: Math.round(mid.x + Math.cos(a) * r), y: Math.round(mid.y + Math.sin(a) * r) });
    }
    return out;
}

/** The fewest heroes the row in front of the Hall is kept clear for. */
const ROW_KEPT_FOR = 6;

/** How far out along its aim's ray an enemy may be stood, in mat units, when the spot nearest its aim is too near the heroes. */
const PUSH_OUT = Object.freeze([0, 64, 128, 192, 256]);

/**
 * Whether an enemy of `typeId` standing at `p` is clear of the heroes, for a Hall `hall` and a
 * roster of `roster`: its art touches neither the Hall, nor the row in front of it where heroes
 * wait (`HeroMotion.homeSpot`), nor the way in straight below it where they walk in after a
 * settle (`HeroMotion.walkIn`).
 */
export function clearOfHeroes(p, typeId, hall, roster = ROW_KEPT_FOR) {
    const r = artRadiusOf(typeId);
    const hallR = artRadiusOf(hall.typeId);
    const hero = artRadius(1) / 2;
    if (Math.hypot(p.x - hall.x, p.y - hall.y) <= r + hallR) return false;
    const rowY = hall.y + hallR + HOME_DROP;
    const half = ((Math.max(ROW_KEPT_FOR, roster) - 1) / 2) * HOME_GAP + hero;
    const dx = Math.max(hall.x - half - p.x, 0, p.x - (hall.x + half));
    const dy = Math.max(rowY - artRadius(1) - p.y, 0, p.y - (rowY + artRadius(1)));
    if (Math.hypot(dx, dy) <= r) return false;
    return !(p.y + r > rowY && Math.abs(p.x - hall.x) <= r + hero);
}

/** Turns of the aim round the Hall tried, in order, when no spot along its own ray is clear of the heroes (a mat of little land). */
const TURNS = Object.freeze([1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6].map(k => (k * Math.PI) / 6));

/**
 * Where an enemy aiming at `aim` stands: the legal spot nearest its aim, or, when that one is too
 * near the heroes ({@link clearOfHeroes}), the nearest to a point further out along its ray from
 * the Hall, then to its aim turned round the Hall; failing all, the first legal spot found.
 */
function standingFor(typeId, id, aim, hall, roster) {
    const dx = aim.x - hall.x;
    const dy = aim.y - hall.y;
    const d = Math.hypot(dx, dy) || 1;
    let first = null;
    const tryAt = (point) => {
        const spot = MatPlacement.findSpotAnywhere(typeId, clampToMat(point), { excludeId: id, plan: { id } });
        if (!spot) return null;
        first ??= spot;
        return clearOfHeroes(spot, typeId, hall, roster) ? { x: spot.x, y: spot.y } : null;
    };
    for (const push of PUSH_OUT) {
        const found = tryAt({ x: aim.x + (dx / d) * push, y: aim.y + (dy / d) * push });
        if (found) return found;
    }
    const a = Math.atan2(dy, dx);
    for (const turn of TURNS) {
        const found = tryAt({ x: hall.x + Math.cos(a + turn) * d, y: hall.y + Math.sin(a + turn) * d });
        if (found) return found;
    }
    return first ? { x: first.x, y: first.y } : aim;
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
    const hall = BoardState.tokens().find(isGuildHall) || null;
    const roster = (GameState.state?.heroes || []).length;
    const spots = spreadOf(seed, total, { centre: hall });
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
            const res = Placement.placeArrivalNear(instance, hall ? standingFor(row.typeId, instance.id, aim, hall, roster) : aim);
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
