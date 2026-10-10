
/**
 * The mat's shared clocks: one loop for many subscribers, instead of one loop each.
 * - {@link onFrame}: every animation frame.
 * - {@link onStep}: {@link STEP_MS} apart, every subscriber in the same frame. The cycle rings
 * (`TokenBubbles`) step here.
 * - {@link onDue}: each subscriber at times of its own, every one due by a frame called in that
 * frame. The hero and enemy sprites step here.
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

/** Subscriber → when it is next due (`performance.now()` ms; `Infinity`: waiting for nothing). */
const dueSubs = new Map();
let dueTimer = null;
let dueTimerAt = Infinity;
let dueRaf = null;

/**
 * One timer, for the soonest due time; when it fires, one animation frame for everyone due by
 * then. ⚠️ While that frame is pending nothing else is scheduled: a hidden tab, which runs no
 * frames, holds one callback, not a queue of them.
 */
function scheduleDue() {
    if (dueRaf !== null) return;
    let at = Infinity;
    for (const t of dueSubs.values()) if (t < at) at = t;
    if (dueTimer !== null) {
        if (dueTimerAt === at) return;
        clearTimeout(dueTimer);
        dueTimer = null;
    }
    dueTimerAt = at;
    if (at === Infinity) return;
    // Rounded up: a timeout is whole milliseconds, and one that fired early would find nobody due.
    dueTimer = setTimeout(wakeDue, Math.max(0, Math.ceil(at - performance.now())));
}

function wakeDue() {
    dueTimer = null;
    dueTimerAt = Infinity;
    dueRaf = requestAnimationFrame(runDue);
}

function runDue() {
    dueRaf = null;
    const now = performance.now();
    try {
        for (const fn of [...dueSubs.keys()]) {
            const at = dueSubs.get(fn);
            if (at === undefined || at > now) continue;
            // Parked first, so a subscriber that throws waits for nothing instead of every frame.
            dueSubs.set(fn, Infinity);
            const next = fn(now);
            if (dueSubs.get(fn) === Infinity && typeof next === 'number' && !Number.isNaN(next)) dueSubs.set(fn, next);
        }
    } finally {
        scheduleDue();
    }
}

/**
 * Call `fn(now)` once `dueAt` has passed, in the first animation frame after it, together with
 * every other subscriber due by that frame; `fn` returns when it is next due (`Infinity` for
 * never), and is called again then. Nobody is called before their time, so a subscriber due
 * rarely costs nothing between. `now` is `performance.now()` in that frame, the same for every
 * subscriber. Subscribing the same function twice is one subscription (the later `dueAt` wins).
 * @param {(now: number) => number} fn
 * @param {number} dueAt `performance.now()` ms
 * @returns {() => void} unsubscribe
 */
export function onDue(fn, dueAt) {
    dueSubs.set(fn, dueAt);
    scheduleDue();
    return () => {
        if (!dueSubs.delete(fn)) return;
        if (dueSubs.size) {
            scheduleDue();
            return;
        }
        if (dueTimer !== null) clearTimeout(dueTimer);
        if (dueRaf !== null) cancelAnimationFrame(dueRaf);
        dueTimer = null;
        dueTimerAt = Infinity;
        dueRaf = null;
    };
}
