// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as CombatFormulas from '../utils/CombatFormulas.js';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Every fight starts even: when the next enemy of a camp steps up after a kill, both swing timers
 * start from zero, so neither side's first swing comes sooner than its own swing time.
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerItems({
    even_sword: { id: 'even_sword', name: 'Even Sword', type: 'weapon', equipSlot: 'hand', skillRequired: 'melee', damage: 6 }
});

registerTokenTypes({
    even_camp_enemy: {
        id: 'even_camp_enemy', name: 'Even Camp Enemy', tokenType: 'enemy', rarity: 'common',
        theme: 'fixture', uses: 12, sprite: 's_crime', requiresHero: true,
        enemy: { level: 5, style: 'melee' },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [],
            outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }]
        }
    }
});

const STEP = 100;

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a camp fight after a kill', () => {
    it('starts even: neither side swings before its own swing time has passed', () => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        const [hero] = fixtures.makeHeroes(1, {});
        hero.skills.melee = { level: 30, xp: xpForLevel(30) };
        hero.equipment[0] = 'even_sword';
        HeroManager.updateHeroFromSkills(hero);
        hero.hp.current = hero.hp.max;
        const camp = fixtures.placeAt('even_camp_enemy', 400, 400);
        fixtures.orderAt(hero.id, { x: camp.x, y: camp.y });
        TileModifiers.rebuildAll();

        const heroSpeed = CombatFormulas.heroAttackSpeedMs(HeroManager.getHero(hero.id));
        const enemySpeed = CombatFormulas.enemyAttackSpeedMs(enemyProfileOf(getTokenType('even_camp_enemy')));

        let now = 0;
        const fights = [];
        let current = null;
        const offs = [
            EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, () => { current = { engaged: now, hero: null, enemy: null }; fights.push(current); }),
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, () => { if (current && current.hero == null) current.hero = now; }),
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATE, () => { if (current && current.hero == null) current.hero = now; }),
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, () => { if (current && current.enemy == null) current.enemy = now; })
        ];
        for (let i = 0; i < 3 * 60_000 / STEP; i++) {
            now += STEP;
            GameLoop.runHandlers(STEP);
        }
        offs.forEach(off => off());

        // The first engagement starts from a fresh fight; every later one follows a kill.
        const afterKill = fights.slice(1).filter(f => f.hero != null && f.enemy != null);
        expect(afterKill.length).toBeGreaterThanOrEqual(3);
        for (const f of afterKill) {
            expect({ hero: f.hero - f.engaged, enemy: f.enemy - f.engaged })
                .toEqual({ hero: Math.ceil(heroSpeed / STEP) * STEP, enemy: Math.ceil(enemySpeed / STEP) * STEP });
        }
    }, 60_000);
});
