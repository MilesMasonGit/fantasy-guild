// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as HeroTools from '../systems/equipment/HeroTools.js';
import { applyDefeatPenalties } from '../systems/combat/DefeatPenalties.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { breakChanceOf } from '../config/registries/itemBreak.js';
import { toolOf, neededToolOf } from '../config/registries/toolKinds.js';
import { markHeld } from '../systems/equipment/heldCopies.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { withoutShippedPerks } from './fixtures/noPerks.js';

withoutShippedPerks();

/**
 * ⭐ The Rusty tools as the owner authored them (`data/items.json`): a Rusty Pickaxe and Woodaxe
 * are tier-1 tools of their kind and work the Tokens a copper one works; each, and the Rusty Sword,
 * has `breakChance: 1`, read as 1 % (the roll is `Math.random() * 100 < 1`). A tool rolls once per
 * work cycle; the sword once per kill, not per swing. Shipped content, so a CMS edit to these items
 * shows up here.
 */

const PICK = 'item_rusty_pickaxe';
const AXE = 'item_rusty_woodaxe';
const SWORD = 'item_rusty_sword';
const ORE = 'item_copper_ore';
const WOOD = 'item_oak_wood';

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const heroRec = (id) => GameState.state.heroes.find(h => h.id === id);
const landed = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);
const play = (ms) => { for (let t = 0; t < ms; t += 100) GameLoop.runHandlers(100); };

/** Every draw is `value`: just under 0.01 every roll of a 1 % chance hits, just over it none does. */
function everyDraw(value) {
    vi.spyOn(Math, 'random').mockImplementation(() => value);
}

function hold(hero, itemId) {
    hero.equipment[0] = itemId;
    markHeld(hero, 0, true);
}

function listen() {
    const seen = { cycles: 0, kills: 0, swings: 0, breaks: [] };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, () => { seen.cycles++; }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => { seen.kills++; }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, () => { seen.swings++; }),
        EventBus.subscribe(BOARD_EVENTS.GEAR_BROKE, (p) => {
            seen.breaks.push({ itemId: p.itemId, use: p.use, cycles: seen.cycles, kills: seen.kills, swings: seen.swings });
        })
    ];
    return { seen, stop: () => offs.forEach(off => off()) };
}

/** A fresh guild: one level-1 hero holding `itemId`, ordered onto a shipped `typeId`; one spare in the Bank. */
function setUp(itemId, typeId, skills = {}) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [hero] = fixtures.makeHeroes(1, skills);
    hold(hero, itemId);
    HeroManager.updateHeroFromSkills(hero);
    hero.hp.current = hero.hp.max;
    const token = fixtures.placeAt(typeId, 600, 500);
    InventoryManager.addItem(itemId, 1);
    TileModifiers.rebuildAll();
    expect(fixtures.orderAt(hero.id, { x: token.x, y: token.y }).success).toBe(true);
    return { heroId: hero.id, tokenId: token.id };
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterEach(() => {
    vi.mocked(Math.random).mockRestore?.();
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the Rusty items as shipped', () => {
    it('each breaks 1 % of the time, read as a percent, not as 1.0', () => {
        for (const id of [PICK, AXE, SWORD]) expect(breakChanceOf(getItem(id)), id).toBe(1);
    });

    it('a Rusty tool is a tier-1 tool of its kind, the need a copper vein and an oak ask for', () => {
        expect(toolOf(getItem(PICK))).toMatchObject({ kind: 'pickaxe', tier: 1 });
        expect(toolOf(getItem(AXE))).toMatchObject({ kind: 'woodaxe', tier: 1 });
        expect(neededToolOf(getTokenType('token_copper_ore_vein'))).toMatchObject({ kind: 'pickaxe', minTier: 1 });
        expect(neededToolOf(getTokenType('token_oak_tree'))).toMatchObject({ kind: 'woodaxe', minTier: 1 });
    });
});

describe('⭐ a Rusty tool works like a copper one, and breaks only as a cycle ends', () => {
    it('a Rusty Pickaxe mines a Copper Ore Vein to the end when the roll misses (just over 1 %)', () => {
        const ids = setUp(PICK, 'token_copper_ore_vein');
        expect(HeroTools.holdsToolFor(ids.heroId, neededToolOf(getTokenType('token_copper_ore_vein')))).toBe(true);
        everyDraw(0.0101);
        const run = listen();
        play(60_000);
        run.stop();
        // The vein runs out by chance, one in five: this draw is under that, so its first cycle is its
        // last; the pick's roll misses on it all the same.
        expect(run.seen.cycles).toBe(1);
        expect(Respawn.isResting(BoardState.getTokenById(ids.tokenId))).toBe(true);
        expect(landed(ORE)).toBeGreaterThanOrEqual(run.seen.cycles);
        expect(run.seen.breaks).toEqual([]);
        expect(heroRec(ids.heroId).equipment[0]).toBe(PICK);
    });

    it('with the roll hit (just under 1 %) it breaks after its first cycle: the ore lands, it leaves the hand, the Bank\'s spare stays', () => {
        const ids = setUp(PICK, 'token_copper_ore_vein');
        everyDraw(0.0099);
        const run = listen();
        play(30_000);
        run.stop();
        expect(run.seen.breaks).toEqual([{ itemId: PICK, use: 'work', cycles: 1, kills: 0, swings: 0 }]);
        expect(run.seen.cycles).toBe(1);
        expect(landed(ORE)).toBeGreaterThanOrEqual(1);
        const hero = heroRec(ids.heroId);
        expect(hero.equipment[0]).toBeNull();
        expect(hero.heldCopies?.[0] ?? false).toBe(false);
        expect(InventoryManager.getItemCount(PICK)).toBe(1);
    });

    it('a Rusty Woodaxe chops an Oak Tree and breaks the same way', () => {
        const ids = setUp(AXE, 'token_oak_tree');
        everyDraw(0.0099);
        const run = listen();
        play(30_000);
        run.stop();
        expect(run.seen.breaks).toEqual([{ itemId: AXE, use: 'work', cycles: 1, kills: 0, swings: 0 }]);
        expect(landed(WOOD)).toBeGreaterThanOrEqual(1);
        expect(heroRec(ids.heroId).equipment[0]).toBeNull();
        expect(InventoryManager.getItemCount(AXE)).toBe(1);
    });
});

describe('⭐ the Rusty Sword rolls once per kill, never per swing', () => {
    it('against the Small Slime: many swings, no break until the kill, then it is gone', () => {
        const ids = setUp(SWORD, 'token_small_slime', { melee: 40 });
        const run = listen();
        // The fight on the seeded stream; from the kill's own events on, every draw hits a 1 % roll.
        const off = EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, () => everyDraw(0.0099));
        play(60_000);
        off();
        run.stop();
        expect(run.seen.kills).toBe(1);
        expect(run.seen.swings).toBeGreaterThan(1);
        expect(run.seen.breaks).toEqual([{ itemId: SWORD, use: 'fight', cycles: 1, kills: 1, swings: run.seen.swings }]);
        expect(heroRec(ids.heroId).equipment[0]).toBeNull();
        expect(InventoryManager.getItemCount(SWORD)).toBe(1);
    });
});

describe('the defeat roll still takes a Rusty tool', () => {
    it('a knocked-out hero can lose the Rusty Pickaxe in hand', () => {
        const ids = setUp(PICK, 'token_copper_ore_vein');
        everyDraw(0);
        expect(applyDefeatPenalties(ids.heroId)).toContain(getItem(PICK).name);
        expect(heroRec(ids.heroId).equipment[0]).toBeNull();
    });
});
