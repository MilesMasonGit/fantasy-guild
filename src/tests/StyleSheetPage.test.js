// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('../ui/hooks/useEngine.js', () => ({ useEngine: vi.fn() }));

import { useEngine } from '../ui/hooks/useEngine.js';
import { TestDashboard } from '../ui/components/TestDashboard.jsx';
import { KIT_SECTIONS, KIT_COLOURS } from '../ui/dev/StyleSheetPage.jsx';

function stubEngine() {
    return {
        EventBus: { subscribe: () => () => {}, publish: () => {} },
        GameState: { state: { board: { tokens: {}, sprites: [] }, heroes: [] } }
    };
}

/** Every piece UI_STYLE's "The style sheet page" names. */
const UI_STYLE_PIECES = [
    'text-sizes', 'colours', 'hover-outline', 'alert-outline', 'ribbon', 'pill', 'header',
    'main-button', 'icon-button', 'tabs', 'arrow-bars', 'frames', 'bars', 'tooltip'
];

/**
 * ⭐ The style sheet page opens from the QA panel and shows every standard piece, the shared ones
 * apart from the new, unapproved placeholders.
 */
describe('Style sheet page', () => {
    afterEach(() => cleanup());

    function openPage() {
        useEngine.mockReturnValue(stubEngine());
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
