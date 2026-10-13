import { vi } from 'vitest';

/**
 * Animation frames that run the moment they are asked for: what a sprite shows at a time on the
 * fake clock, not which screen frame it lands in (`SpriteClock.test.js` drives screen frames).
 * Call after `vi.useFakeTimers`; undo with `vi.unstubAllGlobals()` before `vi.useRealTimers()`.
 * ⚠️ Runs the callback inside `requestAnimationFrame` and returns no id: `frameClock.js` stores
 * the id after the call, so a returned id would mark a frame as pending that has already run.
 * (A 0 ms fake timer would not do: the fake clock runs it 1 ms late.)
 */
export function framesAtOnce() {
    vi.stubGlobal('requestAnimationFrame', (cb) => { cb(performance.now()); return null; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
}
