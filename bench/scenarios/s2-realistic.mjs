// S2 — Realistic late game. The certification scenario (plan §4.4: p99 ≤ 1.5 ms, max ≤ 4 ms).
// The board itself is described in `realistic.mjs`.

import { buildRealistic } from './realistic.mjs';

export default {
    id: 'S2',
    name: 'Realistic late game',
    ticks: () => ({ warmup: 1000, measure: 3000 }),
    build(ctx) {
        buildRealistic(ctx);
    }
};
