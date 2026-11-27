// The cap boards: S2's mix of Tokens with the Token cap set to a number and the mat filled up
// to it, for "how does the realistic mat draw at the cap?" (brief 60; the owner's cap,
// Atlas roadmap D-9: 128 to start, +16 a rank up to 256).
//
// S2 counts ~105 Tokens toward the cap (39 placed, 60 spawned trees and rocks, 6 goblins; the
// Hall never counts). A cap board keeps S2's share of placed Tokens (39 of 105)
// and its order (S2's list again and again), and lets the spawners fill the rest of the mat until
// the cap stops them, so the board ends at the cap and stays there: a used-up tree or a killed
// goblin frees one place and a spawner takes it, as for a player at the cap. Same layout
// (`realistic.mjs`, `layoutSlots`, squeezed), same 8 heroes and flags as S2.
//
// ⚠️ At 128 u apart the shipped mat holds about 130 Tokens even packed as a honeycomb, so no cap
// board stands on it: up to the base cap on S2's mat, above it on the cap mat (`capMat`).
//
// * `cap128`: the base cap, on S2's mat.
// * `camp128`: the Starter Camp at the base cap. Its 25 full-size endgame sites stand on the mat
//   without counting (Atlas D-1 B), so it draws 128 + 25 = 153 Tokens besides the Hall.
//   Drawn here as S2's mix at 153; what the sites are matters less to the drawing than that they
//   are there. On the cap mat.
// * `cap240`: on the cap mat, which holds about 250 of this mix: it reaches its cap and stays there.
// * `cap256`: the top cap, on the same mat: the mat fills before the cap does, so the spawners the
//   mat has no clearing for stand among the producers and miss every try for want of room.
//
// The drawing bench draws `cap128`, `camp128` and `cap256` (`?stress=cap128` …); the engine bench
// runs `cap240` and `cap256` as C240 and C256 (`c240-cap.mjs`, `c256-cap.mjs`).

import { buildBoard, REALISTIC_PLACED } from './realistic.mjs';
import { S2_MAT, CAP_MAT } from './referenceMat.mjs';

/** S2's placed share: 39 placed of the 105 Tokens that count toward the cap. */
const PLACED_SHARE = REALISTIC_PLACED.length / 105;

/** S2's list, repeated: the same mix of producers, stations, spawners and camps at any size. */
const PLACED_POOL = [...REALISTIC_PLACED, ...REALISTIC_PLACED, ...REALISTIC_PLACED];

/** The base cap (Atlas D-9). */
export const BASE_CAP = 128;

/** The mat a cap board of cap `n` stands on: S2's up to the base cap, the cap mat above it. */
export const capMat = (n) => (n <= BASE_CAP ? S2_MAT : CAP_MAT);

/** How many Tokens a placed list's spawners fill to, at most. */
export const SPAWNS = { bench_forest: 10, bench_quarry: 10, bench_camp: 3, bench_warcamp: 5 };
export const spawnRoom = (list) => list.reduce((n, t) => n + (SPAWNS[t] || 0), 0);

/**
 * The placed Tokens of a board at cap `n` (besides the Hall): S2's share and order, at most
 * `cells`; when that is too few to reach `n`, producers from the end of the list become
 * Forests and Quarries in turn until the spawners can fill the rest.
 */
export function capPlaced(n, cells = Infinity) {
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
            buildBoard(ctx, { placed: capPlaced(n), cap: n, mat: capMat(n), squeeze: true });
        }
    };
}

/** The base cap (Atlas D-9). */
export const cap128 = capScenario('C128', 'Realistic at cap 128', BASE_CAP);
/** The Starter Camp at the base cap: 25 uncounted sites besides the 128 (Atlas D-1 B). */
export const camp128 = capScenario('K128', 'Starter Camp at cap 128 (153 Tokens)', 153);
/** About what the cap mat holds of this mix: it reaches its cap. */
export const cap240 = capScenario('C240', 'Realistic at cap 240', 240);
/** The top cap (Atlas D-9). */
export const cap256 = capScenario('C256', 'Realistic at cap 256', 256);
