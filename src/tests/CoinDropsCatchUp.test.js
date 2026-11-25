// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getCoins } from '../systems/inventory/Coins.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { COIN_ITEM_ID } from '../config/registries/coinCosts.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { enemyCampType } from './fixtures/enemyCamp.js';

/**
 * ⭐ Coin drops during time away end exactly where the same time played live ends: a Melee 30 hero
 * beats a camp's coin-dropping enemies beside a Counting House (Coin Find +100%), and the guild's
 * coins, the piles still on the floor and the random stream all match the plain loop's.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 4 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerItems({
    cdc_sword: { id: 'cdc_sword', name: 'Coin Sword', type: 'weapon', equipSlot: 'hand', skillRequired: 'melee', damage: 6 }
});

registerTokenTypes({
    cdc_enemy: {
        id: 'cdc_enemy', name: 'Coin Goblin', tokenType: 'enemy', rarity: 'common',
        theme: 'fixture', uses: 6, sprite: 's_crime', requiresHero: true,
        enemy: { level: 3, style: 'melee', coinDrop: 4 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    cdc_counting_house: {
        id: 'cdc_counting_house', name: 'Counting House', tokenType: 'buff', rarity: 'rare', theme: 'fixture',
        uses: null, sprite: 's_occult',
        statements: [{ id: 'stm_cdc_find', keyword: 'provides', to: { mode: 'all' }, payload: { type: 'COIN_FIND', bucket: 'percentage', value: 1.0 } }]
    }
});

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

function buildBoard() {
    stream.state = 11;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [fighter] = fixtures.makeHeroes(1, {});
    fighter.skills.melee = { level: 30, xp: xpForLevel(30) };
    fighter.equipment[0] = 'cdc_sword';
    HeroManager.updateHeroFromSkills(fighter);
    fighter.hp.current = fighter.hp.max;
    const camp = fixtures.placeAt(enemyCampType('cdc_enemy'), 600, 500);
    fixtures.placeAt('cdc_counting_house', 700, 500);
    fixtures.orderAt(fighter.id, { x: camp.x, y: camp.y });
    TileModifiers.rebuildAll();
}

function listen() {
    const seen = { kills: 0, dropped: [] };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => { seen.kills++; }),
        EventBus.subscribe(ENGINE_EVENTS.LOOT_GENERATED, ({ drops } = {}) => {
            for (const d of drops || []) if (d.coins) seen.dropped.push(d.quantity);
        })
    ];
    return { stop: () => { offs.forEach(off => off()); return seen; } };
}

/** How the run ended, then the floor swept: the coins the piles paid into the count. */
const end = (seen) => {
    const before = {
        coins: getCoins(),
        piles: SpriteLayer.getSprites().filter(s => s.refId === COIN_ITEM_ID).reduce((n, s) => n + s.quantity, 0),
        uses: BoardState.tokens().filter(t => t.typeId === 'cdc_enemy').map(t => t.usesRemaining),
        draws: stream.draws,
        seen
    };
    SpriteLayer.collectAll();
    return { ...before, swept: getCoins(), banked: InventoryManager.getItemCount(COIN_ITEM_ID) };
};

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
    Math.random = realRandom;
    HeroMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ coin drops during a catch-up', () => {
    it('⭐ end exactly where the same 1000 ms steps through the plain loop end', async () => {
        buildBoard();
        let seen = listen();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(seen.stop());

        buildBoard();
        seen = listen();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(seen.stop());

        expect(caughtUp).toEqual(plain);

        // And coins really dropped: several kills, each 4 coins raised to 8 by the Counting House,
        // all on the floor until swept, then all in the count, none in the Bank.
        expect(plain.seen.kills).toBeGreaterThanOrEqual(2);
        expect(plain.seen.dropped.every(n => n === 8)).toBe(true);
        expect(plain.piles).toBe(8 * plain.seen.kills);
        expect(plain.swept).toBe(plain.coins + plain.piles);
        expect(plain.banked).toBe(0);
    }, 60_000);
});
