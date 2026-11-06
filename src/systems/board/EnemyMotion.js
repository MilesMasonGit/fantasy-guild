// enemies stand still, but for a step to open space before a crowded fight

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { matTuning } from '../../config/matTuning.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as BoardCombat from './BoardCombat.js';
import * as SpawnerSystem from './SpawnerSystem.js';
import * as FightRoom from './FightRoom.js';
import { stepToward } from './walking.js';

/**
 * Enemies stand still. An enemy stays where it was spawned, placed or dropped: it never strolls,
 * never walks back to its camp, and stays put when its camp is moved. It moves only to step to open
 * space before a crowded fight starts (`FightRoom`), at Enemy walk speed (Mat Tuner), and then stays
 * where it stepped.
 *
 * The tether: `instance.tether` is the spawner's instance id, written by `SpawnerSystem` when it
 * spawns an enemy, and saved with the Token. It says which camp an enemy belongs to (a hero sent to
 * an enemy camp hunts its enemies, `Camps`, and a camp counts its own toward its allowance); it no
 * longer moves anything. An enemy with no `tether` (an older save) is attached once, on its first
 * tick, to the nearest live spawner whose family (`SpawnerSystem.familyOf`) holds its type;
 * `board.enemyTethers` records that it has been done, so an enemy the player later places by hand
 * is never attached by a reload.
 *
 * A step advances on the tick's `delta`, so a catch-up speeds it up, and moves at most
 * {@link MAX_STEP_MS} worth of walking, so one very long tick cannot fling an enemy across the mat.
 *
 * ⚠️ A step publishes no Token events. The point is written with `BoardState.setTokenPoint`, which
 * publishes nothing (it journals the move, so `nearby.neighbourIds` drops only the cached entries
 * within Near of either end). The screen hears one `ENEMIES_WALKED` per tick at most. The Near
 * neighbourhood is rebuilt (`ADJACENCY_DIRTY`, both ends) once per step, when the enemy stops,
 * never per tick.
 */

/** A step walks at most this much game time, however long the tick. */
export const MAX_STEP_MS = 1000;

/** Walking speed, mat units a second (Mat Tuner "Enemy walk speed"). */
export function enemyWalkSpeed() {
    return matTuning('enemyWalkSpeed');
}

/**
 * `instanceId → { x, y, moving, facing, from }`, for an enemy stepping aside only.
 * `x`, `y` are exact; the Token's own point is the rounded copy, so a step compares rounded points
 * to tell its own walking from a move by something else. Never saved.
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
        if (spawner) { BoardState.setTether(t, spawner.id); attached++; }
    }
    board.enemyTethers = 1;
    return attached;
}

/**
 * What a stepping enemy's body is doing, for the screen and probes: `{ x, y, moving, facing }`, or
 * null when it has none (it is not stepping aside).
 */
export function bodyOf(instanceId) {
    const body = bodies()?.get(instanceId);
    if (!body) return null;
    return { x: body.x, y: body.y, moving: !!body.moving, facing: body.facing || -1 };
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

/** `seen`: the last tick that found it stepping (`tick`'s stamp). */
function newBody(instance) {
    return { x: instance.x, y: instance.y, moving: false, facing: -1, from: null, seen: 0 };
}

/** The walk has ended (arrived, or let go): rebuild the Near neighbourhood at both ends, once. */
function endWalk(instance, body) {
    if (!body.from) return;
    const from = body.from;
    body.from = null;
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [from, { x: instance.x, y: instance.y }] });
}

/** One scratch destination the steps take turns with (`stepToward` copies it, never keeps it). */
const dest = { x: 0, y: 0 };

let tickStamp = 0;

/**
 * Walk enemy `instance` `delta` game ms toward the open space its fight steps to (`FightRoom`), at
 * full speed. Once there it stands, and stays there after the fight.
 * @returns {boolean} whether anything the screen draws changed
 */
function stepAside(instance, body, aside, delta, speed) {
    // Moved by something else since the last step (a push): walk on from where it now stands.
    if (Math.round(body.x) !== Math.round(instance.x) || Math.round(body.y) !== Math.round(instance.y)) {
        body.x = instance.x;
        body.y = instance.y;
        body.from = null;
    }
    const wasMoving = body.moving;
    dest.x = aside.x;
    dest.y = aside.y;
    const walkMs = Math.min(Math.max(0, delta), MAX_STEP_MS);
    const startX = instance.x;
    const startY = instance.y;
    const moved = stepToward(body, dest, speed * walkMs / 1000);
    if (moved) {
        if (!body.from) body.from = { x: startX, y: startY };
        const x = Math.round(body.x);
        const y = Math.round(body.y);
        if (x !== instance.x || y !== instance.y) BoardState.setTokenPoint(instance.id, x, y);
    }
    if (!body.moving) {
        endWalk(instance, body);
        FightRoom.finishStep(instance.id);
    }
    return moved || wasMoving !== body.moving;
}

/**
 * Walk every enemy stepping aside for its fight `delta` game ms; every other enemy stands. Run once
 * per engine tick, after `HeroMotion.tick` (so a hero arriving this tick has already asked for its
 * step) and before any Token ticks.
 */
export function tick(delta = 0) {
    const map = bodies();
    if (!map) return;
    attachUntethered();
    FightRoom.pruneSteps();

    let changed = false;
    const stamp = ++tickStamp;
    const ids = FightRoom.steppingIds();
    if (ids.length) {
        const speed = enemyWalkSpeed();
        for (const id of ids) {
            const instance = BoardState.getTokenById(id);
            const aside = FightRoom.stepOf(id);
            if (!instance || !aside) continue;
            let body = map.get(id);
            if (!body) {
                body = newBody(instance);
                map.set(id, body);
            }
            body.seen = stamp;
            if (stepAside(instance, body, aside, delta, speed)) changed = true;
        }
    }
    // Its step over or let go: no body. One let go mid-walk stands where it got to.
    for (const [id, body] of map) {
        if (body.seen === stamp) continue;
        if (body.moving) {
            changed = true;
            const instance = BoardState.getTokenById(id);
            if (instance) endWalk(instance, body);
        }
        map.delete(id);
    }

    if (changed) EventBus.publish(BOARD_EVENTS.ENEMIES_WALKED);
}
