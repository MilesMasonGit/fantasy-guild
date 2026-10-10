// The cap boards: S2's mix of Tokens with the Token cap set to a number and the mat filled up
// to it, for "how does the realistic mat draw at the cap the game will have?" (brief 60; the
// owner's cap, Atlas roadmap D-9: 128 to start, +16 a rank up to 256).
//
// S2 counts ~105 Tokens toward the cap (39 placed, 60 spawned trees and rocks, 6 goblins; the
// Hall and quest Tokens never count). A cap board keeps S2's share of placed Tokens (39 of 105)
// and its order (S2's list again and again), and lets the spawners fill the rest of the mat until
// the cap stops them, so the board ends at the cap and stays there: a used-up tree or a killed
// goblin frees one place and a spawner takes it, as for a player at the cap. Same shipped
// 11-step mat, same 8 heroes and flags as S2.
//
// * `cap128`: the base cap.
// * `camp128`: the Starter Camp at the base cap. Its 25 full-size endgame sites stand on the mat
//   without counting (Atlas D-1 B), so it draws 128 + 25 = 153 Tokens besides the Hall and quests.
//   Drawn here as S2's mix at 153; what the sites are matters less to the drawing than that they
//   are there.
// * `cap256`: the top cap. The mat has 72 free 160 u cells for placed Tokens, fewer than S2's
//   share of 256 (95), so every cell is built and more of the producers are swapped for Forests
//   and Quarries until the spawners can fill the rest: a denser, more spawned mat than S2.
//
// Drawing bench only (`?stress=cap128` …); the engine bench has no cap scenario.

import { buildBoard, REALISTIC_PLACED } from './realistic.mjs';

/** S2's placed share: 39 placed of the 105 Tokens that count toward the cap. */
const PLACED_SHARE = REALISTIC_PLACED.length / 105;

/** S2's list, repeated: the same mix of producers, stations, spawners and camps at any size. */
const PLACED_POOL = [...REALISTIC_PLACED, ...REALISTIC_PLACED, ...REALISTIC_PLACED];

/** Free 160 u cells for placed Tokens on the shipped 11-step mat (`buildBoard`'s lattice). */
export const SHIPPED_MAT_CELLS = 72;

/** How many Tokens a placed list's spawners fill to, at most. */
const SPAWNS = { bench_forest: 10, bench_quarry: 10, bench_camp: 3, bench_warcamp: 5 };
export const spawnRoom = (list) => list.reduce((n, t) => n + (SPAWNS[t] || 0), 0);

/**
 * The placed Tokens of a board at cap `n` (besides the Hall): S2's share and order, at most one
 * per free cell; when that is too few to reach `n`, producers from the end of the list become
 * Forests and Quarries in turn until the spawners can fill the rest.
 */
export function capPlaced(n, cells = SHIPPED_MAT_CELLS) {
    const k = Math.min(Math.round(n * PLACED_SHARE), cells);
    if (k > PLACED_POOL.length) throw new Error(`cap board: ${k} placed Tokens wanted, the pool has ${PLACED_POOL.length}`);
    const list = PLACED_POOL.slice(0, k);
    let swap = 0;
    for (let i = list.length - 1; i >= 0 && list.length + spawnRoom(list) < n; i--) {
        if (!/^fixture_producer/.test(list[i])) continue;
        list[i] = swap++ % 2 ? 'bench_quarry' : 'bench_forest';
    }
    return list;
}

function capScenario(id, name, n) {
    return {
        id,
        name,
        cap: n,
        ticks: () => ({ warmup: 1000, measure: 3000 }),
        build(ctx) {
            buildBoard(ctx, { placed: capPlaced(n), cap: n });
        }
    };
}

/** The base cap (Atlas D-9). */
export const cap128 = capScenario('C128', 'Realistic at cap 128', 128);
/** The Starter Camp at the base cap: 25 uncounted sites besides the 128 (Atlas D-1 B). */
export const camp128 = capScenario('K128', 'Starter Camp at cap 128 (153 Tokens)', 153);
/** The top cap (Atlas D-9). */
export const cap256 = capScenario('C256', 'Realistic at cap 256', 256);
