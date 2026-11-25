// Fantasy Guild — test helpers: the random numbers a test's runs and harvests draw

import { vi } from 'vitest';
import { mulberry32 } from '../../systems/atlas/seededRandom.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import * as Fields from '../../systems/board/Fields.js';

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

/**
 * **For tests only.** The rolls of a ripe Field's harvests: over its chance (not the last) until the
 * `n`th, which rolls just under it and finishes it. Every other draw reads the same meanwhile, so a
 * smaller chance (a perk's) misses as on a high roll. Returns the restore.
 */
export function finishesAt(field, n) {
    let done = 0;
    const under = Fields.harvestEndChance(field) / 100 - 0.001;
    const rolls = vi.spyOn(Math, 'random').mockImplementation(() => (done >= n - 1 ? under : 0.999));
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.instanceId === field.id) done++; });
    return () => { off(); rolls.mockRestore(); };
}
