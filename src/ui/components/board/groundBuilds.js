// how long the ground's builds took: the perf build marks each

/**
 * The ground is built in two stages (the plan, the screen pass), each a one-off on a travel, a load,
 * a tuning slider or a resize, never in a frame. Each is timed here: dev and perf builds leave a `performance.measure` per build
 * (`fg-perf:ground-plan`, `fg-perf:ground-screen`) for the bench to read against the build bars
 * (terrain roadmap B3).
 */

/**
 * Run one stage of a build and time it.
 *
 * @param {'plan'|'screen'} stage
 * @param {() => any} fn
 */
export function timedBuild(stage, fn) {
    const t0 = performance.now();
    const out = fn();
    const t1 = performance.now();
    if (import.meta.env.DEV || import.meta.env.MODE === 'perf') {
        try { performance.measure(`fg-perf:ground-${stage}`, { start: t0, end: t1 }); } catch { /* an old browser */ }
    }
    return out;
}
