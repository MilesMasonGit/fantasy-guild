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
import { perkTitle } from '../ui/components/dock/heroPerks.js';
import { EFFECTS } from '../config/registries/effectRegistry.js';
import { perksEarnedAt } from '../systems/hero/perkTable.js';
import { setUpForestryTen } from '../ui/dev/perksDev.js';

/**
 * The QA panel's "Hero reaches Forestry 10": the owner's eye-check scene. It uses the authored
 * Forestry perks, or with none installs the stand-ins, and the woodcutter's first log lifts them to
 * 10 with the perk named.
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

/** Forestry's perk table as shipped, kept before a test replaces it. */
const SHIPPED_FORESTRY = perkRowsFor('forestry');

function freshGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    clearAllHeroBubbles();
}

describe('the QA scene for a hero reaching Forestry 10', () => {
    it.skipIf(!perksEarnedAt(SHIPPED_FORESTRY, 10).length)('uses the authored Forestry perks when there are some', () => {
        registerSkillPerks({ forestry: { perks: SHIPPED_FORESTRY } });
        freshGame();
        const r = setUpForestryTen();
        expect(r).toMatchObject({ ok: true, name: 'QA Woodcutter', standIns: false });
        expect(r.perk).toBe(EFFECTS[SHIPPED_FORESTRY[0].effectId]?.name);
        const hero = HeroManager.getAllHeroes().find(h => h.name === 'QA Woodcutter');
        expect(earnedPerks(hero).map(p => p.effectId)).toEqual(perksEarnedAt(SHIPPED_FORESTRY, 9).map(p => p.effectId));

        for (let t = 0; t < 30_000 && hero.skills.forestry.level < 10; t += 100) GameLoop.runHandlers(100);
        expect(hero.skills.forestry.level).toBe(10);
        const atTen = perksEarnedAt(SHIPPED_FORESTRY, 10);
        expect(earnedPerks(hero).map(p => p.effectId)).toEqual(atTen.map(p => p.effectId));
        expect(bubblesOf(hero.id).map(b => b.text)).toEqual([
            '10 Forestry!', ...atTen.filter(p => p.level === 10).map(p => `Perk: ${perkTitle(p)}`)
        ]);
    }, 60_000);

    it('with no authored Forestry perks, installs the stand-ins: the first log names Clean Felling', () => {
        registerSkillPerks({ forestry: { perks: [] } });
        freshGame();
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
