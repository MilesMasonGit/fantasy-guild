// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { BubbleMenu } from '../ui/components/nav/BubbleMenu.jsx';

afterEach(cleanup);

const ui = { nav: { isActive: () => false, toggle: () => {} } };

// The 32 px bar picture draws at a whole scale (2×, 4× from md), never stretched to the menu's width.
describe('the bubble menu bar keeps its pixels whole', () => {
    for (const side of ['left', 'right']) {
        it(`on the ${side}, the bar is sized in whole multiples of 32 px`, () => {
            const { container } = render(React.createElement(BubbleMenu, { ui, side }));
            const nav = container.querySelector('nav');
            expect(nav.style.backgroundSize).not.toContain('%');
            expect(nav.className).toContain('bg-[length:64px_64px]');
            expect(nav.className).toContain('md:bg-[length:128px_128px]');
        });
    }
});
