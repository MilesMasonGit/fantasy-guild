// Fantasy Guild — React commit counting for the Perf HUD (round-3 review, P3).
//
// `<PerfProfiler id="MatBoard">…</PerfProfiler>` wraps one measured surface.
//
// ⚠ A Profiler counts EVERY commit inside its subtree, not the wrapped
// component's own renders: one hero sprite's frame step deep inside the mat is
// a "MatBoard" commit. So the HUD calls that figure "mat subtree commits", and
// `usePerfRenderCount('MatBoard')` inside MatBoard counts MatBoard's OWN
// committed renders beside it (CR3-311, CR3-356).
//
// ⚠️ Three builds, three behaviours:
//   * production (`vite build`): `PERF_ENABLED` is the literal `false`, so this
//     is `Passthrough` and `React.Profiler` never appears in the bundle;
//   * dev, not armed (see `profilingArmed`): also `Passthrough` — no Profiler
//     in the tree, nothing to cost;
//   * dev, armed: a real `<React.Profiler>` whose `onRender` adds to plain
//     counters. The HUD reads them at most twice a second; the callback never
//     touches React state or the DOM.

import React, { useEffect, useState } from 'react';
import { PERF_ENABLED, profilingArmed, HUD_ROOT_ID, HUD_SHOWN_EVENT } from './perfFlags.js';

/** Commit tallies per surface id, read and reset by the harness. */
export const reactCommits = {};

/** The surfaces the HUD reports, in display order (plan §4.2). */
export const PROFILED_SURFACES = ['MatBoard', 'HeroDock', 'Drawer', 'TopBar'];

/**
 * A component's own committed renders, by id — read and reset by the harness.
 * Filled by `usePerfRenderCount`, only while profiling is armed.
 */
export const ownRenders = {};

/** The components that count their own renders, in display order. */
export const SELF_COUNTED = ['MatBoard'];

function onRender(id, phase, actualDuration) {
    let c = reactCommits[id];
    if (!c) c = reactCommits[id] = { commits: 0, mounts: 0, totalMs: 0, maxMs: 0 };
    c.commits++;
    if (phase === 'mount') c.mounts++;
    c.totalMs += actualDuration;
    if (actualDuration > c.maxMs) c.maxMs = actualDuration;
}

function Passthrough({ children }) {
    return children;
}

function DevPerfProfiler({ id, children }) {
    if (!profilingArmed()) return children;
    return (
        <React.Profiler id={id} onRender={onRender}>
            {children}
        </React.Profiler>
    );
}

export const PerfProfiler = PERF_ENABLED ? DevPerfProfiler : Passthrough;

/**
 * Dev only: count one committed render of the calling component under `id`.
 * An effect with no dependency list runs once after every commit this
 * component rendered in, and never for a commit it sat out, so it counts the
 * component's own renders and none of its children's. In production it is an
 * empty function, so the call site costs nothing and holds no hook.
 */
function useDevRenderCount(id) {
    useEffect(() => {
        if (profilingArmed()) ownRenders[id] = (ownRenders[id] || 0) + 1;
    });
}

function noRenderCount() {}

export const usePerfRenderCount = PERF_ENABLED ? useDevRenderCount : noRenderCount;

/**
 * Dev only: whether the Perf HUD overlay is showing. ReactRoot hides the
 * FPS counter while it is (CR3-358): the counter runs its own frame loop and a
 * React commit a second, which the HUD would then measure, and it duplicates
 * the HUD's own frame figures. Always `false` in production (no HUD exists).
 */
function useDevHudShowing() {
    const [on, setOn] = useState(() => !!globalThis.document?.getElementById(HUD_ROOT_ID));
    useEffect(() => {
        const onShown = (e) => setOn(!!e.detail?.on);
        globalThis.addEventListener?.(HUD_SHOWN_EVENT, onShown);
        // The HUD may have come up between the first render and this effect.
        setOn(!!globalThis.document?.getElementById(HUD_ROOT_ID));
        return () => globalThis.removeEventListener?.(HUD_SHOWN_EVENT, onShown);
    }, []);
    return on;
}

function hudNeverShowing() {
    return false;
}

export const usePerfHudShowing = PERF_ENABLED ? useDevHudShowing : hudNeverShowing;

export default PerfProfiler;
