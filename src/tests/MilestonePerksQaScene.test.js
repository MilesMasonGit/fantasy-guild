// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { resetMatTuning } from '../config/matTuning.js';
import { registerSkillPerks, perkRowsFor } from '../config/registries/perkRegistry.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { earnedPerks } from '../systems/hero/HeroPerks.js';
import { bubblesOf, clearAllHeroBubbles } from '../ui/components/dock/heroBarBubbles.js';
import { setUpForestryTen } from '../ui/dev/perksDev.js';

/**
 * The QA panel's "Hero reaches Forestry 10": the owner's eye-check scene. With no authored Forestry
 * perks it installs the stand-ins, and the woodcutter's first log lifts them to 10 with the perk named.
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

describe('the QA scene for a hero reaching Forestry 10', () => {
    it('sends a woodcutter one XP short of 10 to an Oak, and the first log names the perk', () => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        clearAllHeroBubbles();
        const r = setUpForestryTen();
        expect(r).toMatchObject({ ok: true, name: 'QA Woodcutter', standIns: true, perk: 'Clean Felling' });
        expect(perkRowsFor('forestry').map(p => p.level)).toEqual([10, 25]);
        const hero = HeroManager.getAllHeroes().find(h => h.name === 'QA Woodcutter');
        expect(earnedPerks(hero)).toEqual([]);

        for (let t = 0; t < 30_000 && hero.skills.forestry.level < 10; t += 100) GameLoop.runHandlers(100);
        expect(hero.skills.forestry.level).toBe(10);
        expect(earnedPerks(hero).map(p => p.effectId)).toEqual(['effect_clean_felling']);
        expect(bubblesOf(hero.id).map(b => b.text)).toEqual(['10 Forestry!', 'Perk: Clean Felling']);
    }, 60_000);
});
