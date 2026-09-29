// S4 — Push storm. Plan §4.1: 50 Tokens dropped into one crowded region, then
// the mat shrunk from 20 steps to 6. Target (plan §4.4): any single drop or
// shrink ≤ 8 ms.
//
// Not a tick benchmark: each operation is timed on its own.
//
//   1. On a 20-step mat: 60 placed Tokens on a lattice, and in the middle a
//      Forest packed round with spawned trees at the minimum gap.
//   2. ARRIVALS: 50 trees spawned from that Forest through the real
//      `EffectActions.spawn` (`nearest_free`) — the path a spawner, a Map burst
//      or a quest uses. Once the free spots are gone each one PUSHES
//      (`MatPlacement.forceSpot` → the relaxation solver, CR3-003).
//   3. REFUSED DROPS (by design, FP-46): 50 trees dropped by "hand" a little
//      off the Forest through `Placement.placeTokenAt` — nudge search, never
//      a push. The nearest free spot is beyond nudge reach, so every one is
//      refused (flies back). That is the game working as designed; this times
//      the refusal, the costliest failing search.
//   3b. LANDING DROPS (CR3-156): 50 more player drops aimed round the
//      cluster's rim — the radius is measured after the arrivals (the farthest
//      tree), at angles i × 2π/50 — where the nudge search works hardest and
//      still finds room. Each is recorded as placed / nudged / refused, with
//      the nudge distance. They are taken off again (untimed) before the
//      shrink, so the shrink's input is the same board as before.
//   4. SHRINK: the Mat Tuner's size 20 → 6 (`setMatTuning('matSteps', 6)`,
//      which runs `MatResize.fitToMat` and everything else listening).
//
// Work checkpoints (joined to the run's fingerprint, compared by --compare):
// a hash of every Token's id and exact point after the arrivals, after the
// landing drops and after the shrink, plus every count above.
//
// Each timing includes the events the operation publishes and whatever
// listens to them (the neighbourhood rebuilds), as the game would pay.

import * as EffectActions from '../../src/systems/board/EffectActions.js';
import * as Placement from '../../src/systems/board/Placement.js';
import * as MatPlacement from '../../src/systems/board/MatPlacement.js';
import * as BoardState from '../../src/systems/board/BoardState.js';
import { PLACEMENT } from '../../src/config/registries/placementRegistry.js';
import { summarise } from '../lib/stats.mjs';
import { tokensHash } from '../lib/fingerprint.mjs';

const CENTRE = { x: 1600, y: 1024 };

function packCluster({ placeAt }, bearer, count) {
    // A hexagonal packing at the minimum gap, nearest the bearer first.
    const gap = MatPlacement.minGap('bench_tree', 'bench_tree') + 1;
    const points = [];
    for (let r = -8; r <= 8; r++) {
        for (let q = -8; q <= 8; q++) {
            const x = CENTRE.x + gap * (q + r / 2);
            const y = CENTRE.y + gap * (r * Math.sqrt(3) / 2);
            points.push({ x, y, d: Math.hypot(x - CENTRE.x, y - CENTRE.y) });
        }
    }
    points.sort((a, b) => a.d - b.d);
    let n = 0;
    for (const p of points) {
        if (n >= count) break;
        if (!MatPlacement.isLegal('bench_tree', p)) continue;
        placeAt('bench_tree', p.x, p.y, BoardState.ORIGIN.SPAWNED);
        n++;
    }
    return n;
}

export default {
    id: 'S4',
    name: 'Push storm',

    build({ fixtures, setMatTuning }) {
        const { placeAt, lattice } = fixtures;
        setMatTuning('matSteps', 20);
        const types = ['fixture_producer', 'fixture_producer_alt', 'bench_mill', 'fixture_passive', 'fixture_buff_yield'];
        const cells = lattice(3200, 2048).filter(p => Math.hypot(p.x - CENTRE.x, p.y - CENTRE.y) > 420);
        // 60 placed Tokens, spread over the lattice.
        for (let i = 0; i < 60; i++) {
            const p = cells[Math.floor(i * cells.length / 60)];
            placeAt(types[i % types.length], p.x, p.y);
        }
        const bearer = placeAt('bench_forest', CENTRE.x, CENTRE.y);
        this.bearerId = bearer.id;
        this.clustered = packCluster(fixtures, bearer, 24);
    },

    async custom({ now, setMatTuning, fixtures }) {
        // --- 1. Arrivals: spawned from the Forest; they push once it's full.
        const arrivals = [];
        let arrivalsLanded = 0;
        for (let i = 0; i < 50; i++) {
            const t0 = now();
            const landed = EffectActions.spawn(
                { payload: { typeId: 'bench_tree', placement: PLACEMENT.NEAREST_FREE } },
                { self: this.bearerId },
                Math.random
            );
            arrivals.push(now() - t0);
            if (landed) arrivalsLanded++;
        }
        const positionsAfterArrivals = tokensHash();

        // --- 2. Refused drops (by design, FP-46). Aimed a little off the
        // Forest, in the middle of the packed cluster: the nearest free spot is
        // beyond nudge reach, and a player's drop never pushes, so every one
        // flies back. This times the refusal — the full search that fails.
        const refused = [];
        let refusedDropsLanded = 0;
        for (let i = 0; i < 50; i++) {
            const instance = BoardState.createTokenInstance('bench_tree', 40, null, BoardState.ORIGIN.SPAWNED);
            const aim = { x: CENTRE.x + 30, y: CENTRE.y + 10 };
            const t0 = now();
            const res = Placement.placeTokenAt(instance, aim);
            refused.push(now() - t0);
            if (res?.success) refusedDropsLanded++;
        }

        // --- 3. Landing drops (CR3-156): aimed round the cluster's rim, where
        // the nudge search works hardest and still finds room. The radius is
        // measured, not assumed: the farthest tree's centre from the Forest.
        const rimRadius = clusterRim();
        const landing = [];
        const landingStatus = { placed: 0, nudged: 0, refused: 0, restocked: 0 };
        const nudges = [];
        const dropped = [];
        for (let i = 0; i < 50; i++) {
            // A player's own Token (placed), so it can be taken off again below.
            const instance = BoardState.createTokenInstance('bench_tree', 40, null, BoardState.ORIGIN.PLACED);
            const angle = i * 2 * Math.PI / 50;
            const aim = { x: CENTRE.x + rimRadius * Math.cos(angle), y: CENTRE.y + rimRadius * Math.sin(angle) };
            const t0 = now();
            const res = Placement.placeTokenAt(instance, aim);
            landing.push(now() - t0);
            if (res?.restocked) landingStatus.restocked++;
            else if (!res?.success) landingStatus.refused++;
            else {
                dropped.push(instance.id);
                if (res.nudged) {
                    landingStatus.nudged++;
                    nudges.push(Math.hypot(res.x - aim.x, res.y - aim.y));
                } else {
                    landingStatus.placed++;
                }
            }
        }
        const positionsAfterDrops = tokensHash();

        // Take the landed drops off again, so the shrink below starts from the
        // same board as before this set existed (a drop never pushes, FP-46, so
        // nothing else moved) and stays comparable. Not timed.
        for (const id of dropped) Placement.removePlacedToken(id);

        // --- 4. Shrink the mat 20 → 6.
        const beforeShrink = fixtures.census();
        const t0 = now();
        setMatTuning('matSteps', 6);
        const shrinkMs = now() - t0;
        const positionsAfterShrink = tokensHash();

        const worst = (list) => (list.length ? Math.max(...list) : NaN);
        return {
            clustered: this.clustered,
            rimRadius,
            arrivals: { ...summarise(arrivals), landed: arrivalsLanded, worstMs: worst(arrivals) },
            refusedDrops: { ...summarise(refused), count: refused.length - refusedDropsLanded, landed: refusedDropsLanded, worstMs: worst(refused) },
            landingDrops: {
                ...summarise(landing),
                ...landingStatus,
                landed: landingStatus.placed + landingStatus.nudged,
                worstMs: worst(landing),
                nudgeMeanU: nudges.length ? nudges.reduce((a, b) => a + b, 0) / nudges.length : 0,
                nudgeMaxU: nudges.length ? Math.max(...nudges) : 0
            },
            shrink: { ms: shrinkMs, tokens: beforeShrink.tokens },
            shrinkMs,
            // Work, not time: these join the run's fingerprint (harness.mjs), so
            // --compare reports a change in any of them as WORK CHANGED.
            identity: {
                clustered: this.clustered,
                rimRadius,
                arrivalsLanded,
                refusedDropsLanded,
                landingPlaced: landingStatus.placed,
                landingNudged: landingStatus.nudged,
                landingRefused: landingStatus.refused,
                landingRestocked: landingStatus.restocked,
                positionsAfterArrivals,
                positionsAfterDrops,
                positionsAfterShrink
            }
        };
    }
};

/** The farthest tree centre from the Forest, after the arrivals — the cluster's rim. */
function clusterRim() {
    let rim = 0;
    for (const t of BoardState.tokens()) {
        if (t.typeId !== 'bench_tree') continue;
        rim = Math.max(rim, Math.hypot(t.x - CENTRE.x, t.y - CENTRE.y));
    }
    return rim;
}
