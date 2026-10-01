// Fantasy Guild — one animation-frame loop for everything on the mat that moves every frame (CR3-011)

/**
 * ⭐ **The mat's one frame clock** (R6 rule 2: "one frame clock").
 *
 * Per-frame work — today the cycle rings sweeping between engine ticks
 * (`TokenBadgeRow`) — subscribes here instead of running its own
 * `requestAnimationFrame` loop. Seven worked Tokens used to be seven loops;
 * now they are one callback a frame that calls seven functions.
 *
 * The loop runs only while something is subscribed (R6 rule 1): the last
 * unsubscribe cancels the pending frame, and the next subscribe starts it.
 *
 * Each subscriber gets the frame's timestamp, exactly what its own
 * `requestAnimationFrame` used to pass it.
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
 * called. Subscribing the same function twice is one subscription.
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

/** How many functions the clock is driving (tests and the Perf HUD). */
export function frameClockSubscribers() {
    return subs.size;
}
