// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, cleanup } from '@testing-library/react';
import { PixelFrame } from '../ui/components/base/PixelFrame.jsx';
import {
    PANEL_TONES, PANEL_BASE, BAND_MIX, bandColours, backdropSvg, panelBackdropStyle
} from '../ui/components/base/panelBackdrop.js';

/**
 * ⭐ **Every full panel has a coloured pixel backdrop.** Hard bands from its colour down to the
 * frames' dark fill, a dithered step between them, one static picture per colour; text stays
 * readable on every band. Tooltips, bubbles and the Token card have none.
 */

const SRC = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const luminance = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

afterEach(cleanup);

describe('the panel colours', () => {
    it('each full panel has its own colour, and the bubbles\' ones start from their bubble', () => {
        expect(Object.keys(PANEL_TONES).sort()).toEqual(['away', 'bank', 'fight', 'hall', 'hero', 'settings', 'shop', 'world']);
        expect(new Set(Object.values(PANEL_TONES)).size).toBe(Object.keys(PANEL_TONES).length);
    });

    it('bands step down from the tint to the dark fill in hard steps', () => {
        for (let i = 1; i < BAND_MIX.length; i++) expect(BAND_MIX[i]).toBeLessThan(BAND_MIX[i - 1]);
        for (const tone of Object.values(PANEL_TONES)) {
            const bands = bandColours(tone);
            expect(new Set(bands).size).toBe(bands.length);
            for (let i = 1; i < bands.length; i++) expect(luminance(bands[i])).toBeLessThanOrEqual(luminance(bands[i - 1]));
        }
    });

    it('white, muted and gold text stay readable on every band of every panel', () => {
        for (const [name, tone] of Object.entries(PANEL_TONES)) {
            for (const band of bandColours(tone)) {
                expect(contrast('#ffffff', band), `${name} ${band} white`).toBeGreaterThanOrEqual(10);
                expect(contrast('#fbbf24', band), `${name} ${band} gold`).toBeGreaterThanOrEqual(6);
                // Muted grey (`--color-gi-muted`) for hints and counts.
                expect(contrast('#94a3b8', band), `${name} ${band} muted`).toBeGreaterThanOrEqual(4.5);
            }
        }
        expect(PANEL_BASE).toBe('#0d0a08');
    });

    it('is one picture with no smooth gradient, and its dither is whole art pixels', () => {
        const svg = backdropSvg(PANEL_TONES.bank);
        expect(svg).not.toMatch(/Gradient/i);
        expect(svg).toMatch(/shape-rendering='crispEdges'/);
        expect(svg).not.toMatch(/viewBox/);
        for (const [, w, h] of svg.matchAll(/<pattern[^>]*width='(\d+)' height='(\d+)'/g)) {
            expect(Number(w) % 2).toBe(0);
            expect(Number(h) % 2).toBe(0);
        }
    });

    it('is built once per colour and kept', () => {
        const a = panelBackdropStyle('shop');
        expect(a.backgroundImage).toMatch(/^url\("data:image\/svg\+xml,/);
        expect(a.backgroundImage).not.toMatch(/#/);
        expect(panelBackdropStyle('shop')).toBe(a);
        expect(panelBackdropStyle('nothing')).toBeNull();
    });
});

describe('a frame with a backdrop', () => {
    it('lays the backdrop inside the frame, over its fill and under the content', () => {
        const { container } = render(React.createElement(PixelFrame, { kind: 'studs', backdrop: 'bank' },
            React.createElement('span', { 'data-child': true })));
        const frame = container.querySelector('.ui-frame-studs');
        const backdrop = frame.querySelector('[data-panel-backdrop]');
        expect(backdrop.getAttribute('data-panel-backdrop')).toBe('bank');
        expect(backdrop.className).toMatch(/absolute inset-0 -z-10 pointer-events-none/);
        expect(frame.className).toMatch(/\bisolate\b/);
        expect(backdrop.nextSibling.getAttribute('data-child')).not.toBeNull();
    });

    it('a frame without one is as before', () => {
        const { container } = render(React.createElement(PixelFrame, { kind: 'chamfer' }, 'x'));
        expect(container.querySelector('[data-panel-backdrop]')).toBeNull();
        expect(container.querySelector('.ui-frame-chamfer').className).not.toMatch(/\bisolate\b/);
    });
});

describe('which panels wear one', () => {
    it('the full panels name their colour', () => {
        const wears = {
            'ui/components/drawer/BankDrawer.jsx': 'bank',
            'ui/components/drawer/ShopPanel.jsx': 'shop',
            'ui/components/board/GuildHallDetails.jsx': 'hall',
            'ui/components/atlas/WorldPanel.jsx': 'world',
            'ui/modals/SettingsModal.jsx': 'settings',
            'ui/components/dock/HeroDrawer.jsx': 'hero',
            'ui/components/hud/CatchUpOverlay.jsx': 'away'
        };
        for (const [file, tone] of Object.entries(wears)) expect(read(file), file).toMatch(new RegExp(`backdrop="${tone}"`));
    });

    it('tooltips, the Token card, the top bar and speech have none', () => {
        for (const file of ['ui/components/base/Tooltip.jsx', 'ui/components/board/TokenInspectPopup.jsx',
            'ui/components/board/MatTopBar.jsx', 'ui/components/base/KitButton.jsx']) {
            expect(read(file), file).not.toMatch(/backdrop=/);
        }
    });
});
