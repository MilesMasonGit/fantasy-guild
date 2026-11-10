// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BankDrawer } from '../ui/components/drawer/BankDrawer.jsx';
import { resetBankInspection } from '../ui/components/drawer/bankInspection.js';
import { tagKey, tagExplanation, itemTagPills } from '../ui/components/drawer/itemTags.js';
import { SideDrawer, sideDrawerEdge } from '../ui/components/base/SideDrawer.jsx';
import { SRC, codeOf } from './fixtures/sourceScan.js';
import { escapeLayerCount } from '../ui/utils/escapeLayers.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **The Item drawer opens and closes with the Bank**, on the screen's far side from the nav, the
 * hero column's width, in the gold studs frame, with no X. It shows the item last clicked this
 * session, else the open tab's first item, else a calm empty line; top to bottom: the name and
 * the book, the sprite at 4×, the count, the tags as pills that explain themselves, what it does,
 * then the actions and "Collected this run". A drag is still a drag, Select still selects.
 */

const h = React.createElement;
const ptr = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });

registerItems({
    dr_sword: {
        id: 'dr_sword', name: 'Drawer Sword', type: 'weapon', equipSlot: 'hand', stackable: true,
        damage: 4, tags: ['Weapon', 'Sword', 'Unwritten Tag'], description: 'Sharp on both sides.'
    },
    dr_ore: { id: 'dr_ore', name: 'Drawer Ore', type: 'material', stackable: true }
});

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.items = {};
    resetBankInspection();
});
afterEach(async () => {
    await new Promise(r => setTimeout(r, 30));
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

const OPEN = { isOpen: true, panes: ['bank'], filters: {}, closePane: () => {} };
const mountBank = (menuRight = false, drawer = OPEN) =>
    render(h(DeckDndProvider, null, h(BankDrawer, { drawer, menuRight })));
const tile = (view, id) => view.container.querySelector(`button[data-bank-item="${id}"]`);
const drawerOf = (view) => view.container.querySelector('[data-item-drawer]');
const shownId = (view) => drawerOf(view)?.getAttribute('data-item-drawer');

describe('the side drawer shell', () => {
    it('stands on the side away from the nav, flush, full height, the hero column wide', () => {
        expect(sideDrawerEdge(false)).toBe('right');
        expect(sideDrawerEdge(true)).toBe('left');
        for (const menuRight of [false, true]) {
            const { container } = render(h(SideDrawer, { open: true, menuRight, backdrop: 'world', label: 'Test' }, h('p', null, 'inside')));
            const el = container.querySelector('[data-side-drawer]');
            const cls = el.className.split(/\s+/);
            expect(cls).toEqual(expect.arrayContaining(['absolute', 'inset-y-0', menuRight ? 'left-0' : 'right-0']));
            expect(cls).not.toContain(menuRight ? 'right-0' : 'left-0');
            expect(el.getAttribute('aria-label')).toBe('Test');
            expect(el.querySelector('[data-pixel-frame="studs"]')).not.toBeNull();
            expect(el.querySelector('[data-panel-backdrop="world"]')).not.toBeNull();
            expect(el.textContent).toBe('inside');
            cleanup();
        }
    });

    it('takes the hero column width, the width the Bank panel leaves free on the far side', () => {
        // jsdom drops clamp() from a style, so the source says it.
        const shell = codeOf(fs.readFileSync(`${SRC}/ui/components/base/SideDrawer.jsx`, 'utf8'));
        expect(shell).toContain('style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}');
        const bank = codeOf(fs.readFileSync(`${SRC}/ui/components/drawer/BankDrawer.jsx`, 'utf8'));
        expect(bank).toContain('{ left: columnWidthCss(NOTIFICATION_COLUMN) } : { right: columnWidthCss(NOTIFICATION_COLUMN) }');
    });

    it('draws nothing while closed, and carries a frame class (the Hall\'s purple)', () => {
        expect(render(h(SideDrawer, { open: false, backdrop: 'hall', label: 'x' })).container.innerHTML).toBe('');
        cleanup();
        const { container } = render(h(SideDrawer, { open: true, backdrop: 'hall', label: 'x', frameClassName: 'ui-frame-studs-purple' }));
        expect(container.querySelector('.ui-frame-studs-purple')).not.toBeNull();
    });
});

describe('the Item drawer opens and closes with the Bank', () => {
    it('opens with the Bank on the far side from the nav, with no X, and goes with it', async () => {
        InventoryManager.addItem('dr_ore', 2);
        const left = mountBank(false);
        expect(drawerOf(left).getAttribute('data-side-drawer')).toBe('right');
        expect(drawerOf(left).querySelector('[data-close-x]')).toBeNull();
        cleanup();
        const right = mountBank(true);
        expect(drawerOf(right).getAttribute('data-side-drawer')).toBe('left');
        right.rerender(h(DeckDndProvider, null, h(BankDrawer, { drawer: { ...OPEN, isOpen: false, panes: [] }, menuRight: true })));
        await act(async () => { await new Promise(r => setTimeout(r, 400)); });
        expect(drawerOf(right)).toBeNull();
    });

    it('opens no Escape layer of its own: Escape closes the Bank, and the drawer with it', () => {
        InventoryManager.addItem('dr_ore', 1);
        const before = escapeLayerCount();
        const view = mountBank();
        fireEvent.click(tile(view, 'dr_ore'));
        expect(escapeLayerCount()).toBe(before);
    });
});

describe('what it shows', () => {
    it('with nothing clicked, the open tab\'s first item; an empty Bank, a calm line', () => {
        const empty = mountBank();
        expect(shownId(empty)).toBe('');
        expect(drawerOf(empty).querySelector('[data-item-drawer-empty]').textContent).toContain('The Bank is empty');
        cleanup();
        InventoryManager.addItem('dr_ore', 1);
        InventoryManager.addItem('dr_sword', 1);
        const view = mountBank();
        const first = view.container.querySelector('button[data-bank-item]').getAttribute('data-bank-item');
        expect(shownId(view)).toBe(first);
        expect(tile(view, first).hasAttribute('data-bank-item-inspected')).toBe(true);
    });

    it('a click shows that item; a second click keeps it; another tile moves it', () => {
        InventoryManager.addItem('dr_sword', 1);
        InventoryManager.addItem('dr_ore', 1);
        const view = mountBank();
        fireEvent.click(tile(view, 'dr_sword'));
        expect(shownId(view)).toBe('dr_sword');
        fireEvent.click(tile(view, 'dr_sword'));
        expect(shownId(view)).toBe('dr_sword');
        fireEvent.click(tile(view, 'dr_ore'));
        expect(shownId(view)).toBe('dr_ore');
        expect(tile(view, 'dr_ore').hasAttribute('data-bank-item-inspected')).toBe(true);
        expect(tile(view, 'dr_sword').hasAttribute('data-bank-item-inspected')).toBe(false);
    });

    it('the last item clicked is kept for the session: the Bank reopened shows it again', () => {
        InventoryManager.addItem('dr_ore', 1);
        InventoryManager.addItem('dr_sword', 1);
        const first = mountBank();
        fireEvent.click(tile(first, 'dr_sword'));
        cleanup();
        const again = mountBank();
        expect(shownId(again)).toBe('dr_sword');
    });

    it('an item used up falls back to the tab\'s first item', async () => {
        InventoryManager.addItem('dr_ore', 1);
        InventoryManager.addItem('dr_sword', 1);
        const view = mountBank();
        fireEvent.click(tile(view, 'dr_sword'));
        await act(async () => {
            InventoryManager.removeItem('dr_sword', 1);
            await new Promise(r => setTimeout(r, 50));
        });
        expect(shownId(view)).toBe('dr_ore');
    });

    it('its six parts, top to bottom: name and book, sprite at 4×, count, tag pills, what it does, actions and collected', () => {
        InventoryManager.addItem('dr_sword', 1500);
        GameState.state.collection = { ...(GameState.state.collection || {}), itemLifetimeCounts: { dr_sword: 2345 } };
        const view = mountBank();
        fireEvent.click(tile(view, 'dr_sword'));
        const d = drawerOf(view);
        const parts = ['[data-item-drawer-header]', '[data-item-drawer-sprite]', '[data-item-drawer-count]',
            '[data-item-drawer-tags]', '[data-item-drawer-stats]', '[data-item-drawer-actions]', '[data-item-drawer-collected]']
            .map(sel => d.querySelector(sel));
        parts.forEach((el, i) => expect(el, `part ${i}`).not.toBeNull());
        for (let i = 1; i < parts.length; i++) {
            expect(parts[i - 1].compareDocumentPosition(parts[i]) & Node.DOCUMENT_POSITION_FOLLOWING, `part ${i}`).toBeTruthy();
        }
        expect(parts[0].textContent).toContain('Drawer Sword');
        expect(parts[0].querySelector('[data-item-drawer-look-up] [data-glyph="book"]')).not.toBeNull();
        expect(parts[1].querySelector('.gi-icon-128')).not.toBeNull();
        expect(parts[2].textContent).toBe('×1,500');
        expect([...parts[3].querySelectorAll('[data-item-tag]')].map(p => p.textContent)).toEqual(['Weapon', 'Sword', 'Unwritten Tag']);
        for (const part of ['DMG', '4', 'Sharp on both sides.']) expect(parts[4].textContent).toContain(part);
        expect(parts[6].textContent).toBe('Collected this run: 2,345');
        // The old top lines are gone: no type line, no "Equippable".
        expect(d.textContent).not.toMatch(/Equippable/);
        expect(d.querySelector('[data-item-tip-type], [data-item-tip-tags]')).toBeNull();
    });

    it('a tag pill explains itself on hover; a tag with no line written is a plain pill', () => {
        InventoryManager.addItem('dr_sword', 1);
        const view = mountBank();
        fireEvent.click(tile(view, 'dr_sword'));
        const pill = drawerOf(view).querySelector('[data-item-tag="Weapon"]');
        act(() => { fireEvent.pointerEnter(pill, { clientX: 10, clientY: 10, pointerType: 'mouse', buttons: 0 }); });
        expect(document.querySelector('[data-tooltip]').textContent).toContain(tagExplanation('Weapon'));
        act(() => { fireEvent.pointerLeave(pill); });
        const plain = drawerOf(view).querySelector('[data-item-tag="Unwritten Tag"]');
        act(() => { fireEvent.pointerEnter(plain, { clientX: 10, clientY: 10, pointerType: 'mouse', buttons: 0 }); });
        expect(document.querySelector('[data-tooltip]')).toBeNull();
    });

    it('an item with no tags shows its kind as its one pill', () => {
        InventoryManager.addItem('dr_ore', 1);
        const view = mountBank();
        expect([...drawerOf(view).querySelectorAll('[data-item-tag]')].map(p => p.textContent)).toEqual(['Material']);
    });

    it('the book opens the item\'s Encyclopedia page', () => {
        InventoryManager.addItem('dr_ore', 2);
        const view = mountBank();
        const heard = [];
        const off = EventBus.subscribe(UI_EVENTS.OPEN_ENCYCLOPEDIA, d => heard.push(d.key));
        fireEvent.click(drawerOf(view).querySelector('[data-item-drawer-look-up]'));
        off();
        expect(heard).toEqual(['item:dr_ore']);
    });
});

describe('the Bank\'s clicks and drags still work', () => {
    it('in Select mode a click selects and leaves the drawer as it was', () => {
        InventoryManager.addItem('dr_ore', 1);
        InventoryManager.addItem('dr_sword', 1);
        const view = mountBank();
        fireEvent.click(tile(view, 'dr_ore'));
        const select = [...view.container.querySelectorAll('button')].find(b => b.textContent.trim() === 'Select');
        fireEvent.click(select);
        fireEvent.click(tile(view, 'dr_sword'));
        expect(shownId(view)).toBe('dr_ore');
        expect(view.container.textContent).toContain('1 selected');
    });

    it('a drag is not a click: past 8 px the press is a drag, and the click that ends it picks nothing', () => {
        InventoryManager.addItem('dr_ore', 1);
        InventoryManager.addItem('dr_sword', 1);
        const view = mountBank();
        fireEvent.click(tile(view, 'dr_ore'));
        const el = tile(view, 'dr_sword');
        el.getBoundingClientRect = () => box(2000, 2000, 64, 64);
        act(() => {
            fireEvent.pointerDown(el, ptr(2020, 2020));
            fireEvent.pointerMove(document, ptr(2060, 2020));
        });
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
        act(() => { fireEvent.pointerMove(document, ptr(2300, 2300)); });
        act(() => { fireEvent.pointerUp(document, ptr(2300, 2300)); });
        fireEvent.click(el);
        expect(shownId(view)).toBe('dr_ore');
    });
});

describe('the tag lines file', () => {
    it('keys a tag by its camelCase name in the strings file; a tag with no line has none', () => {
        expect(tagKey('Seafood')).toBe('seafood');
        expect(tagKey('Unwritten Tag')).toBe('unwrittenTag');
        expect(tagExplanation('Food')).toMatch(/HP/);
        expect(tagExplanation('food')).toBe(tagExplanation('Food'));
        expect(tagExplanation('Unwritten Tag')).toBeNull();
    });

    it('a tag listed twice shows once', () => {
        expect(itemTagPills({ tags: ['Food', 'food', 'Fish'] }).map(p => p.tag)).toEqual(['Food', 'Fish']);
    });
});
