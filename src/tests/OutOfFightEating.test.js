// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as RegenSystem from '../systems/hero/RegenSystem.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';
import * as BoardState from '../systems/board/BoardState.js';

/**
 * Between kills a hero eats on game time, at most one meal a second of rest, so the same fight
 * played live (100 ms ticks) and in a catch-up (1,000 ms steps) eats the same between kills.
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerItems({
    ofe_sword: { id: 'ofe_sword', name: 'Rest Sword', type: 'weapon', equipSlot: 'hand', skillRequired: 'melee', damage: 6 },
    ofe_bread: { id: 'ofe_bread', name: 'Crumb', equipSlot: 'food', stackable: true, restoreAmount: 1 }
});

/**
 * A sting beside the enemy: each kill hurts the hero who won it, so a rest can start under a quarter
 * health. On Neighbour's Kill, since an enemy's own On Cycle does not fire at its death.
 */
const THORNS = 4;
registerEffects({
    ofe_thorns: {
        id: 'ofe_thorns', name: 'Rest Thorns',
        statements: [{
            id: 'stm_ofe_thorns', keyword: 'deals', payload: { amount: THORNS, ignoresArmor: true }, chargeDelta: 0,
            to: null, reach: null, target: { role: 'actor' },
            when: { event: 'COMBAT_RESOLVED', scope: 'nearby', cooldownMs: 0 }, upkeep: null
        }]
    }
});

registerTokenTypes({
    ofe_enemy: {
        id: 'ofe_enemy', name: 'Rest Enemy', tokenType: 'enemy', rarity: 'common',
        theme: 'fixture', uses: 30, sprite: 's_crime', requiresHero: true,
        enemy: { level: 5, style: 'melee' },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [],
            outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }]
        }
    },
    ofe_stinger: {
        id: 'ofe_stinger', name: 'Rest Stinger', tokenType: 'buff', rarity: 'common',
        theme: 'fixture', uses: null, sprite: 's_crime', requiresHero: false,
        effects: [{ effectId: 'ofe_thorns', scale: 1 }]
    }
});

const stream = { state: 1 };
function seeded() {
    stream.state = (stream.state + 0x6D2B79F5) | 0;
    let t = stream.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const realRandom = Math.random;

/** Strong enough to win a long run, weak enough that the sting leaves a rest under a quarter health. */
const LEVEL = 25;

function buildBoard({ hpShare = 1 } = {}) {
    stream.state = 7;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [hero] = fixtures.makeHeroes(1, {});
    hero.skills.melee = { level: LEVEL, xp: xpForLevel(LEVEL) };
    hero.equipment[0] = 'ofe_sword';
    hero.equipment[1] = 'ofe_bread';
    InventoryManager.addItem('ofe_bread', 500);
    HeroManager.updateHeroFromSkills(hero);
    hero.hp.current = Math.ceil(hero.hp.max * hpShare);
    const a = fixtures.placeAt('ofe_enemy', 400, 400);
    fixtures.placeAt('ofe_stinger', 540, 400);
    fixtures.orderAt(hero.id, { x: a.x, y: a.y });
    TileModifiers.rebuildAll();
    return hero.id;
}

/**
 * Run the same fights for `ms` of game time in steps of `step`; what the hero ate and how it went.
 * Every enemy is one use: two seconds (on the whole second) after each kill a fresh one is put where
 * the last stood and the hero sent at it, so a rest falls between fights at either step.
 */
function fight(step, ms, options) {
    const heroId = buildBoard(options);
    const hero = () => GameState.state.heroes.find(h => h.id === heroId);
    const spot = (() => { const e = BoardState.tokens().find(t => t.typeId === 'ofe_enemy'); return { x: e.x, y: e.y }; })();
    const seen = { kills: 0, defeats: 0, fightMeals: 0, restMeals: 0 };
    let t = 0;
    let nextAt = null;
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, () => {
            if (hero().status === 'combat') seen.fightMeals++; else seen.restMeals++;
        }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => {
            seen.kills++;
            nextAt = Math.ceil((t + step) / 1000) * 1000 + 2000;
        }),
        EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, () => { seen.defeats++; })
    ];
    for (; t < ms; t += step) {
        if (nextAt != null && t >= nextAt) {
            nextAt = null;
            const e = fixtures.placeAt('ofe_enemy', spot.x, spot.y);
            fixtures.orderAt(heroId, { x: e.x, y: e.y });
        }
        GameLoop.runHandlers(step);
    }
    offs.forEach(off => off());
    return { ...seen, hp: hero().hp.current, maxHp: hero().hp.max, status: hero().status };
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
    RegenSystem.reset();
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

describe('eating between kills', () => {
    it('the same fight eats the same, and ends the same, at 100 ms ticks and at 1,000 ms steps', () => {
        const live = fight(100, 10 * 60_000);
        const away = fight(1000, 10 * 60_000);

        expect(away).toEqual(live);
        // The case really arose: rests began under a quarter health and the hero ate in them.
        expect(live.kills).toBeGreaterThanOrEqual(8);
        expect(live.restMeals).toBeGreaterThan(live.kills);
    }, 120_000);

    it('a resting hero eats at most one meal a second of game time', () => {
        const heroId = buildBoard();
        const hero = GameState.state.heroes.find(h => h.id === heroId);
        // Off the enemy, idle and hurt: nothing but the rest's own eating heals them.
        hero.status = 'idle';
        hero.hp.current = 1;
        let meals = 0;
        const off = EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, () => { meals++; });
        for (let t = 0; t < 2500; t += 100) RegenSystem.tick(100);
        off();
        // At 0, 1,000 and 2,000 ms, still under a quarter after each crumb.
        expect(meals).toBe(3);
    });
});
