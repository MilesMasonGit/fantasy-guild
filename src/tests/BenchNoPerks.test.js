// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import { skillsWithPerks, authoredSkillPerks, registerSkillPerks } from '../config/registries/perkRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { buildScenario } from '../../bench/lib/harness.mjs';

import s1 from '../../bench/scenarios/s1-quiet-hall.mjs';
import s2 from '../../bench/scenarios/s2-realistic.mjs';
import s3 from '../../bench/scenarios/s3-torture.mjs';
import s4 from '../../bench/scenarios/s4-push-storm.mjs';
import s5 from '../../bench/scenarios/s5-rebuild-storm.mjs';
import s6 from '../../bench/scenarios/s6-long-idle.mjs';
import s7 from '../../bench/scenarios/s7-waiting-room.mjs';
import s8 from '../../bench/scenarios/s8-catchup.mjs';
import s8f from '../../bench/scenarios/s8f-ticks.mjs';
import s8l from '../../bench/scenarios/s8l-steps.mjs';
import c240 from '../../bench/scenarios/c240-cap.mjs';
import c256 from '../../bench/scenarios/c256-cap.mjs';
import fs from '../../bench/scenarios/fs-fishing.mjs';

/**
 * Every bench scenario is built through the harness's `buildScenario`, which takes the shipped skill
 * perks off first, so a CMS edit of a perk never moves a scenario's work fingerprint.
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const SHIPPED = { ...authoredSkillPerks() };

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

const SCENARIOS = [s1, s2, s3, s4, s5, s6, s7, s8, s8f, s8l, c240, c256, fs];

describe('bench scenarios are built without the shipped skill perks', () => {
    it('the shipped perks exist, so the check below can fail', () => {
        expect(Object.keys(SHIPPED).length).toBeGreaterThan(0);
    });

    for (const scenario of SCENARIOS) {
        it(`${scenario.id}: no skill carries a perk once its board is built`, async () => {
            registerSkillPerks(SHIPPED);
            expect(skillsWithPerks().length).toBeGreaterThan(0);
            resetMatTuning();
            GameState.initNew();
            InventoryManager.init();
            BoardCombat.clearAll();

            await buildScenario(scenario, { fixtures, setMatTuning });

            expect(skillsWithPerks()).toEqual([]);
        });
    }
});
