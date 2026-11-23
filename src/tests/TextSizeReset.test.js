// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { TypographyScaleModal, DEFAULT_FONT_SIZES } from '../ui/modals/TypographyScaleModal.jsx';

/** The Text size window: Reset Defaults is a preview like the sliders, kept only by Save & Close. */

const h = React.createElement;
const CUSTOM = Object.fromEntries(DEFAULT_FONT_SIZES.map(f => [f.key, f.defaultVal + 2]));
const DEFAULTS = Object.fromEntries(DEFAULT_FONT_SIZES.map(f => [f.key, f.defaultVal]));
const shown = () => Object.fromEntries(DEFAULT_FONT_SIZES.map(f =>
    [f.key, parseInt(document.documentElement.style.getPropertyValue(f.key), 10)]));
let before;

beforeEach(() => {
    before = SettingsManager.get('ui.fontSizes');
    SettingsManager.set('ui.fontSizes', { ...CUSTOM });
});
afterEach(() => {
    cleanup();
    SettingsManager.set('ui.fontSizes', before);
});

const open = () => render(h(TypographyScaleModal, { isOpen: true, onClose: () => {} }));
const press = (words) => fireEvent.click(screen.getByText(words).closest('button'));

describe('Reset Defaults in the Text size window', () => {
    it('previews the defaults without storing them; the X puts back and keeps the custom sizes', () => {
        open();
        press('Reset defaults');
        expect(shown()).toEqual(DEFAULTS);
        expect(SettingsManager.get('ui.fontSizes')).toEqual(CUSTOM);
        fireEvent.click(document.querySelector('[data-close-x]'));
        expect(shown()).toEqual(CUSTOM);
        expect(SettingsManager.get('ui.fontSizes')).toEqual(CUSTOM);
        // The next change to any setting no longer snaps the text to the defaults.
        SettingsManager.save();
        expect(shown()).toEqual(CUSTOM);
    });

    it('Save & Close keeps the defaults', () => {
        open();
        press('Reset defaults');
        press('Save & close');
        expect(SettingsManager.get('ui.fontSizes')).toEqual(DEFAULTS);
        expect(shown()).toEqual(DEFAULTS);
    });
});
