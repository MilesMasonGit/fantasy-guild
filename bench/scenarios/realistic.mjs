// The board builder shared by S2, S3, S5 and S6 (and the S2 list itself).
//
// S2's board, on the shipped 11-step mat (1760 × 1126 u):
//   * the Guild Hall in the middle;
//   * 39 more PLACED Tokens: 20 producers,
//     3 fed mills, 3 unfeedable smelters, 3 passives, 2 nearby buffs,
//     3 Forests + 3 Quarries (10 spawned each, 60 in all) and 2 goblin camps
//     (3 hostile goblins each, walking about their camp);
//   * 8 heroes with flags, walking between their Tokens;
//   * one hero PINNED to a smelter that runs dry after two cycles: the
//     "stalled station with a hero standing on it" case (CR3-005);
//   * quest Tokens from the Hall (the tutorial step and bounties);
//   * loot dropping from every cycle, with auto-collect ON so the Bank moves.
//
// ⚠️ Auto-collect is off by default in the shipped settings (D-233) — the player
// collects by hovering. A late-game player collects, so the bench turns the
// 2.5 s sweep on to stand in for them; without it the Bank barely changes and
// every Bank-driven path (CR3-002, CR3-029) would be idle.

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
const ASPECT = 0.64;

/**
 * Lay a board out and put 8 heroes on it.
 *
 * @param {object} ctx the harness context
 * @param {object} [options]
 * @param {string[]} [options.placed] placed Tokens besides the Hall, in order
 * @param {string[]} [options.extra]  more placed Tokens, after `placed`
 * @param {number}   [options.matSteps] mat size (Mat Tuner, 6–20); 11 is shipped
 * @param {string[]} [options.late] placed AFTER the spawners are filled, on the
 *        next free cells — the board-reach aura goes here, so the prefill is not
 *        itself a few thousand whole-mat rebuilds (it would take seconds; that
 *        cost is what S3/S5 measure while ticking, not while building)
 * @param {number}   [options.cap] the Token cap to play under (the Mat Tuner's
 *        override); the spawners then fill the mat up to it and wait, as they do
 *        for a player at the cap. Unset: lifted out of the way (2000).
 */
export function buildBoard({ fixtures, setMatTuning }, { placed = REALISTIC_PLACED, extra = [], late = [], matSteps = 11, cap = null } = {}) {
    const { placeAt, makeHeroes, plant, lattice } = fixtures;

    if (matSteps !== 11) setMatTuning('matSteps', matSteps);
    // ⚠️ These boards hold more than the game's Token cap (80, spawned Tokens included), so the
    // cap is lifted: with it, the spawners stall at 80 and every scenario measures a lighter
    // board than its baseline timings (S3 would lose a third of its Tokens).
    setMatTuning('tokenCap', cap ?? 2000);
    const w = matSteps * STEP;
    const h = Math.round(w * ASPECT);
    const hall = { x: MARGIN + STEP * Math.floor((matSteps - 1) / 2), y: MARGIN + STEP * Math.floor((Math.floor((h - 2 * MARGIN) / STEP)) / 2) };

    // Loot sweeps into the Bank every 2.5 s, as an attentive player would.
    fixtures.settings.set('gameplay.autoCollectLoot', true);

    placeAt('bench_hall', hall.x, hall.y);

    // A 160 u lattice, minus the Hall's own cell and its four side cells.
    const cells = lattice(w, h, STEP, MARGIN).filter(p => Math.hypot(p.x - hall.x, p.y - hall.y) > 170);
    const col = (p) => Math.round((p.x - MARGIN) / STEP);
    const row = (p) => Math.round((p.y - MARGIN) / STEP);
    // Placed Tokens take the "even" cells first, leaving the odd ones as room
    // for spawns; any overflow takes odd cells from the far end.
    const even = cells.filter(p => (col(p) + row(p)) % 2 === 0);
    const odd = cells.filter(p => (col(p) + row(p)) % 2 === 1).reverse();
    const slots = [...even, ...odd];

    const list = [...placed, ...extra];
    if (list.length > slots.length) {
        throw new Error(`board: ${list.length} placed Tokens but only ${slots.length} cells on a ${matSteps}-step mat`);
    }
    const tokens = list.map((typeId, i) => placeAt(typeId, slots[i].x, slots[i].y));

    // The smelters' first two cycles: 4 coal. Then they are dry.
    fixtures.inventory.addItem('item_coal', 4, 'bench');

    // Spawned Tokens and goblins up to their caps before the heroes arrive,
    // so the warm-up is about a warm JIT, not a board still filling up.
    fixtures.prefillSpawners();
    for (const typeId of late) {
        const at = fixtures.freeSpot(typeId, slots.slice(list.length));
        if (at) tokens.push(placeAt(typeId, at.x, at.y));
    }

    const heroes = makeHeroes(8);
    const producers = tokens.filter(t => t.typeId === 'fixture_producer' || t.typeId === 'fixture_producer_alt');
    const camps = tokens.filter(t => t.typeId === 'bench_camp' || t.typeId === 'bench_warcamp');
    const smelter = tokens.find(t => t.typeId === 'bench_smelter');

    // Hero 0: pinned to a smelter that will run dry.
    plant(heroes[0].id, { x: smelter.x, y: smelter.y }, { pin: true });
    // Heroes 1–2: beside goblin camps, where the goblins will find them.
    plant(heroes[1].id, { x: camps[0].x + STEP, y: camps[0].y });
    plant(heroes[2].id, { x: camps[1].x - STEP, y: camps[1].y });
    // Heroes 3–7: on producers spread across the list. A flag reaches its
    // producer and the cells beside it, where spawned trees and rocks land.
    for (let i = 3; i < 8; i++) {
        const target = producers[Math.floor((i - 3 + 0.5) * producers.length / 5)];
        plant(heroes[i].id, { x: target.x, y: target.y });
    }

    return { tokens, heroes, hall };
}

/** S2's board. */
export function buildRealistic(ctx, options = {}) {
    return buildBoard(ctx, options);
}
