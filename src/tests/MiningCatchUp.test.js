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
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as Respawn from '../systems/board/Respawn.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { withoutShippedPerks } from './fixtures/noPerks.js';

// The miner is Mining 10: a shipped perk would change the cycle this test sets.
withoutShippedPerks();

/**
 * Time away beside a vein (brief 230 S3): a miner works a five-ore vein sped by one Minecart
 * (2.5 s → 1.875 s a cycle) with two Mines in reach (each 25 % to double the ore). It runs out,
 * rests 10 s, refills all at once, and is worked again, several times over. ⚠️ The cycle is not a
 * whole second on purpose: the vein runs out part-way through a 1000 ms step, and its rest must
 * start when that cycle ended, not when the step did. The Mines' rolls draw from
 * a seeded `Math.random` in fixed places of each finished cycle, so the same time played in
 * 100 ms steps, in 1000 ms steps and through the game's own catch-up ends in the same place: the
 * same cycles, the same doubles, the same ore, the vein at the same charge and clock.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 3 * 60_000;
const ORE = 'fixture_copper_ore';

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const provides = (id, type, bucket, value, target, extra = {}) => ({
    id: `stm_${id}`, keyword: 'provides', to: { mode: 'id', value: target }, reach: 'nearby',
    payload: { type, bucket, value, ...extra }
});

registerTokenTypes({
    mcu_vein: {
        id: 'mcu_vein', name: 'MCU Copper Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 5,
        sprite: 't_ore_vein_copper', requiresHero: true, staysPut: true,
        respawn: { mode: 'refill', afterMs: 10000, restingSprite: 't_vein_stone' },
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 2500, xp: 1, inputs: [], outputs: [{ itemId: ORE, quantity: 1, chance: 100 }] }
    },
    mcu_mine: {
        id: 'mcu_mine', name: 'MCU Copper Mine', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_mine_copper',
        statements: [provides('mcu_mine', EFFECT_TYPES.DOUBLE_DROP, 'flat', 25, 'mcu_vein', { category: ORE })]
    },
    mcu_cart: {
        id: 'mcu_cart', name: 'MCU Minecart', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_minecart_copper',
        statements: [provides('mcu_cart', EFFECT_TYPES.WORK_TIME, 'percentage', -0.25, 'mcu_vein')]
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
/**
 * The heroes' and enemies' footsteps get a stream of their own: they draw per tick, so ten 100 ms
 * ticks draw more than one 1000 ms tick, and sharing would shift the Mines' rolls by step size.
 */
const motion = { state: 7 };
function motionRandom() {
    motion.state = (motion.state + 0x6D2B79F5) | 0;
    let t = motion.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const VEIN = { x: 700, y: 500 };

function buildBoard() {
    stream.state = 31;
    stream.draws = 0;
    motion.state = 7;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [miner] = fixtures.makeHeroes(1, { mining: 10 });
    const vein = fixtures.placeAt('mcu_vein', VEIN.x, VEIN.y);
    fixtures.placeAt('mcu_cart', VEIN.x + 150, VEIN.y);
    fixtures.placeAt('mcu_mine', VEIN.x - 150, VEIN.y);
    fixtures.placeAt('mcu_mine', VEIN.x, VEIN.y + 150);
    fixtures.orderAt(miner.id, { x: VEIN.x, y: VEIN.y });
    TileModifiers.rebuildAll();
    return vein.id;
}

function watch(veinId) {
    const seen = { cycles: 0, ore: [], cycleMs: new Set(), rested: 0, refilled: 0 };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.instanceId === veinId) { seen.cycles++; seen.ore.push(InventoryManager.getItemCount(ORE) + SpriteLayer.countOnBoard(ORE)); } }),
        EventBus.subscribe(BOARD_EVENTS.PROGRESS, (p) => { if (p.instanceId === veinId && p.cycleTimeMs != null) seen.cycleMs.add(p.cycleTimeMs); }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_RESTING, (p) => { if (p.instanceId === veinId) seen.rested++; }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_RESPAWNED, (p) => { if (p.instanceId === veinId) seen.refilled++; })
    ];
    return { stop: () => { offs.forEach(off => off()); return seen; } };
}

/** Where the time away ended. Ore is counted banked or lying on the mat: only the sum is the same. */
function snapshot(veinId, seen) {
    const vein = BoardState.getTokenById(veinId);
    return {
        cycles: seen.cycles,
        rested: seen.rested,
        refilled: seen.refilled,
        ore: InventoryManager.getItemCount(ORE) + SpriteLayer.countOnBoard(ORE),
        uses: vein?.usesRemaining ?? null,
        clocks: vein?.clocks ?? null,
        restingSprite: vein ? Respawn.restingSpriteOf(vein) : null,
        draws: stream.draws
    };
}

function plainLoop(step) {
    const id = buildBoard();
    const w = watch(id);
    for (let t = 0; t < AWAY_MS; t += step) GameLoop.runHandlers(step);
    const seen = w.stop();
    return { snap: snapshot(id, seen), seen };
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

describe('⭐ a catch-up beside a vein with a Minecart and two Mines in reach', () => {
    it('rests and refills, doubling the same ore, the same in 100 ms and 1000 ms steps and through the catch-up', async () => {
        const small = plainLoop(100);
        const big = plainLoop(1000);
        expect(big.snap).toEqual(small.snap);
        expect(big.seen.ore).toEqual(small.seen.ore);

        const id = buildBoard();
        const w = watch(id);
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const seen = w.stop();
        expect(snapshot(id, seen)).toEqual(small.snap);
        expect(seen.ore).toEqual(small.seen.ore);

        // And what happened: the Minecart's 1.875 s cycle, several rests each followed by a refill,
        // and the Mines doubling some ore but not all (two Mines: about half).
        expect([...small.seen.cycleMs]).toEqual([1875]);
        expect(small.snap.rested).toBeGreaterThanOrEqual(5);
        expect(small.snap.refilled).toBeGreaterThanOrEqual(small.snap.rested - 1);
        // One ore a cycle, some of it doubled: more than one a cycle, fewer than two.
        expect(small.snap.ore).toBeGreaterThan(small.snap.cycles);
        expect(small.snap.ore).toBeLessThan(2 * small.snap.cycles);
    }, 60_000);
});
