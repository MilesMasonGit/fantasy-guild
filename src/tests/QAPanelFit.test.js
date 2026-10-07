// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../ui/hooks/useEngine.js', () => ({ useEngine: vi.fn() }));

import { useEngine } from '../ui/hooks/useEngine.js';
import { TestDashboard, QA_PANEL_FIT_CLASS, QA_PANEL_BODY_CLASS } from '../ui/components/TestDashboard.jsx';

/** Just enough engine for the panel to open: it only subscribes while closed or open. */
function stubEngine() {
    return {
        EventBus: { subscribe: () => () => {}, publish: () => {} },
        GameState: { state: { board: { tokens: {}, sprites: [] }, heroes: [] } }
    };
}

/**
 * ⭐ **The QA panel fits the window** (Token Lifecycle feedback Q7:). It used
 * to grow past a short window's bottom edge; now it is capped at the viewport
 * and everything under its header scrolls inside it. The *banner card width*
 * slider is gone from it.
 */
describe('QA panel', () => {
    afterEach(() => cleanup());

    function openPanel() {
        useEngine.mockReturnValue(stubEngine());
        const view = render(React.createElement(TestDashboard));
        fireEvent.click(view.getByTitle('Open QA Dashboard'));
        return view;
    }

    it('is capped at the viewport height (FB-36)', () => {
        expect(QA_PANEL_FIT_CLASS).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/);
        const panel = openPanel().getByTestId('qa-panel');
        expect(panel.className).toContain(QA_PANEL_FIT_CLASS);
        expect(panel.className).toContain('flex-col');
    });

    it('scrolls everything under the header inside itself (FB-36)', () => {
        const view = openPanel();
        const body = view.getByTestId('qa-panel-body');
        expect(body.className).toBe(QA_PANEL_BODY_CLASS);
        expect(body.className).toContain('overflow-y-auto');
        // min-h-0 is what lets a flex child shrink below its content and scroll.
        expect(body.className).toContain('min-h-0');
        // The dev tools and the action buttons are both inside the scroll region.
        expect(body.textContent).toContain('Give item');
        expect(body.textContent).toContain('Spawn Party');
        // The header stays outside it.
        expect(body.textContent).not.toContain('QA TESTER');
    });

    it('has no banner card width slider (FB-37)', () => {
        const view = openPanel();
        expect(view.queryByText(/banner card width/i)).toBeNull();
        expect(view.container.ownerDocument.querySelector('input[type="range"]')).toBeNull();
    });
});
