import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { registerSkillPerks, perkRowsFor } from '../config/registries/perkRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { tokenCardModel, CARD_BLOCK } from '../ui/components/board/tokenCard.js';
import { setUpManyHandsScene, QA_MH } from '../ui/dev/manyHandsScene.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * The QA panel's Many Hands scene (brief 800 P3's look), on the shipped Workshop, played through the
 * real loop: both recipes run side by side, the Leather runs dry of Hide while the Charcoal carries
 * on, the card names the Leather's want and the mat's mark stays clear. ⚠️ Deleted with the scene
 * once the look is accepted.
 */

const step = (ms) => { for (let t = 0; t < ms; t += 100) GameLoop.runHandlers(100); };
const made = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);
let craftingPerks;

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
    craftingPerks = perkRowsFor('crafting');
});
beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.clearAll();
    BoardCombat.clearAll();
});
afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
});
afterAll(() => {
    registerSkillPerks({ crafting: { perks: craftingPerks } });
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the Many Hands scene', () => {
    it('two recipes side by side; the second runs dry, the card says so, the first carries on', () => {
        const r = setUpManyHandsScene();
        expect(r).toMatchObject({ ok: true });
        // Crafting's own perks are kept beside the Test one.
        expect(perkRowsFor('crafting').map(p => p.effectId)).toEqual(expect.arrayContaining([...craftingPerks.map(p => p.effectId), QA_MH.PERK]));
        const seen = { first: 0, second: 0 };
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
            if (p.instanceId !== r.instanceId) return;
            if (p.lane === 2) seen.second++;
            else seen.first++;
        });
        step(90_000);
        off();
        const station = BoardState.getTokenById(r.instanceId);
        expect(BoardState.workerOf(r.instanceId)).toBe(r.heroId);
        expect(seen.second).toBe(2);
        expect(seen.first).toBeGreaterThan(seen.second);
        expect(made(QA_MH.SECOND_MAKES)).toBe(2);
        expect(made(QA_MH.FIRST_MAKES)).toBe(seen.first);
        expect(station.alert ?? null).toBeNull();
        expect(station.secondAlert).toBe(ALERT.INPUTS);
        const block = tokenCardModel(QA_MH.STATION, r.instanceId).blocks.find(b => b.id === CARD_BLOCK.SECOND);
        expect(block).toMatchObject({ open: true, problem: { kind: ALERT.INPUTS, text: 'Needs Hide' } });
    }, 60_000);
});
