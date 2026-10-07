// Perf harness switches.
// ⚠️ DEV AND PERF BUILDS ONLY. Everything in `src/ui/dev/perf/` is reached through a compile-time
// check (dev server, or `vite build --mode perf`), so a normal production build (`vite build`) folds the check to `false`
// and drops the harness entirely: no HUD, no `window.__perf`, no `<React.Profiler>`. `npx vite
// build` then grepping `dist/assets/*.js` for `fg-perf-hud` proves it. This module must stay
// free of side effects at import time: ReactRoot and Board import `PerfProfiler`, which
// imports this, in every build.

// ⚠️ Files outside this folder write the check inline (`import.meta.env.DEV || import.meta.env.MODE
// === 'perf'`) so the bundler sees the literals and drops what sits behind it.
export const PERF_ENABLED = !!(import.meta.env.DEV || import.meta.env.MODE === 'perf');

/** localStorage key: the HUD was switched on, keep it on across reloads. */
export const HUD_STORAGE_KEY = 'fg_perf_hud';

export const HUD_SHOWN_EVENT = 'fg-perf-hud-shown';

export const HUD_ROOT_ID = 'fg-perf-hud';

function urlFlags() {
    try {
        const params = new URLSearchParams(globalThis.location?.search || '');
        return { stress: params.get('stress'), perf: params.get('perf') };
    } catch {
        return { stress: null, perf: null };
    }
}

export function stressFromUrl() {
    return PERF_ENABLED ? urlFlags().stress : null;
}

export function hudRemembered() {
    try {
        return globalThis.localStorage?.getItem(HUD_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

let armed = null;

/**
 * Whether this page load wraps the measured surfaces in `<React.Profiler>`. Decided ONCE, at
 * first use, and never changed for the life of the page: a Profiler added or removed later
 * would change the element tree above `MatBoard` and remount it (losing its state and spiking
 * the very numbers the HUD is reading). So React commit counting is armed by `?stress=…`,
 * `?perf=1` or a remembered HUD, and switching the HUD on mid-session says 'reload to count
 * React commits' instead. When not armed there is no Profiler in the tree at all.
 */
export function profilingArmed() {
    if (!PERF_ENABLED) return false;
    if (armed === null) {
        const { stress, perf } = urlFlags();
        armed = !!stress || perf === '1' || hudRemembered();
    }
    return armed;
}
