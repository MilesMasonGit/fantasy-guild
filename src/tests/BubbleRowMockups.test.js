// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { KIT_SECTIONS } from '../ui/dev/StyleSheetPage.jsx';
import { BubbleRowMockups, BUBBLE_ROW_MOCKUPS, MOCK_SCENES } from '../ui/dev/BubbleRowMockups.jsx';

/** Every source file under `dir`, recursively. */
function sources(dir) {
    return readdirSync(dir).flatMap(name => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return sources(full);
        return /\.(jsx?|mjs)$/.test(name) ? [full] : [];
    });
}

/**
 * The bubble row's mock-ups (T-239) are pictures for the owner to pick from: on the style sheet
 * page as an unapproved piece, and nowhere in the game.
 */
describe('Bubble row mock-ups', () => {
    afterEach(() => cleanup());

    it('are a new, unapproved piece of the style sheet page', () => {
        const entry = KIT_SECTIONS.find(s => s.id === 'bubble-row');
        expect(entry?.status).toBe('unapproved');
        expect(entry.Demo).toBe(BubbleRowMockups);
    });

    it('draw each mock-up in the same four moments, with a cell to hover for each part', () => {
        const view = render(React.createElement(BubbleRowMockups));
        const doc = view.container;
        expect(MOCK_SCENES.map(s => s.id)).toEqual(['working', 'waiting', 'charges', 'combat']);
        for (const m of BUBBLE_ROW_MOCKUPS) {
            const box = doc.querySelector(`[data-mockup="${m.id}"]`);
            expect(box).not.toBeNull();
            for (const s of MOCK_SCENES) {
                expect(box.querySelector(`[data-mock-scene="${s.id}"]`)).not.toBeNull();
            }
            expect(box.querySelector('[data-mock-scene="waiting"] [data-mock-cell="problem"]')).not.toBeNull();
            expect(box.querySelector('[data-mock-scene="working"] [data-mock-cell="output"]')).not.toBeNull();
            expect(box.querySelector('[data-mock-scene="combat"] [data-mock-cell="hero-style"]')).not.toBeNull();
        }
    });

    it('are not wired into the game: only the style sheet page imports them', () => {
        const root = path.resolve(__dirname, '..');
        const importers = sources(root)
            .filter(f => !f.includes(`${path.sep}tests${path.sep}`))
            .filter(f => /BubbleRowMockups/.test(readFileSync(f, 'utf8')))
            .map(f => path.relative(root, f).split(path.sep).join('/'));
        expect(importers.sort()).toEqual(['ui/dev/BubbleRowMockups.jsx', 'ui/dev/StyleSheetPage.jsx']);
    });
});
