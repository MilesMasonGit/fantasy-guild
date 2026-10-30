// The Performance Envelope's boards (brief 90): the realistic mat at the base cap (`cap128`), with
// one thing turned up at a time, so each design limit is measured on its own.
//
//   cap<N>      S2's mix filled to a Token cap of N (as `cap.mjs`, any N: cap64, cap160, cap192…;
//               below ~96 S2's list holds fewer than two goblin camps, so the heroes S2 puts by
//               them go to producers instead)
//   heroes<N>   cap128 with N heroes instead of 8 (the roster's top is 8; more is headroom)
//   enemies<N>  cap128 with Forests and Quarries, then producers, swapped for war camps until N
//               goblins have room under the cap (they wander their camps; no hero is near the new
//               camps, so they do not fight)
//   fights<N>   cap128 with N of the 8 heroes each beside a camp of one tough, hostile brute that
//               never runs out: N fights going on at once, the rest as S2
//
// Loot piles and notifications are the same cap128 board with something done from a page timer
// (`bench/browser/scenes.mjs`: floor<N>, notify<N>).
//
// Drawing bench only (`?stress=heroes16` …); the engine bench runs none of these. The layout is
// S2's (`realistic.mjs`'s `buildBoard`), copied and parameterised here rather than changed there,
// so the engine bench's boards and their recorded work cannot move.

import { capPlaced } from './cap.mjs';
import { pinMat, REFERENCE_STEPS } from './referenceMat.mjs';
import { registerTokenTypes } from '../../src/config/registries/tokenRegistry.js';

const BASE_CAP = 128;
const STEP = 160;
const MARGIN = 80;

// Registered here, not in `fixtures.mjs`, so no other scenario's work changes.
registerTokenTypes({
    /**
     * A hostile brute that never runs out (a kill costs one of 1000 uses; it is back at full HP
     * after the 2 s pause and ambushes again): a fight that keeps going for as long as a hero
     * stands by its camp. Tougher than a goblin, so a fight lasts several blows.
     */
    env_brute: {
        id: 'env_brute', name: 'Envelope Brute', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 1000, sprite: 's_crime', requiresHero: true,
        enemy: { level: 1, style: 'melee', budgetScale: 0.4, hostile: true },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0,
            inputs: [],
            outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }]
        }
    },
    /** Its camp: one brute. */
    env_brute_camp: {
        id: 'env_brute_camp', name: 'Envelope Brute Camp', tokenType: 'spawner',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'env_brute', weight: 1 }], allowance: 1, intervalMs: 30000, upkeep: [] }
    }
});

const GOBLINS = { bench_camp: 3, bench_warcamp: 5 };
const goblinRoom = (list) => list.reduce((n, t) => n + (GOBLINS[t] || 0), 0);
const isProducer = (t) => /^fixture_producer/.test(t);

/**
 * cap128's placed list with room for `n` goblins. The cap leaves 80 places for spawned Tokens, and
 * a Forest refills every 5 s where a camp waits 30 s, so trees take any room a camp could use:
 * Forests and Quarries beyond what the other 80 − n places hold become war camps first, then
 * producers, until the camps hold `n`.
 */
export function enemyPlaced(n) {
    const list = capPlaced(BASE_CAP);
    const room = BASE_CAP - list.length;
    const isTrees = (t) => t === 'bench_forest' || t === 'bench_quarry';
    let trees = list.filter(isTrees).length;
    for (let i = list.length - 1; i >= 0 && trees * 10 > room - n; i--) {
        if (isTrees(list[i])) { list[i] = 'bench_warcamp'; trees--; }
    }
    for (let i = list.length - 1; i >= 0 && goblinRoom(list) < n; i--) {
        if (isProducer(list[i])) list[i] = 'bench_warcamp';
    }
    return list;
}

/** cap128's placed list with producers swapped for brute camps, `n` of them. */
export function fightPlaced(n) {
    const list = capPlaced(BASE_CAP);
    let made = 0;
    for (let i = list.length - 1; i >= 0 && made < n; i--) {
        if (isProducer(list[i])) { list[i] = 'env_brute_camp'; made++; }
    }
    return list;
}

/**
 * S2's layout (`realistic.mjs`) with a hero count and fighters: `fighters` heroes beside brute
 * camps first, then (as S2) one pinned to a smelter and two beside goblin camps while heroes are
 * left, the rest on producers spread across the list.
 */
function buildEnvelope({ fixtures, setMatTuning }, { placed, cap = BASE_CAP, heroes: heroCount = 8, fighters = 0 }) {
    const { placeAt, makeHeroes, orderAt, lattice } = fixtures;
    setMatTuning('tokenCap', cap);
    const matSteps = REFERENCE_STEPS;
    const { w, h } = pinMat(setMatTuning, matSteps);
    const hall = { x: MARGIN + STEP * Math.floor((matSteps - 1) / 2), y: MARGIN + STEP * Math.floor((Math.floor((h - 2 * MARGIN) / STEP)) / 2) };
    fixtures.settings.set('gameplay.autoCollectLoot', true);
    placeAt('bench_hall', hall.x, hall.y);

    const cells = lattice(w, h, STEP, MARGIN).filter(p => Math.hypot(p.x - hall.x, p.y - hall.y) > 170);
    const col = (p) => Math.round((p.x - MARGIN) / STEP);
    const row = (p) => Math.round((p.y - MARGIN) / STEP);
    const even = cells.filter(p => (col(p) + row(p)) % 2 === 0);
    const odd = cells.filter(p => (col(p) + row(p)) % 2 === 1).reverse();
    const slots = [...even, ...odd];
    if (placed.length > slots.length) throw new Error(`envelope board: ${placed.length} placed Tokens but only ${slots.length} cells`);
    const tokens = placed.map((typeId, i) => placeAt(typeId, slots[i].x, slots[i].y));
    fixtures.inventory.addItem('item_coal', 4, 'bench');
    fixtures.prefillSpawners();

    const heroes = makeHeroes(heroCount);
    const producers = tokens.filter(t => t.typeId === 'fixture_producer' || t.typeId === 'fixture_producer_alt');
    const camps = tokens.filter(t => t.typeId === 'bench_camp' || t.typeId === 'bench_warcamp');
    const bruteCamps = tokens.filter(t => t.typeId === 'env_brute_camp');
    const smelter = tokens.find(t => t.typeId === 'bench_smelter');
    if (bruteCamps.length < fighters) throw new Error(`envelope board: ${fighters} fighters but ${bruteCamps.length} brute camps`);

    const queue = [...heroes];
    for (let i = 0; i < fighters && queue.length; i++) orderAt(queue.shift().id, { x: bruteCamps[i].x + STEP, y: bruteCamps[i].y });
    if (queue.length && smelter) orderAt(queue.shift().id, { x: smelter.x, y: smelter.y });
    for (let i = 0; i < 2 && queue.length && camps[i]; i++) orderAt(queue.shift().id, { x: camps[i].x + (i ? -STEP : STEP), y: camps[i].y });
    const rest = queue.length;
    const spots = producers.length ? producers : tokens;
    queue.forEach((hero, i) => {
        const target = spots[Math.floor((i + 0.5) * spots.length / rest)];
        orderAt(hero.id, { x: target.x, y: target.y });
    });
    return { tokens, heroes, hall };
}

const PATTERN = /^(cap|heroes|enemies|fights)(\d+)$/i;
const ID_PREFIX = { cap: 'C', heroes: 'H', enemies: 'E', fights: 'F' };

/** The board a name like `heroes16` asks for, or null. */
export function envelopeScenario(name) {
    const m = PATTERN.exec(String(name || '').trim());
    if (!m) return null;
    const kind = m[1].toLowerCase();
    const n = Number(m[2]);
    if (!(n >= 0 && n <= 2000)) return null;
    const id = `${ID_PREFIX[kind]}${n}`;
    const ticks = () => ({ warmup: 1000, measure: 3000 });
    switch (kind) {
        case 'cap':
            if (n < 1) return null;
            return { id, name: `Realistic at cap ${n}`, cap: n, ticks, build(ctx) { buildEnvelope(ctx, { placed: capPlaced(n), cap: n }); } };
        case 'heroes':
            return { id, name: `cap128 with ${n} heroes`, ticks, build(ctx) { buildEnvelope(ctx, { placed: capPlaced(BASE_CAP), heroes: n }); } };
        case 'enemies':
            return { id, name: `cap128 with room for ${n} goblins`, ticks, build(ctx) { buildEnvelope(ctx, { placed: enemyPlaced(n) }); } };
        case 'fights':
            if (n > 8) return null;
            return { id, name: `cap128 with ${n} heroes fighting`, ticks, build(ctx) { buildEnvelope(ctx, { placed: fightPlaced(n), fighters: n }); } };
        default:
            return null;
    }
}

