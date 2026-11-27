// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { skillsWithPerks } from '../config/registries/perkRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { build } from '../../bench/scenarios/hour-after-load.mjs';

/**
 * The catch-up hour (S8, S8L, S8F) is played without the shipped skill perks, so its Bank carries no
 * luck the fidelity gate would read as a difference between 1000 ms steps and 100 ms ticks. With them,
 * the Forestry perk's Double Loot on the hour's producer cycles moved the Bank by up to 1.6 % between
 * the two on seeds 1 to 5 by chance alone (bench/README.md, "The catch-up gates").
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the catch-up hour (S8, S8L, S8F)', () => {
    it('is built without the shipped skill perks: no hero rolls Double Loot at a producer', () => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        BoardCombat.clearAll();
        build({ fixtures, setMatTuning });

        expect(skillsWithPerks()).toEqual([]);
        const producers = BoardState.tokens().filter(t => t.typeId === 'fixture_producer');
        const heroes = GameState.state.heroes;
        expect(producers.length).toBeGreaterThan(0);
        expect(heroes).toHaveLength(8);
        for (const token of producers) {
            for (const hero of heroes) {
                expect(TileModifiers.resolveHeroAxis(token.id, EFFECT_TYPES.LOOT_MULT, 0, 'forestry', hero.id)).toBe(0);
            }
        }
    });
});
