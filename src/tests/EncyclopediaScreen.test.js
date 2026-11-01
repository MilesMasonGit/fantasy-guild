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
import { RegistryManager } from '../systems/progression/RegistryManager.js';

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
});

const open = () => render(React.createElement(EncyclopediaScreen, { onClose: () => {} }));
const q = (c, sel) => c.querySelector(sel);
const qa = (c, sel) => [...c.querySelectorAll(sel)];
const page = (c) => q(c, '[data-encyclopedia]').getAttribute('data-codex-page');
const nodeOf = (c, key, side) => qa(c, `[data-codex-key="${key}"]`).find(n => !side || n.getAttribute('data-codex-side') === side);
const focused = (c) => q(c, '[data-codex-node][data-focus="true"]')?.getAttribute('data-codex-key');
const panel = (c) => q(c, '[data-codex-panel]')?.getAttribute('data-codex-panel');
const search = (c, term) => fireEvent.change(q(c, '[data-codex-search]'), { target: { value: term } });
const rowKeys = (c, sel) => qa(c, `${sel} [data-codex-row]`).map(r => r.getAttribute('data-codex-row'));

describe('the opening page', () => {
    it('opens on a search and the recent entries, with no kind tabs or counts', () => {
        const { container } = open();
        expect(page(container)).toBe(PAGE.OPENING);
        expect(q(container, '[data-codex-search]')).not.toBeNull();
        expect(q(container, '[data-codex-recent="viewed"]')).not.toBeNull();
        expect(q(container, '[data-codex-recent="collected"]')).not.toBeNull();
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

    it('lists what was looked at, newest first, and the items collected last, newest first', () => {
        RegistryManager.recordItemGain('item_copper_ore', 1);
        RegistryManager.recordItemGain('item_coal', 1);
        lookUp(itemKey('item_iron_ingot'));
        const first = open();
        fireEvent.click(nodeOf(first.container, itemKey('item_iron_ore'), 'in'));
        fireEvent.click(q(first.container, '[data-codex-contents]'));
        expect(page(first.container)).toBe(PAGE.OPENING);
        expect(rowKeys(first.container, '[data-codex-recent="viewed"]')).toEqual([itemKey('item_iron_ore'), itemKey('item_iron_ingot')]);
        const collected = rowKeys(first.container, '[data-codex-recent="collected"]');
        expect(collected.slice(0, 2)).toEqual([itemKey('item_coal'), itemKey('item_copper_ore')]);
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
        // Its first way in is the smelt: a chip naming a station, with the level.
        const chip = q(container, '[data-codex-chip="s<0"]');
        expect(chip.getAttribute('data-codex-how')).toBe('craft');
        expect(q(chip, '[data-codex-gate]')).not.toBeNull();
        expect(qa(container, '[data-codex-link]').length).toBeGreaterThan(3);
        expect(panel(container)).toBe(itemKey('item_iron_ingot'));
    });

    it('clicking Iron Ore grows its vein and focuses it; back to start returns', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        expect(nodeOf(container, tokenKey('token_iron_ore_vein'))).toBeFalsy();
        fireEvent.click(nodeOf(container, itemKey('item_iron_ore'), 'in'));
        expect(focused(container)).toBe(itemKey('item_iron_ore'));
        expect(panel(container)).toBe(itemKey('item_iron_ore'));
        const vein = nodeOf(container, tokenKey('token_iron_ore_vein'), 'in');
        expect(vein).toBeTruthy();
        // The vein stands left of the ore, the ore left of the ingot.
        const x = (el) => parseFloat(el.style.left);
        expect(x(vein)).toBeLessThan(x(nodeOf(container, itemKey('item_iron_ore'), 'in')));
        expect(x(nodeOf(container, itemKey('item_iron_ore'), 'in'))).toBeLessThan(x(q(container, '[data-codex-node="s"]')));

        fireEvent.click(q(container, '[data-codex-home]'));
        expect(focused(container)).toBe(itemKey('item_iron_ingot'));
        expect(panel(container)).toBe(itemKey('item_iron_ingot'));
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
        expect(q(container, '[data-codex-facts="token"]')).not.toBeNull();
    });

    it('a station chip opens its recipe in the panel, which can start a chart from it', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        fireEvent.click(q(container, '[data-codex-chip="s<0"]'));
        const recipe = panel(container);
        expect(recipe.startsWith('recipe:')).toBe(true);
        expect(q(container, '[data-codex-facts="recipe"] [data-codex-station]')).not.toBeNull();
        fireEvent.click(q(container, '[data-codex-chart-from]'));
        expect(q(container, '[data-codex-node="s"]').getAttribute('data-codex-key')).toBe(recipe);
    });

    it('have / need reads red when short, and a level no hero has is marked', () => {
        GameState.state.heroes = [];
        InventoryManager.addItem('item_coal', 1);
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        const ore = nodeOf(container, itemKey('item_iron_ore'), 'in');
        expect(q(ore, '[data-codex-have]').getAttribute('data-short')).toBe('true');
        expect(q(container, '[data-codex-chip="s<0"] [data-codex-gate]').getAttribute('data-codex-gate-short')).toBe('true');
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
