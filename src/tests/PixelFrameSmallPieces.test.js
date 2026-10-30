// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../ui/modals/SettingsModal.jsx';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { KitButton, KIT_BUTTON_TONE, PixelToggle } from '../ui/components/base/KitButton.jsx';

const h = React.createElement;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** UI_STYLE "Pixel frames": the soft look the kit's small pieces must not fall back to. */
const SOFT_LOOK = /\brounded(-\w+)?\b|shadow-(sm|md|lg|xl|inner|glow|\[)|(?<![-\w])shadow(?![-\w])|gi-shadow-deep|ring-1\b/;
const src = (p) => readFileSync(`src/${p}`, 'utf8');
/** The class strings in a source file (quoted or template literals), comments left out. */
const classStrings = (text) => (text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').match(/(['"`])(?:(?!\1)[^\\]|\\.)*?\1/g) || []);

describe('the surfaces inside windows wear the pixel kit, not soft boxes (UI_STYLE "Pixel frames")', () => {
    const REFRAMED = [
        'ui/components/drawer/BankTab.jsx',
        'ui/components/dock/DockEquipmentGrid.jsx',
        'ui/modals/SettingsModal.jsx',
        'ui/modals/SlotSelectionModal.jsx',
        'ui/modals/TypographyScaleModal.jsx',
        'ui/modals/HeroEditModal.jsx',
        'ui/components/hud/CatchUpOverlay.jsx',
        'ui/components/board/MatModeControls.jsx',
        'ui/components/drawer/HeroInspectionSheet.jsx',
        'ui/components/base/VitalBar.jsx',
        'ui/components/base/KitButton.jsx'
    ];

    it.each(REFRAMED)('%s draws no rounded corners, soft shadows or translucent rings', (file) => {
        const soft = classStrings(src(file)).filter(s => SOFT_LOOK.test(s));
        expect(soft, file).toEqual([]);
    });

    it('Bank tiles and filled loadout slots are item tiles; empty slots and Bank tabs are wells', () => {
        const bank = src('ui/components/drawer/BankTab.jsx');
        const slots = src('ui/components/dock/DockEquipmentGrid.jsx');
        expect(bank).toMatch(/'ui-item-tile /);
        expect(bank).toMatch(/'ui-slot-empty /);
        expect(slots).toMatch(/'ui-item-tile /);
        expect(slots).toMatch(/'ui-slot-empty'/);
        // No border utilities that would override the tile's own line and white hover.
        expect(bank).not.toMatch(/hover:border-gi-muted/);
        expect(slots).not.toMatch(/hover:border-gi-danger|border-gi-primary\/50|border-dashed/);
    });

    it('an item tile is square with a hard 1-art-pixel line that turns white on hover', () => {
        const css = src('tailwind.css');
        const rule = (sel) => css.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`))?.[1] || '';
        expect(rule('.ui-item-tile')).toMatch(/border:\s*2px solid var\(--color-ui-frame\)/);
        expect(rule('.ui-item-tile')).toMatch(/border-radius:\s*0/);
        expect(rule('.ui-item-tile:hover')).toMatch(/border-color:\s*var\(--color-ui-white\)/);
        expect(rule('.ui-slot-empty')).toMatch(/border-radius:\s*0/);
        expect(rule('.ui-pixel-edge')).toMatch(/border:\s*2px solid var\(--color-ui-frame\)/);
    });
});

describe('the kit button and switch', () => {
    it('a kit button is a chamfer frame around the button, gold words for the main action', () => {
        render(h('div', null,
            h(KitButton, { 'data-test': 'main' }, 'Save'),
            h(KitButton, { tone: KIT_BUTTON_TONE.PLAIN, 'data-test': 'plain' }, 'Cancel')
        ));
        const main = document.querySelector('[data-test="main"]');
        const plain = document.querySelector('[data-test="plain"]');
        expect(main.tagName).toBe('BUTTON');
        expect(main.closest('[data-pixel-frame="chamfer"]')).not.toBeNull();
        expect(main.className).toContain('ui-shine');
        expect(main.className).toContain('--color-ui-gold');
        expect(plain.closest('[data-pixel-frame="chamfer"]')).not.toBeNull();
        expect(plain.className).not.toContain('ui-shine');
    });

    it('a switch is square and says whether it is on', () => {
        render(h(PixelToggle, { on: true, onClick: () => {} }));
        const sw = document.querySelector('[role="switch"]');
        expect(sw.getAttribute('aria-checked')).toBe('true');
        const track = sw.querySelector('[data-pixel-switch]');
        expect(track.getAttribute('data-pixel-switch')).toBe('on');
        expect(track.className).toContain('ui-pixel-edge');
    });
});

describe('Settings: rows unboxed, switches and buttons from the kit', () => {
    beforeEach(() => {
        vi.stubGlobal('__APP_VERSION__', '0.0.0-test');
        localStorage.clear();
        SettingsManager.resetOptions();
    });

    it('no element in any tab is rounded or boxed with a soft shadow', () => {
        render(h(SettingsModal, { isOpen: true, onClose: () => {} }));
        for (const tab of ['Accessibility', 'Notifications', 'Gameplay', 'Audio']) {
            fireEvent.click([...document.querySelectorAll('button')].find(b => b.textContent.includes(tab)));
            const body = document.body.querySelector('[data-pixel-frame="chamfer"]');
            const soft = [...body.querySelectorAll('*')].filter(e => SOFT_LOOK.test(String(e.className?.baseVal ?? e.className ?? '')));
            expect(soft.map(e => e.className), tab).toEqual([]);
        }
    });

    it('the toggles are pixel switches and Done is the main action', () => {
        render(h(SettingsModal, { isOpen: true, onClose: () => {} }));
        expect(document.querySelectorAll('[data-pixel-switch]').length).toBeGreaterThan(0);
        const done = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done');
        expect(done.closest('[data-kit-button="main"]')).not.toBeNull();
    });
});
