// S5 — Rebuild storm. Plan §4.1: S2 plus one board-reach aura.
//
// While any Token with a `board`-reach rule is on the mat, every neighbourhood
// change rebuilds EVERY Token's modifiers, and each rebuild scans every Token
// (TileModifiers.rebuildTokens / applicableStatements, CR3-004). ⚠️ The storm
// comes from S2's two hunters: each goblin killed leaves the mat
// (`ADJACENCY_DIRTY`) and each one its camp brings back lands (the spawn's own
// `rebuildAround`). Enemies stand still, so a board with no hunt has almost no
// storm.

import { buildBoard } from './realistic.mjs';

export default {
    id: 'S5',
    name: 'Rebuild storm',
    ticks: () => ({ warmup: 500, measure: 1500 }),
    build(ctx) {
        buildBoard(ctx, { late: ['bench_board_aura'] });
    }
};
