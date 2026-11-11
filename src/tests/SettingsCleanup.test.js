// @vitest-environment jsdom
// The settings window: three tabs (Display, Game, Audio) and Dev Tools in dev builds only. The
// five "coming soon" controls are gone with the settings only they read; the 1-minute auto-save
// is for dev builds; a stored settings file from an older build keeps working.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../ui/modals/SettingsModal.jsx';
import { SettingsManager, autoSaveChoices } from '../systems/core/SettingsManager.js';

const h = React.createElement;

const tabButton = (id) => document.querySelector(`[data-settings-tab="${id}"]`);
const openTab = (id) => fireEvent.click(tabButton(id));
const settingKeys = () => [...document.querySelectorAll('[data-setting]')].map(e => e.getAttribute('data-setting'));

const mount = (Modal = SettingsModal) => render(h(Modal, { isOpen: true, onClose: () => {} }));

const RETIRED = ['ui.tooltipsEnabled', 'ui.tooltipsItems', 'ui.zoomToCursor', 'gameplay.enableAnimations', 'gameplay.themeMode'];

/** A settings file as an older build stored it: the five retired keys, a 1-minute auto-save, the player's own choices. */
const OLD_FILE = {
    ui: {
        tooltipsEnabled: false, tooltipsItems: false, zoomToCursor: false, largeTrayTokens: true,
        fontFamily: 'dotgothic', allCaps: false, bubbleMenuRight: true, backgroundTile: 'u_table_forest', itemParticles: false
    },
    gameplay: { themeMode: 'light', enableAnimations: false, autoSaveIntervalMinutes: 1 },
    notifications: { itemStubs: false },
    audio: { masterVolume: 40, musicVolume: 20, sfxVolume: 70 }
};

beforeEach(() => {
    // Injected by Vite's `define` in the real build; vitest runs its own
    // config without it, so the modal's version footer needs a stand-in.
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test');
    localStorage.clear();
    SettingsManager.resetOptions();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe('the settings window has three tabs, and Dev Tools in a dev build', () => {
    it('Display, Game, Audio, then Dev Tools, in that order', () => {
        mount();
        const tabs = [...document.querySelectorAll('[data-settings-tab]')].map(b => b.textContent.trim());
        expect(tabs).toEqual(['Display', 'Game', 'Audio', 'Dev Tools']);
    });

    it('each tab holds the controls the brief lists', () => {
        mount();
        expect(settingKeys()).toEqual([
            'ui.fontFamily', 'ui.allCaps', 'ui.bubbleMenuRight', 'ui.backgroundTile', 'ui.itemParticles', 'notifications.itemStubs',
            'ui.limesBlurbs'
        ]);
        expect(document.body.textContent).toContain('Typography Scale');
        openTab('game');
        expect(settingKeys()).toEqual(['gameplay.autoSaveIntervalMinutes']);
        expect(document.body.textContent).toContain('Save Game Now');
        openTab('audio');
        expect(settingKeys()).toEqual(['audio.masterVolume', 'audio.musicVolume', 'audio.sfxVolume']);
        openTab('dev');
        expect(settingKeys()).toEqual(['debugMode']);
    });

    it('the five coming-soon controls and the four retired ones are gone from every tab', () => {
        mount();
        for (const tab of ['display', 'game', 'audio', 'dev']) {
            openTab(tab);
            const text = document.body.textContent;
            for (const gone of ['Coming soon', 'Theme Mode', 'Zoom to Cursor', 'Animations', 'Master Tooltips', 'Item Tooltips',
                'Large Tray Tokens', 'Card Badge Tooltips', 'Boost Tile Tooltips', 'Instant Pack Reveal']) {
                expect(text, `${tab}: ${gone}`).not.toContain(gone);
            }
            expect(document.querySelector('[data-setting-disabled]')).toBeNull();
        }
    });

    it('the settings only those controls read are gone from the defaults', () => {
        for (const key of RETIRED) expect(SettingsManager.get(key), key).toBeUndefined();
    });
});

describe('the controls still work', () => {
    it('Item Stubs, now on Display, turns the stubs off and on', () => {
        mount();
        const toggle = document.querySelector('[data-setting="notifications.itemStubs"] button');
        expect(SettingsManager.get('notifications.itemStubs')).toBe(true);
        fireEvent.click(toggle);
        expect(SettingsManager.get('notifications.itemStubs')).toBe(false);
        fireEvent.click(toggle);
        expect(SettingsManager.get('notifications.itemStubs')).toBe(true);
    });

    it('All Caps Text and Menu on Right Side flip their settings', () => {
        mount();
        for (const key of ['ui.allCaps', 'ui.bubbleMenuRight']) {
            const before = SettingsManager.get(key);
            fireEvent.click(document.querySelector(`[data-setting="${key}"] button`));
            expect(SettingsManager.get(key), key).toBe(!before);
        }
    });

    it('the auto-save choice is stored as minutes', () => {
        mount();
        openTab('game');
        fireEvent.change(document.querySelector('[data-setting="gameplay.autoSaveIntervalMinutes"] select'), { target: { value: '60' } });
        expect(SettingsManager.get('gameplay.autoSaveIntervalMinutes')).toBe(60);
    });

    it('the flying-items switch names the mat and where items land, not cards and inventory', () => {
        mount();
        const row = document.querySelector('[data-setting="ui.itemParticles"]');
        expect(row.textContent).not.toMatch(/cards|inventory|Particles/i);
        expect(row.textContent).toContain('item stubs');
    });
});

describe('the 1-minute auto-save is for dev builds', () => {
    it('a dev build offers 1 minute; a shipped one offers 10 minutes, 1 hour and off', () => {
        expect(autoSaveChoices(true)).toEqual([1, 10, 60, 0]);
        expect(autoSaveChoices(false)).toEqual([10, 60, 0]);
    });

    it('a dev build shows the 1-minute choice', () => {
        mount();
        openTab('game');
        const options = [...document.querySelectorAll('[data-setting="gameplay.autoSaveIntervalMinutes"] option')].map(o => o.value);
        expect(options).toEqual(['1', '10', '60', '0']);
    });

    it('a shipped build shows neither the 1-minute choice nor the Dev Tools tab', async () => {
        vi.stubEnv('DEV', false);
        vi.resetModules();
        const { SettingsModal: ShippedModal } = await import('../ui/modals/SettingsModal.jsx');
        mount(ShippedModal);
        expect(document.querySelector('[data-settings-tab="dev"]')).toBeNull();
        expect([...document.querySelectorAll('[data-settings-tab]')].map(b => b.textContent.trim())).toEqual(['Display', 'Game', 'Audio']);
        openTab('game');
        const options = [...document.querySelectorAll('[data-setting="gameplay.autoSaveIntervalMinutes"] option')].map(o => o.value);
        expect(options).toEqual(['10', '60', '0']);
    });
});

describe('a settings file from an older build keeps working', () => {
    it('in a dev build: the player\'s choices load, the retired keys are dropped, 1 minute stays', () => {
        localStorage.setItem('fantasy_guild_settings', JSON.stringify(OLD_FILE));
        expect(() => SettingsManager.load()).not.toThrow();
        expect(SettingsManager.get('ui.fontFamily')).toBe('dotgothic');
        expect(SettingsManager.get('ui.allCaps')).toBe(false);
        expect(SettingsManager.get('ui.bubbleMenuRight')).toBe(true);
        expect(SettingsManager.get('ui.backgroundTile')).toBe('u_table_forest');
        expect(SettingsManager.get('ui.itemParticles')).toBe(false);
        expect(SettingsManager.get('notifications.itemStubs')).toBe(false);
        expect(SettingsManager.get('audio.musicVolume')).toBe(20);
        expect(SettingsManager.get('gameplay.autoSaveIntervalMinutes')).toBe(1);
        for (const key of RETIRED) expect(SettingsManager.get(key), key).toBeUndefined();
        expect(() => mount()).not.toThrow();
        // The window shows the loaded choices.
        expect(document.querySelector('[data-setting="ui.fontFamily"] select').value).toBe('dotgothic');
    });

    it('in a shipped build: a 1-minute auto-save becomes the 10-minute default, the rest as stored', async () => {
        localStorage.setItem('fantasy_guild_settings', JSON.stringify(OLD_FILE));
        vi.stubEnv('DEV', false);
        vi.resetModules();
        const { SettingsManager: Shipped } = await import('../systems/core/SettingsManager.js');
        Shipped.load();
        expect(Shipped.get('gameplay.autoSaveIntervalMinutes')).toBe(10);
        expect(Shipped.get('ui.fontFamily')).toBe('dotgothic');
        expect(Shipped.get('audio.sfxVolume')).toBe(70);
        for (const key of RETIRED) expect(Shipped.get(key), key).toBeUndefined();
    });

    it('a shipped build keeps a stored 10 minutes, 1 hour or off', async () => {
        vi.stubEnv('DEV', false);
        vi.resetModules();
        const { SettingsManager: Shipped } = await import('../systems/core/SettingsManager.js');
        for (const minutes of [10, 60, 0]) {
            localStorage.setItem('fantasy_guild_settings', JSON.stringify({ gameplay: { autoSaveIntervalMinutes: minutes } }));
            Shipped.load();
            expect(Shipped.get('gameplay.autoSaveIntervalMinutes')).toBe(minutes);
        }
    });
});

describe('the default font', () => {
    it('is Silkscreen, and the window marks it as the default', () => {
        expect(SettingsManager.get('ui.fontFamily')).toBe('silkscreen');
        mount();
        const select = document.querySelector('[data-setting="ui.fontFamily"] select');
        const label = [...select.options].find(o => o.value === 'silkscreen').textContent;
        expect(label).toContain('(Default)');
        expect([...select.options].filter(o => o.textContent.includes('(Default)'))).toHaveLength(1);
    });
});
