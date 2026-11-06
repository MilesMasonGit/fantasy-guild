// S5 — Rebuild storm. Plan §4.1: S2 plus one board-reach aura, enemies
// strolling continuously.
//
// While any Token with a `board`-reach rule is on the mat, every neighbourhood
// change rebuilds EVERY Token's modifiers, and each rebuild scans every Token
// (TileModifiers.rebuildTokens / applicableStatements, CR3-004). ⚠️ The storm
// came from S2's six goblins strolling about their camps and publishing
// `ADJACENCY_DIRTY` at the end of every stroll. Enemies stand still now (brief
// 500), so only heroes' arrivals and spawns rebuild: S5 is much calmer and needs
// a new source of neighbourhood changes to measure a storm again.

import { buildBoard } from './realistic.mjs';

export default {
    id: 'S5',
    name: 'Rebuild storm',
    ticks: () => ({ warmup: 500, measure: 1500 }),
    build(ctx) {
        buildBoard(ctx, { late: ['bench_board_aura'] });
    }
};
