import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Laboratories from '../systems/board/Laboratories.js';
import * as Mastery from '../systems/progression/Mastery.js';
import { resetMatTuning } from '../config/matTuning.js';
import { setUpScienceScene, QA_OAK } from '../ui/dev/scienceScene.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * The QA panel's Laboratory scene (brief 810 K6's eye-check), played through the real loop: one
 * click lays out a Laboratory with its scientist, a University and the QA Oaks; once an Oak is
 * picked the Oak kind's rank rises and every QA Oak, the far one too, works faster.
 * ⚠️ Deleted with the scene once the eye-check is accepted.
 */

const step = (ms) => { for (let t = 0; t < ms; t += 100) GameLoop.runHandlers(100); };

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});
afterEach(() => { GameLoop.stop(); resetMatTuning(); });

describe('the Laboratory scene', () => {
    it('lays out the Laboratory, its scientist, the University and the QA Oaks, nothing chosen; a pick studies and every Oak takes the rank', () => {
        GameState.initNew();
        InventoryManager.init();
        TileModifiers.clearAll();
        const r = setUpScienceScene();
        expect(r.ok).toBe(true);
        const lab = BoardState.getTokenById(r.labId);
        expect(Laboratories.targetOf(lab)).toBeNull();
        expect(Laboratories.nodesInReach(lab).map(n => n.id).sort()).toEqual([...r.oakIds].sort());
        const scientist = GameState.state.heroes.find(h => h.name === 'QA Scientist');
        expect(BoardState.flagOf(scientist.id)?.pinnedTo).toBe(lab.id);

        expect(Laboratories.setTarget(lab, r.oakIds[0])).toBe(true);
        // Four seconds a study, a quarter off with the University: two studies in about seven seconds.
        step(8000);
        expect(Mastery.rankOf(QA_OAK)).toBeGreaterThanOrEqual(1);
        expect(TileModifiers.workTimeOf(r.farOakId, 3000, 'forestry')).toBe(2400);

        // Run again: the QA Oak mastery starts from none.
        expect(setUpScienceScene().ok).toBe(true);
        expect(Mastery.pointsOf(QA_OAK)).toBe(0);
        expect(TileModifiers.workTimeOf(r.farOakId, 3000, 'forestry')).toBe(3000);
    });
});
