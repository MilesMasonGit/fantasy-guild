// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { EncyclopediaScreen, PAGE } from '../ui/components/encyclopedia/EncyclopediaScreen.jsx';
import { lookUp, takeLookUp } from '../ui/components/encyclopedia/encyclopediaLink.js';
import { clearViewed } from '../ui/components/encyclopedia/encyclopediaRecent.js';
import { itemKey, tokenKey } from '../systems/progression/ledger/engine.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ItemStubColumn } from '../ui/components/notifications/ItemStubColumn.jsx';
import * as ItemStubs from '../systems/notifications/itemStubs.js';

/**
 * ⭐ The Encyclopedia, search-first (brief 300 E3): a book whose opening page searches everything
 * and lists the recent entries; an entry opens as a left-to-right chart that grows a step per
 * click, glides to its focus, drags, and goes back to the start; a small panel says what the focus
 * is. No kind tabs, no per-kind counts, no long lists.
 */

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    clearViewed();
});

afterEach(() => {
    cleanup();
    takeLookUp();
    ItemStubs.reset();
});

const open = () => render(React.createElement(EncyclopediaScreen, { onClose: () => {} }));
const q = (c, sel) => c.querySelector(sel);
const qa = (c, sel) => [...c.querySelectorAll(sel)];
const page = (c) => q(c, '[data-encyclopedia]').getAttribute('data-codex-page');
const nodeOf = (c, key, side) => qa(c, `[data-codex-key="${key}"]`).find(n => !side || n.getAttribute('data-codex-side') === side);
const focused = (c) => q(c, '[data-codex-node][data-focus="true"]')?.getAttribute('data-codex-key');
const reqOf = (c, id) => q(c, `[data-codex-req-of="${id}"] [data-codex-req]`);
const search = (c, term) => fireEvent.change(q(c, '[data-codex-search]'), { target: { value: term } });
const rowKeys = (c, sel) => qa(c, `${sel} [data-codex-row]`).map(r => r.getAttribute('data-codex-row'));

describe('the opening page', () => {
    it('opens on a search and the entries looked at lately, with no kind tabs, counts or collected list', () => {
        const { container } = open();
        expect(page(container)).toBe(PAGE.OPENING);
        expect(q(container, '[data-codex-search]')).not.toBeNull();
        expect(q(container, '[data-codex-recent="viewed"]')).not.toBeNull();
        expect(q(container, '[data-codex-recent="collected"]')).toBeNull();
        expect(q(container, '[role="tab"]')).toBeNull();
        expect(q(container, '[data-codex-progress]')).toBeNull();
        // The Atlas's book.
        expect(qa(container, '[data-codex-page-art]').map(i => i.getAttribute('src'))).toEqual(['/assets/playmat/atlas_book_left.png', '/assets/playmat/atlas_book_right.png']);
    });

    it('"iron" finds Iron Ore, Iron Ingot and the Iron Smithy', () => {
        const { container } = open();
        search(container, 'iron');
        expect(rowKeys(container, '[data-codex-list="search"]'))
            .toEqual(expect.arrayContaining([itemKey('item_iron_ore'), itemKey('item_iron_ingot'), tokenKey('token_iron_smithy')]));
        expect(q(container, '[data-codex-group="tokens"]')).not.toBeNull();
    });

    it('lists what was looked at, newest first', () => {
        lookUp(itemKey('item_iron_ingot'));
        const first = open();
        fireEvent.click(nodeOf(first.container, itemKey('item_iron_ore'), 'in'));
        fireEvent.click(q(first.container, '[data-codex-contents]'));
        expect(page(first.container)).toBe(PAGE.OPENING);
        expect(rowKeys(first.container, '[data-codex-recent="viewed"]')).toEqual([itemKey('item_iron_ore'), itemKey('item_iron_ingot')]);
    });
});

describe('the chart', () => {
    it('Iron Ingot: Iron Ore and Coal flow in from the left, its uses go out to the right', () => {
        const { container } = open();
        search(container, 'iron ingot');
        fireEvent.click(q(container, `[data-codex-row="${itemKey('item_iron_ingot')}"]`));
        expect(page(container)).toBe(PAGE.CHART);
        expect(q(container, '[data-codex-node="s"]').getAttribute('data-codex-key')).toBe(itemKey('item_iron_ingot'));
        expect(nodeOf(container, itemKey('item_iron_ore'), 'in')).toBeTruthy();
        expect(nodeOf(container, itemKey('item_coal'), 'in')).toBeTruthy();
        expect(qa(container, '[data-codex-side="out"]').length).toBeGreaterThan(0);
        // Its smelt: the Smithing Station beside the ingredients, Smithing 15 above the ingot, no chips, no panel.
        expect(nodeOf(container, 'station:smithing', 'in').textContent).toMatch(/Smithing Station/);
        expect(reqOf(container, 's').textContent).toBe('Smithing 15');
        expect(reqOf(container, 's').getAttribute('data-codex-made-at')).toMatch(/^Made at .*Furnace/);
        expect(q(container, '[data-codex-chip]')).toBeNull();
        expect(q(container, '[data-codex-panel]')).toBeNull();
        expect(q(container, '[data-codex-chart-from]')).toBeNull();
        expect(qa(container, '[data-codex-link]').length).toBeGreaterThan(3);
        // Dropped by the Fire Elemental Chief: its odds on its box, Combat and its level above it.
        const chief = nodeOf(container, tokenKey('token_fire_elemental_chief'), 'in');
        expect(q(chief, '[data-codex-chance]').textContent).toMatch(/^\d+(\.\d)?%$/);
        expect(reqOf(container, chief.getAttribute('data-codex-node')).textContent).toMatch(/^Combat · Lv \d+$/);
        // A use shows a count of its lines not on screen: the pickaxe's station and other ingredient.
        const pick = nodeOf(container, itemKey('item_iron_pickaxe'), 'out');
        expect(q(container, `[data-codex-stem="in"][data-codex-stem-of="${pick.getAttribute('data-codex-node')}"]`).textContent).toMatch(/^\+\d+$/);
    });

    it('clicking Iron Ore grows its vein and focuses it; back to start returns', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        expect(nodeOf(container, tokenKey('token_iron_ore_vein'))).toBeFalsy();
        fireEvent.click(nodeOf(container, itemKey('item_iron_ore'), 'in'));
        expect(focused(container)).toBe(itemKey('item_iron_ore'));
        const vein = nodeOf(container, tokenKey('token_iron_ore_vein'), 'in');
        expect(vein).toBeTruthy();
        // The vein stands left of the ore, the ore left of the ingot.
        const x = (el) => parseFloat(el.style.left);
        expect(x(vein)).toBeLessThan(x(nodeOf(container, itemKey('item_iron_ore'), 'in')));
        expect(x(nodeOf(container, itemKey('item_iron_ore'), 'in'))).toBeLessThan(x(q(container, '[data-codex-node="s"]')));

        fireEvent.click(q(container, '[data-codex-home]'));
        expect(focused(container)).toBe(itemKey('item_iron_ingot'));
        // The grown part stays.
        expect(nodeOf(container, tokenKey('token_iron_ore_vein'))).toBeTruthy();
    });

    it('a drag pans the chart, and the press that dragged is no click', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        const chart = q(container, '[data-codex-chart]');
        const before = chart.getAttribute('data-codex-view').split(',').map(Number);
        const ore = nodeOf(container, itemKey('item_iron_ore'), 'in');
        act(() => {
            fireEvent.pointerDown(ore, { pointerId: 1, button: 0, clientX: 300, clientY: 300 });
            fireEvent.pointerMove(window, { pointerId: 1, clientX: 340, clientY: 320 });
            fireEvent.pointerMove(window, { pointerId: 1, clientX: 380, clientY: 330 });
            fireEvent.pointerUp(window, { pointerId: 1, clientX: 380, clientY: 330 });
        });
        fireEvent.click(ore);
        const after = q(container, '[data-codex-chart]').getAttribute('data-codex-view').split(',').map(Number);
        expect([after[0] - before[0], after[1] - before[1]]).toEqual([80, 30]);
        expect(focused(container)).toBe(itemKey('item_iron_ingot'));
        expect(nodeOf(container, tokenKey('token_iron_ore_vein'))).toBeFalsy();
        // The next plain click is a click again.
        fireEvent.click(ore);
        expect(focused(container)).toBe(itemKey('item_iron_ore'));
    });

    it('a link pressed while open starts a chart there, and announces itself', () => {
        const heard = [];
        const off = EventBus.subscribe(UI_EVENTS.OPEN_ENCYCLOPEDIA, (d) => heard.push(d.key));
        const { container } = open();
        act(() => lookUp(tokenKey('token_iron_smithy')));
        off();
        expect(heard).toEqual([tokenKey('token_iron_smithy')]);
        expect(page(container)).toBe(PAGE.CHART);
        expect(q(container, '[data-codex-node="s"]').getAttribute('data-codex-key')).toBe(tokenKey('token_iron_smithy'));
    });

    it('the station entry grows to every station of its skill', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        fireEvent.click(nodeOf(container, 'station:smithing', 'in'));
        const stations = qa(container, '[data-codex-node^="s<0f<"]').map(n => n.getAttribute('data-codex-key'));
        expect(stations).toEqual(expect.arrayContaining([tokenKey('token_furnace'), tokenKey('token_iron_smithy')]));
        // A station asks nothing above it: its recipes do.
        expect(q(container, '[data-codex-req-of^="s<0f<"]')).toBeNull();
    });

    it('the inspect mark tells what you have and this run totals', () => {
        InventoryManager.addItem('item_iron_ore', 4);
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        const ore = nodeOf(container, itemKey('item_iron_ore'), 'in');
        act(() => { fireEvent.pointerEnter(q(ore, '[data-codex-inspect]'), { clientX: 10, clientY: 10, pointerType: 'mouse', buttons: 0 }); });
        const tip = document.querySelector('[data-tooltip]')?.textContent || '';
        expect(tip).toMatch(/Have 4/);
        expect(tip).toMatch(/Collected this run: 4/);
    });

    it('have / need reads red when short, and a level no hero has is marked', () => {
        GameState.state.heroes = [];
        InventoryManager.addItem('item_coal', 1);
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        const ore = nodeOf(container, itemKey('item_iron_ore'), 'in');
        expect(q(ore, '[data-codex-have]').getAttribute('data-short')).toBe('true');
        expect(reqOf(container, 's').getAttribute('data-codex-req-short')).toBe('true');
        // A fight is never marked: no hero level is checked to fight.
        const chief = nodeOf(container, tokenKey('token_fire_elemental_chief'), 'in');
        expect(reqOf(container, chief.getAttribute('data-codex-node')).getAttribute('data-codex-req-short')).toBeNull();
    });

    it('the opening page and back keep the chart as it was left', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        fireEvent.click(nodeOf(container, itemKey('item_iron_ore'), 'in'));
        search(container, 'iron ingot');
        expect(page(container)).toBe(PAGE.OPENING);
        fireEvent.click(q(container, `[data-codex-row="${itemKey('item_iron_ingot')}"]`));
        expect(page(container)).toBe(PAGE.CHART);
        expect(nodeOf(container, tokenKey('token_iron_ore_vein'))).toBeTruthy();
    });

    it('shows no wedge, cell or tier anywhere', () => {
        lookUp(itemKey('item_iron_ore'));
        const { container } = open();
        fireEvent.click(q(container, '[data-codex-node][data-codex-side="in"]'));
        expect(container.textContent).not.toMatch(/\b(tier|wedge|cell|plane)\b/i);
    });
});

describe('after the owner\'s look of 1 November', () => {
    it('clicking an open box collapses it again', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        fireEvent.click(nodeOf(container, itemKey('item_iron_ore'), 'in'));
        expect(nodeOf(container, tokenKey('token_iron_ore_vein'))).toBeTruthy();
        fireEvent.click(nodeOf(container, itemKey('item_iron_ore'), 'in'));
        expect(nodeOf(container, tokenKey('token_iron_ore_vein'))).toBeFalsy();
        expect(focused(container)).toBe(itemKey('item_iron_ore'));
    });

    it('an item toast clicked while the book is open jumps to its chart; with it shut, the click still pins', () => {
        act(() => {
            ItemStubs.recordFlow('item_coal', { added: 2, removed: 0 });
            ItemStubs.recordFlow('item_iron_ore', { added: 1, removed: 0 });
            ItemStubs.flush();
        });
        const stubs = render(React.createElement(ItemStubColumn));
        const stub = (id) => stubs.container.querySelector(`[data-item-stub="${id}"]`);
        act(() => { fireEvent.click(stub('item_iron_ore')); });
        expect(ItemStubs.getStub('item_iron_ore')?.pinned).toBe(true);

        const { container } = open();
        act(() => { fireEvent.click(stub('item_coal')); });
        expect(page(container)).toBe(PAGE.CHART);
        expect(q(container, '[data-codex-node="s"]').getAttribute('data-codex-key')).toBe(itemKey('item_coal'));
        expect(ItemStubs.getStub('item_coal')?.pinned).toBeFalsy();
    });
});
