// fishing spots: Tokens that arrive on the mat's water by themselves and leave again

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import * as BoardState from './BoardState.js';
import * as MatPlacement from './MatPlacement.js';
import * as GroundRules from './GroundRules.js';
import * as EventTokens from './EventTokens.js';
import {
    getTokenType, getAllTokenTypes, registryVersion, tokenStartingUses
} from '../../config/registries/tokenRegistry.js';
import { spotOf, arrivesByItself } from '../../config/registries/fishingSpots.js';

/**
 * **Fishing spots** (brief 850 F1). Water is ground; a spot kind (`fishingSpots.js`: a Token type
 * with a `spot` block) arrives on water cells of its kinds by itself and leaves by itself.
 *
 * ## Arriving
 * Each spot kind has its own clock on the board that holds it, saved as `board.spotClocks[typeId] =
 * { ms, waitMs }` and advanced by {@link tick} with the loop's `delta` (so a catch-up runs it too).
 * A kind's clock runs while the kind fits the place (the Region is of a biome it lists, any when it
 * lists none, and the mat has water of its kinds) and fewer than its `most` stand on the mat; else
 * it is held at zero (dropped), so the next one comes a whole wait after a place opens. Each wait is
 * drawn, as the clock starts, between half and one and a half of the kind's `everyMinutes`. When it
 * is due the spot lands on a free point of its water ({@link landingSpot}, darts as the event clock
 * throws them); landed or not, the next wait starts with the time past due, so a spot with no room
 * waits a whole wait as a spawner does.
 *
 * ⚠️ A board with no water draws nothing and writes nothing: every meadow, every test and bench
 * board, plays exactly as before.
 *
 * ## Leaving
 * - By chance per catch ({@link afterCatch}, from `BoardRunner.completeCycle`): one draw against the
 *   kind's `leaveChance` after each catch that landed, no counter.
 * - Unworked: `TimedChanges`' `spot_unworked` row, on `instance.clocks.spotMs`, held at zero while a
 *   hero works the spot, leaves once it reaches the kind's `unworkedMinutes`.
 *
 * Either way {@link leave} takes it off the mat with no loot; the heroes working it let go on their
 * next pass, as for any Token that leaves. A spot kind landed as an event (the Fish Shoal) leaves
 * the same ways and says so as an event (`EventTokens.leave`).
 *
 * Spots stand outside the Token cap (`MatCap.countsTowardCap`).
 */

/** The key in `instance.clocks` the unworked clock counts on. */
export const SPOT_CLOCK = 'spotMs';

/** Random points tried on a kind's water before a landing is given up until its next wait. */
export const LANDING_DARTS = 48;

/** Why a spot left the mat (`BOARD_EVENTS.SPOT_LEFT`'s `reason`). */
export const LEFT = Object.freeze({ MOVED_ON: 'moved_on', UNWORKED: 'unworked' });

// ---------------------------------------------------------------------------
// The kinds
// ---------------------------------------------------------------------------

let kindsKept = { version: -1, all: [], arriving: [] };

function syncKinds() {
    const version = registryVersion();
    if (kindsKept.version === version) return kindsKept;
    const all = [];
    for (const [typeId, def] of Object.entries(getAllTokenTypes())) {
        const spot = spotOf(def);
        if (spot) all.push({ typeId, def, spot });
    }
    kindsKept = { version, all, arriving: all.filter(k => arrivesByItself(k.spot)) };
    return kindsKept;
}

/** Every spot kind's type id, in registry order. */
export function spotKindIds() {
    return syncKinds().all.map(k => k.typeId);
}

/** Whether a Token on the mat is a fishing spot: its type is a spot kind. */
export function isSpot(instance) {
    return spotOf(getTokenType(instance?.typeId)) !== null;
}

/** How long a spot kind stays with nobody working it, in game ms (0: it never drifts off). */
export function unworkedMsOf(def) {
    return spotOf(def)?.unworkedMs || 0;
}

// ---------------------------------------------------------------------------
// On the mat
// ---------------------------------------------------------------------------

/** Spots on the mat by type id, remembered while nothing arrives or leaves. */
let counted = { tokens: null, version: -1, regVersion: -1, byType: new Map() };

/** How many of spot kind `typeId` stand on the mat. */
export function countOnMat(typeId) {
    const { tokens, version } = BoardState.membershipVersion();
    const regVersion = registryVersion();
    if (counted.tokens !== tokens || counted.version !== version || counted.regVersion !== regVersion) {
        const byType = new Map();
        for (const t of BoardState.tokens()) {
            if (spotOf(getTokenType(t.typeId))) byType.set(t.typeId, (byType.get(t.typeId) || 0) + 1);
        }
        counted = { tokens, version, regVersion, byType };
    }
    return counted.byType.get(typeId) || 0;
}

/** Whether a spot kind could arrive here, before looking for room: its biome, and water of its kinds. */
function fitsHere(spot, biomes) {
    if (spot.biomes.length && !spot.biomes.some(b => biomes.includes(b))) return false;
    return GroundRules.waterCellsOf(spot.water).length > 0;
}

/** A fresh wait for a kind, uniform in [½, 1½) of its rate, whole ms. */
export function drawWait(spot, random = Math.random) {
    return Math.round(spot.everyMs * (0.5 + random()));
}

/**
 * A free point for spot kind `typeId` on water of its kinds that its "Stands on" also allows: up to
 * {@link LANDING_DARTS} random points, the first legal one kept (clear of every Token, inside the
 * mat, breaking no rule). Nothing is pushed. Null when none had room.
 */
export function landingSpot(typeId, spot, random = Math.random) {
    const water = GroundRules.waterCellsOf(spot.water);
    if (!water.length) return null;
    const rules = GroundRules.rulesFor(typeId);
    const cells = rules ? water.filter(i => rules.mask[i] === 1) : water;
    if (!cells.length) return null;
    const ground = GroundRules.groundHere();
    for (let i = 0; i < LANDING_DARTS; i++) {
        const index = cells[Math.floor(random() * cells.length)];
        const col = index % ground.cols;
        const row = Math.floor(index / ground.cols);
        const dart = { x: Math.floor((col + random()) * ground.cell), y: Math.floor((row + random()) * ground.cell) };
        if (MatPlacement.isLegal(typeId, dart)) return dart;
    }
    return null;
}

/** Put a spot of `typeId` on the mat at `at`, `spawned`. Announced as `BOARD_EVENTS.SPOT_LANDED`. */
function land(typeId, at) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, BoardState.ORIGIN.SPAWNED);
    BoardState.addToken(instance, at.x, at.y);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId });
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [{ x: at.x, y: at.y }] });
    EventBus.publish(BOARD_EVENTS.SPOT_LANDED, {
        instanceId: instance.id, typeId, water: GroundRules.waterKindAt(at.x, at.y), x: at.x, y: at.y
    });
    return instance;
}

const validClock = (c) => !!c && typeof c === 'object' && Number.isFinite(c.ms) && Number.isFinite(c.waitMs);

/**
 * **One tick** (from `BoardRunner.tick`, after the timed changes): every spot kind's clock on the
 * live board, and a landing when one is due. See the module header.
 */
export function tick(delta, random = Math.random) {
    if (!(delta > 0)) return;
    const { arriving } = syncKinds();
    if (!arriving.length) return;
    const board = GameState.state?.board;
    if (!board || !GroundRules.groundHere().hasWater) return;
    const biomes = GroundRules.regionBiomes();
    let clocks = board.spotClocks && typeof board.spotClocks === 'object' ? board.spotClocks : null;
    for (const { typeId, spot } of arriving) {
        if (!fitsHere(spot, biomes) || countOnMat(typeId) >= spot.most) {
            if (clocks && typeId in clocks) delete clocks[typeId];
            continue;
        }
        if (!clocks) clocks = board.spotClocks = {};
        let clock = clocks[typeId];
        if (!validClock(clock)) clock = clocks[typeId] = { ms: 0, waitMs: drawWait(spot, random) };
        clock.ms += delta;
        if (clock.ms < clock.waitMs) continue;
        const at = landingSpot(typeId, spot, random);
        if (at) land(typeId, at);
        clocks[typeId] = { ms: clock.ms - clock.waitMs, waitMs: drawWait(spot, random) };
    }
}

/**
 * **The QA panel's landing**: a spot of `typeId` now, whatever its clock, biome or most say, on
 * water of its kinds here. Never called by the game itself.
 *
 * @returns {{success: boolean, reason?: string, instance?: object}}
 */
export function landNow(typeId, random = Math.random) {
    const spot = spotOf(getTokenType(typeId));
    if (!spot) return { success: false, reason: `${typeId} is not a fishing spot` };
    const at = landingSpot(typeId, spot, random);
    if (!at) return { success: false, reason: 'No room on its water here' };
    return { success: true, instance: land(typeId, at) };
}

// ---------------------------------------------------------------------------
// Leaving
// ---------------------------------------------------------------------------

/**
 * Take a spot off the mat by itself (`reason`: {@link LEFT}): no loot. An event's spot says so as an
 * event. Returns whether it was on the mat and left.
 */
export function leave(instance, reason) {
    const token = BoardState.getTokenById(instance?.id);
    if (!token) return false;
    if (EventTokens.isEventToken(token)) {
        return EventTokens.leave(token, reason === LEFT.MOVED_ON ? EventTokens.ENDED.WORKED_OUT : EventTokens.ENDED.TIME_UP);
    }
    const at = { x: token.x, y: token.y };
    BoardState.removeToken(token.id);
    EventBus.publish(BOARD_EVENTS.SPOT_LEFT, { instanceId: token.id, typeId: token.typeId, reason, ...at });
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: token.id, ...at, typeId: null });
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [at] });
    return true;
}

/**
 * After a catch landed at spot `instance` (type `def`): one draw against its `leaveChance`, and on a
 * hit it moves on. A kind with no chance draws nothing. Returns whether it left.
 */
export function afterCatch(instance, def, random = Math.random) {
    const spot = spotOf(def);
    if (!spot || !(spot.leaveChance > 0)) return false;
    if (!(random() * 100 < spot.leaveChance)) return false;
    return leave(instance, LEFT.MOVED_ON);
}
