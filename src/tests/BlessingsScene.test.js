import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Shrines from '../systems/board/Shrines.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { setUpBlessingsScene, QA_RAREST_FIND } from '../ui/dev/blessingsScene.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * The QA panel's blessings scene (T-705's eye-check), played through the real loop: the veins give
 * their rarest find every fourth cycle (Fortune), the miners share their Mining XP (Wisdom), and
 * the beginner sent at the Brute flees, losing nothing (Valiant). ⚠️ Deleted with the scene once the
 * eye-check is accepted.
 */

const step = (ms) => { for (let t = 0; t < ms; t += 100) GameLoop.runHandlers(100); };
const heroOf = (id) => GameState.state.heroes.find(h => h.id === id);

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});
afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
});
afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the QA blessings scene', () => {
    it('Fortune gives Quartz every fourth cycle, Wisdom shares the miners\' XP, Valiant lets the beginner flee', () => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        TileModifiers.clearAll();
        const r = setUpBlessingsScene();
        expect(r.ok, r.error).toBe(true);
        expect(Shrines.isLit(BoardState.getTokenById(r.shrineId))).toBe(true);
        const defeats = [];
        const off = EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, (p) => defeats.push(p));
        // Eight cycles of 3 s on each vein.
        step(8 * 3000 + 500);
        off();
        const quartz = InventoryManager.getItemCount(QA_RAREST_FIND) + SpriteLayer.countOnBoard(QA_RAREST_FIND);
        expect(quartz).toBeGreaterThanOrEqual(4);
        for (const id of r.minerIds) {
            // Each: eight cycles of 4 XP, and half of the other's eight.
            expect(heroOf(id).skills.mining.xp - xpForLevel(10)).toBe(8 * 4 + 8 * 2);
        }
        expect(defeats).toEqual([expect.objectContaining({ heroId: r.recruitId, fled: true, lost: [] })]);
        expect(heroOf(r.recruitId).status).toBe('wounded');
    });
});
