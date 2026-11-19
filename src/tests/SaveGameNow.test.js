// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as SaveFiles from '../systems/core/SaveFiles.js';
import * as Banners from '../systems/notifications/banners.js';
import { fakeSaveDisk } from './fixtures/fakeSaveDisk.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(),
    error: vi.fn(), getQueue: vi.fn(() => []), setQuiet: vi.fn()
}));

vi.mock('../systems/core/SettingsManager.js', () => ({
    SettingsManager: { get: vi.fn(() => 10) }
}));

describe('Save Game Now answers from the write', () => {
    afterEach(async () => {
        await SaveFiles.flush();
        SaveFiles.useBackend(null);
    });

    describe('desktop', () => {
        let disk;
        beforeEach(async () => {
            localStorage.clear();
            Banners.reset();
            disk = fakeSaveDisk();
            SaveFiles.useBackend(disk);
            await SaveManager.loadSaveFiles();
            GameState.initNew();
            SaveManager.currentSlot = 0;
            SaveManager.isResetting = false;
            SaveManager.resumeSaving();
        });

        it('is true once the file is written', async () => {
            expect(await SaveManager.saveAndConfirm()).toBe(true);
            expect(disk.writes()).toHaveLength(1);
        });

        it('is false when the file cannot be written', async () => {
            disk.failWrites();
            expect(await SaveManager.saveAndConfirm()).toBe(false);
        });

        it('is false when the save is refused', async () => {
            SaveManager.suspendSaving();
            expect(await SaveManager.saveAndConfirm()).toBe(false);
            SaveManager.resumeSaving();
        });
    });

    describe('browser', () => {
        beforeEach(() => {
            localStorage.clear();
            SaveFiles.useBackend(null);
            GameState.initNew();
            SaveManager.currentSlot = 0;
            SaveManager.isResetting = false;
            SaveManager.resumeSaving();
        });

        it('is true when the slot is written and false when storage refuses', async () => {
            expect(await SaveManager.saveAndConfirm()).toBe(true);
            const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('nope'); });
            try {
                expect(await SaveManager.saveAndConfirm()).toBe(false);
            } finally {
                spy.mockRestore();
            }
        });
    });
});
