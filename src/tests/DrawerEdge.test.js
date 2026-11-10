// @vitest-environment jsdom
// The Bank and Shop drawers as one panel to the screen's edge under the nav, and the mat's side
// staying put while the Bank is open (no column, no refit, no move).
import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import './fixtures/testTokens.js';
import { SRC, codeOf } from './fixtures/sourceScan.js';
import { hallCameraSides } from './fixtures/hallCameraSides.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';

// What the Bank draws inside its pane is not the point here: the drawer's own box is.
vi.mock('../ui/components/drawer/BankTab.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'bank-pane' })
}));

import { BankDrawer } from '../ui/components/drawer/BankDrawer.jsx';
import { ShopPanel, shopPanelTransform } from '../ui/components/drawer/ShopPanel.jsx';

const h = React.createElement;
const css = fs.readFileSync(`${SRC}/tailwind.css`, 'utf8');
const bankDrawer = (menuRight) => render(h(BankDrawer, {
    drawer: { isOpen: true, panes: ['bank'], filters: {}, closePane: () => {} },
    menuRight
})).container.querySelector('[data-dnd-surface="drawer"]');
const shopPanel = (menuRight) => render(h(DeckDndProvider, null, h(ShopPanel, { isOpen: true, onClose: () => {}, menuRight })))
    .container.querySelector('[data-shop-drawer]');
const classes = (el) => el.className.split(/\s+/);
/** Every rule in the stylesheet whose selector mentions `needle`, as { selector, body }. */
const rulesFor = (needle) => [...codeOf(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(m => ({ selector: m[1].trim(), body: m[2].trim() }))
    .filter(r => r.selector.includes(needle));

afterEach(cleanup);

describe('the drawers reach the screen edge under the nav, as one panel', () => {
    it('the Bank, nav on the left: from the left edge, its rows padded for the nav', () => {
        const el = bankDrawer(false);
        expect(classes(el)).toEqual(expect.arrayContaining(['left-0', '[--nav-inset-l:84px]', 'md:[--nav-inset-l:152px]']));
        // The drawer itself is not padded (that left a bare strip under the orbs); its rows are.
        expect(el.className).not.toMatch(/(^| )(md:)?p[lrx]-/);
        expect(el.querySelector('[data-panel-header]').className).toContain('gi-drawer-pad-x');
    });

    it('the Bank, nav on the right: the same, mirrored', () => {
        const el = bankDrawer(true);
        expect(classes(el)).toEqual(expect.arrayContaining(['right-0', '[--nav-inset-r:84px]', 'md:[--nav-inset-r:152px]']));
        expect(el.className).not.toContain('--nav-inset-l');
        expect(el.className).not.toMatch(/(^| )(md:)?p[lrx]-/);
    });

    it('the Shop, nav on the left: at the foot, across the whole screen under the nav, its rows padded for it', () => {
        const el = shopPanel(false);
        expect(classes(el)).toEqual(expect.arrayContaining(['bottom-0', 'inset-x-0', '[--nav-inset-l:84px]', 'md:[--nav-inset-l:152px]']));
        // Never as wide as its cards: the panel spans the screen, whatever it holds.
        expect(classes(el)).not.toEqual(expect.arrayContaining(['w-max']));
        expect(el.className).not.toMatch(/(^| )max-w-/);
        expect(el.className).not.toMatch(/(^| )(md:)?p[lrx]-/);
        expect(el.querySelector('[data-panel-header]').className).toContain('gi-drawer-pad-x');
    });

    it('the Shop, nav on the right: the same, mirrored', () => {
        const el = shopPanel(true);
        expect(classes(el)).toEqual(expect.arrayContaining(['bottom-0', 'inset-x-0', '[--nav-inset-r:84px]', 'md:[--nav-inset-r:152px]']));
        expect(classes(el)).not.toEqual(expect.arrayContaining(['w-max']));
        expect(el.className).not.toContain('[--nav-inset-l:');
    });

    it("the Shop's cards sit from the nav's side: from the left beside a left nav, against a right one by an auto margin", () => {
        const left = shopPanel(false).querySelector('[data-shop-cards]');
        expect(left.getAttribute('data-shop-cards')).toBe('left');
        expect(left.className).not.toContain('ms-auto');
        cleanup();
        const right = shopPanel(true).querySelector('[data-shop-cards]');
        expect(right.getAttribute('data-shop-cards')).toBe('right');
        expect(classes(right)).toContain('[&>:first-child]:ms-auto');
        // ⚠️ Never justify-end: an overflowing row would lose its first cards off the left.
        expect(right.className).not.toMatch(/justify-end/);
    });

    it("the Shop's lip, while a Shop Token is carried, drops straight down at either side", () => {
        expect(shopPanelTransform('lip')).toMatch(/^translateY\(/);
    });

    it("the rows' padding is the nav's reach on each side plus the usual gap", () => {
        const [rule] = rulesFor('.gi-drawer-pad-x');
        expect(rule.body).toContain('padding-left: calc(var(--nav-inset-l, 0px) + 0.75rem)');
        expect(rule.body).toContain('padding-right: calc(var(--nav-inset-r, 0px) + 0.75rem)');
        // The Bank's toolbar and its list pad the same way, so their bands also run under the orbs.
        const bankTab = codeOf(fs.readFileSync(`${SRC}/ui/components/drawer/BankTab.jsx`, 'utf8'));
        expect(bankTab.match(/gi-drawer-pad-x/g)?.length).toBeGreaterThanOrEqual(2);
    });
});

describe('opening the Bank leaves the mat side where it is', () => {
    it('the Bank takes no column beside the mat: the only <aside> left in ReactRoot is the Hall details', () => {
        const code = codeOf(fs.readFileSync(`${SRC}/ui/ReactRoot.jsx`, 'utf8'));
        const asides = code.match(/<aside[\s\S]*?>/g) || [];
        expect(asides.length).toBe(1);
        expect(asides[0]).toContain('data-hall-details');
    });

    it('nothing moves the mat side for the Bank: no shift wrapper, no shift rules', () => {
        const { mat } = hallCameraSides();
        expect(mat).not.toMatch(/bank-shift|bankShift|--hero-col/);
        expect(rulesFor('bank-shift')).toEqual([]);
        expect(codeOf(css)).not.toContain('--hero-col');
    });

    it('the drawer slides in step with the Item drawer, and not at all under reduced motion', () => {
        const code = codeOf(fs.readFileSync(`${SRC}/ui/components/drawer/BankDrawer.jsx`, 'utf8'));
        expect(code).toMatch(/prefersReducedMotion\(\) \? \{ duration: 0 \} : SIDE_DRAWER_TRANSITION/);
        const shell = codeOf(fs.readFileSync(`${SRC}/ui/components/base/SideDrawer.jsx`, 'utf8'));
        expect(shell).toMatch(/prefersReducedMotion\(\) \? \{ duration: 0 \} : SIDE_DRAWER_TRANSITION/);
    });
});
