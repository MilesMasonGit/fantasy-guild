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
import * as CatchUp from '../systems/core/CatchUp.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * A kill uses its enemy up, but the time-away summary lists that enemy once, under kills: Tokens
 * used up never lists an enemy.
 */

const NOW = 1_800_000_000_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerItems({
    killsonce_sword: { id: 'killsonce_sword', name: 'Kills-once Sword', type: 'weapon', equipSlot: 'hand', skillRequired: 'melee', damage: 20 }
});

registerTokenTypes({
    killsonce_enemy: {
        id: 'killsonce_enemy', name: 'Kills-once Enemy', tokenType: 'enemy', rarity: 'common',
        theme: 'fixture', uses: 1, sprite: 's_crime', requiresHero: true,
        enemy: { level: 1, style: 'melee' },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }
});

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

afterEach(() => {
    SaveManager.currentSlot = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a kill during time away', () => {
    it('is listed under kills only, never under Tokens used up', async () => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        const [fighter] = fixtures.makeHeroes(1, {});
        fighter.skills.melee = { level: 30, xp: xpForLevel(30) };
        fighter.equipment[0] = 'killsonce_sword';
        HeroManager.updateHeroFromSkills(fighter);
        fighter.hp.current = fighter.hp.max;
        const enemy = fixtures.placeAt('killsonce_enemy', 400, 400);
        fixtures.orderAt(fighter.id, { x: enemy.x, y: enemy.y });
        TileModifiers.rebuildAll();

        const { summary } = await CatchUp.run({
            savedAt: NOW - 5 * 60_000, now: NOW, save: false, yieldFn: () => Promise.resolve()
        });

        expect(BoardState.tokens().some(t => t.typeId === 'killsonce_enemy')).toBe(false);
        expect(summary.fightsWon).toEqual({ total: 1, byEnemy: { killsonce_enemy: 1 } });
        expect(summary.depleted).toEqual({ total: 0, byType: {} });
    }, 30_000);
});
