// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { GameState } from '../state/GameState.js';
import { TestDashboard } from '../ui/components/TestDashboard.jsx';
import { KIT_SECTIONS, KIT_COLOURS } from '../ui/dev/StyleSheetPage.jsx';


/** Every piece UI_STYLE's "The style sheet page" names. */
const UI_STYLE_PIECES = [
    'text-sizes', 'colours', 'hover-outline', 'alert-outline', 'ribbon', 'pill', 'header',
    'main-button', 'shine', 'icon-button', 'tabs', 'arrow-bars', 'frames', 'bars', 'tooltip'
];

/**
 * ⭐ The style sheet page opens from the QA panel and shows every standard piece, the shared ones
 * apart from the new, unapproved placeholders.
 */
describe('Style sheet page', () => {
    afterEach(() => cleanup());

    function openPage() {
        GameState.initNew();
        const view = render(React.createElement(TestDashboard));
        fireEvent.click(view.getByTitle('Open QA Dashboard'));
        fireEvent.click(view.getByText(/Style Sheet/));
        return view;
    }

    it('opens from the QA panel and lists every UI_STYLE piece', () => {
        const view = openPage();
        const page = view.container.ownerDocument.querySelector('[data-style-sheet-page]');
        expect(page).not.toBeNull();
        const shown = [...page.querySelectorAll('[data-kit-section]')].map(el => el.dataset.kitSection);
        for (const piece of UI_STYLE_PIECES) expect(shown).toContain(piece);
        expect(shown.length).toBe(KIT_SECTIONS.length);
    });

    it('keeps the shared pieces apart from the new, unapproved ones', () => {
        const view = openPage();
        const doc = view.container.ownerDocument;
        const shared = doc.querySelector('[data-kit-group="shared"]');
        const unapproved = doc.querySelector('[data-kit-group="unapproved"]');
        for (const s of KIT_SECTIONS) {
            const el = doc.querySelector(`[data-kit-section="${s.id}"]`);
            const afterUnapproved = !!(unapproved.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
            expect(afterUnapproved).toBe(s.status === 'unapproved');
            expect(!!(shared.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
        }
    });

    it('closes on its X and on Escape', () => {
        const view = openPage();
        const doc = view.container.ownerDocument;
        fireEvent.click(doc.querySelector('[data-style-sheet-close]'));
        expect(doc.querySelector('[data-style-sheet-page]')).toBeNull();
        fireEvent.click(view.getByText(/Style Sheet/));
        fireEvent.keyDown(doc, { key: 'Escape' });
        expect(doc.querySelector('[data-style-sheet-page]')).toBeNull();
    });

    it('shows the five colours, each a CSS variable defined in the theme', () => {
        const css = readFileSync(path.resolve('src/tailwind.css'), 'utf8');
        expect(KIT_COLOURS.map(c => c.name)).toEqual(['Red', 'Green', 'Gold', 'White', 'Muted grey']);
        for (const c of KIT_COLOURS) expect(css).toMatch(new RegExp(`${c.cssVar}\\s*:`));
        const view = openPage();
        const swatches = view.container.ownerDocument.querySelectorAll('[data-kit-colour]');
        expect(swatches.length).toBe(5);
    });
});

describe('Main-action button shine', () => {
    const read = (rel) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');

    it('is on the Upgrade and Settle buttons and the style sheet demo', () => {
        const upgrade = read('ui/components/drawer/GuildUpgradeInspection.jsx');
        expect(upgrade).toMatch(/id="guild-upgrade-button"[\s\S]*?"ui-shine /);
        const settle = read('ui/components/atlas/CartographyTable.jsx');
        // Settle is the table's main button, and the main button wears the shine.
        expect(settle).toMatch(/<AtlasButton main data-cartography-settle/);
        expect(read('ui/components/atlas/AtlasButton.jsx')).toMatch(/main && 'ui-shine'/);
        expect(read('ui/dev/StyleSheetPage.jsx')).toMatch(/data-kit-main-button\s+className=\{cn\('ui-shine /);
    });

    it('is a stepped, once-only solid band over the whole button that stops for reduced motion', () => {
        const css = read('tailwind.css');
        expect(css).toMatch(/\.ui-shine::before\s*\{[^}]*z-index: 1;/);
        expect(css).toMatch(/\.ui-shine::before\s*\{[^}]*rgba\(255, 255, 255, 0\.75\)/);
        expect(css).toMatch(/animation: ui-shine-sweep 280ms steps\(7, end\) 1 both/);
        expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.ui-shine:hover:not\(:disabled\)::before \{ animation: none; \}/);
    });

    it('is listed on the style sheet page as an unapproved piece', () => {
        const shine = KIT_SECTIONS.find(s => s.id === 'shine');
        expect(shine?.status).toBe('unapproved');
    });
});
