// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { render, cleanup } from '@testing-library/react';
import { FloatingTip } from '../ui/components/base/Tooltip.jsx';
import { GIModal } from '../ui/components/base/GIModal.jsx';
import { TokenSummaryPanel } from '../ui/components/board/MatCapBadge.jsx';

const h = React.createElement;
afterEach(cleanup);

/** UI_STYLE "Pixel frames": the look these windows must not fall back to. */
const SOFT_LOOK = /\brounded(-\w+)?\b|shadow-\[|gi-shadow-deep|backdrop-blur/;

describe('every window wears a pixel frame (UI_STYLE "Pixel frames")', () => {
    it('the shared tooltip is a chamfer frame, with no rounded corners or blurred shadow', () => {
        render(h(FloatingTip, { title: 'Work Permissions', lines: ['Which skills each hero works'] }));
        const tip = document.body.querySelector('[data-tooltip]');
        expect(tip.querySelector('[data-pixel-frame="chamfer"]')).not.toBeNull();
        expect(tip.className).not.toMatch(SOFT_LOOK);
    });

    it('the modal shell is a chamfer frame', () => {
        render(h(GIModal, { isOpen: true, title: 'Settings', onClose: () => {} }, 'body'));
        const frame = document.body.querySelector('[data-pixel-frame="chamfer"]');
        expect(frame).not.toBeNull();
        expect(frame.textContent).toContain('Settings');
        expect(frame.parentElement.className).not.toMatch(SOFT_LOOK);
    });

    it('the Token Summary is a chamfer frame', () => {
        render(h(TokenSummaryPanel, { anchor: null, summary: { total: 0, pinned: [], sections: [] }, cap: 12, panelRef: { current: null } }));
        const panel = document.body.querySelector('[data-token-summary]');
        expect(panel.querySelector('[data-pixel-frame="chamfer"]')).not.toBeNull();
        expect(panel.className).not.toMatch(SOFT_LOOK);
    });

    it('the docked panels (Bank, Shop, hero panel) wear studs, and the catch-up wears chamfer', () => {
        const src = (p) => readFileSync(`src/ui/components/${p}`, 'utf8');
        for (const p of ['drawer/BankDrawer.jsx', 'drawer/ShopDrawer.jsx', 'dock/BankHeroPanel.jsx']) {
            expect(src(p), p).toContain('kind={FRAME_KIND.STUDS}');
            expect(src(p), p).not.toMatch(/shadow-\[/);
        }
        expect(src('hud/CatchUpOverlay.jsx')).toContain('kind={FRAME_KIND.CHAMFER}');
        expect(src('hud/CatchUpOverlay.jsx')).not.toMatch(/shadow-\[/);
    });
});
