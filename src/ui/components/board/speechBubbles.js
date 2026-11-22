/**
 * Speech bubbles that wait: a hero's line for something stopped, gone or needing the player ("My
 * Rusty Woodaxe broke!"). Unlike a moment (`heroSpeech.js`), it has no timer: it stays until the
 * player hovers or clicks it, or until its need is met, whichever comes first. A dismissed bubble
 * is no longer drawn but is still watched, so a later rebuild does not bring it back while its
 * need stands; once the need is met it is forgotten.
 *
 * Each bubble carries its own condition, `holds()`, true while its need stands, and the events on
 * which to ask it again (`checkOn`): the store hears those events, never a per-frame poll.
 *
 * UI state only: never saved. A load rebuilds what still stands from the game's state through the
 * rebuilders registered with {@link registerRebuild}.
 */

import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { GameState } from '../../../state/GameState.js';

/** ownerId → Map(key → { key, text, holds, checkOn, at, dismissed }) */
const owners = new Map();
/** eventName → { off, count } */
const watched = new Map();
const listeners = new Set();
const rebuilders = new Set();
let version = 0;
let lastAt = 0;
/** The game state the bubbles were raised in: another one (a load while the mat was not drawn) clears them. */
let raisedIn = null;

/** A strictly rising stamp, so bubbles raised in the same millisecond keep their order. */
function stamp() {
    lastAt = Math.max(Date.now(), lastAt + 1);
    return lastAt;
}

function changed() {
    version++;
    for (const fn of [...listeners]) fn();
}

function watch(eventName) {
    const w = watched.get(eventName);
    if (w) { w.count++; return; }
    const off = EventBus.subscribe(eventName, () => recheck(eventName), UI_LISTENER);
    watched.set(eventName, { off, count: 1 });
}

function unwatch(eventName) {
    const w = watched.get(eventName);
    if (!w) return;
    if (--w.count > 0) return;
    w.off();
    watched.delete(eventName);
}

function drop(ownerId, entry) {
    const list = owners.get(ownerId);
    if (!list?.delete(entry.key)) return;
    if (!list.size) owners.delete(ownerId);
    for (const name of entry.checkOn) unwatch(name);
}

function stands(entry) {
    try {
        return entry.holds() === true;
    } catch {
        return false;
    }
}

function put(ownerId, { key, text, holds, checkOn = [], tone = null }, { keepExisting }) {
    if (!ownerId || !key || !text || typeof holds !== 'function') return false;
    const existing = owners.get(ownerId)?.get(key);
    if (existing && keepExisting) return false;
    const entry = { key, text, holds, checkOn: [...new Set(checkOn)], tone, at: stamp(), dismissed: false };
    if (!stands(entry)) return false;
    if (existing) drop(ownerId, existing);
    if (!owners.has(ownerId)) owners.set(ownerId, new Map());
    owners.get(ownerId).set(key, entry);
    for (const name of entry.checkOn) watch(name);
    changed();
    return true;
}

/**
 * Raise a waiting bubble over `ownerId` (a hero's id). One per `key`: raising a key again (the
 * same need, newly met with) replaces the earlier bubble and shows it again even if it had been
 * dismissed. Nothing is raised when `holds()` is already false.
 *
 * @param {string} ownerId
 * @param {{key: string, text: string, holds: () => boolean, checkOn?: string[], tone?: string}} spec
 *   `holds` is true while the need stands; `checkOn` the EventBus events on which it is asked again.
 * @returns {boolean} whether a bubble was raised
 */
export function raiseBubble(ownerId, spec) {
    return put(ownerId, spec, { keepExisting: false });
}

/** Hovered or clicked: no longer drawn, still watched until its need is met. */
export function dismissBubble(ownerId, key) {
    const entry = owners.get(ownerId)?.get(key);
    if (!entry || entry.dismissed) return;
    entry.dismissed = true;
    changed();
}

/** Ask every bubble's condition again (only those watching `eventName`, when given); drop those met. */
export function recheck(eventName = null) {
    const met = [];
    for (const [ownerId, list] of owners) {
        for (const entry of list.values()) {
            if (eventName && !entry.checkOn.includes(eventName)) continue;
            if (!stands(entry)) met.push([ownerId, entry]);
        }
    }
    if (!met.length) return;
    for (const [ownerId, entry] of met) drop(ownerId, entry);
    changed();
}

/** The bubbles drawn over `ownerId`, oldest first, as `{ key, text, at, tone }`. */
export function bubblesOf(ownerId) {
    const list = owners.get(ownerId);
    if (!list) return [];
    const out = [];
    for (const e of list.values()) if (!e.dismissed) out.push({ key: e.key, text: e.text, at: e.at, tone: e.tone });
    return out.sort((a, b) => a.at - b.at);
}

/** Whether `ownerId` has a bubble under `key` whose need stands, drawn or dismissed. */
export function hasBubble(ownerId, key) {
    return owners.get(ownerId)?.has(key) === true;
}

/**
 * Register what to rebuild from the game's state on a load: `fn(raise)`, where `raise(ownerId,
 * spec)` takes the same spec as {@link raiseBubble} but leaves a bubble already there (drawn or
 * dismissed) as it is.
 * @returns {() => void} unregister
 */
export function registerRebuild(fn) {
    rebuilders.add(fn);
    return () => rebuilders.delete(fn);
}

/** Run every rebuilder, then ask every condition again. */
export function rebuild() {
    const raise = (ownerId, spec) => put(ownerId, spec, { keepExisting: true });
    for (const fn of [...rebuilders]) {
        try {
            fn(raise);
        } catch (err) {
            console.error('[speechBubbles] rebuild failed', err);
        }
    }
    recheck();
}

/** Forget every bubble: another game. */
export function clearBubbles() {
    for (const [ownerId, list] of [...owners]) for (const entry of [...list.values()]) drop(ownerId, entry);
    changed();
}

/** For `useSyncExternalStore`. */
export function subscribeBubbles(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function bubblesVersion() {
    return version;
}

/** Forget the bubbles of another game, then rebuild. */
function rebuildFor(state, { keep }) {
    if (!keep || state !== raisedIn) clearBubbles();
    raisedIn = state;
    rebuild();
}

/**
 * Keep the store in step with the game while the mat is drawn: a new game or a load forgets every
 * bubble and rebuilds; a catch-up or a travel keeps them (a dismissed one stays dismissed) and
 * rebuilds what time away left standing. Rebuilds once now, for a mat drawn after a load or drawn
 * again after another screen (keeping what it had when the game is the same).
 * @returns {() => void} stop
 */
export function startSpeechBubbles() {
    const off = EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, (p) => {
        const reason = p?.reason;
        rebuildFor(GameState.state, { keep: reason === 'catch_up' || reason === 'travel' });
    }, UI_LISTENER);
    rebuildFor(GameState.state, { keep: true });
    return off;
}
