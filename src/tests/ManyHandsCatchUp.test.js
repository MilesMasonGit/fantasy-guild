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
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * ⭐ Many Hands while the player is away, and across a save (brief 800 P3): a master crafter at a
 * Workbench set to Charcoal (1.1 s) and Leather (1.7 s), each on its own clock, with Hide for only
 * part of the time, so the second recipe runs dry while the first carries on. A catch-up ends
 * exactly where the same time played in 1000 ms steps ends, both lanes, every draw; live play's
 * 100 ms steps make the same cycles; and a save written mid-cycle on both lanes loads with both
 * cycles where they stood and goes on as if never saved.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 3 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const material = (id) => ({ id, name: id, type: 'material', stackable: true, equipSlot: '', sprite: 'i_bones' });
const ITEMS = ['mhc_wood', 'mhc_hide', 'mhc_charcoal', 'mhc_leather'];
registerItems(Object.fromEntries(ITEMS.map(id => [id, material(id)])));

const CHARCOAL = 'mhc_recipe_charcoal';
const LEATHER = 'mhc_recipe_leather';
const recipe = (id, input, output, durationMs, xp) => ({
    id, name: id, levelRequirement: 1, requiresContext: [], durationMs, xp,
    inputs: [{ itemId: input, quantity: 1 }], outputs: [{ itemId: output, chance: 100, minQty: 1, maxQty: 1 }]
});
registerRecipePools({ crafting: [recipe(CHARCOAL, 'mhc_wood', 'mhc_charcoal', 1100, 1), recipe(LEATHER, 'mhc_hide', 'mhc_leather', 1700, 2)] });

registerTokenTypes({
    mhc_bench: {
        id: 'mhc_bench', name: 'MHC Workbench', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_industry', requiresHero: true,
        config: { skill: 'crafting', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_mhc_bench_works', keyword: KEYWORD.STATION, payload: { skill: 'crafting' } }]
    },
    // Double Loot on a chance, so every cycle draws and the work check has a stream to compare.
    mhc_charm: {
        id: 'mhc_charm', name: 'MHC Charm', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
        statements: [{ id: 'stm_mhc_charm', keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby', payload: { type: EFFECT_TYPES.LOOT_MULT, bucket: 'flat', value: 30 } }]
    }
});
registerEffects({
    mhc_many_hands: {
        id: 'mhc_many_hands', name: 'Many Hands',
        statements: [{ id: 'stm_mhc_mh', keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby', payload: { type: EFFECT_TYPES.SECOND_RECIPE, bucket: 'flat', value: 1, category: 'crafting' } }]
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

const BENCH = { x: 700, y: 500 };

function buildBoard(hide = 40) {
    stream.state = 61;
    stream.draws = 0;
    resetMatTuning();
    registerSkillPerks({ crafting: { perks: [{ level: 99, effectId: 'mhc_many_hands' }] } });
    GameState.initNew();
    InventoryManager.init();
    const [crafter] = fixtures.makeHeroes(1, { crafting: 99 });
    InventoryManager.addItem('mhc_wood', 400);
    InventoryManager.addItem('mhc_hide', hide);
    const bench = fixtures.placeAt('mhc_bench', BENCH.x, BENCH.y);
    fixtures.placeAt('mhc_charm', BENCH.x + 130, BENCH.y);
    StationRecipe.setSelectedRecipe(bench, CHARCOAL);
    expect(StationRecipe.setSecondRecipe(bench, LEATHER)).toBe(true);
    fixtures.orderAt(crafter.id, BENCH);
    TileModifiers.rebuildAll();
    return bench.id;
}

function listen(id) {
    const seen = { first: 0, second: 0 };
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
        if (p.instanceId !== id) return;
        if (p.lane === StationRecipe.LANE.SECOND) seen.second++;
        else seen.first++;
    });
    return { stop: () => { off(); return seen; } };
}

/** What every item came to, on the board or banked: a catch-up banks as it goes, live play leaves it lying. */
function end(seen, withDraws = true) {
    const items = Object.fromEntries(ITEMS.map(id => [id, InventoryManager.getItemCount(id)]));
    for (const s of SpriteLayer.getSprites()) if (s.refId in items) items[s.refId] += s.quantity;
    const xp = GameState.state.heroes.map(h => h.skills?.crafting?.xp);
    return { seen, items, xp, ...(withDraws ? { draws: stream.draws } : {}) };
}

async function caughtUp() {
    const id = buildBoard();
    const seen = listen(id);
    await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
    return end(seen.stop());
}

function played(stepMs = 1000, withDraws = true, hide = 40) {
    const id = buildBoard(hide);
    const seen = listen(id);
    for (let t = 0; t < AWAY_MS; t += stepMs) GameLoop.runHandlers(stepMs);
    return end(seen.stop(), withDraws);
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    Math.random = seeded;
    HeroMotion.setRandomForTests(seeded);
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
    registerSkillPerks({ crafting: { perks: [] } });
    Math.random = realRandom;
    HeroMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ Many Hands during time away', () => {
    it('a catch-up ends where 1000 ms steps end, both lanes and every draw; the second ran dry and the first carried on', async () => {
        const loop = played(1000);
        const away = await caughtUp();
        expect(away).toEqual(loop);

        // Both lanes worked: Charcoal every 1.1 s for the whole time, Leather until the 40 Hide ran out.
        expect(loop.seen.first).toBe(Math.floor(AWAY_MS / 1100));
        expect(loop.seen.second).toBe(40);
        expect(loop.items.mhc_hide).toBe(0);
        expect(loop.items.mhc_wood).toBe(400 - loop.seen.first);
        expect(loop.items.mhc_leather).toBeGreaterThanOrEqual(40);
        expect(loop.draws).toBeGreaterThan(loop.seen.first);
    }, 120_000);

    it('live play\'s 100 ms steps make the same cycles in each lane, with Hide for the whole time', () => {
        const loop = played(1000, false, 400);
        const live = played(100, false, 400);
        // Each lane hands its own leftover on: Leather every 1.7 s, not every 2 s of 1 s steps.
        expect(loop.seen).toEqual({ first: Math.floor(AWAY_MS / 1100), second: Math.floor(AWAY_MS / 1700) });
        expect(live.seen).toEqual(loop.seen);
        expect(live.items.mhc_wood).toBe(loop.items.mhc_wood);
        expect(live.items.mhc_hide).toBe(loop.items.mhc_hide);
        expect(live.xp).toEqual(loop.xp);
    }, 120_000);
});

describe('⭐ a save mid-cycle on both lanes', () => {
    it('loads with both picks and both cycles where they stood, and goes on as if never saved', async () => {
        // The run with no save: 5.25 s, then 6 s more.
        let id = buildBoard();
        for (let t = 0; t < 5250; t += 100) GameLoop.runHandlers(100);
        const mid = { ...BoardState.getTokenById(id) };
        expect(mid.cycleElapsedMs).toBeGreaterThan(0);
        expect(mid.secondElapsedMs).toBeGreaterThan(0);
        let seen = listen(id);
        for (let t = 0; t < 6000; t += 100) GameLoop.runHandlers(100);
        const straight = end(seen.stop(), false);

        // The same 5.25 s, saved, loaded, and the same 6 s more.
        id = buildBoard();
        for (let t = 0; t < 5250; t += 100) GameLoop.runHandlers(100);
        const save = JSON.parse(GameState.serializeJson());
        localStorage.setItem(SaveManager.getSlotKey(0), JSON.stringify(save));
        GameState.initNew();
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        GameLoop.stop();
        const loaded = BoardState.getTokenById(id);
        expect(loaded).toMatchObject({
            selectedRecipeId: CHARCOAL, secondRecipeId: LEATHER,
            cycleElapsedMs: mid.cycleElapsedMs, secondElapsedMs: mid.secondElapsedMs
        });
        seen = listen(id);
        for (let t = 0; t < 6000; t += 100) GameLoop.runHandlers(100);
        const resumed = end(seen.stop(), false);
        expect(resumed).toEqual(straight);
        expect(resumed.seen.second).toBeGreaterThan(2);
    }, 120_000);
});
