// Fantasy Guild — test helper: the same random numbers for runs compared with one another

import { vi } from 'vitest';
import { mulberry32 } from '../../systems/atlas/seededRandom.js';

/**
 * **For tests only.** Points `Math.random` at a fresh stream from `seed`, so runs meant to end alike
 * (small steps, big steps, the catch-up) each draw the same numbers from their start, as the bench
 * reseeds each scenario. A source that runs out by chance rolls on that stream. Returns the spy;
 * `spy.mockRestore()` gives the test's seeded stream back.
 */
export function sameRolls(seed = 860) {
    const next = mulberry32(seed);
    return vi.spyOn(Math, 'random').mockImplementation(() => next());
}
