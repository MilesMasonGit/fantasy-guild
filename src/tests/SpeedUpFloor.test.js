import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { MAX_SPEED_UP_CUT } from '../config/loopConstants.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { clearMat, placeAt } from './fixtures/mat.js';

/**
 * The standard floor for speed-ups (brief 230 S1a; owner, 2026-10-24): stacked supports cut at
 * most 80 % of a time. Five Minecarts at −20 % each would take a 10 s vein to nothing; the floor
 * holds it at 2 s, and the engine's own 1 s floor still holds beneath that.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const mining = (cycleTimeMs) => ({
    skill: 'mining', skillRequired: 1, cycleTimeMs, xp: 1,
    inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }]
});
const minecart = (id, value, target) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_industry',
    statements: [{
        id: `stm_${id}`, keyword: 'provides', to: { mode: 'id', value: target },
        payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value }
    }]
});

registerTokenTypes({
    s1a_vein: {
        id: 's1a_vein', name: 'S1a Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 1000, sprite: 's_industry', config: mining(10000)
    },
    s1a_quick_vein: {
        id: 's1a_quick_vein', name: 'S1a Quick Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 1000, sprite: 's_industry', config: mining(3000)
    },
    s1a_minecart: minecart('s1a_minecart', -0.2, 's1a_vein'),
    s1a_quick_cart: minecart('s1a_quick_cart', -0.2, 's1a_quick_vein'),
    s1a_slow_cart: minecart('s1a_slow_cart', 0.5, 's1a_vein')
});

const VEIN = { x: 800, y: 600 };
/** `n` points on a 150 u ring round the vein: all within Near (164 u), none on top of another. */
const ring = (n) => Array.from({ length: n }, (_, i) => ({
    x: Math.round(VEIN.x + 150 * Math.cos((2 * Math.PI * i) / n)),
    y: Math.round(VEIN.y + 150 * Math.sin((2 * Math.PI * i) / n))
}));

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    return hero;
}

/** A vein with a miner on it and `carts` of a cart type round it. */
function scene(veinType, cartType, carts) {
    const vein = placeAt(veinType, VEIN.x, VEIN.y);
    for (const p of ring(carts)) placeAt(cartType, p.x, p.y);
    TileModifiers.rebuildAll();
    Placement.plantFlagAt('hero_1', VEIN);
    return vein;
}

/** The cycle time the runner works the Token at, as its progress events report it. */
function workedCycleMs(instance, ms = 3000) {
    let seen = null;
    const off = EventBus.subscribe(BOARD_EVENTS.PROGRESS, (p) => {
        if (p?.instanceId === instance.id && p.cycleTimeMs != null) seen = p.cycleTimeMs;
    });
    for (let t = 0; t < ms; t += 100) BoardRunner.tick(100);
    off();
    return seen;
}

/** How many cycles the Token completes in `ms`. */
function cyclesIn(instance, ms) {
    let n = 0;
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p?.instanceId === instance.id) n++; });
    for (let t = 0; t < ms; t += 100) BoardRunner.tick(100);
    off();
    return n;
}

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => clearMat());

describe('the floor, as a number', () => {
    it('is one code constant: a speed-up cuts at most 80 %', () => {
        expect(MAX_SPEED_UP_CUT).toBe(0.8);
    });

    it('holds a sped-up time at a fifth of itself, exactly, and lets a slow-down through', () => {
        expect(TileModifiers.floorSpeedUp(10000, 0)).toBe(2000);
        expect(TileModifiers.floorSpeedUp(10000, -5000)).toBe(2000);
        expect(TileModifiers.floorSpeedUp(10000, 4000)).toBe(4000);
        expect(TileModifiers.floorSpeedUp(30000, 0)).toBe(6000);
        expect(TileModifiers.floorSpeedUp(300000, 1)).toBe(60000);     // a 5 minute regrow, never under 1 minute
        expect(TileModifiers.floorSpeedUp(10000, 15000)).toBe(15000);
    });
});

describe('stacked speed-ups on a worked Token', () => {
    it('⭐ five −20 % Minecarts on a 10 s vein give 2 s, not 1 s', () => {
        const vein = scene('s1a_vein', 's1a_minecart', 5);
        // The rules alone take the vein to nothing: −100 %.
        expect(TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.WORK_TIME, 10000, 'mining')).toBe(0);
        expect(workedCycleMs(vein)).toBe(2000);
    });

    it('three of them give 4 s: under the floor nothing is cut off', () => {
        const vein = scene('s1a_vein', 's1a_minecart', 3);
        // 1 + 3 × −0.2 is 0.3999999999999999 in floating point: the three-bucket sum, as ever.
        expect(workedCycleMs(vein)).toBeCloseTo(4000, 6);
    });

    it('a 2 s cycle is a 2 s cycle: ten worked seconds after the walk complete five', () => {
        const vein = scene('s1a_vein', 's1a_minecart', 5);
        // Let the hero arrive and start, then count whole cycles.
        let started = false;
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_START, (p) => { if (p?.instanceId === vein.id) started = true; });
        for (let t = 0; t < 10000 && !started; t += 100) BoardRunner.tick(100);
        off();
        expect(started).toBe(true);
        expect(cyclesIn(vein, 10000)).toBe(5);
    });

    it('the engine’s 1 s floor still holds beneath it: a 3 s vein floors at 1 s, not 600 ms', () => {
        const vein = scene('s1a_quick_vein', 's1a_quick_cart', 5);
        expect(workedCycleMs(vein)).toBe(1000);
    });

    it('a slow-down is never capped', () => {
        const vein = scene('s1a_vein', 's1a_slow_cart', 1);
        expect(workedCycleMs(vein, 3000)).toBe(15000);
    });

    it('with no rule the authored time stands', () => {
        const vein = scene('s1a_vein', 's1a_minecart', 0);
        expect(workedCycleMs(vein)).toBe(10000);
    });
});
