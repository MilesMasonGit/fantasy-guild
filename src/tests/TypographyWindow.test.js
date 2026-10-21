// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { SettingsModal } from '../ui/modals/SettingsModal.jsx';
import { SettingsManager } from '../systems/core/SettingsManager.js';

const h = React.createElement;
const KEY = '--font-size-xs';
const rootSize = () => document.documentElement.style.getPropertyValue(KEY);

function openTypography(onClose = () => {}) {
    render(h(SettingsModal, { isOpen: true, onClose }));
    const adjust = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Adjust Scale'));
    act(() => { fireEvent.click(adjust); });
    return document.querySelector('[data-typography-window]');
}

function slide(win, value) {
    // The second slider is XS.
    const input = win.querySelectorAll('input[type="range"]')[1];
    act(() => { fireEvent.change(input, { target: { value: String(value) } }); });
}

beforeEach(() => {
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test');
    localStorage.clear();
    SettingsManager.resetOptions();
    SettingsManager.set('ui.fontSizes', { [KEY]: 16 });
    SettingsManager.applyFontSizes();
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty(KEY);
});

describe('the Typography window is a window of its own', () => {
    it('is not drawn inside the Settings panel', () => {
        const win = openTypography();
        expect(win).not.toBeNull();
        const settingsTitle = [...document.querySelectorAll('h3')].find(t => t.textContent === 'Settings');
        const settingsPanel = settingsTitle.closest('[id^="headlessui-dialog-panel"]') || settingsTitle.parentElement.parentElement;
        expect(settingsPanel.contains(win)).toBe(false);
    });
});

describe('leaving the Typography window', () => {
    it('Escape puts back the sizes it opened with, and closes only the Typography window', () => {
        const closeSettings = vi.fn();
        const win = openTypography(closeSettings);
        slide(win, 30);
        expect(rootSize()).toBe('30px');
        act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
        expect(document.querySelector('[data-typography-window]')).toBeNull();
        expect(rootSize()).toBe('16px');
        expect(SettingsManager.get('ui.fontSizes')[KEY]).toBe(16);
        expect(closeSettings).not.toHaveBeenCalled();
    });

    it('Save & Close keeps the new sizes', () => {
        const win = openTypography();
        slide(win, 22);
        const save = [...win.querySelectorAll('button')].find(b => b.textContent.includes('Save & Close'));
        act(() => { fireEvent.click(save); });
        expect(rootSize()).toBe('22px');
        expect(SettingsManager.get('ui.fontSizes')[KEY]).toBe(22);
    });
});
