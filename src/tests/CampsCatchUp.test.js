// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as Growth from '../systems/board/Growth.js';
import * as Orders from '../systems/board/Orders.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { withoutShippedPerks } from './fixtures/noPerks.js';

// ⚠️ No chance roll may matter here: Tokens finishing inside one 1000 ms step draw in board order,
// ten 100 ms ticks in time order. The shipped perks would add rolls (Clean Felling, Green Thumb).
withoutShippedPerks();

/**
 * Time away with heroes working from camps (brief 260 O2).
 *
 * Work camps, the same in 100 ms steps, in 1000 ms steps and through the game's own catch-up: two
 * woodcutters on a Logging Camp with five trees in its reach, each used up in three 2.3 s cycles
 * (so every move to the next tree starts part-way through a tick), and a farmer on a Farmstead with
 * two ripe Fields that sow again and ripen part-way through ticks. Which Token each hero takes and
 * when they move on is part of the catch-up's work: a hero's leftover from the Token they finished
 * is handed to the next (`BoardRunner`'s hero carry), as a Token's is to its own next cycle.
 *
 * Fights and refills, the same through the catch-up as in the plain loop's 1000 ms steps (the
 * combat catch-up's own standard): a hunter at an enemy camp whose goblins come one at a time, and
 * woodcutters waiting on trees that rest and refill.
 */

const NOW = 1_800_000_000_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const SEED = 'fixture_ccu_seed';
const WHEAT = 'fixture_ccu_wheat';
const CROP = 'ccu_recipe_wheat';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({ [SEED]: item(SEED, 'CCU Wheat Seed'), [WHEAT]: item(WHEAT, 'CCU Wheat') });
registerRecipePools({
    farming: [{
        id: CROP, name: 'CCU Wheat', levelRequirement: 1, durationMs: 1300, xp: 1, stationKinds: ['field'],
        inputs: [{ itemId: SEED, quantity: 1 }],
        outputs: [{ itemId: WHEAT, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 6_570, load: 3 }
    }]
});

const plain = (id, name, extra) => ({ id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra });
const camp = (id, name, skill) => ({
    id, name, tokenType: 'camp', rarity: 'common', theme: 'fixture', uses: null,
    sprite: 's_nature', requiresHero: false, config: null, camp: { skill, reach: 320 }
});
const chop = (ms) => ({ skill: 'forestry', skillRequired: 1, cycleTimeMs: ms, xp: 1, inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }] });
registerTokenTypes({
    ccu_logging: camp('ccu_logging', 'CCU Logging Camp', 'forestry'),
    ccu_farmstead: camp('ccu_farmstead', 'CCU Farmstead', 'farming'),
    /** Used up in three cycles and gone. */
    ccu_tree: plain('ccu_tree', 'CCU Tree', { uses: 3, requiresHero: true, config: chop(2_300) }),
    /** Rests when used up and refills where it stands. */
    ccu_resting_tree: plain('ccu_resting_tree', 'CCU Resting Tree', {
        uses: 3, requiresHero: true, respawn: { mode: 'refill', afterMs: 9_500 }, config: chop(2_300)
    }),
    ccu_field: plain('ccu_field', 'CCU Field', {
        tokenType: 'station', requiresHero: true, field: { startsWith: CROP },
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 1300, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_ccu_field', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
    }),
    ccu_goblin: {
        id: 'ccu_goblin', name: 'CCU Goblin', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 's_occult', enemy: { level: 1, style: 'melee', budgetScale: 0.3 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }] }
    },
    ccu_den: {
        id: 'ccu_den', name: 'CCU Den', tokenType: 'spawner', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'ccu_goblin', weight: 1 }], allowance: 1, intervalMs: 7_300, upkeep: [] }
    }
});

/** A seeded `Math.random` (mulberry32) that counts its draws, as the bench's prelude does. */
const stream = { state: 1, draws: 0 };
function seeded() {
    stream.draws++;
    stream.state = (stream.state + 0x6D2B79F5) | 0;
    let t = stream.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const realRandom = Math.random;
const motion = { state: 7 };
function motionRandom() {
    motion.state = (motion.state + 0x6D2B79F5) | 0;
    let t = motion.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const LOGGING = { x: 600, y: 500 };
const TREES = [{ x: 720, y: 500 }, { x: 600, y: 680 }, { x: 440, y: 560 }, { x: 760, y: 680 }, { x: 600, y: 340 }];
const FARMSTEAD = { x: 1300, y: 500 };
const FIELDS = [{ x: 1430, y: 500 }, { x: 1300, y: 690 }];
const DEN = { x: 1300, y: 250 };

/** A fresh board with the seeded streams rewound. */
function freshBoard() {
    stream.state = 41;
    stream.draws = 0;
    motion.state = 7;
    resetMatTuning();
    setMatTuning('questCap', 0);
    GameState.initNew();
    InventoryManager.init();
    Growth.resetGrowthAlerts();
    BoardCombat.clearAll();
}

/** Work camps: two woodcutters among five trees, a farmer between two Fields. */
function workCamps() {
    freshBoard();
    const heroes = fixtures.makeHeroes(3, { forestry: 10, farming: 10 });
    fixtures.placeAt('ccu_logging', LOGGING.x, LOGGING.y);
    for (const p of TREES) fixtures.placeAt('ccu_tree', p.x, p.y);
    fixtures.placeAt('ccu_farmstead', FARMSTEAD.x, FARMSTEAD.y);
    for (const p of FIELDS) fixtures.placeAt('ccu_field', p.x, p.y);
    InventoryManager.addItem(SEED, 3);
    TileModifiers.rebuildAll();
    expect(Orders.orderAt(heroes[0].id, LOGGING).success).toBe(true);
    expect(Orders.orderAt(heroes[1].id, LOGGING).success).toBe(true);
    expect(Orders.orderAt(heroes[2].id, FARMSTEAD).success).toBe(true);
    return heroes.map(h => h.id);
}

/** Fights and refills: a hunter at a den, two woodcutters waiting on three resting trees. */
function huntAndRest() {
    freshBoard();
    const heroes = fixtures.makeHeroes(3, { forestry: 10, melee: 25 });
    fixtures.placeAt('ccu_logging', LOGGING.x, LOGGING.y);
    for (const p of TREES.slice(0, 3)) fixtures.placeAt('ccu_resting_tree', p.x, p.y);
    const den = fixtures.placeAt('ccu_den', DEN.x, DEN.y);
    SpawnerSystem.attemptSpawn(den, getTokenType('ccu_den'));
    TileModifiers.rebuildAll();
    expect(Orders.orderAt(heroes[0].id, LOGGING).success).toBe(true);
    expect(Orders.orderAt(heroes[1].id, LOGGING).success).toBe(true);
    expect(Orders.orderAt(heroes[2].id, DEN).success).toBe(true);
    return heroes.map(h => h.id);
}

/** A Token by where it stands (instance ids differ from run to run). */
const keyOf = (t) => (t ? (BoardCombat.isEnemyToken(t) ? t.typeId : `${t.typeId}@${t.x},${t.y}`) : 'gone');

/**
 * Each hero's cycles, in order, by the Token's place; and, given the loop's clock, the second each
 * finished in (`times`, rounded up: a 100 ms tick and a 1000 ms tick that hold the same moment
 * agree), so a move that loses time shows.
 */
function watch(heroes, clock = null) {
    const seen = { byHero: heroes.map(() => []), times: heroes.map(() => []), kills: 0 };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
            const i = heroes.indexOf(p.heroId);
            if (i < 0) return;
            seen.byHero[i].push(keyOf(BoardState.getTokenById(p.instanceId)));
            if (clock) seen.times[i].push(Math.ceil(clock() / 1000));
        }),
        EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, () => { seen.kills++; })
    ];
    return { seen, stop: () => { offs.forEach(off => off()); return seen; } };
}

const count = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);

function snapshot(heroes, seen) {
    return {
        byHero: seen.byHero.map(list => [...list]),
        kills: seen.kills,
        wood: count('fixture_oak_wood'),
        wheat: count(WHEAT),
        seeds: count(SEED),
        ore: count('fixture_copper_ore'),
        claims: heroes.map(id => {
            const c = BoardState.claimOfHero(id);
            return c ? keyOf(BoardState.getTokenById(c.instanceId)) : null;
        }),
        progress: BoardState.tokens().filter(t => !BoardCombat.isEnemyToken(t))
            .map(t => [keyOf(t), t.usesRemaining ?? null, t.cycleElapsedMs ?? 0, t.field ? { ...t.field } : null, t.clocks ? { ...t.clocks } : null])
            .sort((a, b) => a[0].localeCompare(b[0])),
        draws: stream.draws
    };
}

/** The plain loop in `step` ms ticks: a snapshot `firstMs` in (mid-work, every cycle's progress exact), and one at the end. */
function plainLoop(build, step, awayMs, firstMs = awayMs) {
    const heroes = build();
    let now = 0;
    const w = watch(heroes, () => now);
    for (; now < firstMs;) { now += step; GameLoop.runHandlers(step); }
    const first = snapshot(heroes, w.seen);
    for (; now < awayMs;) { now += step; GameLoop.runHandlers(step); }
    const seen = w.stop();
    return { first, end: snapshot(heroes, seen), times: seen.times };
}

/** The same through the game's own catch-up: one away to `firstMs`, the rest as a second away. */
async function caughtUp(build, awayMs, firstMs = awayMs) {
    const heroes = build();
    const w = watch(heroes);
    const away = { save: false, yieldFn: () => Promise.resolve() };
    await CatchUp.run({ ...away, savedAt: NOW - firstMs, now: NOW });
    const first = snapshot(heroes, w.seen);
    if (awayMs > firstMs) await CatchUp.run({ ...away, savedAt: NOW, now: NOW + awayMs - firstMs });
    return { first, end: snapshot(heroes, w.stop()), times: null };
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    Math.random = seeded;
    HeroMotion.setRandomForTests(motionRandom);
    EnemyMotion.setRandomForTests(motionRandom);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    Math.random = realRandom;
    HeroMotion.setRandomForTests();
    EnemyMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ a catch-up with heroes working from camps', () => {
    it('work camps: the same Tokens taken in the same order, moving on at the same moments, in 100 ms and 1000 ms steps and through the catch-up', async () => {
        const AWAY = 60_000;
        const FIRST = 17_000;
        const smallRun = plainLoop(workCamps, 100, AWAY, FIRST);
        const bigRun = plainLoop(workCamps, 1000, AWAY, FIRST);
        // Every cycle of every hero ends in the same second, and the end is the same.
        expect(bigRun.times).toEqual(smallRun.times);
        expect(bigRun.end).toEqual(smallRun.end);
        // The catch-up runs the plain loop's 1000 ms steps: the same mid-way and at the end.
        const caught = await caughtUp(workCamps, AWAY, FIRST);
        expect(caught.first).toEqual(bigRun.first);
        expect(caught.end).toEqual(smallRun.end);
        const small = smallRun.end;

        // And what happened: the woodcutters used up all five trees between them, three cycles
        // each, never sharing one (a tree's last cycle is counted as it leaves the mat, "gone"); the
        // farmer harvested both Fields over their loads, moving to the other while one grew, until
        // the three seeds were spent: five loads of three.
        const [a, b, farmer] = small.byHero;
        const trees = (list) => new Set(list.filter(k => k !== 'gone'));
        expect(a.length + b.length).toBe(15);
        expect(trees(a).size + trees(b).size).toBe(5);
        for (const key of trees(a)) expect(b).not.toContain(key);
        expect(small.wood).toBe(15);
        expect(farmer.length).toBe(15);
        expect(new Set(farmer).size).toBe(2);
        expect(farmer.slice(0, 6)).toEqual([...Array(3).fill(farmer[0]), ...Array(3).fill(farmer[3])]);
        expect(small.wheat).toBe(15);
        expect(small.seeds).toBe(0);
    }, 120_000);

    it('fights and refills: the catch-up ends where the plain loop’s 1000 ms steps end', async () => {
        const AWAY = 120_000;
        const run = plainLoop(huntAndRest, 1000, AWAY);
        const caught = await caughtUp(huntAndRest, AWAY);
        expect(caught.end).toEqual(run.end);
        const live = run.end;
        // The hunter beat goblin after goblin, one at a time; the woodcutters came back to rested trees.
        expect(live.kills).toBeGreaterThan(3);
        // Each kill drops one ore (the last may still be on its way to the floor).
        expect(live.ore).toBeGreaterThanOrEqual(live.kills - 1);
        expect(live.byHero[0].length + live.byHero[1].length).toBeGreaterThan(9 + 6);
    }, 120_000);
});
