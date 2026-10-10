
/**
 * The mat's shared clocks: one loop for many subscribers, instead of one loop each.
 * - {@link onFrame}: every animation frame.
 * - {@link onStep}: {@link STEP_MS} apart, every subscriber in the same frame. The cycle rings
 * (`TokenBubbles`) step here.
 * Each runs only while something is subscribed: the last unsubscribe cancels what is pending,
 * and the next subscribe starts it again.
 */

const subs = new Set();
let raf = null;

function run(now) {
    raf = null;
    // A copy: a subscriber may unsubscribe itself, or another, mid-frame.
    for (const fn of [...subs]) {
        if (subs.has(fn)) fn(now);
    }
    if (subs.size && raf === null) raf = requestAnimationFrame(run);
}

/**
 * Call `fn(now)` on every animation frame until the returned function is
 * called. Subscribing the same function twice is one subscription. `now` is the frame's
 * timestamp, exactly what its own `requestAnimationFrame` would pass it.
 * @param {(now: number) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onFrame(fn) {
    subs.add(fn);
    if (raf === null) raf = requestAnimationFrame(run);
    return () => {
        subs.delete(fn);
        if (!subs.size && raf !== null) {
            cancelAnimationFrame(raf);
            raf = null;
        }
    };
}

/** How far apart the stepped clock's steps are: 10 a second. */
export const STEP_MS = 100;

const stepSubs = new Set();
let stepTimer = null;
let stepRaf = null;

/**
 * Wait for the next step, then draw it in the frame after. Steps fall on one grid of
 * {@link STEP_MS} (`performance.now()`), so a step drawn late does not push the next one back.
 * ⚠️ A timer, not a frame loop: between steps nothing is scheduled, so a page that is otherwise
 * still draws no frame for the rings.
 */
function scheduleStep() {
    if (stepTimer !== null || stepRaf !== null || !stepSubs.size) return;
    const wait = STEP_MS - (performance.now() % STEP_MS);
    stepTimer = setTimeout(() => {
        stepTimer = null;
        stepRaf = requestAnimationFrame(runStep);
    }, wait);
}

function runStep() {
    stepRaf = null;
    // One `now` for the whole step, so two drawings of the same cycle agree exactly.
    const now = performance.now();
    try {
        for (const fn of [...stepSubs]) {
            if (stepSubs.has(fn)) fn(now);
        }
    } finally {
        // One subscriber that throws must not stop every ring.
        scheduleStep();
    }
}

/**
 * Call `fn(now)` once a step ({@link STEP_MS}) until the returned function is called. Every
 * subscriber is called in the same animation frame, so what they draw changes together, at
 * most 1000 / STEP_MS times a second. `now` is `performance.now()` at the step, the same for
 * every subscriber. Subscribing the same function twice is one subscription.
 * @param {(now: number) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onStep(fn) {
    stepSubs.add(fn);
    scheduleStep();
    return () => {
        stepSubs.delete(fn);
        if (stepSubs.size) return;
        if (stepTimer !== null) clearTimeout(stepTimer);
        if (stepRaf !== null) cancelAnimationFrame(stepRaf);
        stepTimer = null;
        stepRaf = null;
    };
}
