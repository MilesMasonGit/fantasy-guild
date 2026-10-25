// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { BubbleMenu } from '../ui/components/nav/BubbleMenu.jsx';
import { StationGearBadge } from '../ui/components/board/TokenBadges.jsx';

afterEach(cleanup);

const ui = { nav: { isActive: () => false, toggle: () => {} } };
const BAD = /hover:(scale|brightness|contrast|drop-shadow|shadow|translate)|active:scale/;

describe('hover is a white outline, never a glow or a scale', () => {
    it('the nav orbs carry no hover scale or glow, and draw a hover outline', () => {
        const { container } = render(React.createElement(BubbleMenu, { ui }));
        const orbs = [...container.querySelectorAll('button[data-alpha-circle]')];
        expect(orbs.length).toBeGreaterThan(0);
        for (const o of orbs) expect(o.className).not.toMatch(BAD);
        expect(container.querySelectorAll('[data-orb-outline]').length).toBeGreaterThan(0);
    });

    it('the station gear carries no hover scale or glow, and draws a hover outline', () => {
        const { container } = render(React.createElement(StationGearBadge, { recipe: null }));
        const btn = container.querySelector('button');
        expect(btn.className).not.toMatch(BAD);
        expect(container.querySelectorAll('[data-gear-hover-outline]').length).toBe(4);
    });

    it('a selected orb has no scale or glow and shows a steady gold outline', () => {
        const activeUi = { nav: { isActive: (k) => k === 'bank', toggle: () => {} } };
        const { container } = render(React.createElement(BubbleMenu, { ui: activeUi }));
        const bank = container.querySelector('#bank-bubble-target');
        const btn = bank.querySelector('button');
        expect(btn.className).not.toMatch(/scale-|brightness-|contrast-|drop-shadow/);
        const outlines = [...bank.querySelectorAll('[data-orb-outline]')];
        expect(outlines.length).toBe(4);
        for (const o of outlines) {
            expect(o.className).toMatch(/(^| )block( |$)/);
            expect(o.className).not.toMatch(/(^| )hidden( |$)/);
            expect(o.className).toMatch(/bg-gi-gold/);
            expect(o.className).not.toMatch(/bg-white/);
        }
        const guild = container.querySelector('#guild-bubble-target');
        for (const o of guild.querySelectorAll('[data-orb-outline]')) expect(o.className).toMatch(/bg-white/);
    });
});
