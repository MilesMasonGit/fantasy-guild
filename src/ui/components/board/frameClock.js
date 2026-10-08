
/**
 * The mat's one frame clock.
 * Per-frame work (today the cycle rings sweeping between engine ticks, `TokenBubbles`)
 * subscribes here instead of running its own `requestAnimationFrame` loop, so seven worked
 * Tokens are one callback a frame that calls seven functions rather than seven loops.
 * The loop runs only while something is subscribed: the last unsubscribe cancels the pending
 * frame, and the next subscribe starts it.
 * Each subscriber gets the frame's timestamp, exactly what its own `requestAnimationFrame`
 * would pass it.
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
