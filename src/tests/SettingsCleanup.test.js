// @vitest-environment jsdom
// the Settings screen had 13 controls that did nothing. Four named retired
// concepts (Tray, cards, boost tiles, packs) and are deleted outright. Four
// were already ruled "disabled + coming soon" in round 2 (Theme Mode, Zoom to
// Cursor, Animations, Notification Position). The remaining five are simply
// unwired (the setting is read nowhere) and are now disabled the same way,
// until a later wave wires them.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../ui/modals/SettingsModal.jsx';
import { SettingsManager } from '../systems/core/SettingsManager.js';

const h = React.createElement;

function openTab(label) {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(label));
    fireEvent.click(btn);
}

const mount = () => render(h(SettingsModal, { isOpen: true, onClose: () => {} }));

beforeEach(() => {
    // Injected by Vite's `define` in the real build; vitest runs its own
    // config without it, so the modal's version footer needs a stand-in.
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test');
    localStorage.clear();
    SettingsManager.settings = SettingsManager._deepMerge({}, SettingsManager.getAll());
    SettingsManager.resetOptions();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('CR3-033: the four retired controls are gone', () => {
    it('never renders Large Tray Tokens, Card Badge Tooltips, Boost Tile Tooltips or Instant Pack Reveal', () => {
        mount();
        for (const tab of ['Accessibility', 'Notifications', 'Gameplay', 'Audio', 'Dev Tools']) {
            openTab(tab);
            expect(document.body.textContent).not.toContain('Large Tray Tokens');
            expect(document.body.textContent).not.toContain('Card Badge Tooltips');
            expect(document.body.textContent).not.toContain('Boost Tile Tooltips');
            expect(document.body.textContent).not.toContain('Instant Pack Reveal');
        }
    });
});

describe('CR3-033: the previously-ruled controls are disabled with "Coming soon"', () => {
    it('Theme Mode, Zoom to Cursor and Animations (Accessibility tab)', () => {
        mount();
        for (const key of ['gameplay.themeMode', 'ui.zoomToCursor', 'gameplay.enableAnimations']) {
            const row = document.querySelector(`[data-setting="${key}"]`);
            expect(row).not.toBeNull();
            expect(row.getAttribute('data-setting-disabled')).toBe('true');
            expect(row.textContent).toContain('Coming soon');
        }
    });

});

describe('the Notifications tab is one switch, for the item stubs', () => {
    it('shows only the item-stub switch: the position and message toggles are gone', () => {
        mount();
        openTab('Notifications');
        for (const key of ['notifications.position', 'showSystemMessages', 'showLevelUpMessages', 'showLootMessages']) {
            expect(document.querySelector(`[data-setting="${key}"]`)).toBeNull();
        }
        expect(document.body.textContent).not.toContain('Notification Position');
        const row = document.querySelector('[data-setting="notifications.itemStubs"]');
        expect(row).not.toBeNull();
        expect(row.getAttribute('data-setting-disabled')).not.toBe('true');
    });

    it('the switch turns the item stubs off and on', () => {
        mount();
        openTab('Notifications');
        const toggle = document.querySelector('[data-setting="notifications.itemStubs"] button');
        expect(SettingsManager.get('notifications.itemStubs')).toBe(true);
        fireEvent.click(toggle);
        expect(SettingsManager.get('notifications.itemStubs')).toBe(false);
        fireEvent.click(toggle);
        expect(SettingsManager.get('notifications.itemStubs')).toBe(true);
    });
});

describe('CR3-033: the unwired controls are disabled with "Coming soon"', () => {
    it('Master Tooltips and Item Tooltips (Gameplay tab)', () => {
        mount();
        openTab('Gameplay');
        for (const key of ['ui.tooltipsEnabled', 'ui.tooltipsItems']) {
            const row = document.querySelector(`[data-setting="${key}"]`);
            expect(row).not.toBeNull();
            expect(row.getAttribute('data-setting-disabled')).toBe('true');
        }
    });
});

describe('CR3-033: a disabled control cannot be flipped, and live ones still work', () => {
    it('clicking a disabled toggle does not change the stored setting', () => {
        const before = SettingsManager.get('ui.zoomToCursor');
        mount();
        const row = document.querySelector('[data-setting="ui.zoomToCursor"]');
        const toggle = row.querySelector('button');
        expect(toggle.disabled).toBe(true);
        fireEvent.click(toggle);
        expect(SettingsManager.get('ui.zoomToCursor')).toBe(before);
    });

    it('changing a disabled select does not change the stored setting', () => {
        const before = SettingsManager.get('gameplay.themeMode');
        mount();
        const row = document.querySelector('[data-setting="gameplay.themeMode"]');
        const select = row.querySelector('select');
        expect(select.disabled).toBe(true);
        fireEvent.change(select, { target: { value: 'light' } });
        expect(SettingsManager.get('gameplay.themeMode')).toBe(before);
    });

    it('All Caps Text (a live, unrelated control) still works', () => {
        mount();
        const label = Array.from(document.querySelectorAll('span')).find(s => s.textContent === 'All Caps Text');
        expect(label).toBeTruthy();
        const row = label.closest('.rounded');
        const toggle = row.querySelector('button');
        expect(toggle.disabled).toBe(false);
        const before = SettingsManager.get('ui.allCaps');
        fireEvent.click(toggle);
        expect(SettingsManager.get('ui.allCaps')).toBe(!before);
    });
});

describe('CR3-033: unknown/stale keys in saved settings stay harmless', () => {
    it('loading a save with the retired keys still present does not throw, and ignores them', () => {
        localStorage.setItem('fantasy_guild_settings', JSON.stringify({
            ui: { largeTrayTokens: true, tooltipsCardBadges: false, tooltipsBoostTiles: false, instantPackReveal: true }
        }));
        expect(() => SettingsManager.load()).not.toThrow();
        expect(() => mount()).not.toThrow();
    });
});

describe('the flying-items switch says what it does today', () => {
    it('names the mat and where items land, not cards and inventory', () => {
        mount();
        openTab('Gameplay');
        const row = document.querySelector('[data-setting="ui.itemParticles"]');
        expect(row).not.toBeNull();
        expect(row.textContent).not.toMatch(/cards|inventory|Particles/i);
        expect(row.textContent).toContain('item stubs');
    });
});
