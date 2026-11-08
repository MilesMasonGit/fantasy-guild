import { useSyncExternalStore } from 'react';

/**
 * The fight windows (owner, 2026-11-05): one window per hero, several open at once. A window
 * belongs to its hero, not to one fight: it shows whatever they fight next, and the last result
 * between fights, until it is closed. A window is open (drawn over the mat, where it was put or
 * dragged) or minimized (only then a tab in the strip above the hero bar). UI state only.
 *
 * Each window: `{ heroId, minimized, x, y, anchor, away, z, tabAt }`. `x`/`y` stay null until the
 * window has been placed beside the button that opened it (`anchor`, on its `away` side); `z`
 * orders the open windows (the highest on top); `tabAt` orders the tabs (the latest at the end).
 */

let windows = [];
let seq = 0;
const listeners = new Set();

function set(next) {
    windows = next;
    for (const fn of [...listeners]) fn();
}

const find = (heroId) => windows.find(w => w.heroId === heroId) || null;
const replace = (heroId, patch) => set(windows.map(w => (w.heroId === heroId ? { ...w, ...patch } : w)));
const boxOf = (anchor) => (anchor ? { left: anchor.left, top: anchor.top, right: anchor.right, bottom: anchor.bottom } : null);

/**
 * Open `heroId`'s window, or bring it back and to the top when it is minimized or under another.
 * A new one is placed beside `anchor` (a DOMRect-like `{left, top, right, bottom}`) on its `away`
 * side (-1 left, 1 right): away from the fight, so the fighters stay in view.
 */
export function openFightPanel(heroId, anchor = null, away = 1) {
    if (!heroId) return;
    const had = find(heroId);
    if (had) {
        replace(heroId, { minimized: false, z: ++seq, tabAt: null });
        return;
    }
    set([...windows, { heroId, minimized: false, x: null, y: null, anchor: boxOf(anchor), away: away === -1 ? -1 : 1, z: ++seq, tabAt: null }]);
}

/** Close `heroId`'s window; with no hero, the top open one. */
export function closeFightPanel(heroId = null) {
    const id = heroId ?? topOpen()?.heroId;
    if (!id || !find(id)) return;
    set(windows.filter(w => w.heroId !== id));
}

/** The fight's button: closes the hero's window when it is open, else opens or brings it back. */
export function toggleFightPanel(heroId, anchor = null, away = 1) {
    const w = find(heroId);
    if (w && !w.minimized) closeFightPanel(heroId);
    else openFightPanel(heroId, anchor, away);
}

/** Put `heroId`'s window away as a tab at the end of the strip. */
export function minimizeFightPanel(heroId) {
    const w = find(heroId);
    if (!w || w.minimized) return;
    replace(heroId, { minimized: true, tabAt: ++seq });
}

/** Bring a minimized window back where it was, on top. */
export function restoreFightPanel(heroId) {
    const w = find(heroId);
    if (w) replace(heroId, { minimized: false, z: ++seq, tabAt: null });
}

/** Put `heroId`'s open window on top of the others. */
export function raiseFightPanel(heroId) {
    const w = find(heroId);
    if (!w || w.minimized) return;
    if (w.z === seq) return;
    replace(heroId, { z: ++seq });
}

/** Move `heroId`'s window to `x`, `y` (its top-left on screen, whole pixels). */
export function moveFightPanel(heroId, x, y) {
    const w = find(heroId);
    if (!w) return;
    const nx = Math.round(x);
    const ny = Math.round(y);
    if (w.x === nx && w.y === ny) return;
    replace(heroId, { x: nx, y: ny });
}

/** Every window, in the order opened. The same array until something changes. */
export function fightWindows() {
    return windows;
}

/** The open windows, bottom to top. */
export function openFightWindows(list = windows) {
    return list.filter(w => !w.minimized).sort((a, b) => a.z - b.z);
}

/** The minimized windows, as their tabs stand from the left. */
export function fightTabs(list = windows) {
    return list.filter(w => w.minimized).sort((a, b) => a.tabAt - b.tabAt);
}

function topOpen(list = windows) {
    return openFightWindows(list).at(-1) || null;
}

/** The top open window, or null: the one Escape closes. */
export function fightPanelState() {
    return topOpen();
}

/** Whether `heroId` has a window open (not minimized). */
export function isFightPanelOpen(heroId) {
    const w = find(heroId);
    return !!w && !w.minimized;
}

/** Close every window (tests only). */
export function resetFightPanels() {
    seq = 0;
    if (windows.length) set([]);
}

function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Every window (`fightWindows`). */
export function useFightWindows() {
    return useSyncExternalStore(subscribe, fightWindows, fightWindows);
}

/** The top open window, or null. */
export function useFightPanelState() {
    return useSyncExternalStore(subscribe, fightPanelState, fightPanelState);
}
