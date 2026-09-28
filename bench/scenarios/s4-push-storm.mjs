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
//   3. PLAYER DROPS: 50 more trees dropped by "hand" at the same point through
//      `Placement.placeTokenAt` — nudge search, never a push; a drop with no
//      room within nudge reach is refused (flies back), which is timed too.
//   4. SHRINK: the Mat Tuner's size 20 → 6 (`setMatTuning('matSteps', 6)`,
//      which runs `MatResize.fitToMat` and everything else listening).
//
// Each timing includes the events the operation publishes and whatever
// listens to them (the neighbourhood rebuilds), as the game would pay.

import * as EffectActions from '../../src/systems/board/EffectActions.js';
import * as Placement from '../../src/systems/board/Placement.js';
import * as MatPlacement from '../../src/systems/board/MatPlacement.js';
import * as BoardState from '../../src/systems/board/BoardState.js';
import { PLACEMENT } from '../../src/config/registries/placementRegistry.js';
import { summarise } from '../lib/stats.mjs';

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

        const drops = [];
        let dropsLanded = 0;
        for (let i = 0; i < 50; i++) {
            const instance = BoardState.createTokenInstance('bench_tree', 40, null, BoardState.ORIGIN.SPAWNED);
            // Aim a little off the Forest, as a hand would.
            const aim = { x: CENTRE.x + 30, y: CENTRE.y + 10 };
            const t0 = now();
            const res = Placement.placeTokenAt(instance, aim);
            drops.push(now() - t0);
            if (res?.success) dropsLanded++;
        }

        const beforeShrink = fixtures.census();
        const t0 = now();
        setMatTuning('matSteps', 6);
        const shrinkMs = now() - t0;

        const worst = (list) => Math.max(...list);
        return {
            clustered: this.clustered,
            arrivals: { ...summarise(arrivals), landed: arrivalsLanded, worstMs: worst(arrivals) },
            drops: { ...summarise(drops), landed: dropsLanded, worstMs: worst(drops) },
            shrink: { ms: shrinkMs, tokens: beforeShrink.tokens },
            // The headline §4.4 checks: the worst single operation of each kind.
            worstDropMs: Math.max(worst(arrivals), worst(drops)),
            shrinkMs
        };
    }
};
