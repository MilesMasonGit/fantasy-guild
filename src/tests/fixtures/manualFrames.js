import { vi } from 'vitest';
import { act } from '@testing-library/react';

/**
 * Animation frames that run only when the test says so, on a clock the test moves: what an
 * animation driven by `frameClock.onFrame` shows after so many ms, and whether it still asks for
 * frames at all. `performance.now()` reads the same clock. Undo with `vi.unstubAllGlobals()` and
 * `vi.restoreAllMocks()`.
 * @param {number} [start] the clock's first reading, ms
 */
export function manualFrames(start = 1000) {
    let now = start;
    let nextId = 0;
    let queue = new Map();
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (cb) => {
        nextId += 1;
        queue.set(nextId, cb);
        return nextId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id) => { queue.delete(id); });
    const frames = {
        /** Frames asked for and not yet run. */
        pending: () => queue.size,
        /** Moves the clock `ms` on and runs every frame asked for, inside `act`. */
        frame(ms = 16) {
            now += ms;
            const due = [...queue.values()];
            queue = new Map();
            act(() => { for (const cb of due) cb(now); });
        },
        /** Frames `step` ms apart until `ms` have passed. */
        run(ms, step = 16) {
            for (let t = 0; t < ms; t += step) frames.frame(step);
        }
    };
    return frames;
}
