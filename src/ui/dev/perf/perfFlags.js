// Fantasy Guild — Perf harness switches (round-3 review, Tier B, session P3).
//
// ⚠️ DEV BUILDS ONLY. Everything in `src/ui/dev/perf/` is reached through a
// compile-time `import.meta.env.DEV` check, so a production build (`vite build`)
// folds the check to `false` and drops the harness entirely — no HUD, no
// `window.__perf`, no `<React.Profiler>`. `npx vite build` then grepping
// `dist/assets/*.js` for `fg-perf-hud` proves it (see docs/review_v3/P3.md).
//
// This module must stay free of side effects at import time: ReactRoot and
// Board import `PerfProfiler`, which imports this, in every build.

/** The harness exists at all. A compile-time constant, false in production. */
export const PERF_ENABLED = !!import.meta.env.DEV;

/** localStorage key: the owner switched the HUD on, keep it on across reloads. */
export const HUD_STORAGE_KEY = 'fg_perf_hud';

/** Window event fired when the HUD overlay is shown or hidden; `detail.on`. */
export const HUD_SHOWN_EVENT = 'fg-perf-hud-shown';

/** The HUD overlay's element id (perfHud.js creates it). */
export const HUD_ROOT_ID = 'fg-perf-hud';

/** URL flags that arm the harness for this page load. */
function urlFlags() {
    try {
        const params = new URLSearchParams(globalThis.location?.search || '');
        return { stress: params.get('stress'), perf: params.get('perf') };
    } catch {
        return { stress: null, perf: null };
    }
}

/** `?stress=<name>` from the URL, or null. */
export function stressFromUrl() {
    return PERF_ENABLED ? urlFlags().stress : null;
}

/** Whether the owner left the HUD on last time. */
export function hudRemembered() {
    try {
        return globalThis.localStorage?.getItem(HUD_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

let armed = null;

/**
 * Whether this page load wraps the measured surfaces in `<React.Profiler>`.
 *
 * Decided ONCE, at first use, and never changed for the life of the page: a
 * Profiler added or removed later would change the element tree above
 * `MatBoard` and remount it (losing its state and spiking the very numbers the
 * HUD is reading). So React commit counting is armed by `?stress=…`, `?perf=1`
 * or a remembered HUD, and switching the HUD on mid-session says "reload to
 * count React commits" instead.
 *
 * When not armed there is no Profiler in the tree at all — nothing to cost.
 */
export function profilingArmed() {
    if (!PERF_ENABLED) return false;
    if (armed === null) {
        const { stress, perf } = urlFlags();
        armed = !!stress || perf === '1' || hudRemembered();
    }
    return armed;
}
