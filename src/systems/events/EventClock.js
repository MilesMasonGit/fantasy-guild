// the event clock: about once an hour of play, an event lands on the mat

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import * as BoardState from '../board/BoardState.js';
import * as MatPlacement from '../board/MatPlacement.js';
import * as GroundRules from '../board/GroundRules.js';
import * as EventTokens from '../board/EventTokens.js';
import { getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { allEvents, getEvent } from '../../config/registries/eventRegistry.js';
import { EVENT_KIND, isRunnable } from '../../config/eventTable.js';
import { artRadiusOf, matW, matH } from '../../config/matGeometry.js';

/**
 * **Events** (brief 640): now and then a special Token lands on the active Region's mat, a rich
 * node or a buff Token (`EventTokens.js` says what one is and how it leaves; the table is
 * `eventTable.js`, authored in the CMS).
 *
 * ## The clock
 * `state.events.clockMs`, saved, advanced by {@link tick} with the loop's `delta` (so a catch-up
 * and the dev time skip run it too). It runs only while **no event Token stands on the mat**, and
 * is held at zero while one does: the next event comes {@link EVENT_EVERY_MS} after the last one
 * ended. When it is due, one event is drawn by weight among those that fit the place
 * ({@link fittingEvents}) and lands on a free spot of its ground ({@link landNext}); when none
 * fits or none finds room, the next try is {@link EVENT_RETRY_MS} later.
 *
 * One at a time is the clock's rule: it never lands an event while one stands on the mat. An
 * event left on another Region's mat stays there, frozen with that board; it does not hold this
 * mat's clock.
 *
 * ## Off unless turned on
 * ⚠️ {@link setEnabled} starts false: the tests and the engine bench play without events unless
 * they ask (`bench/lib/harness.mjs`, `--events`), so content added to the table never changes
 * their work. The game turns it on at boot (`main.jsx`); a perf stress board turns it off again
 * unless its address says `events=1` (`perfHarness.js`).
 *
 * Live play draws `Math.random`: the draw, the darts for a spot, and the new Token's id.
 */

/** ⭐ Game value: the time between one event ending and the next landing, in game ms. */
export const EVENT_EVERY_MS = 60 * 60 * 1000;

/** ⭐ Game value: when nothing could land, the time until the next try. */
export const EVENT_RETRY_MS = 5 * 60 * 1000;

/** Random spots tried on the event's ground before a landing is given up until the next try. */
export const LANDING_DARTS = 48;

/** The biome of a Region no map wrote (the Starter Camp), as its ground is meadow (`GroundRules`). */
const NO_MAP_BIOME = 'meadow';

let enabled = false;

/** Turn events on or off (see the module header). */
export function setEnabled(on) {
    enabled = !!on;
}

/** Whether events land and their clock runs. */
export function isEnabled() {
    return enabled;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** The saved event state, made whole. Null before a game exists. */
export function eventState() {
    const state = GameState.state;
    if (!state) return null;
    if (!state.events || typeof state.events !== 'object') state.events = { clockMs: 0 };
    if (!Number.isFinite(state.events.clockMs)) state.events.clockMs = 0;
    return state.events;
}

/** The event clock, in game ms (tests, the QA panel). */
export function clockMs() {
    return eventState()?.clockMs || 0;
}

/** Game ms until the next event is tried, or null while one stands on the mat or events are off. */
export function nextEventInMs() {
    if (!enabled || eventTokenOnMat()) return null;
    return Math.max(0, EVENT_EVERY_MS - clockMs());
}

/** The event Token on the mat, remembered while nothing arrives or leaves. */
let onMat = { tokens: null, version: -1, id: null };

/** The event Token standing on the active mat, or null. */
export function eventTokenOnMat() {
    const { tokens, version } = BoardState.membershipVersion();
    if (onMat.tokens !== tokens || onMat.version !== version) {
        let id = null;
        for (const t of BoardState.tokens()) {
            if (EventTokens.isEventToken(t)) {
                id = t.id;
                break;
            }
        }
        onMat = { tokens, version, id };
    }
    return onMat.id ? BoardState.getTokenById(onMat.id) : null;
}

// ---------------------------------------------------------------------------
// Where an event may land
// ---------------------------------------------------------------------------

/** The biomes of the Region the guild is in: those its maps gave any weight. */
export function regionBiomes() {
    const atlas = GameState.state?.atlas;
    const weights = atlas?.regions?.[atlas?.activeRegionId]?.biome;
    if (!weights || typeof weights !== 'object') return [NO_MAP_BIOME];
    const out = Object.keys(weights).filter(b => Number(weights[b]) > 0);
    return out.length ? out : [NO_MAP_BIOME];
}

/** The rules of an event's own ground, or null when it lists none. */
function eventGround(event) {
    return event.ground.length ? GroundRules.rulesForWords([...event.ground].sort()) : null;
}

/**
 * Whether an event could land here, before looking for room: it can run, its Token exists, the
 * Region is of a biome it lists (any, when it lists none), and the mat has some ground both it and
 * its Token may stand on.
 */
export function fitsHere(event, biomes = regionBiomes()) {
    if (!isRunnable(event) || !getTokenType(event.typeId)) return false;
    if (event.biomes.length && !event.biomes.some(b => biomes.includes(b))) return false;
    if (GroundRules.rulesFor(event.typeId)?.allowed === 0) return false;
    if (eventGround(event)?.allowed === 0) return false;
    return true;
}

/** The events that fit the place, in the table's order. */
export function fittingEvents() {
    const biomes = regionBiomes();
    return allEvents().filter(e => fitsHere(e, biomes));
}

/**
 * The cells both the event's ground and its Token's "Stands on" allow, as cell indices (empty:
 * none), or null when a dart may go anywhere: no list narrows it, or the mat is one meadow cell
 * (a Region no map wrote) that both allow.
 */
function allowedCells(rulesList) {
    const rules = rulesList.filter(Boolean);
    if (!rules.length) return null;
    const cells = [];
    for (let i = 0; i < rules[0].mask.length; i++) {
        if (rules.every(r => r.mask[i] === 1)) cells.push(i);
    }
    const { grid } = rules[0];
    if (grid.cols * grid.rows <= 1) return cells.length ? null : [];
    return cells;
}

/** A whole-unit point inside a random cell of `cells` (indices into the ground grid). */
function dartInCells(cells, grid, cell, random) {
    const index = cells[Math.floor(random() * cells.length)];
    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);
    return { x: Math.floor((col + random()) * cell), y: Math.floor((row + random()) * cell) };
}

/** A whole-unit point anywhere a Token of `typeId` could fit inside the mat. */
function dartAnywhere(typeId, random) {
    const r = artRadiusOf(typeId);
    return {
        x: Math.round(r + random() * Math.max(0, matW() - 2 * r)),
        y: Math.round(r + random() * Math.max(0, matH() - 2 * r))
    };
}

/**
 * A free spot for `event`: up to {@link LANDING_DARTS} random points on ground it may land on, the
 * first legal one kept (clear of every Token, inside the mat, breaking no rule). Nothing is pushed.
 * Null when none had room.
 */
export function landingSpot(event, random = Math.random) {
    const typeId = event.typeId;
    const own = eventGround(event);
    const cells = allowedCells([own, GroundRules.rulesFor(typeId)]);
    if (cells && cells.length === 0) return null;
    const ground = GroundRules.groundHere();
    // ⚠️ A dart is thrown only at cells both lists allow (`allowedCells`), or anywhere when the mat
    // is one meadow cell that both allow, so the event's ground needs no second look here.
    for (let i = 0; i < LANDING_DARTS; i++) {
        const dart = cells ? dartInCells(cells, ground, ground.cell, random) : dartAnywhere(typeId, random);
        if (MatPlacement.isLegal(typeId, dart)) return dart;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Landing
// ---------------------------------------------------------------------------

/** A weighted draw among events (each fits, so each has a weight above zero). One rolls nothing. */
function pickByWeight(events, random) {
    if (events.length === 1) return events[0];
    const total = events.reduce((sum, e) => sum + e.weight, 0);
    let roll = random() * total;
    for (const e of events) {
        roll -= e.weight;
        if (roll < 0) return e;
    }
    return events[events.length - 1];
}

/**
 * Put `event`'s Token on the mat at `spot`, as an event: `spawned`, carrying `instance.event`, with
 * a buff's time on it. Announced as `BOARD_EVENTS.EVENT_LANDED`.
 */
function land(event, spot) {
    const typeId = event.typeId;
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, BoardState.ORIGIN.SPAWNED);
    instance.event = { id: event.id, kind: event.kind, name: event.name };
    if (event.kind === EVENT_KIND.BUFF) instance.event.lastsMs = Math.round(event.durationMinutes * 60 * 1000);
    BoardState.addToken(instance, spot.x, spot.y);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId });
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [{ x: spot.x, y: spot.y }] });
    EventBus.publish(BOARD_EVENTS.EVENT_LANDED, {
        instanceId: instance.id, typeId, eventId: event.id, kind: event.kind, name: event.name, x: spot.x, y: spot.y
    });
    return instance;
}

/**
 * Land the next event: drawn by weight among those that fit the place; one that finds no room is
 * set aside and the draw made again among the rest. Returns the new instance, or null when none
 * could land.
 */
export function landNext(random = Math.random) {
    let pool = fittingEvents();
    while (pool.length) {
        const event = pickByWeight(pool, random);
        const spot = landingSpot(event, random);
        if (spot) return land(event, spot);
        pool = pool.filter(e => e !== event);
    }
    return null;
}

/**
 * **The QA panel's landing**: event `eventId` now, whatever the clock says and whatever stands on
 * the mat, in any Region (its ground still decides where). Never called by the game itself.
 *
 * @returns {{success: boolean, reason?: string, instance?: object}}
 */
export function landNow(eventId, random = Math.random) {
    const event = getEvent(eventId);
    if (!event) return { success: false, reason: `No event "${eventId}"` };
    if (!isRunnable(event) || !getTokenType(event.typeId)) return { success: false, reason: `${event.name} cannot land: check its kind, Token and weight` };
    const spot = landingSpot(event, random);
    if (!spot) return { success: false, reason: `No room for ${event.name} on its ground here` };
    const instance = land(event, spot);
    const s = eventState();
    if (s) s.clockMs = 0;
    return { success: true, instance };
}

// ---------------------------------------------------------------------------
// The tick
// ---------------------------------------------------------------------------

/**
 * **One tick** (`event_clock`, with the loop's `delta`). Nothing while events are off. While an
 * event Token stands on the mat the clock is held at zero; otherwise it advances, and once due an
 * event is tried ({@link landNext}): landed, the clock starts from zero (and holds while it stands);
 * not, the next try is {@link EVENT_RETRY_MS} later.
 */
export function tick(delta, random = Math.random) {
    if (!enabled || !(delta > 0)) return;
    const s = eventState();
    if (!s) return;
    if (eventTokenOnMat()) {
        s.clockMs = 0;
        return;
    }
    s.clockMs += delta;
    if (s.clockMs < EVENT_EVERY_MS) return;
    s.clockMs = landNext(random) ? 0 : EVENT_EVERY_MS - EVENT_RETRY_MS;
}

// ---------------------------------------------------------------------------
// How an event ended
// ---------------------------------------------------------------------------

let unsubscribers = [];

/**
 * Say how an event Token that left by the ordinary ways ended (`BOARD_EVENTS.EVENT_ENDED`): worked
 * out (its last charge spent) or demolished. Its clocks say the other two themselves
 * (`EventTokens.leave`). Idempotent.
 */
export function init() {
    for (const off of unsubscribers) off();
    unsubscribers = [
        EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, ({ instance, x, y } = {}) => {
            if (!EventTokens.isEventToken(instance)) return;
            EventBus.publish(BOARD_EVENTS.EVENT_ENDED, EventTokens.endedPayload(instance, EventTokens.ENDED.WORKED_OUT, { x, y }));
        }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_DEMOLISHED, ({ instanceId, typeId, event, x, y } = {}) => {
            if (!event?.id) return;
            const gone = { id: instanceId, typeId, event };
            EventBus.publish(BOARD_EVENTS.EVENT_ENDED, EventTokens.endedPayload(gone, EventTokens.ENDED.DEMOLISHED, { x, y }));
        })
    ];
}
