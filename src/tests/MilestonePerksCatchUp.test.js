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
import { AudioSystem } from '../systems/core/AudioSystem.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { earnedPerks } from '../systems/hero/HeroPerks.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * A forester one XP short of Forestry 10, whose perk there doubles the logs they fell, left alone
 * for a while: the same in 100 ms steps, in 1000 ms steps and through the game's own catch-up, and
 * holding the perk draws not one random number more than holding none.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 60_000;
const TREE = { x: 700, y: 500 };

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerTokenTypes({
    k4cu_tree: {
        id: 'k4cu_tree', name: 'K4 Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_nature',
        uses: null, requiresHero: true, staysPut: true,
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [],
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }] }
    }
});

registerEffects({
    k4cu_double_logs: {
        id: 'k4cu_double_logs', name: 'Double Logs',
        statements: [{
            id: 'stm_k4cu_double', keyword: KEYWORD.PROVIDES,
            payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 1, category: 'forestry' },
            to: { mode: 'all', value: '' }, reach: 'nearby'
        }]
    }
});

function buildBoard(withPerk) {
    resetMatTuning();
    registerSkillPerks({ forestry: { perks: withPerk ? [{ level: 10, effectId: 'k4cu_double_logs' }] : [] } });
    GameState.initNew();
    InventoryManager.init();
    const [forester] = fixtures.makeHeroes(1, { forestry: 9 });
    forester.skills.forestry.xp = xpForLevel(10) - 1;
    fixtures.placeAt('k4cu_tree', TREE.x, TREE.y);
    fixtures.orderAt(forester.id, TREE);
    TileModifiers.rebuildAll();
    return forester;
}

function snapshot(forester) {
    return {
        level: forester.skills.forestry.level,
        xp: forester.skills.forestry.xp,
        perks: earnedPerks(forester).map(p => `${p.skillId} ${p.level}`),
        wood: InventoryManager.getItemCount('fixture_oak_wood') + SpriteLayer.countOnBoard('fixture_oak_wood')
    };
}

function plainLoop(step, withPerk = true) {
    const forester = buildBoard(withPerk);
    const spy = vi.spyOn(Math, 'random');
    for (let t = 0; t < AWAY_MS; t += step) GameLoop.runHandlers(step);
    const draws = spy.mock.calls.length;
    spy.mockRestore();
    return { ...snapshot(forester), draws };
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
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    registerSkillPerks({ forestry: { perks: [] } });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ a perk reached while the player is away', () => {
    it('is held and works the same in 100 ms and 1000 ms steps and through the catch-up', async () => {
        const small = plainLoop(100);
        const big = plainLoop(1000);
        expect(big).toEqual(small);

        const forester = buildBoard(true);
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const { draws, ...rest } = small;
        expect(snapshot(forester)).toEqual(rest);

        // The first log lifts the forester to 10; every log after it comes out doubled.
        expect(small.level).toBe(10);
        expect(small.perks).toEqual(['forestry 10']);
        const without = plainLoop(100, false);
        expect(without.level).toBe(10);
        expect(without.wood).toBeGreaterThan(10);
        expect(small.wood).toBe(2 * without.wood - 1);
        expect(without.draws).toBeGreaterThan(0);
        // Holding the perk asked the dice nothing new.
        expect(small.draws).toBe(without.draws);
    }, 60_000);
});
