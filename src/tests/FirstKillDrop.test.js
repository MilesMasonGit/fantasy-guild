// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
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
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import * as FirstKill from '../systems/combat/firstKill.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { enemyDropsOf } from '../config/registries/enemyProfile.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * ⭐ "First kill always drops" (brief 240 K0.3): a drop line marked first-kill-guaranteed drops for
 * certain the first time the save kills that enemy type, then at its own chance. The save
 * remembers it; a save from before the record has killed nothing yet. Time away honours it
 * exactly as live play does.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 6 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerItems({
    firstkill_sword: { id: 'firstkill_sword', name: 'First-kill Sword', type: 'weapon', equipSlot: 'hand', skillRequired: 'melee', damage: 6 },
    firstkill_trophy: { id: 'firstkill_trophy', name: 'Trophy Map', type: 'material', stackable: true }
});

registerTokenTypes({
    firstkill_boss: {
        id: 'firstkill_boss', name: 'First-kill Boss', tokenType: 'enemy', rarity: 'common',
        theme: 'fixture', uses: 6, sprite: 's_crime', requiresHero: true,
        enemy: { level: 5, style: 'melee' },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [],
            outputs: [
                { itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 },
                { itemId: 'firstkill_trophy', chance: 1, minQty: 1, maxQty: 1, firstKill: true }
            ]
        }
    },
    firstkill_plain: {
        id: 'firstkill_plain', name: 'Plain Enemy', tokenType: 'enemy', rarity: 'common',
        theme: 'fixture', uses: 6, sprite: 's_crime', requiresHero: true,
        enemy: { level: 5, style: 'melee' },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [],
            outputs: [{ itemId: 'firstkill_trophy', chance: 1, minQty: 1, maxQty: 1 }]
        }
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

/** How many of an item the guild has, banked or lying on the mat. */
const held = (itemId) => InventoryManager.getItemCount(itemId)
    + SpriteLayer.getSprites().filter(s => s.kind === 'item' && s.refId === itemId).reduce((n, s) => n + (s.quantity || 1), 0);
const trophies = () => held('firstkill_trophy');

/** A kill of `enemyId` off the mat: its loot goes straight to the Bank. */
const killOffMat = (enemyId) => EventBus.publish(ENGINE_EVENTS.COMBAT_VICTORY, {
    cardId: 'fight', heroId: 'hero', instanceId: null, areaId: 'area_guild_hall',
    enemyId, enemyName: enemyId, drops: enemyDropsOf(getTokenType(enemyId))
});

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterEach(() => {
    Math.random = realRandom;
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    HeroMotion.setRandomForTests();
    EnemyMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a drop line marked first kill', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        LootSystem.init();
        // Every roll misses a 1 % line.
        Math.random = () => 0.5;
    });

    it('is carried from the Token onto the fight\'s drop list, and only where marked', () => {
        expect(enemyDropsOf(getTokenType('firstkill_boss')).map(d => d.firstKill === true)).toEqual([false, true]);
        expect(enemyDropsOf(getTokenType('firstkill_plain'))[0]).not.toHaveProperty('firstKill');
    });

    it('drops for certain on the first kill of that type, then at its own chance', () => {
        killOffMat('firstkill_boss');
        expect(trophies()).toBe(1);
        expect(FirstKill.hasPaid('firstkill_boss')).toBe(true);
        killOffMat('firstkill_boss');
        killOffMat('firstkill_boss');
        expect(trophies()).toBe(1);
        expect(InventoryManager.getItemCount('item_bones')).toBe(3);
    });

    it('is a guarantee per enemy type, and an unmarked line never gets one', () => {
        killOffMat('firstkill_plain');
        expect(trophies()).toBe(0);
        expect(FirstKill.hasPaid('firstkill_plain')).toBe(false);
        killOffMat('firstkill_boss');
        expect(trophies()).toBe(1);
    });

    it('is remembered in the save, and a save from before the record has killed nothing yet', () => {
        killOffMat('firstkill_boss');
        const saved = JSON.parse(GameState.serializeJson()).state;
        expect(saved.collection.firstKillDrops).toEqual({ firstkill_boss: true });

        // An old save: no record at all, though the Bestiary counts kills.
        delete GameState.state.collection.firstKillDrops;
        GameState.state.collection.enemyKillCounts = { firstkill_boss: 40 };
        expect(FirstKill.hasPaid('firstkill_boss')).toBe(false);
        killOffMat('firstkill_boss');
        expect(trophies()).toBe(2);
        killOffMat('firstkill_boss');
        expect(trophies()).toBe(2);
    });
});

/** A Melee 30 hero with a sword pinned to a six-use first-kill boss. */
function buildBoard() {
    stream.state = 11;
    stream.draws = 0;
    Math.random = seeded;
    HeroMotion.setRandomForTests(seeded);
    EnemyMotion.setRandomForTests(seeded);
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [fighter] = fixtures.makeHeroes(1, {});
    fighter.skills.melee = { level: 30, xp: xpForLevel(30) };
    fighter.equipment[0] = 'firstkill_sword';
    HeroManager.updateHeroFromSkills(fighter);
    fighter.hp.current = fighter.hp.max;
    const boss = fixtures.placeAt('firstkill_boss', 600, 500);
    fixtures.plant(fighter.id, { x: boss.x, y: boss.y }, { pin: true });
    TileModifiers.rebuildAll();
}

function listen() {
    const kills = [];
    const off = EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, (d) => kills.push(d.enemyId));
    return { stop: () => { off(); return kills; } };
}

const end = (kills) => ({
    kills,
    trophies: trophies(),
    bones: held('item_bones'),
    record: { ...(GameState.state.collection.firstKillDrops || {}) },
    draws: stream.draws
});

describe('time away', () => {
    it('pays the first kill exactly where the same 1000 ms steps through the plain loop do', async () => {
        buildBoard();
        let seen = listen();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(seen.stop());

        buildBoard();
        seen = listen();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(seen.stop());

        expect(caughtUp).toEqual(plain);
        expect(plain.kills.length).toBeGreaterThanOrEqual(2);
        expect(plain.record).toEqual({ firstkill_boss: true });
        expect(plain.trophies).toBeGreaterThanOrEqual(1);
    }, 60_000);
});
