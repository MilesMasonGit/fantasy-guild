// Fantasy Guild — React commit counting for the Perf HUD (round-3 review, P3).
//
// `<PerfProfiler id="MatBoard">…</PerfProfiler>` wraps one measured surface.
//
// ⚠️ Three builds, three behaviours:
//   * production (`vite build`): `PERF_ENABLED` is the literal `false`, so this
//     is `Passthrough` and `React.Profiler` never appears in the bundle;
//   * dev, not armed (see `profilingArmed`): also `Passthrough` — no Profiler
//     in the tree, nothing to cost;
//   * dev, armed: a real `<React.Profiler>` whose `onRender` adds to plain
//     counters. The HUD reads them at most twice a second; the callback never
//     touches React state or the DOM.

import React from 'react';
import { PERF_ENABLED, profilingArmed } from './perfFlags.js';

/** Commit tallies per surface id, read and reset by the harness. */
export const reactCommits = {};

/** The surfaces the HUD reports, in display order (plan §4.2). */
export const PROFILED_SURFACES = ['MatBoard', 'HeroDock', 'Drawer', 'TopBar'];

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

export default PerfProfiler;
