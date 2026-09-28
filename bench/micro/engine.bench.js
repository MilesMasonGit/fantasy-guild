// Fantasy Guild bench — micro-benchmarks (`npm run bench:micro`).
//
// Vitest `bench` in the node environment (bench/micro/vitest.config.mjs) —
// never jsdom. Each hot function is measured on boards of 40, 150 and 300
// Tokens, so the output shows a growth curve rather than one number:
// linear growth is ~×3.75 then ×2 between the columns, quadratic ~×14 then ×4.
//
//   BoardState.tokens()               — the copy/filter/sort list (CR3-001)
//   nearby.tokensWithin               — "what is near this point" (CR3-003)
//   MatPlacement.forceSpot            — the push solver, via its public API (CR3-003)
//   Flags choosing                    — a re-plant, which releases and chooses again (CR3-002)
//   TileModifiers.rebuildAll          — with and without a board-reach aura (CR3-004)

import '../lib/prelude.mjs';
import { bench, describe } from 'vitest';
import { boot } from '../lib/harness.mjs';
import * as fixtures from '../fixtures.mjs';
import * as BoardState from '../../src/systems/board/BoardState.js';
import * as MatPlacement from '../../src/systems/board/MatPlacement.js';
import * as TileModifiers from '../../src/systems/board/TileModifiers.js';
import * as Flags from '../../src/systems/board/Flags.js';
import { tokensWithin } from '../../src/systems/board/nearby.js';
import { setMatTuning } from '../../src/config/matTuning.js';

const SIZES = [40, 150, 300];
const CENTRE = { x: 1600, y: 1024 };
const TYPES = ['fixture_producer', 'fixture_producer_alt', 'bench_mill', 'fixture_passive', 'fixture_buff_yield'];

/**
 * A board of `n` Tokens on a 20-step mat: 25 spawned trees packed at the
 * minimum gap round the centre — one ON the centre, so a drop there must push —
 * and the rest placed on a 128 u lattice. One hero. Optionally a board-reach aura.
 */
function buildBoard(n, { aura = false } = {}) {
    boot(1);
    setMatTuning('matSteps', 20);
    const gap = MatPlacement.minGap('bench_tree', 'bench_tree') + 1;
    let placed = 0;
    const hex = [];
    for (let r = -4; r <= 4; r++) {
        for (let q = -4; q <= 4; q++) {
            const p = { x: CENTRE.x + gap * (q + r / 2), y: CENTRE.y + gap * (r * Math.sqrt(3) / 2) };
            hex.push({ ...p, d: Math.hypot(p.x - CENTRE.x, p.y - CENTRE.y) });
        }
    }
    hex.sort((a, b) => a.d - b.d);
    for (const p of hex) {
        if (placed >= 25) break;
        if (!MatPlacement.isLegal('bench_tree', p)) continue;
        fixtures.placeAt('bench_tree', p.x, p.y, BoardState.ORIGIN.SPAWNED);
        placed++;
    }
    const cells = fixtures.lattice(3200, 2048, 128, 80).filter(p => Math.hypot(p.x - CENTRE.x, p.y - CENTRE.y) > 420);
    for (let i = 0; placed < n - (aura ? 1 : 0); i++, placed++) {
        const p = cells[i];
        fixtures.placeAt(TYPES[i % TYPES.length], p.x, p.y);
    }
    if (aura) fixtures.placeAt('bench_board_aura', cells[cells.length - 1].x, cells[cells.length - 1].y);
    const [hero] = fixtures.makeHeroes(1);
    TileModifiers.rebuildAll();
    return { heroId: hero.id, fixedIds: BoardState.placedTokenIds() };
}

for (const n of SIZES) {
    describe(`${n} Tokens`, () => {
        let ctx;
        const setup = (opts) => () => { ctx = buildBoard(n, opts); };
        const options = (opts = {}) => ({ time: 400, warmupTime: 100, setup: setup(opts) });

        bench('BoardState.tokens()', () => {
            BoardState.tokens();
        }, options());

        bench('nearby.tokensWithin (Near radius)', () => {
            tokensWithin(CENTRE);
        }, options());

        bench('MatPlacement.forceSpot into the packed cluster (push solver)', () => {
            MatPlacement.forceSpot('bench_tree', CENTRE, { fixedIds: ctx.fixedIds });
        }, { ...options(), time: 1000 });

        let flip = false;
        bench('Flags choosing (re-plant, release + choose)', () => {
            flip = !flip;
            Flags.plant(ctx.heroId, flip ? CENTRE : { x: CENTRE.x + 500, y: CENTRE.y });
        }, options());

        bench('TileModifiers.rebuildAll', () => {
            TileModifiers.rebuildAll();
        }, options());

        bench('TileModifiers.rebuildAll with a board-reach aura', () => {
            TileModifiers.rebuildAll();
        }, options({ aura: true }));
    });
}
