// S6 — Long idle. Plan §4.1: S2 run for 8 hours of game time (288,000 ticks);
// heap after GC must be flat and every runtime structure bounded (plan §4.4:
// heap within ±5 % of the 1-hour mark).
//
// The full 8 hours takes several minutes, so it runs only with `--long`. The
// default is 30 game-minutes (18,000 ticks) with a checkpoint every 5 minutes —
// enough to see a trend, not enough to certify one.
//
// Each checkpoint forces a GC and records the heap and the size of the
// structures the engine keeps: Tokens, loot sprites, EventBus listeners, the
// notification queue, the discard bin and the saved state's JSON size.

import { buildBoard } from './realistic.mjs';

const MINUTE = 600; // ticks per game-minute

export default {
    id: 'S6',
    name: 'Long idle',
    ticks: (long) => long
        ? { warmup: 1000, measure: 480 * MINUTE, checkpointEvery: 30 * MINUTE }
        : { warmup: 1000, measure: 30 * MINUTE, checkpointEvery: 5 * MINUTE },
    build(ctx) {
        buildBoard(ctx);
    }
};
