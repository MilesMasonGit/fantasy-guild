// how long the ground's last builds took: the dev panel shows it, the perf build marks it

/**
 * The ground is built in two stages (the plan, the screen pass), each a one-off on a travel, a load,
 * a tuning slider or a resize, never in a frame. Each is timed here: the Terrain dev section shows
 * the last of each, and dev and perf builds leave a `performance.measure` per build
 * (`fg-perf:ground-plan`, `fg-perf:ground-screen`) for the bench to read against the build bars
 * (terrain roadmap B3).
 */

const last = { plan: null, screen: null, cols: 0, rows: 0, at: 0 };
const listeners = new Set();
let notifying = false;

/**
 * Tell the listeners after the current task. ⚠️ Never at once: the plan is built while
 * `TerrainCanvas` renders, and a listener that sets React state then would update another
 * component in the middle of that render.
 */
function notifySoon() {
    if (notifying) return;
    notifying = true;
    queueMicrotask(() => {
        notifying = false;
        for (const fn of [...listeners]) fn();
    });
}

/**
 * Run one stage of a build and note how long it took.
 *
 * @param {'plan'|'screen'} stage
 * @param {() => any} fn
 */
export function timedBuild(stage, fn) {
    const t0 = performance.now();
    const out = fn();
    const t1 = performance.now();
    last[stage] = t1 - t0;
    last.at = t1;
    if (stage === 'screen' && out) {
        last.cols = out.cols;
        last.rows = out.rows;
    }
    if (import.meta.env.DEV || import.meta.env.MODE === 'perf') {
        try { performance.measure(`fg-perf:ground-${stage}`, { start: t0, end: t1 }); } catch { /* an old browser */ }
    }
    notifySoon();
    return out;
}

/** The last build's times in ms (null before the first), and the picture's size in ground pixels. */
export function lastGroundBuilds() {
    return { ...last };
}

/** Called once after the task in which stages were timed. Returns an unsubscribe. */
export function onGroundBuilt(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
