// The board builder shared by S2, S3, S5 and S6 (and the S2 list itself).
//
// S2's board, on the reference 11-step mat (1760 × 1126 u, pinned: `referenceMat.mjs`):
//   * the Guild Hall in the middle;
//   * 39 more PLACED Tokens: 20 producers,
//     3 fed mills, 3 unfeedable smelters, 3 passives, 2 nearby buffs,
//     3 Forests + 3 Quarries (10 spawned each, 60 in all) and 2 goblin camps
//     (3 goblins each, standing where they spawned);
//   * 8 heroes with flags, walking between their Tokens; two sent at the goblin camps, hunting
//     their goblins (S2's fights: a kill every 15 s or so, as each camp respawns one every 30 s);
//   * one hero PINNED to a smelter that runs dry after two cycles: the
//     "stalled station with a hero standing on it" case (CR3-005);
//   * loot dropping from every cycle, with auto-collect ON so the Bank moves.
//
// ⚠️ Auto-collect is off by default in the shipped settings (D-233) — the player
// collects by hovering. A late-game player collects, so the bench turns the
// 2.5 s sweep on to stand in for them; without it the Bank barely changes and
// every Bank-driven path (CR3-002, CR3-029) would be idle.

import { pinMat, REFERENCE_STEPS } from './referenceMat.mjs';

/** S2's placed Tokens besides the Hall, in placement order. */
export const REALISTIC_PLACED = [
    'bench_forest', 'fixture_producer', 'bench_quarry', 'fixture_producer_alt', 'bench_camp',
    'fixture_producer', 'bench_mill', 'fixture_producer_alt', 'bench_smelter', 'fixture_passive',
    'bench_forest', 'fixture_producer', 'fixture_buff_yield', 'fixture_producer_alt', 'bench_quarry',
    'fixture_producer', 'bench_mill', 'fixture_producer_alt', 'bench_smelter', 'fixture_passive',
    'bench_forest', 'fixture_producer', 'fixture_buff_speed', 'fixture_producer_alt', 'bench_camp',
    'fixture_producer', 'bench_quarry', 'fixture_producer_alt', 'bench_mill', 'fixture_passive',
    'fixture_producer', 'bench_smelter', 'fixture_producer_alt', 'fixture_producer', 'fixture_producer_alt',
    'fixture_producer', 'fixture_producer_alt', 'fixture_producer', 'fixture_producer_alt'
];

const STEP = 160;
const MARGIN = 80;
const CLEARING = 352;
const EDGE = 240;

/** The lattice cell nearest the middle of a `w` x `h` mat, where the Hall stands. */
export function hallCell(w, h, step = STEP, margin = MARGIN) {
    return { x: margin + step * Math.floor(Math.floor((w - 2 * margin) / step) / 2), y: margin + step * Math.floor(Math.floor((h - 2 * margin) / step) / 2) };
}

/**
 * Cells for a list of placed Tokens on a `step` lattice (EXPERIMENT).
 */
export function layoutSlots(fixtures, { w, h, hall, list, step = STEP, margin = MARGIN, clearing = CLEARING, campClearing = 240, edge = EDGE, apart = 480, campApart = 368, fallback = false }) {
    const cells = fixtures.lattice(w, h, step, margin).filter(p => Math.hypot(p.x - hall.x, p.y - hall.y) > step * 1.0625);
    const col = (p) => Math.round((p.x - margin) / step);
    const row = (p) => Math.round((p.y - margin) / step);
    const even = cells.filter(p => (col(p) + row(p)) % 2 === 0);
    const odd = cells.filter(p => (col(p) + row(p)) % 2 === 1).reverse();
    const order = [...even, ...odd];
    const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r;
    const inside = (p) => p.x >= edge && p.y >= edge && p.x <= w - edge && p.y <= h - edge;
    const attempt = (most) => {
        const taken = new Set();
        const spawners = [];
        const cleared = (p) => spawners.some(q => near(p, q, q.clear));
        const slots = new Array(list.length);
        // Pass 1: spawners their clearings, the first `most` of them.
        list.forEach((typeId, i) => {
            const kind = fixtures.spawnerKind(typeId);
            if (!kind || spawners.length >= most) return;
            const clear = kind === 'planter' ? clearing : campClearing;
            const gapTo = (q) => (kind === 'planter' && q.kind === 'planter' ? apart : campApart);
            const cell = order.find(p => inside(p) && !spawners.some(q => near(p, q, gapTo(q))) && !near(p, hall, clear + 80));
            if (!cell) return;
            spawners.push({ x: cell.x, y: cell.y, clear, kind });
            taken.add(cell);
            slots[i] = cell;
        });
        // Pass 2: the rest, outside every clearing.
        for (let i = 0; i < list.length; i++) {
            if (slots[i]) continue;
            const cell = order.find(p => !taken.has(p) && !cleared(p));
            if (!cell) return null;
            taken.add(cell);
            slots[i] = cell;
        }
        return { slots, rest: order.filter(p => !taken.has(p) && !cleared(p)), cleared: spawners.length };
    };
    const count = list.filter(t => fixtures.spawnerKind(t)).length;
    for (let most = count; most >= (fallback ? 0 : count); most--) {
        const got = attempt(most);
        if (got && (fallback || got.cleared === count)) return got;
    }
    throw new Error(`board: ${list.length} placed Tokens with ${count} spawners do not fit a ${w} x ${h} mat`);
}

/**
 * Lay a board out and put 8 heroes on it.
 *
 * @param {object} ctx the harness context
 * @param {object} [options]
 * @param {string[]} [options.placed] placed Tokens besides the Hall, in order
 * @param {string[]} [options.extra]  more placed Tokens, after `placed`
 * @param {number}   [options.matSteps] mat size (Mat Tuner, 6–20) at the reference aspect; 11 is the reference
 * @param {string[]} [options.late] placed AFTER the spawners are filled, on the
 *        next free cells — the board-reach aura goes here, so the prefill is not
 *        itself a few thousand whole-mat rebuilds (it would take seconds; that
 *        cost is what S3/S5 measure while ticking, not while building)
 * @param {number}   [options.cap] the Token cap to play under (the Mat Tuner's
 *        override); the spawners then fill the mat up to it and wait, as they do
 *        for a player at the cap. Unset: lifted out of the way (2000).
 */
export function buildBoard({ fixtures, setMatTuning }, { placed = REALISTIC_PLACED, extra = [], late = [], matSteps = REFERENCE_STEPS, cap = null, step = STEP, margin = MARGIN, aspect, clearing = CLEARING, campClearing, edge = EDGE, apart, campApart, fallback } = {}) {
    const { placeAt, makeHeroes, orderAt, lattice } = fixtures;

    const { w, h } = pinMat(setMatTuning, matSteps, aspect);
    const STEP = step;
    const MARGIN = margin;
    // ⚠️ These boards hold more than the game's Token cap (80, spawned Tokens included), so the
    // cap is lifted: with it, the spawners stall at 80 and every scenario measures a lighter
    // board than its baseline timings (S3 would lose a third of its Tokens).
    setMatTuning('tokenCap', cap ?? 2000);
    const hall = hallCell(w, h, STEP, MARGIN);

    // Loot sweeps into the Bank every 2.5 s, as an attentive player would.
    fixtures.settings.set('gameplay.autoCollectLoot', true);

    placeAt('bench_hall', hall.x, hall.y);

    const { slots, rest } = layoutSlots(fixtures, { w, h, hall, list: [...placed, ...extra], step: STEP, margin: MARGIN, clearing, campClearing, edge, apart, campApart, fallback });
    const list = [...placed, ...extra];
    const tokens = list.map((typeId, i) => placeAt(typeId, slots[i].x, slots[i].y));

    // The smelters' first two cycles: 4 coal. Then they are dry.
    fixtures.inventory.addItem('item_coal', 4, 'bench');

    // Spawned Tokens and goblins up to their caps before the heroes arrive,
    // so the warm-up is about a warm JIT, not a board still filling up.
    fixtures.prefillSpawners();
    for (const typeId of late) {
        const at = fixtures.freeSpot(typeId, rest);
        if (at) tokens.push(placeAt(typeId, at.x, at.y));
    }

    const heroes = makeHeroes(8);
    const producers = tokens.filter(t => t.typeId === 'fixture_producer' || t.typeId === 'fixture_producer_alt');
    const camps = tokens.filter(t => t.typeId === 'bench_camp' || t.typeId === 'bench_warcamp');
    const smelter = tokens.find(t => t.typeId === 'bench_smelter');

    // Hero 0: ordered onto a smelter that will run dry.
    orderAt(heroes[0].id, { x: smelter.x, y: smelter.y });
    // Heroes 1–2: each sent at a goblin camp, as the player's drop on it sends them (enemies never
    // start a fight): they hunt its goblins one by one and wait by it for the next spawn.
    for (let i = 1; i <= 2; i++) {
        const camp = camps[i - 1];
        const sent = orderAt(heroes[i].id, { x: camp.x, y: camp.y });
        if (!sent.success || sent.instanceId !== camp.id) {
            throw new Error(`board: hero ${i} could not be sent at goblin camp ${i - 1}`);
        }
    }
    // Heroes 3–7: each ordered onto a producer, spread across the list.
    for (let i = 3; i < 8; i++) {
        const target = producers[Math.floor((i - 3 + 0.5) * producers.length / 5)];
        orderAt(heroes[i].id, { x: target.x, y: target.y });
    }

    return { tokens, heroes, hall };
}

/** S2's board. */
export function buildRealistic(ctx, options = {}) {
    return buildBoard(ctx, options);
}
