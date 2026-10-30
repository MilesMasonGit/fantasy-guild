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
import * as Growth from '../systems/board/Growth.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Time away in an orchard (brief 230 S2b): two pickers, each pinned to an apple tree. The first
 * tree has an Orchard in reach (Grow Time −30 %): picked bare, it rests 14 s instead of 20, fruits
 * again all at once, and is picked again, several times over. The second has none: picked bare
 * once, it stays Bare, its clock standing still, for the rest of the time away. The pickers' yields
 * draw from a seeded `Math.random`, so the same time in 100 ms steps, in 1000 ms steps and through
 * the game's own catch-up ends in the same place.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 3 * 60_000;
const APPLE = 'item_apple';

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerTokenTypes({
    ocu_orchard: {
        id: 'ocu_orchard', name: 'OCU Apple Orchard', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_orchard_red',
        statements: [{ id: 'stm_ocu_orchard', keyword: 'provides', to: { mode: 'id', value: 'ocu_tree' }, reach: 'nearby',
            payload: { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.3 } }]
    },
    ocu_tree: {
        id: 'ocu_tree', name: 'OCU Apple Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 3,
        sprite: 't_tree_apple', requiresHero: true, staysPut: true,
        respawn: { mode: 'refill', afterMs: 20000, restingSprite: 't_tree_oak', needsNearby: ['ocu_orchard'] },
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [],
            outputs: [{ itemId: APPLE, chance: 100, minQty: 1, maxQty: 2 }] }
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

const GROVE = { x: 600, y: 500 };
const LONE = { x: 1300, y: 500 };

function buildBoard() {
    stream.state = 31;
    stream.draws = 0;
    motion.state = 7;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    Growth.resetGrowthAlerts();
    const [a, b] = fixtures.makeHeroes(2, { farming: 10 });
    const grove = fixtures.placeAt('ocu_tree', GROVE.x, GROVE.y);
    fixtures.placeAt('ocu_orchard', GROVE.x + 150, GROVE.y);
    const lone = fixtures.placeAt('ocu_tree', LONE.x, LONE.y);
    fixtures.orderAt(a.id, { x: GROVE.x, y: GROVE.y });
    fixtures.orderAt(b.id, { x: LONE.x, y: LONE.y });
    TileModifiers.rebuildAll();
    return { grove: grove.id, lone: lone.id };
}

function watch(ids) {
    const seen = { cycles: { grove: 0, lone: 0 }, rested: { grove: 0, lone: 0 }, refilled: { grove: 0, lone: 0 } };
    const which = (id) => (id === ids.grove ? 'grove' : id === ids.lone ? 'lone' : null);
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { const k = which(p.instanceId); if (k) seen.cycles[k]++; }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_RESTING, (p) => { const k = which(p.instanceId); if (k) seen.rested[k]++; }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_RESPAWNED, (p) => { const k = which(p.instanceId); if (k) seen.refilled[k]++; })
    ];
    return { stop: () => { offs.forEach(off => off()); return seen; } };
}

const treeState = (id) => {
    const t = BoardState.getTokenById(id);
    return t ? { uses: t.usesRemaining, clocks: t.clocks ?? null, sprite: Respawn.restingSpriteOf(t), alert: Growth.growthAlertOf(id)?.alert ?? null } : null;
};

/** Where the time away ended. Apples are counted banked or lying on the mat: only the sum is the same. */
function snapshot(ids, seen) {
    return {
        seen,
        apples: InventoryManager.getItemCount(APPLE) + SpriteLayer.countOnBoard(APPLE),
        grove: treeState(ids.grove),
        lone: treeState(ids.lone),
        draws: stream.draws
    };
}

function plainLoop(step) {
    const ids = buildBoard();
    const w = watch(ids);
    for (let t = 0; t < AWAY_MS; t += step) GameLoop.runHandlers(step);
    return snapshot(ids, w.stop());
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

describe('⭐ a catch-up in an orchard: one tree with its Orchard, one without', () => {
    it('the first fruits again and again, the second stays Bare, the same in 100 ms and 1000 ms steps and through the catch-up', async () => {
        const small = plainLoop(100);
        const big = plainLoop(1000);
        expect(big).toEqual(small);

        const ids = buildBoard();
        const w = watch(ids);
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        expect(snapshot(ids, w.stop())).toEqual(small);

        // What happened: the grove tree rested and refilled several times; the lone tree was
        // picked bare once and never came back, its clock never started, saying it needs an Orchard.
        expect(small.seen.rested.grove).toBeGreaterThanOrEqual(3);
        expect(small.seen.refilled.grove).toBeGreaterThanOrEqual(small.seen.rested.grove - 1);
        expect(small.seen.rested.lone).toBe(1);
        expect(small.seen.refilled.lone).toBe(0);
        expect(small.seen.cycles.lone).toBe(3);
        expect(small.lone.uses).toBe(0);
        expect(Number(small.lone.clocks?.respawnMs) || 0).toBe(0);
        expect(small.lone.alert).toBe('grow_needs_nearby');
    }, 60_000);
});
