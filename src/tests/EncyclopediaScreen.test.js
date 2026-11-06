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
 * click, glides to its focus, drags, and goes back to the start. As the owner chose its display
 * (1 November): what a step asks sits on its line, a box says how many are needed and its card
 * shows on rest, and the "+N" on a box's far side opens that side in place.
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
/** The mark on a line: a branch's `${branchId}@`, a use's `${useId}@`. */
const markOf = (c, id) => q(c, `[data-codex-line-label="${id}"]`);
const stationOf = (c, side) => qa(c, '[data-codex-key^="station:smithing"]').find(n => !side || n.getAttribute('data-codex-side') === side);
const search = (c, term) => fireEvent.change(q(c, '[data-codex-search]'), { target: { value: term } });
const rowKeys = (c, sel) => qa(c, `${sel} [data-codex-row]`).map(r => r.getAttribute('data-codex-row'));

describe('the opening page', () => {
    it('opens on a search and the entries looked at lately, with no kind tabs or collected list; the counts stand at the page foot', () => {
        const { container } = open();
        expect(page(container)).toBe(PAGE.OPENING);
        expect(q(container, '[data-codex-search]')).not.toBeNull();
        expect(q(container, '[data-codex-recent="viewed"]')).not.toBeNull();
        expect(q(container, '[data-codex-recent="collected"]')).toBeNull();
        expect(q(container, '[role="tab"]')).toBeNull();
        expect(qa(container, '[data-codex-progress] [data-codex-progress-kind]')).toHaveLength(4);
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
        // Its smelt: the Smithing Station beside the ingredients, the Smithing mark and 15 on the line, no chips, no panel.
        expect(stationOf(container, 'in').textContent).toMatch(/Smithing Station/);
        const smelt = markOf(container, 's<0@');
        expect([smelt.getAttribute('data-codex-req'), smelt.textContent]).toEqual(['smithing', '15']);
        expect(smelt.getAttribute('data-codex-made-at')).toMatch(/^Made at .*Furnace/);
        expect(q(container, '[data-codex-req-of]')).toBeNull();
        expect(q(container, '[data-codex-chip]')).toBeNull();
        expect(q(container, '[data-codex-panel]')).toBeNull();
        expect(q(container, '[data-codex-chart-from]')).toBeNull();
        expect(qa(container, '[data-codex-link]').length).toBeGreaterThan(3);
        // Dropped by the Fire Elemental Chief: its odds on its box, a fight and its level on its line.
        const chief = nodeOf(container, tokenKey('token_fire_elemental_chief'), 'in');
        expect(q(chief, '[data-codex-chance]').textContent).toMatch(/^\d+(\.\d)?%$/);
        const branch = chief.getAttribute('data-codex-node').slice(0, -1);
        expect([markOf(container, `${branch}@`).getAttribute('data-codex-req'), markOf(container, `${branch}@`).textContent]).toEqual(['combat', '25']);
        // A use shows a count of its lines not on screen, an arrow tab pointing that way: the pickaxe's station.
        const pick = nodeOf(container, itemKey('item_iron_pickaxe'), 'out');
        expect(q(container, `[data-codex-stem="in"][data-codex-stem-of="${pick.getAttribute('data-codex-node')}"]`).textContent).toMatch(/^‹\d+$/);
        // No magnifier, no kind word, no lone count on a use.
        expect(q(container, '[data-codex-inspect]')).toBeNull();
        expect(pick.textContent).toBe('Iron Pickaxe');
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

    it('a picture pressed in a box cannot be dragged off by the browser, so the pan carries on', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        const pic = q(nodeOf(container, itemKey('item_iron_ore'), 'in'), 'img');
        expect(pic).not.toBeNull();
        expect(fireEvent.dragStart(pic)).toBe(false);
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

    it('the station entry grows to the stations that make it, and only those', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        fireEvent.click(stationOf(container, 'in'));
        const stations = qa(container, '[data-codex-node^="s<0f<"]').map(n => n.getAttribute('data-codex-key'));
        expect(stations.sort()).toEqual([tokenKey('token_furnace'), tokenKey('token_iron_furnace')]);
        // A station's line asks nothing: its recipes do.
        expect(q(container, '[data-codex-line-label^="s<0f<"]')).toBeNull();
    });

    it('resting on a box shows its card: what it is, what you have, this run totals', () => {
        InventoryManager.addItem('item_iron_ore', 4);
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        const ore = nodeOf(container, itemKey('item_iron_ore'), 'in');
        act(() => { fireEvent.pointerEnter(ore, { clientX: 10, clientY: 10, pointerType: 'mouse', buttons: 0 }); });
        const tip = document.querySelector('[data-tooltip]')?.textContent || '';
        expect(tip).toMatch(/Have 4; one Iron Ingot needs 6/);
        expect(tip).toMatch(/Collected this run: 4/);
    });

    it('a box shows just the need, red when short; a level no hero has is marked on its line', () => {
        GameState.state.heroes = [];
        InventoryManager.addItem('item_coal', 5);
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        const ore = q(nodeOf(container, itemKey('item_iron_ore'), 'in'), '[data-codex-need]');
        expect([ore.textContent, ore.getAttribute('data-short')]).toEqual(['×6', 'true']);
        const coal = q(nodeOf(container, itemKey('item_coal'), 'in'), '[data-codex-need]');
        expect([coal.textContent, coal.getAttribute('data-short')]).toEqual(['×2', null]);
        expect(q(container, '[data-codex-have]')).toBeNull();
        expect(markOf(container, 's<0@').getAttribute('data-codex-req-short')).toBe('true');
        // A fight is never marked: no hero level is checked to fight.
        const chief = nodeOf(container, tokenKey('token_fire_elemental_chief'), 'in').getAttribute('data-codex-node').slice(0, -1);
        expect(markOf(container, `${chief}@`).getAttribute('data-codex-req-short')).toBeNull();
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

describe('after the owner\'s third look', () => {
    it('the lines carry their own colour, and their drawing covers the whole chart', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        const svg = q(container, '[data-codex-links]');
        expect(Number(svg.getAttribute('width'))).toBeGreaterThan(500);
        expect(Number(svg.getAttribute('height'))).toBeGreaterThan(200);
        expect(svg.getAttribute('viewBox')).toMatch(/^-?\d+ -?\d+ \d+ \d+$/);
        const drawn = qa(container, '[data-codex-links] polyline, [data-codex-links] polygon');
        expect(drawn.length).toBeGreaterThan(5);
        for (const el of drawn) {
            expect(`${el.getAttribute('stroke') ?? ''} ${el.getAttribute('fill') ?? ''} ${el.getAttribute('style') ?? ''}`).not.toMatch(/var\(/);
        }
        expect(qa(container, '[data-codex-links] polyline').every(el => /^#[0-9a-f]{6}$/i.test(el.getAttribute('stroke')))).toBe(true);
    });

    it('no "or": each way into the ingot sits on its own faint band', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        expect(q(container, '[data-codex-or]')).toBeNull();
        expect(container.textContent).not.toMatch(/\bor\b/i);
        expect(qa(container, '[data-codex-band]').length).toBe(3);
    });

    it('a count beside a box is an arrow tab pointing the way: ‹ on its left, › on its right', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        expect(q(container, '[data-codex-stem-of="s"][data-codex-stem="out"]').textContent).toMatch(/^›\d+$/);
        const ore = nodeOf(container, itemKey('item_iron_ore'), 'in').getAttribute('data-codex-node');
        expect(q(container, `[data-codex-stem-of="${ore}"][data-codex-stem="in"]`).textContent).toMatch(/^‹\d+$/);
        expect(container.textContent).not.toMatch(/\+\d/);
    });

    it('resting on a box draws its lines to the start twice as thick; nothing fades; leaving clears it', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        fireEvent.click(nodeOf(container, itemKey('item_iron_ore'), 'in'));
        const vein = nodeOf(container, tokenKey('token_iron_ore_vein'), 'in');
        const width = (id) => q(container, `[data-codex-link="${id}"] polyline`).getAttribute('stroke-width');
        const veinLine = `${vein.getAttribute('data-codex-node')}>`;
        const coalLine = `${nodeOf(container, itemKey('item_coal'), 'in').getAttribute('data-codex-node')}>`;
        expect([width(veinLine), width(coalLine)]).toEqual(['2', '2']);
        act(() => { fireEvent.pointerEnter(vein, { clientX: 10, clientY: 10, pointerType: 'mouse', buttons: 0 }); });
        expect(q(container, `[data-codex-link="${veinLine}"]`).getAttribute('data-lit')).toBe('true');
        expect([width(veinLine), width(coalLine)]).toEqual(['4', '2']);
        expect(q(container, `[data-codex-link="${coalLine}"]`).getAttribute('data-lit')).toBeNull();
        // Nothing fades: no box, line, mark or tab is dimmed.
        expect(q(container, '[data-dim]')).toBeNull();
        expect(qa(container, '[data-codex-node], [data-codex-line-label], [data-codex-stem]').every(el => !el.style.opacity)).toBe(true);
        expect(qa(container, '[data-codex-link]').every(el => !el.getAttribute('opacity'))).toBe(true);
        act(() => { fireEvent.pointerLeave(vein, { clientX: 10, clientY: 10, pointerType: 'mouse' }); });
        expect(q(container, '[data-lit]')).toBeNull();
        expect(width(veinLine)).toBe('2');
    });

    it('a requirement mark is light words with the hard 2 px outline, the skill icon at 2×; red when short, never on a fight', () => {
        GameState.state.heroes = [];
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        const smelt = markOf(container, 's<0@');
        expect(smelt.className).toMatch(/ui-text-outline-2/);
        expect(smelt.className).toMatch(/text-white/);
        expect(smelt.className).not.toMatch(/ui-text-ink/);
        expect(smelt.style.color).toMatch(/--color-ui-red/);
        expect(q(smelt, 'img').getAttribute('width')).toBe('32');
        const chief = nodeOf(container, tokenKey('token_fire_elemental_chief'), 'in').getAttribute('data-codex-node').slice(0, -1);
        expect(markOf(container, `${chief}@`).style.color).toBe('');
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

    it('the +N count on the side a box grows shows the rest', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        const stem = q(container, '[data-codex-stem-of="s"][data-codex-stem="out"]');
        const hidden = Number(stem.textContent.slice(1));
        const shown = qa(container, '[data-codex-side="out"]').length;
        fireEvent.click(stem);
        expect(qa(container, '[data-codex-side="out"]').length).toBe(shown + hidden);
        expect(q(container, '[data-codex-stem-of="s"][data-codex-stem="out"]')).toBeNull();
    });

    it('the +N on a box\'s far side opens that side in place; clicking the box folds it', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        const x = (el) => parseFloat(el.style.left);
        const pickId = nodeOf(container, itemKey('item_iron_pickaxe'), 'out').getAttribute('data-codex-node');
        const before = x(nodeOf(container, itemKey('item_iron_pickaxe'), 'out'));
        const stem = q(container, `[data-codex-stem-of="${pickId}"][data-codex-stem="in"]`);
        expect([stem.tagName, stem.getAttribute('data-codex-stem-far')]).toEqual(['BUTTON', 'true']);
        fireEvent.click(stem);
        // The pickaxe moves out a column; its station stands between it and the ingot, whose line runs through.
        const pick = q(container, `[data-codex-node="${pickId}"]`);
        expect(pick.getAttribute('data-far-open')).toBe('true');
        expect(focused(container)).toBe(itemKey('item_iron_pickaxe'));
        expect(x(pick)).toBeGreaterThan(before);
        const between = qa(container, `[data-codex-node^="${pickId}<"]`);
        expect(between.length).toBeGreaterThan(0);
        expect(between.every(n => x(n) > x(q(container, '[data-codex-node="s"]')) && x(n) < x(pick))).toBe(true);
        expect(qa(container, '[data-codex-node]').filter(n => n.getAttribute('data-codex-key') === itemKey('item_iron_ingot'))).toHaveLength(1);
        expect(q(container, `[data-codex-stem-of="${pickId}"][data-codex-stem="in"]`)).toBeNull();
        // Clicking the open box folds what it opened.
        fireEvent.click(pick);
        expect(qa(container, `[data-codex-node^="${pickId}<"]`)).toHaveLength(0);
        expect(x(q(container, `[data-codex-node="${pickId}"]`))).toBe(before);
        expect(focused(container)).toBe(itemKey('item_iron_pickaxe'));
    });

    it('an ingredient\'s far side opens its other uses between it and the start', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        const x = (el) => parseFloat(el.style.left);
        const coal = nodeOf(container, itemKey('item_coal'), 'in');
        const coalId = coal.getAttribute('data-codex-node');
        const before = x(coal);
        fireEvent.click(q(container, `[data-codex-stem-of="${coalId}"][data-codex-stem="out"]`));
        const moved = q(container, `[data-codex-node="${coalId}"]`);
        expect(x(moved)).toBeLessThan(before);
        const uses = qa(container, `[data-codex-node^="${coalId}>"]`);
        expect(uses.map(n => n.getAttribute('data-codex-key'))).toEqual(expect.arrayContaining([itemKey('item_copper_ingot')]));
        expect(uses.every(n => n.getAttribute('data-codex-side') === 'out' && x(n) > x(moved) && x(n) < x(q(container, '[data-codex-node="s"]')))).toBe(true);
    });

    it('a growing stage is no box: an Oak Tree comes from the Oak Forest, its sapling a grow mark on the line', () => {
        lookUp(tokenKey('token_oak_tree'));
        const { container } = open();
        expect(nodeOf(container, tokenKey('token_oak_sapling'))).toBeFalsy();
        expect(nodeOf(container, tokenKey('token_oak_stump'))).toBeFalsy();
        expect(nodeOf(container, tokenKey('token_oak_forest'), 'in')).toBeTruthy();
        expect(q(container, '[data-codex-line-label] [data-glyph="grow"]')).not.toBeNull();
        expect(q(container, '[data-codex-line-label] [data-glyph="regrow"]')).not.toBeNull();
        // The Starter Camp is no way on the chart; the card names it.
        expect(q(container, '[data-codex-caption="starterCamp"]')).toBeNull();
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
