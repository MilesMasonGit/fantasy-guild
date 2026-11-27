// S3 — Torture. Plan §4.1: 8 heroes, 200 placed + 100 spawned, 20 enemies,
// one board-reach aura. Target (plan §4.4): p99 ≤ 4 ms — degrade, don't cliff.
//
// On the largest mat the Mat Tuner allows (20 steps at 0.8, 3200 × 2560 u): 200 placed
// Tokens including the Hall and ONE board-reach aura, 5 Forests + 5 Quarries
// (10 spawned each) and 4 war camps (5 goblins each). Even that mat has no room for every
// spawner's clearing and the rest (`layoutSlots`, squeezed): the last Quarry stands among the
// producers and finds no room, so about 90 are spawned, and the board holds about 305 Tokens.
// The board is far over the game's Token cap (128); `buildBoard` lifts the cap
// so the stress stays what it measures.

import { buildBoard } from './realistic.mjs';
import { spread } from './spread.mjs';
import { LARGEST_MAT } from './referenceMat.mjs';

const SPECIALS = [
    ['bench_forest', 5],
    ['bench_quarry', 5],
    ['bench_warcamp', 4],
    ['fixture_buff_yield', 10],
    ['fixture_buff_speed', 10],
    ['bench_mill', 20],
    ['bench_smelter', 10],
    ['fixture_passive', 14]
];

/** 198 placed Tokens besides the Hall and the aura: the specials above, spread among 120 producers. */
export function tortureList() {
    return spread(SPECIALS, 120, ['fixture_producer', 'fixture_producer_alt']);
}

export default {
    id: 'S3',
    name: 'Torture',
    ticks: () => ({ warmup: 300, measure: 500 }),
    build(ctx) {
        buildBoard(ctx, { placed: tortureList(), late: ['bench_board_aura'], mat: LARGEST_MAT, squeeze: true });
    }
};
