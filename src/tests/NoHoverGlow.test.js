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
});
