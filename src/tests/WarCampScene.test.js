// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Camps from '../systems/board/Camps.js';
import * as Flags from '../systems/board/Flags.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { flagStatusLine } from '../ui/components/board/flagText.js';
import { setUpWarCamp } from '../ui/dev/warCampScene.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * The War Camp's QA scene (`warCampScene.js`, for the owner's look; deleted with it): laid round the
 * Guild Hall, its hand clears the four enemies in its reach one at a time and leaves the Goblin
 * outside it alone.
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

describe('⭐ the War Camp QA scene', () => {
    it('lays the camp, four enemies in its reach and one outside, and its hand clears the four, then waits', () => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        BoardCombat.clearAll();
        fixtures.placeAt('token_guild_hall', Math.round(matW() / 2), Math.round(matH() / 2));

        const res = setUpWarCamp();
        expect(res).toMatchObject({ ok: true, inReach: 4 });
        const camp = BoardState.getTokenById(res.campId);
        expect(Camps.isWarCamp(camp)).toBe(true);
        const hand = GameState.state.heroes.find(h => h.name === res.name);
        expect(Flags.pinnedIdOf(hand.id)).toBe(camp.id);
        const four = Camps.campWork(camp).map(t => t.id);

        for (let t = 0; t < 600_000 && four.some(id => BoardState.getTokenById(id)); t += 100) GameLoop.runHandlers(100);
        expect(four.filter(id => BoardState.getTokenById(id))).toEqual([]);
        GameLoop.runHandlers(2000);
        expect(BoardState.getTokenById(res.outsideId)).toBeTruthy();
        expect(BoardCombat.getFight(res.outsideId)).toBe(null);
        expect(flagStatusLine(hand.id)).toBe('Nothing to fight near QA War Camp');
    }, 60_000);
});
