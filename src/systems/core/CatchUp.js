// Catching up: playing the time the game was not running, fast, through the real engine.

import { GameState } from '../../state/GameState.js';
import { GameLoop } from './GameLoop.js';
import { EventBus } from './EventBus.js';
import * as GameClock from './GameClock.js';
import * as NotificationSystem from './NotificationSystem.js';
import { AudioSystem } from './AudioSystem.js';
import { SaveManager } from './SaveManager.js';
import { ENGINE_EVENTS, HEARD_WHILE_QUIET } from './engineEvents.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import { CATCH_UP } from '../../config/loopConstants.js';
import { logger } from '../../utils/Logger.js';

/**
 * A catch-up runs the same tick handlers live play runs, in `CATCH_UP.STEP_MS` steps, with:
 * - the game clock (`GameClock`) starting where the save was written and moving with the steps;
 * - the bus quiet (every `UI_LISTENER` skipped), no toasts, no sounds, and the Time Bank's tick off;
 * - saving suspended (the autosave timer and the save on closing the window), so the slot keeps the
 *   pre-catch-up save byte for byte until the one save at the end: a crash or a closed window
 *   loses nothing, and the next load starts the same catch-up again;
 * - slices of about `CATCH_UP.SLICE_MS` of work with a yield between them, so the page can draw a
 *   progress bar.
 * Everything is restored in a `finally`.
 *
 * It plays `min(time away, CATCH_UP.CAP_MS)`, re-reading the clock between slices so the time the
 * catch-up itself takes is played too; what lies past the cap is dropped and reported.
 *
 * The summary (`result.summary`), counted from the engine's own events while it runs:
 * - `items`: `{ gained, spent, net, floor }`, each `{ itemId: quantity }`. `gained` / `spent` are
 *   what the Bank took in and paid out; `net` is the Bank before against after (two Bank paths
 *   announce no amounts, so it is the one to trust for "how much more do I have"); `floor` is the
 *   loot lying on the mat before against after. ⚠️ With auto-collect off (the default) loot waits
 *   on the mat for the player, so a long catch-up's production is mostly in `floor`, not `gained`.
 * - `levelUps`: `[{ heroId, heroName, skillId, skillName, from, to }]`, one per hero and skill.
 * - `depleted`: `{ total, byType: { typeId: count } }`: Tokens that ran out of charges.
 * - `wounded`: `[{ heroId, heroName, times }]`: heroes defeated and carried home.
 * - `fightsWon`: `{ total, byEnemy: { enemyId: count } }`.
 */

let running = false;
let last = null;
let initialized = false;
/** Overflow the live loop handed over that is still less than one step. */
let pendingMs = 0;

/** Whether a catch-up is playing right now. */
export function isRunning() {
    return running;
}

/** The last catch-up that played anything (its result, summary included), or null. */
export function lastResult() {
    return last;
}

/**
 * Time the live loop could not deliver (`TIME_OVERFLOW`: a sleeping PC, a stalled frame, a
 * background browser tab woken once a minute) is caught up here, through `run` like a load.
 * A gap of `CATCH_UP.SHOW_GAP_MS` or more pauses the loop and plays with the loading bar and the
 * summary (`show`); a shorter one plays at once, inside the tick that found it, before that tick's
 * own step; less than a step waits for the next overflow.
 */
function onOverflow({ overflowMs, deltaMs = 0 } = {}) {
    if (running || !(overflowMs > 0)) return;
    pendingMs += overflowMs;
    const now = Date.now();
    if (pendingMs >= CATCH_UP.SHOW_GAP_MS) {
        const savedAt = now - deltaMs - pendingMs;
        pendingMs = 0;
        // Stopped before the catch-up starts, so the tick that found the gap does not also run its
        // own step: the catch-up plays that second too, up to the real time it finishes at.
        GameLoop.stop();
        run({ savedAt })
            .catch(err => logger.error('CatchUp', `catching up a ${Math.round((now - savedAt) / 1000)} s gap failed`, err))
            .finally(() => { if (!GameLoop.getIsRunning()) GameLoop.start(); });
        return;
    }
    if (pendingMs < CATCH_UP.STEP_MS) return;
    const play = pendingMs - (pendingMs % CATCH_UP.STEP_MS);
    const start = now - deltaMs - pendingMs;
    pendingMs -= play;
    // One slice, so it runs to the end synchronously: the tick carries on with its own step after.
    run({ savedAt: start, now: start + play, sliceMs: Infinity, save: false });
}

/** Catch up the gaps the live loop reports. Idempotent. */
export function init() {
    if (initialized) return;
    initialized = true;
    EventBus.subscribe(ENGINE_EVENTS.TIME_OVERFLOW, onOverflow);
}

/**
 * Hand the event loop a turn, so the page can draw. A `MessageChannel` message, because a hidden
 * window never fires `requestAnimationFrame` and `setTimeout` is clamped to 4 ms.
 */
export function yieldToEventLoop() {
    if (typeof MessageChannel !== 'function') return new Promise(resolve => setTimeout(resolve, 0));
    return new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
            channel.port1.close();
            resolve();
        };
        channel.port2.postMessage(null);
    });
}

function bankSnapshot() {
    const out = {};
    for (const [itemId, entry] of Object.entries(GameState.state?.inventory?.items || {})) {
        out[itemId] = Number(entry?.quantity) || 0;
    }
    return out;
}

function floorSnapshot() {
    const out = {};
    for (const sprite of GameState.state?.board?.sprites || []) {
        if (sprite?.refId) out[sprite.refId] = (out[sprite.refId] || 0) + (Number(sprite.quantity) || 0);
    }
    return out;
}

/** `after − before` per key, leaving out what did not change. */
function change(before, after) {
    const out = {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        const diff = (after[key] || 0) - (before[key] || 0);
        if (diff) out[key] = diff;
    }
    return out;
}

const heroName = (heroId) => (GameState.state?.heroes || []).find(h => h.id === heroId)?.name || heroId;

/** Listen to the engine's events for the summary. `stop()` unsubscribes and returns it. */
function startSummary() {
    const bankBefore = bankSnapshot();
    const floorBefore = floorSnapshot();
    const gained = {};
    const spent = {};
    const levels = new Map();
    const depleted = { total: 0, byType: {} };
    const wounded = new Map();
    const fightsWon = { total: 0, byEnemy: {} };
    const add = (map, key, n = 1) => { map[key] = (map[key] || 0) + n; };

    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.INVENTORY_UPDATED, ({ itemId, added, removed } = {}) => {
            if (!itemId) return;
            if (added > 0) add(gained, itemId, added);
            if (removed > 0) add(spent, itemId, removed);
        }),
        EventBus.subscribe(ENGINE_EVENTS.HERO_LEVELED, ({ heroId, heroName: name, skillId, skillName, oldLevel, newLevel } = {}) => {
            const key = `${heroId}|${skillId}`;
            const row = levels.get(key);
            if (row) row.to = Math.max(row.to, newLevel);
            else levels.set(key, { heroId, heroName: name || heroId, skillId, skillName: skillName || skillId, from: oldLevel, to: newLevel });
        }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, ({ typeId } = {}) => {
            depleted.total++;
            add(depleted.byType, typeId || 'unknown');
        }),
        EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, ({ heroId } = {}) => {
            if (heroId) wounded.set(heroId, (wounded.get(heroId) || 0) + 1);
        }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, ({ enemyId } = {}) => {
            fightsWon.total++;
            add(fightsWon.byEnemy, enemyId || 'unknown');
        })
    ];

    return {
        stop() {
            for (const off of offs) off();
            return {
                items: {
                    gained, spent,
                    net: change(bankBefore, bankSnapshot()),
                    floor: change(floorBefore, floorSnapshot())
                },
                levelUps: [...levels.values()],
                depleted,
                wounded: [...wounded.entries()].map(([heroId, times]) => ({ heroId, heroName: heroName(heroId), times })),
                fightsWon
            };
        }
    };
}

/** Put the game into catch-up mode; the returned function puts it back. */
function enterQuiet(startMs) {
    GameClock.begin(startMs);
    EventBus.setQuiet(true, { except: HEARD_WHILE_QUIET });
    NotificationSystem.setQuiet(true);
    AudioSystem.setSilenced(true);
    SaveManager.suspendSaving();
    return () => {
        SaveManager.resumeSaving();
        AudioSystem.setSilenced(false);
        NotificationSystem.setQuiet(false);
        EventBus.setQuiet(false);
        GameClock.end();
    };
}

/**
 * Play the time since `savedAt`.
 *
 * @param {object} options
 * @param {number} options.savedAt  epoch ms the game stopped (the save's `savedAt`)
 * @param {number|(() => number)} [options.now]  the real time now; a function is re-read between
 *        slices, so the catch-up plays its own duration too. A number fixes the target.
 * @param {number} [options.capMs]
 * @param {number} [options.stepMs]
 * @param {number} [options.sliceMs]
 * @param {(fraction: number, progress: {playedMs: number, targetMs: number}) => void} [options.onProgress]
 *        called with 0 before the first slice, between slices, and with 1 at the end
 * @param {boolean} [options.save]   save once at the end (the bench passes false)
 * @param {boolean} [options.reset]  announce at the end what a load does (`GAME_RESET`, then the
 *        broad updates), once, for everything that was quiet
 * @param {() => Promise<void>} [options.yieldFn]
 * @returns {Promise<{awayMs: number, simulatedMs: number, droppedMs: number, steps: number,
 *          wallMs: number, show: boolean, summary: object|null}>}
 */
export async function run({
    savedAt,
    now = () => Date.now(),
    capMs = CATCH_UP.CAP_MS,
    stepMs = CATCH_UP.STEP_MS,
    sliceMs = CATCH_UP.SLICE_MS,
    onProgress = null,
    save = true,
    reset = true,
    yieldFn = yieldToEventLoop
} = {}) {
    const readNow = typeof now === 'function' ? now : () => now;
    const wallStart = performance.now();
    const startAway = readNow() - Number(savedAt);
    const result = {
        awayMs: Math.max(0, startAway || 0), simulatedMs: 0, droppedMs: 0, steps: 0, wallMs: 0,
        show: startAway >= CATCH_UP.SHOW_GAP_MS, summary: null
    };
    // Under one step, a savedAt in the future (the clock moved back), or already running: nothing.
    if (running || !GameState.getIsInitialized() || !Number.isFinite(startAway) || startAway < stepMs) return result;

    running = true;
    // The live loop is paused while the catch-up plays, and picks up from the real clock after.
    const wasLooping = GameLoop.getIsRunning();
    if (wasLooping) GameLoop.stop();
    const summary = startSummary();
    const leave = enterQuiet(savedAt);
    let played = 0;
    let steps = 0;
    let target = Math.min(startAway, capMs);
    let away;
    const progress = (fraction) => {
        const payload = { fraction, playedMs: played, targetMs: target };
        onProgress?.(fraction, payload);
        EventBus.publish(ENGINE_EVENTS.CATCH_UP_PROGRESS, { ...payload, show: result.show });
    };

    try {
        EventBus.publish(ENGINE_EVENTS.CATCH_UP_STARTED, { awayMs: startAway, playMs: target, show: result.show });
        progress(0);
        for (;;) {
            const sliceStart = performance.now();
            while (target - played >= stepMs) {
                GameClock.advance(stepMs);
                GameLoop.runHandlers(stepMs);
                played += stepMs;
                steps++;
                if (performance.now() - sliceStart >= sliceMs) break;
            }
            away = readNow() - Number(savedAt);
            target = Math.min(Math.max(target, away), capMs);
            if (target - played < stepMs) break;
            progress(played / target);
            await yieldFn();
        }
        // The last part of a step, so the game clock ends exactly where the real one is.
        const rest = target - played;
        if (rest > 0) {
            GameClock.advance(rest);
            GameLoop.runHandlers(rest);
            played += rest;
            steps++;
        }
    } finally {
        leave();
        result.summary = summary.stop();
        running = false;
        if (wasLooping) GameLoop.start();
    }

    result.awayMs = away;
    result.simulatedMs = played;
    result.droppedMs = Math.max(0, away - capMs);
    result.steps = steps;
    progress(1);
    if (save) SaveManager.save(false);
    result.wallMs = performance.now() - wallStart;
    last = result;
    logger.info('CatchUp', `Played ${Math.round(played / 1000)} s of game in ${Math.round(result.wallMs)} ms`
        + `${result.droppedMs > 0 ? `, dropped ${Math.round(result.droppedMs / 1000)} s past the cap` : ''}`,
    result.summary);
    EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, result);
    if (reset) {
        // What a load announces once it has booted: the UI heard nothing while this played.
        EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'catch_up' });
        EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
        EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED);
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED);
    }
    return result;
}
