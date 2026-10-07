// Per-system drawing switches for the perf harness: turn one system's DRAWING off to measure
// what it costs. ⚠️ A switch stops drawing only, never game logic.
// ⚠️ Compiled out of a normal production build: `isDrawn` and `useDrawn` fold to a constant
// `true` and the registry below is dropped. Gate with the literal `import.meta.env` check so the
// bundler can see it; do not route it through a variable.

import { useSyncExternalStore } from 'react';

export const DRAW_SWITCHES = [
    'rings', 'alerts', 'speech', 'tooltips',
    'heroAnim', 'enemyAnim', 'walkDraw', 'itemFlight',
    'notifications', 'bin', 'dock', 'drawers',
    'spriteFx', 'background', 'particles'
];

const off = new Set();
const listeners = new Set();
const warned = new Set();
let version = 0;

function known(name) {
    if (DRAW_SWITCHES.includes(name)) return true;
    if (!warned.has(name)) {
        warned.add(name);
        console.warn(`[perf] unknown draw switch "${name}"; known: ${DRAW_SWITCHES.join(', ')}`);
    }
    return false;
}

function notify() {
    version += 1;
    listeners.forEach((l) => l());
}

export function setDrawn(name, drawn) {
    if (!known(name)) return;
    const changed = drawn ? off.delete(name) : !off.has(name) && !!off.add(name);
    if (changed) notify();
}

export function drawnSwitches() {
    return Object.fromEntries(DRAW_SWITCHES.map((n) => [n, !off.has(n)]));
}

/** Parse `?off=a,b` into the registry. Called once at load. */
export function applyOffFromUrl(search) {
    try {
        const raw = new URLSearchParams(search || '').get('off');
        if (!raw) return;
        raw.split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => { if (known(n)) off.add(n); });
    } catch { /* no URL, nothing to apply */ }
}

if (import.meta.env.DEV || import.meta.env.MODE === 'perf') {
    applyOffFromUrl(globalThis.location?.search);
}

function subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
}

/** Cheap non-reactive read, for canvas and animation-frame code. */
export function isDrawn(name) {
    if (!(import.meta.env.DEV || import.meta.env.MODE === 'perf')) return true;
    return !off.has(name);
}

/** Reactive read, for React components: re-renders when the switch flips. */
export function useDrawn(name) {
    if (!(import.meta.env.DEV || import.meta.env.MODE === 'perf')) return true;
    // Hook count is fixed per build: the check above is a compile-time constant.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSyncExternalStore(subscribe, () => version);
    return !off.has(name);
}

/** Test seam: back to all-on, no listeners. */
export function resetDrawSwitches() {
    off.clear();
    warned.clear();
    version += 1;
}
