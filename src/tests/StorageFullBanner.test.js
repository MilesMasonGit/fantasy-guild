// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as SaveFiles from '../systems/core/SaveFiles.js';
import * as Banners from '../systems/notifications/banners.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(),
    error: vi.fn(), getQueue: vi.fn(() => []), setQuiet: vi.fn()
}));

describe('The storage-full banner says what the player can do', () => {
    it('names deleting a slot and no longer mentions export', () => {
        Banners.reset();
        localStorage.clear();
        SaveFiles.useBackend(null);
        GameState.initNew();
        SaveManager.currentSlot = 0;
        SaveManager.isResetting = false;
        SaveManager.resumeSaving();
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
        });
        try {
            SaveManager.save(false);
        } finally {
            spy.mockRestore();
        }
        const message = Banners.getAll().map(b => b.parts?.message ?? b.message).join(' ');
        expect(message).toMatch(/delete/i);
        expect(message).not.toMatch(/export/i);
    });
});
