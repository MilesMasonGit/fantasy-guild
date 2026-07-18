import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as SlotHelper from '../systems/core/SaveSlotHelper.js';
import { GAME_VERSION } from '../state/StateSchema.js';

// Wave 5: save-path robustness — validator gating (CR-008), rolling backup
// and export/import (CR-054).

vi.mock('../config/registries/cardRegistry.js', () => ({
    getCard: vi.fn(() => null),
    CARD_TYPES: { TASK: 'task', COMBAT: 'combat', STATION: 'station' }
}));

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(),
    error: vi.fn(), getQueue: vi.fn(() => [])
}));

vi.mock('../systems/core/SettingsManager.js', () => ({
    SettingsManager: { get: vi.fn(() => 10) }
}));

const SLOT = 0;

describe('Save durability (CR-008 / CR-054)', () => {
    beforeEach(() => {
        localStorage.clear();
        GameState.initNew();
        SaveManager.currentSlot = SLOT;
        SaveManager.isResetting = false;
    });

    it('writes a save and keeps the previous one as a backup', () => {
        GameState.state.currency.gold = 100;
        expect(SaveManager.save(false)).toBe(true);
        expect(localStorage.getItem(SlotHelper.getBackupKey(SLOT))).toBeNull();

        GameState.state.currency.gold = 200;
        expect(SaveManager.save(false)).toBe(true);

        const backup = JSON.parse(localStorage.getItem(SlotHelper.getBackupKey(SLOT)));
        const current = JSON.parse(localStorage.getItem(SlotHelper.getSlotKey(SLOT)));
        expect(backup.state.currency.gold).toBe(100);
        expect(current.state.currency.gold).toBe(200);
    });

    it('refuses to load a structurally invalid save', async () => {
        SaveManager.save(false);
        const stored = JSON.parse(localStorage.getItem(SlotHelper.getSlotKey(SLOT)));
        stored.state.heroes = 'not-an-array';
        localStorage.setItem(SlotHelper.getSlotKey(SLOT), JSON.stringify(stored));

        expect(await SaveManager.loadSlot(SLOT)).toBe(false);
    });

    it('recovers from the backup when the current save is damaged', async () => {
        GameState.state.currency.gold = 777;
        SaveManager.save(false);          // good save
        GameState.state.currency.gold = 999;
        SaveManager.save(false);          // rolls 777 into backup

        const stored = JSON.parse(localStorage.getItem(SlotHelper.getSlotKey(SLOT)));
        stored.state.inventory = null;    // corrupt the current save
        localStorage.setItem(SlotHelper.getSlotKey(SLOT), JSON.stringify(stored));

        expect(await SaveManager.loadSlot(SLOT)).toBe(true);
        expect(GameState.state.currency.gold).toBe(777);   // came from the backup
    });

    it('deleting a slot clears its backup too', () => {
        SaveManager.save(false);
        SaveManager.save(false);
        expect(localStorage.getItem(SlotHelper.getBackupKey(SLOT))).not.toBeNull();
        SaveManager.deleteSlot(SLOT);
        expect(localStorage.getItem(SlotHelper.getBackupKey(SLOT))).toBeNull();
    });

    it('exports a save and imports it back into another slot', async () => {
        GameState.state.currency.gold = 4242;
        const exported = SaveManager.exportSave();
        expect(typeof exported).toBe('string');

        const result = await SaveManager.importSave(1, exported);
        expect(result.success).toBe(true);

        const stored = JSON.parse(localStorage.getItem(SlotHelper.getSlotKey(1)));
        expect(stored.state.currency.gold).toBe(4242);
        expect(stored.version).toBe(GAME_VERSION);
    });

    it('rejects an import that is not a save', async () => {
        expect((await SaveManager.importSave(1, 'not json')).success).toBe(false);
        expect((await SaveManager.importSave(1, '{"nope":true}')).success).toBe(false);
    });
});
