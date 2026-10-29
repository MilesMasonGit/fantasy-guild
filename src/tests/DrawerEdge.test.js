// @vitest-environment jsdom
// The Bank and Shop drawers as one panel to the screen's edge under the nav, and the mat's side
// moving aside for the Bank by transforms only (no column, no refit).
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
import { ShopDrawer, shopDrawerTransform } from '../ui/components/drawer/ShopDrawer.jsx';

const h = React.createElement;
const css = fs.readFileSync(`${SRC}/tailwind.css`, 'utf8');
const bankDrawer = (menuRight) => render(h(BankDrawer, {
    drawer: { isOpen: true, panes: ['bank'], filters: {}, closePane: () => {} },
    menuRight
})).container.querySelector('[data-dnd-surface="drawer"]');
const shopDrawer = (menuRight) => render(h(DeckDndProvider, null, h(ShopDrawer, { isOpen: true, onClose: () => {}, menuRight })))
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

    it('the Shop, nav on the left: from the left edge, a third of the screen beside the nav', () => {
        const el = shopDrawer(false);
        expect(classes(el)).toEqual(expect.arrayContaining([
            'left-0', '[--nav-inset-l:84px]', 'md:[--nav-inset-l:152px]', 'w-[calc(33.333vw+var(--nav-inset-l,0px))]'
        ]));
        expect(el.className).not.toMatch(/left-\[/);
        expect(el.querySelector('[data-panel-header]').className).toContain('gi-drawer-pad-x');
    });

    it('the Shop, nav on the right: at the left edge with no nav to clear', () => {
        const el = shopDrawer(true);
        expect(classes(el)).toContain('left-0');
        expect(el.className).not.toContain('[--nav-inset-l:');
    });

    it("the Shop's lip, while a Shop Token is carried, stays beside the nav rather than under it", () => {
        expect(shopDrawerTransform('lip')).toContain('var(--nav-inset-l, 0px)');
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

describe('opening the Bank moves the mat side by transforms only', () => {
    it('the Bank takes no column beside the mat: the only <aside> left in ReactRoot is the Hall details', () => {
        const code = codeOf(fs.readFileSync(`${SRC}/ui/ReactRoot.jsx`, 'utf8'));
        const asides = code.match(/<aside[\s\S]*?>/g) || [];
        expect(asides.length).toBe(1);
        expect(asides[0]).toContain('data-hall-details');
    });

    it('one wrapper carries the whole mat side: the board, its top bar, the stubs, the dock', () => {
        const { mat } = hallCameraSides();
        const at = mat.indexOf('data-bank-shift={bankShift}');
        expect(at).toBeGreaterThan(-1);
        for (const part of ['<MatTopBar', '<Board', '<ItemStubColumn', '<BottomHeroDock']) {
            expect(mat.indexOf(part), part).toBeGreaterThan(at);
        }
    });

    it('only transforms move, with one duration and easing, and nothing is moved at rest', () => {
        const rules = rulesFor('.gi-bank-shift');
        const transition = rules.find(r => r.body.startsWith('transition') && !r.selector.includes('@media'));
        expect(transition.body).toBe('transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1);');
        for (const part of ['.gi-bank-shift', '.gi-bank-shift [data-mat-top-bar]', '.gi-bank-shift [data-item-stubs]']) {
            expect(transition.selector.split(/,\s*/)).toContain(part);
        }
        const moves = rules.filter(r => r.body.startsWith('transform'));
        expect(moves.length).toBe(6);
        for (const r of moves) {
            // A move only while the Bank is open, and nothing but a transform: no layout property.
            expect(r.selector).toMatch(/^\.gi-bank-shift\[data-bank-shift="(left|right)"\]/);
            expect(r.body).toMatch(/^transform: [^;]+;$/);
        }
        const reduced = rules.find(r => r.body === 'transition: none;');
        expect(reduced).toBeTruthy();
    });

    it('the drawer slides in step with the mat side, and not at all under reduced motion', () => {
        const code = codeOf(fs.readFileSync(`${SRC}/ui/components/drawer/BankDrawer.jsx`, 'utf8'));
        expect(code).toMatch(/prefersReducedMotion\(\) \? \{ duration: 0 \} : \{ duration: 0\.25, ease: \[0\.16, 1, 0\.3, 1\] \}/);
    });
});
