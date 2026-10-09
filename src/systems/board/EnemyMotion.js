// enemies potter by their spawner

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { artRadiusOf, clampToMat } from '../../config/matGeometry.js';
import { matTuning } from '../../config/matTuning.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as BoardCombat from './BoardCombat.js';
import * as SpawnerSystem from './SpawnerSystem.js';
import * as TimedChanges from './TimedChanges.js';
import { ARRIVE_EPS, stepToward, randomOffset, randomPauseMs } from './walking.js';

/**
 * Each enemy is tethered to the spawner that made it, as a hero is to a flag, and this file walks
 * it.
 *
 * Potters near its spawner: a pause, a stroll to a random spot in the ring between the spawner's
 * art edge and Enemy wander beyond it (Mat Tuner), another pause. This is the heroes' idle potter,
 * with the step itself shared (`walking.js`). Follows its spawner: where it stands is kept as an
 * offset from the spawner's live centre, so a moved spawner is walked after, never jumped to. Walks
 * back when the player drops it outside that ring, at full Enemy walk speed; strolls inside it go
 * at half, as a hero's do. Holds still while fought (a live fight via `BoardCombat.getFight`, or a
 * hero's claim on it) and while it is in the player's hand. A dragged enemy keeps its fight through
 * the move; nothing here touches fights.
 *
 * An enemy with no live spawner (placed by hand, or its spawner gone) stands still.
 *
 * The tether: `instance.tether` is the spawner's instance id, written by
 * `SpawnerSystem.attemptSpawn` when it spawns an enemy, and saved with the Token. An enemy with no
 * `tether` (an older save) is attached once, on its first tick, to the nearest live spawner whose
 * family (`SpawnerSystem.familyOf`) holds its type; `board.enemyTethers` records that it has been
 * done, so an enemy the player later places by hand is never attached by a reload.
 *
 * Everything advances on the tick's `delta`, so a catch-up speeds it up. A step moves at most
 * {@link MAX_STEP_MS} worth of walking, so one very long tick cannot fling an enemy across the mat.
 *
 * ⚠️ A step publishes no Token events. The point is written with `BoardState.setTokenPoint`, which
 * publishes nothing (it journals the move, so `nearby.neighbourIds` drops only the cached entries
 * within Near of either end). The screen hears one `ENEMIES_WALKED` per tick at most. The Near
 * neighbourhood is rebuilt (`ADJACENCY_DIRTY`, both ends) once per walk, when the enemy stops,
 * never per step.
 */

/** A step walks at most this much game time, however long the tick. */
export const MAX_STEP_MS = 1000;

/** An enemy pauses between strolls for this long, in game ms. */
export const POTTER_PAUSE_MS = Object.freeze({ min: 2000, max: 6000 });

/** Strolls inside the ring go at this fraction of walking speed, as heroes' do. */
export const STROLL_FACTOR = 0.5;

/** Walking speed, mat units a second (Mat Tuner "Enemy walk speed"). */
export function enemyWalkSpeed() {
    return matTuning('enemyWalkSpeed');
}

/** How far past its spawner's edge an enemy potters (Mat Tuner "Enemy wander"; 0 = no strolls). */
export function enemyPotterRadius() {
    return matTuning('enemyPotterRadius');
}

let random = Math.random;

/** Tests only: make pottering predictable. Pass nothing to restore `Math.random`. */
export function setRandomForTests(fn = Math.random) {
    random = fn;
}

/**
 * `instanceId → { x, y, potter: {dx, dy}, pauseLeft, moving, facing, from }`.
 * `x`, `y` are exact; the Token's own point is the rounded copy (centres stay
 * whole numbers, which `nearby.js`' exact tie-breaks rely on). Never saved: a
 * load starts every enemy standing where it was saved.
 */
const bodiesByBoard = new WeakMap();

function bodies() {
    const board = GameState.state?.board;
    if (!board) return null;
    let map = bodiesByBoard.get(board);
    if (!map) {
        map = new Map();
        bodiesByBoard.set(board, map);
    }
    return map;
}

/** Whether a Token type is an enemy. */
function isEnemyTypeId(typeId) {
    return BoardCombat.isEnemyToken({ typeId });
}

/** Whether `instance` is a working spawner on the mat (a turned one is not). */
function isLiveSpawner(instance) {
    return !!instance && !instance.turnedFrom && SpawnerSystem.isSpawner(getTokenType(instance.typeId));
}

/** The spawner instance id recorded on enemy `instanceId`, or null. */
export function tetherOf(instanceId) {
    const t = BoardState.getTokenById(instanceId)?.tether;
    return typeof t === 'string' ? t : null;
}

/** The live spawner enemy `instanceId` is tethered to, or null (none, or it is gone). */
export function spawnerOf(instanceId) {
    const spawner = BoardState.getTokenById(tetherOf(instanceId));
    return isLiveSpawner(spawner) ? spawner : null;
}

/**
 * The nearest live spawner whose family holds `typeId`, measured from `point`,
 * or null. Ties go to the earlier arrival.
 */
export function nearestFamilySpawner(typeId, point) {
    let best = null;
    let bestD = Infinity;
    for (const s of BoardState.tokens()) {
        if (!isLiveSpawner(s) || !SpawnerSystem.familyOf(s.typeId).includes(typeId)) continue;
        const d = (s.x - point.x) ** 2 + (s.y - point.y) ** 2;
        if (d < bestD) { best = s; bestD = d; }
    }
    return best;
}

/**
 * Attach an older save's enemies, once per board (`board.enemyTethers`).
 *
 * @returns {number} how many were attached (tests)
 */
export function attachUntethered() {
    const board = GameState.state?.board;
    if (!board || board.enemyTethers === 1) return 0;
    let attached = 0;
    for (const t of BoardState.tokens()) {
        if (!isEnemyTypeId(t.typeId) || 'tether' in t) continue;
        const spawner = nearestFamilySpawner(t.typeId, t);
        if (spawner) { t.tether = spawner.id; attached++; }
    }
    board.enemyTethers = 1;
    return attached;
}

/**
 * What enemy `instanceId`'s body is doing, for the screen and probes:
 * `{ x, y, moving, facing, strolling }`, or null when it has none (not a
 * tethered enemy, or not ticked yet).
 */
export function bodyOf(instanceId) {
    const body = bodies()?.get(instanceId);
    if (!body) return null;
    return {
        x: body.x, y: body.y, moving: !!body.moving, facing: body.facing || -1,
        potter: body.potter ? { ...body.potter } : null,
        pauseLeft: body.pauseLeft
    };
}

/** Whether enemy `instanceId` is walking right now. */
export function isWalking(instanceId) {
    return !!bodies()?.get(instanceId)?.moving;
}

/** Which way a walking enemy faces (−1 left, 1 right), or null when it is not walking. */
export function walkFacingOf(instanceId) {
    const body = bodies()?.get(instanceId);
    return body?.moving ? (body.facing || -1) : null;
}

/** Whether an enemy holds still this tick: fought, walked up to, or in the player's hand. */
export function isHeld(instanceId) {
    return !!BoardCombat.getFight(instanceId)
        || !!BoardState.heroOfInstance(instanceId)
        || TimedChanges.isInHand(instanceId);
}

/** The ring an enemy potters in around `spawner`: `{ centre, inner, outer }`. */
export function areaOf(spawner) {
    const inner = artRadiusOf(spawner.typeId);
    return { centre: { x: spawner.x, y: spawner.y }, inner, outer: inner + Math.max(0, enemyPotterRadius()) };
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** A fresh stroll offset from the spawner's centre, in the ring. */
function strollOffset(area) {
    return randomOffset(area.outer, random, area.inner);
}

function newBody(instance) {
    return { x: instance.x, y: instance.y, potter: null, pauseLeft: null, moving: false, facing: -1, from: null };
}

/** The walk has ended (arrived, or held): rebuild the Near neighbourhood at both ends, once. */
function endWalk(instance, body) {
    if (!body.from) return;
    const from = body.from;
    body.from = null;
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [from, { x: instance.x, y: instance.y }] });
}

/**
 * Move one tethered enemy `delta` game ms.
 * @returns {boolean} whether anything the screen draws changed
 */
function step(instance, spawner, body, delta) {
    // Moved by something else since the last step — the player's drop, a push:
    // start again from where it now stands.
    if (Math.round(body.x) !== instance.x || Math.round(body.y) !== instance.y) {
        body.x = instance.x;
        body.y = instance.y;
        body.potter = null;
        body.pauseLeft = null;
        body.from = null;
    }

    const wasMoving = body.moving;
    if (isHeld(instance.id)) {
        body.moving = false;
        endWalk(instance, body);
        return wasMoving;
    }

    const area = areaOf(spawner);
    const outside = distance(body, area.centre) > area.outer + ARRIVE_EPS;

    // Where it stands, as an offset from the spawner, so it follows the spawner.
    // Standing inside the ring, it keeps its spot; outside, it heads back in.
    if (!body.potter) {
        body.potter = outside
            ? strollOffset(area)
            : { dx: body.x - area.centre.x, dy: body.y - area.centre.y };
    }
    const dest = clampToMat({ x: area.centre.x + body.potter.dx, y: area.centre.y + body.potter.dy });

    const walkMs = Math.min(Math.max(0, delta), MAX_STEP_MS);
    const speed = enemyWalkSpeed() * (outside ? 1 : STROLL_FACTOR);
    const start = { x: instance.x, y: instance.y };
    const moved = stepToward(body, dest, speed * walkMs / 1000);

    let changed = moved || wasMoving !== body.moving;
    if (moved) {
        if (!body.from) body.from = start;
        const x = Math.round(body.x);
        const y = Math.round(body.y);
        if (x !== instance.x || y !== instance.y) BoardState.setTokenPoint(instance.id, x, y);
    }

    if (!body.moving) {
        endWalk(instance, body);
        // Standing: count the pause down, then set off on a stroll.
        if (enemyPotterRadius() > 0) {
            if (body.pauseLeft == null) body.pauseLeft = randomPauseMs(POTTER_PAUSE_MS, random);
            body.pauseLeft -= Math.max(0, delta);
            if (body.pauseLeft <= 0) {
                body.potter = strollOffset(area);
                body.pauseLeft = null;
                changed = true;
            }
        }
    }
    return changed;
}

/**
 * Walk every tethered enemy on the mat `delta` game ms. Run once per engine
 * tick, after `HeroMotion.tick` (so a hero's claim this tick already holds its
 * enemy still) and before any Token ticks.
 */
export function tick(delta = 0) {
    const map = bodies();
    if (!map) return;
    attachUntethered();

    let changed = false;
    const seen = new Set();
    for (const instance of BoardState.tokens()) {
        if (typeof instance.tether !== 'string') continue;
        const spawner = spawnerOf(instance.id);
        if (!spawner || !isEnemyTypeId(instance.typeId)) continue;
        seen.add(instance.id);
        let body = map.get(instance.id);
        if (!body) {
            body = newBody(instance);
            map.set(instance.id, body);
        }
        if (step(instance, spawner, body, delta)) changed = true;
    }
    // Gone from the mat, or no spawner left: no body.
    for (const id of [...map.keys()]) {
        if (seen.has(id)) continue;
        if (map.get(id)?.moving) changed = true;
        map.delete(id);
    }

    if (changed) EventBus.publish(BOARD_EVENTS.ENEMIES_WALKED);
}
