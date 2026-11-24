// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(),
    error: vi.fn(), getQueue: vi.fn(() => []), setQuiet: vi.fn()
}));

describe('A new player\'s master volume survives the next load', () => {
    beforeEach(() => {
        localStorage.clear();
        SettingsManager.resetOptions();
        localStorage.clear();
    });

    it('loading with nothing stored sets the marker, so a later load keeps the chosen volume', () => {
        SettingsManager.load();
        SettingsManager.set('audio.masterVolume', 60);
        const kept = Object.entries(localStorage).map(([key]) => [key, localStorage.getItem(key)]);
        SettingsManager.resetOptions();
        localStorage.clear();
        kept.forEach(([key, value]) => localStorage.setItem(key, value));
        SettingsManager.load();
        expect(SettingsManager.get('audio.masterVolume')).toBe(60);
    });

    it('settings stored before the mute still lose their old volume once', () => {
        localStorage.setItem('tabletop_guild_settings', JSON.stringify({ audio: { masterVolume: 100 } }));
        SettingsManager.load();
        expect(SettingsManager.get('audio.masterVolume')).toBe(0);
    });
});
