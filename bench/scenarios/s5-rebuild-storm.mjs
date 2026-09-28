// S5 — Rebuild storm. Plan §4.1: S2 plus one board-reach aura, enemies
// strolling continuously.
//
// While any Token with a `board`-reach rule is on the mat, every neighbourhood
// change rebuilds EVERY Token's modifiers, and each rebuild scans every Token
// (TileModifiers.rebuildTokens / applicableStatements, CR3-004). S2's six
// goblins already stroll about their camps and publish `ADJACENCY_DIRTY` at the
// end of every stroll (EnemyMotion.endWalk), so the storm comes from the same
// board with one extra Token on it.

import { buildBoard } from './realistic.mjs';

export default {
    id: 'S5',
    name: 'Rebuild storm',
    ticks: () => ({ warmup: 500, measure: 1500 }),
    build(ctx) {
        buildBoard(ctx, { late: ['bench_board_aura'] });
    }
};
