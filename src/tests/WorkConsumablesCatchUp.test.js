// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { DRINK_CYCLES } from '../config/loopConstants.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { withoutShippedPerks } from './fixtures/noPerks.js';

// Its heroes stand at perk levels: the shipped perks are content, not what this tests.
withoutShippedPerks();

/**
 * Brief 230 S6b: a forester with a Birdwatcher (a work potion: a 25 % chance of a Bird Nest as each
 * Forestry cycle completes) and a Coffee (a drink: cycles at half time for ten cycles). Every
 * Birdwatcher is drunk at a cycle start and each nest is one random draw at a cycle's end, so the
 * same 25 cycles in 100 ms ticks and in 1000 ms steps drink the same potions and Coffees, keep the
 * same dose and drop the same nests; and a catch-up ends where the same time played live ends.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 90_000;
const CYCLES = 25;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const forTheCycle = (effectId, skill = null) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'WORK_START', scope: 'self', ...(skill ? { skill } : {}) },
    target: { role: 'actor' },
    payload: { effectId, scale: 1, durationMs: 0, forCycle: true, chance: 100 }
});

registerEffects({
    cu6_fx_birdwatcher: {
        id: 'cu6_fx_birdwatcher', name: 'Birdwatcher',
        statements: [{ ...makeStatement(KEYWORD.GRANTS), payload: { type: 'BONUS_DROP', itemId: 'cu6_nest', quantity: 1, chance: 25 }, to: null }]
    },
    cu6_fx_birdwatcher_potion: { id: 'cu6_fx_birdwatcher_potion', name: 'Birdwatcher Potion', statements: [forTheCycle('cu6_fx_birdwatcher', 'forestry')] },
    cu6_fx_coffee: {
        id: 'cu6_fx_coffee', name: 'Coffee',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.5 }, to: null }]
    },
    cu6_fx_coffee_drink: { id: 'cu6_fx_coffee_drink', name: 'Coffee Drink', statements: [forTheCycle('cu6_fx_coffee')] }
});

registerItems({
    cu6_nest: { id: 'cu6_nest', name: 'Bird Nest', type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw' },
    cu6_log: { id: 'cu6_log', name: 'Log', type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw' },
    cu6_birdwatcher: { id: 'cu6_birdwatcher', name: 'Birdwatcher', type: 'potion', stackable: true, equipSlot: 'consumable', sprite: 'i_potion_shrimp_pink', effects: [{ effectId: 'cu6_fx_birdwatcher_potion' }] },
    cu6_coffee: { id: 'cu6_coffee', name: 'Coffee', type: 'drink', stackable: true, equipSlot: 'drink', sprite: 'i_potion_shrimp_pink', effects: [{ effectId: 'cu6_fx_coffee_drink' }] }
});

registerTokenTypes({
    cu6_tree: {
        id: 'cu6_tree', name: 'Catch-up Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: true,
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 2, inputs: [], outputs: [{ itemId: 'cu6_log', quantity: 1, chance: 100 }] }
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

/** One forester pinned to one tree, carrying a Birdwatcher and a Coffee: 30 potions, 2 Coffees. */
function buildBoard() {
    stream.state = 61;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [forester] = fixtures.makeHeroes(1, { forestry: 10 });
    forester.equipment[0] = 'cu6_birdwatcher';
    forester.equipment[1] = 'cu6_coffee';
    InventoryManager.addItem('cu6_birdwatcher', 30);
    InventoryManager.addItem('cu6_coffee', 2);
    const tree = fixtures.placeAt('cu6_tree', 400, 400);
    fixtures.orderAt(forester.id, { x: tree.x, y: tree.y });
    TileModifiers.rebuildAll();
    return { tree: tree.id, forester: forester.id };
}

/** Everything the doses decide: what was drunk, what is left, what dropped, the random draws. */
function snapshot(ids, extra = {}) {
    const onBoardOrBanked = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);
    const h = GameState.state.heroes.find(x => x.id === ids.forester);
    return {
        birdwatchers: InventoryManager.getItemCount('cu6_birdwatcher'),
        coffees: InventoryManager.getItemCount('cu6_coffee'),
        drinkCycles: { ...(h.drinkCycles || {}) },
        nests: onBoardOrBanked('cu6_nest'),
        logs: onBoardOrBanked('cu6_log'),
        xp: h.skills.forestry.xp,
        draws: stream.draws,
        ...extra
    };
}

/** Watch the forester's cycles and drinks; `at` is a snapshot taken as the 25th cycle completes. */
function watch(ids) {
    const seen = { cycles: 0, drunk: [], at: null };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
            if (p?.instanceId !== ids.tree) return;
            seen.cycles++;
            if (seen.cycles === CYCLES) seen.at = snapshot(ids);
        }),
        EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, (p) => { if (p?.dose) seen.drunk.push(p.itemId); })
    ];
    return { seen, stop: () => { offs.forEach(off => off()); return seen; } };
}

/** Play in `stepMs` steps through the plain loop until the 25th cycle has completed. */
function playTo25(stepMs) {
    const ids = buildBoard();
    const w = watch(ids);
    for (let i = 0; i < 400_000 / stepMs && !w.seen.at; i++) GameLoop.runHandlers(stepMs);
    return w.stop();
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    Math.random = seeded;
    HeroMotion.setRandomForTests(seeded);
    EnemyMotion.setRandomForTests(seeded);
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

describe('work potions and drinks during time away', () => {
    it('⭐ 25 Forestry cycles drink, dose and drop the same in 100 ms ticks as in 1000 ms steps', () => {
        const fine = playTo25(100);
        const coarse = playTo25(1000);
        expect(fine.at).not.toBeNull();
        expect(coarse.at).toEqual(fine.at);

        // And the doses really ran: 25 Birdwatchers, two Coffees (the second ran out at cycle 20,
        // then the Bank was dry), some nests and not all.
        expect(fine.at.birdwatchers).toBe(30 - CYCLES);
        expect(fine.at.coffees).toBe(0);
        expect(fine.at.drinkCycles).toEqual({ cu6_coffee: 0 });
        expect(fine.drunk.filter(id => id === 'cu6_coffee')).toHaveLength(2);
        expect(fine.at.nests).toBeGreaterThan(0);
        expect(fine.at.nests).toBeLessThan(CYCLES);
        expect(fine.at.logs).toBe(CYCLES);
        expect(DRINK_CYCLES * 2).toBeLessThan(CYCLES);
    });

    it('⭐ a catch-up ends exactly where the same 1000 ms steps through the plain loop end', async () => {
        let ids = buildBoard();
        let w = watch(ids);
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = { ...snapshot(ids), cycles: w.stop().cycles };

        ids = buildBoard();
        w = watch(ids);
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        expect({ ...snapshot(ids), cycles: w.stop().cycles }).toEqual(plain);

        expect(plain.cycles).toBeGreaterThan(CYCLES);
        expect(plain.nests).toBeGreaterThan(0);
    }, 60_000);
});
