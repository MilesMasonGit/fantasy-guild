// The board builder shared by S2, S3, S5 and S6 (and the S2 list itself), and the layout every board
// of S2's mix uses (`layoutSlots`: the cap boards and the envelope boards too).
//
// S2's board, on S2's 16-step mat (2560 × 1638 u, pinned: `referenceMat.mjs`):
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

import { pinMat, S2_MAT } from './referenceMat.mjs';

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

/**
 * How far from a spawner no other placed Token stands, by kind (`fixtures.spawnerKind`). A Forest or
 * a Quarry plants within its reach, and alone on the mat its ten land within 224 u of it, so nothing
 * placed within 224 + 128 u (a Token's width) takes a spot a tree could use: the twelve cells within
 * two steps stay free. An enemy camp's spawns land one Token's width out, 128 u, so the eight cells
 * round it stay free (128 + 128 u).
 */
const CLEARING = { planter: 352, camp: 256 };

/**
 * How far apart two spawners stand: two Forests or Quarries two reaches (480 u), so their reaches
 * never overlap; an enemy camp a reach and a Token's width (368 u) from any other spawner.
 */
const PLANTERS_APART = 480;
const CAMP_APART = 368;

/** How far in from every edge a spawner stands: a reach, so all of it lies on the mat. */
const EDGE = 240;

/** The Hall is a 2×2, 80 u wider than a Token (art radius 144 u against 64 u). */
const HALL_WIDER = 80;

/** The lattice cell nearest the middle of a `w` × `h` mat, where the Hall stands. */
export function hallCell(w, h) {
    return {
        x: MARGIN + STEP * Math.floor(Math.floor((w - 2 * MARGIN) / STEP) / 2),
        y: MARGIN + STEP * Math.floor(Math.floor((h - 2 * MARGIN) / STEP) / 2)
    };
}

/**
 * Cells for a board's placed Tokens on the 160 u lattice, without the Hall's own cell and its four
 * side cells. Every Token stands at least 160 u from the next, so legally (128 u, edges touching).
 *
 * ⚠️ At 128 u a Forest fits its ten trees only with its reach free: on a lattice of placed Tokens a
 * spawn fits only in a free cell's middle. So the spawners come first, each in its own clearing
 * ({@link CLEARING}), a reach in from the edge and apart from the others ({@link PLANTERS_APART});
 * then the rest in list order on the "even" cells, leaving the odd ones as room for spawns, any
 * overflow taking odd cells from the far end, never inside a clearing.
 *
 * `squeeze`: when the mat has no room for every spawner's clearing and the rest, the most spawners
 * (in list order) that leave room for the rest get theirs, and the others stand on ordinary cells
 * among the placed Tokens, where they find little room or none: a full mat. Without it a board that
 * does not fit throws.
 *
 * @returns {{slots: Array<{x: number, y: number}>, rest: Array<{x: number, y: number}>, cleared: number}}
 *          a cell per Token of `list`, the cells left free outside the clearings, and how many
 *          spawners have a clearing
 */
export function layoutSlots(fixtures, { w, h, hall, list, squeeze = false }) {
    const cells = fixtures.lattice(w, h, STEP, MARGIN).filter(p => Math.hypot(p.x - hall.x, p.y - hall.y) > STEP * 1.0625);
    const col = (p) => Math.round((p.x - MARGIN) / STEP);
    const row = (p) => Math.round((p.y - MARGIN) / STEP);
    const even = cells.filter(p => (col(p) + row(p)) % 2 === 0);
    const odd = cells.filter(p => (col(p) + row(p)) % 2 === 1).reverse();
    const order = [...even, ...odd];
    const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r;
    const inside = (p) => p.x >= EDGE && p.y >= EDGE && p.x <= w - EDGE && p.y <= h - EDGE;
    const kinds = list.map(t => fixtures.spawnerKind(t));

    const attempt = (most) => {
        const taken = new Set();
        const spawners = [];
        const cleared = (p) => spawners.some(q => near(p, q, CLEARING[q.kind]));
        const slots = new Array(list.length);
        list.forEach((typeId, i) => {
            const kind = kinds[i];
            if (!kind || spawners.length >= most) return;
            const apart = (q) => (kind === 'planter' && q.kind === 'planter' ? PLANTERS_APART : CAMP_APART);
            const cell = order.find(p => inside(p) && !near(p, hall, CLEARING[kind] + HALL_WIDER) && !spawners.some(q => near(p, q, apart(q))));
            if (!cell) return;
            spawners.push({ x: cell.x, y: cell.y, kind });
            taken.add(cell);
            slots[i] = cell;
        });
        for (let i = 0; i < list.length; i++) {
            if (slots[i]) continue;
            const cell = order.find(p => !taken.has(p) && !cleared(p));
            if (!cell) return null;
            taken.add(cell);
            slots[i] = cell;
        }
        return { slots, rest: order.filter(p => !taken.has(p) && !cleared(p)), cleared: spawners.length };
    };

    const count = kinds.filter(Boolean).length;
    for (let most = count; most >= (squeeze ? 0 : count); most--) {
        const got = attempt(most);
        if (got && (squeeze || got.cleared === count)) return got;
    }
    throw new Error(`board: ${list.length} placed Tokens, ${count} of them spawners, do not fit a ${w} × ${h} mat with every spawner's clearing`);
}

/**
 * Lay a board out and put 8 heroes on it.
 *
 * @param {object} ctx the harness context
 * @param {object} [options]
 * @param {string[]} [options.placed] placed Tokens besides the Hall, in order
 * @param {string[]} [options.extra]  more placed Tokens, after `placed`
 * @param {{steps: number, aspect: number}} [options.mat] the mat (`referenceMat.mjs`); S2's by default
 * @param {boolean}  [options.squeeze] spawners the mat has no clearing for stand among the rest
 *        ({@link layoutSlots}); otherwise a board that does not fit throws
 * @param {string[]} [options.late] placed AFTER the spawners are filled, on the
 *        next free cells — the board-reach aura goes here, so the prefill is not
 *        itself a few thousand whole-mat rebuilds (it would take seconds; that
 *        cost is what S3/S5 measure while ticking, not while building)
 * @param {number}   [options.cap] the Token cap to play under (the Mat Tuner's
 *        override); the spawners then fill the mat up to it and wait, as they do
 *        for a player at the cap. Unset: lifted out of the way (2000).
 */
export function buildBoard({ fixtures, setMatTuning }, { placed = REALISTIC_PLACED, extra = [], late = [], mat = S2_MAT, squeeze = false, cap = null } = {}) {
    const { placeAt, makeHeroes, orderAt } = fixtures;

    const { w, h } = pinMat(setMatTuning, mat.steps, mat.aspect);
    // ⚠️ These boards hold more than the game's Token cap (128, spawned Tokens included), so the
    // cap is lifted: with it, the spawners stall at 128 and every scenario measures a lighter
    // board than its baseline timings (S3 would lose more than half its Tokens).
    setMatTuning('tokenCap', cap ?? 2000);
    const hall = hallCell(w, h);

    // Loot sweeps into the Bank every 2.5 s, as an attentive player would.
    fixtures.settings.set('gameplay.autoCollectLoot', true);

    placeAt('bench_hall', hall.x, hall.y);

    const list = [...placed, ...extra];
    const { slots, rest } = layoutSlots(fixtures, { w, h, hall, list, squeeze });
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
