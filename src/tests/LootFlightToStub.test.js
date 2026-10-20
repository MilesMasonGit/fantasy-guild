// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { wireNotifications, unwireNotifications } from '../systems/notifications/routing.js';
import * as ItemStubs from '../systems/notifications/itemStubs.js';
import { ParticleOverlay } from '../ui/components/base/ParticleOverlay.jsx';
import { ItemStubColumn } from '../ui/components/notifications/ItemStubColumn.jsx';
import { resetCopies, getCopies } from '../ui/components/notifications/stubLanding.js';
import { STUB_PX, PITCH_PX, SPRITE_INSET_PX, HEADER_PX } from '../ui/components/notifications/stubGeometry.js';
import './fixtures/fixtureItems.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ **Collected loot flies to its own stub** (owner, third look), the whole way through: a sprite
 * collected off the mat is in the Bank at once, exactly as before; its flight lands on the item's
 * stub instead of the Guild Hall, and the stub's count ticks up only as it lands. A new item's stub
 * slides out at +0 as the flight starts; a stub out of view gets a copy over the bottom stubs; with
 * item stubs switched off the loot flies to the Guild Hall as before.
 *
 * jsdom lays nothing out: the boxes below stand in for the screen (a 1600×1000 window, the mat
 * from the top left at 1:1, the column flush right from y 40, the Hall in the middle).
 */

const h = React.createElement;
const COLUMN = { left: 1400, top: 40, width: 200 };
const HALL = { left: 600, top: 400, width: 128, height: 128 };
/** The scrolling list's visible box, when the column scrolls. */
const SCROLL_VIEW = { top: COLUMN.top + HEADER_PX + 20, height: 4 * PITCH_PX };
let columnHeight = 900;

const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });

function fakeRect() {
    if (this.matches?.('[data-board-origin]')) return box(0, 0, 1600, 1000);
    if (this.matches?.('[data-item-stubs]')) return box(COLUMN.left, COLUMN.top, COLUMN.width, columnHeight);
    if (this.matches?.('[data-stubs-scroll]')) return box(COLUMN.left, SCROLL_VIEW.top, COLUMN.width, SCROLL_VIEW.height);
    if (this.matches?.('[data-guild-hall="true"]')) return box(HALL.left, HALL.top, HALL.width, HALL.height);
    if (this.matches?.('[data-item-stub]')) {
        const scroller = this.closest('[data-stubs-scroll]');
        const group = scroller || this.closest('[data-item-stubs]');
        const i = [...group.querySelectorAll('[data-item-stub]')].indexOf(this);
        const top = scroller ? SCROLL_VIEW.top + i * PITCH_PX : COLUMN.top + HEADER_PX + i * PITCH_PX;
        return box(1600 - 80, top, 80, STUB_PX);
    }
    if (this.matches?.('[data-stub-sprite]')) {
        const r = this.closest('[data-item-stub]').getBoundingClientRect();
        return box(r.right - SPRITE_INSET_PX - 16, r.top + 6, 32, 32);
    }
    return box(0, 0, 0, 0);
}

const realRect = Element.prototype.getBoundingClientRect;
const realClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
Element.prototype.getBoundingClientRect = fakeRect;
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() { return this.matches?.('[data-item-stubs]') ? columnHeight : 0; }
});
afterAll(() => {
    Element.prototype.getBoundingClientRect = realRect;
    if (realClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', realClientHeight);
});

let queue;
let clock;
let landed;
let unsubLanded;
const fakeCtx = new Proxy({}, {
    get: (target, key) => (key in target ? target[key] : () => ({ addColorStop() {} })),
    set: (target, key, value) => { target[key] = value; return true; }
});

function frame(ms = 16) {
    clock += ms;
    const due = queue;
    queue = [];
    act(() => { for (const cb of due) cb(clock); });
}
function runUntilAsleep(limit = 4000) {
    let n = 0;
    while (queue.length && n < limit) { frame(); n++; }
}

/** The mat with the Guild Hall on it, the flight layer, and the stub column, as the game has them. */
function mountGame() {
    return render(h('div', null,
        h('div', { 'data-board-origin': true, 'data-natural-width': '1600' },
            h('div', { 'data-token-art': 'true', 'data-guild-hall': 'true' })),
        h(ParticleOverlay, { disabled: false }),
        h('div', { style: { position: 'relative' } }, h(ItemStubColumn))
    ));
}

/** A pile on the mat at (x, y), collected the way hovering it does. */
async function collectPile(itemId, qty, x = 300, y = 600) {
    const sprite = SpriteLayer.addSprite('item', itemId, qty, null);
    sprite.x = x;
    sprite.y = y;
    let taken;
    await act(async () => { taken = SpriteLayer.collectSprite(sprite.id); });
    return taken;
}

const stubEl = (view, id) => view.container.querySelector(`[data-item-stub="${id}"]`);
const shownOn = (el) => el?.getAttribute('data-stub-net');

beforeEach(() => {
    queue = [];
    clock = 0;
    landed = [];
    columnHeight = 900;
    GameState.initNew();
    SpriteLayer.init();
    ItemStubs.reset();
    resetCopies();
    wireNotifications();
    SettingsManager.set('notifications.itemStubs', true);
    SettingsManager.set('ui.itemParticles', true);
    Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb) => { queue.push(cb); return queue.length; });
    vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);
    unsubLanded = EventBus.subscribe(UI_EVENTS.PARTICLE_LANDED, (p) => landed.push(p));
});

afterEach(() => {
    unsubLanded?.();
    cleanup();
    unwireNotifications();
    ItemStubs.reset();
    resetCopies();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete window.innerWidth;
    delete window.innerHeight;
    SettingsManager.set('notifications.itemStubs', true);
});

describe('⭐ collected loot flies to its stub', () => {
    it('lands on the item\'s stub, not the Guild Hall; the Bank has it at once; the count ticks on landing', async () => {
        const view = mountGame();
        expect(await collectPile('fixture_oak_wood', 2)).toBe(true);
        runUntilAsleep();
        const before = InventoryManager.getItemCount('fixture_oak_wood');

        expect(await collectPile('fixture_oak_wood', 3, 500, 700)).toBe(true);
        // Credited the moment it was collected, before any frame: the Bank's timing is unchanged.
        expect(InventoryManager.getItemCount('fixture_oak_wood')).toBe(before + 3);
        act(() => ItemStubs.flush());
        // The stub still shows the old count while the loot is in the air.
        expect(shownOn(stubEl(view, 'fixture_oak_wood'))).toBe('2');

        runUntilAsleep();
        const last = landed[landed.length - 1];
        expect(last.landsOn).toBe('stub');
        const sprite = stubEl(view, 'fixture_oak_wood').querySelector('[data-stub-sprite]').getBoundingClientRect();
        expect(last.x).toBeCloseTo(sprite.left + 16);
        expect(last.y).toBeCloseTo(sprite.top + 16);
        expect(landed.some(p => p.landsOn === 'hall')).toBe(false);
        expect(shownOn(stubEl(view, 'fixture_oak_wood'))).toBe('5');
    });

    it('a new item\'s stub slides out at +0 as the flight starts, then counts the landing once', async () => {
        const view = mountGame();
        await collectPile('fixture_oak_wood', 4);
        // Drawn before the first frame of the flight, at +0, sliding in.
        const el = stubEl(view, 'fixture_oak_wood');
        expect(el).not.toBeNull();
        expect(shownOn(el)).toBe('0');
        expect(el.getAttribute('data-stub-arriving')).toBe('true');
        expect(ItemStubs.getStub('fixture_oak_wood').added).toBe(4);

        runUntilAsleep();
        expect(landed.map(p => p.landsOn)).toEqual(['stub']);
        expect(shownOn(stubEl(view, 'fixture_oak_wood'))).toBe('4');
        act(() => ItemStubs.flush());
        expect(ItemStubs.getStub('fixture_oak_wood').added).toBe(4);
    });

    it('with item stubs switched off, loot flies to the Guild Hall as before and nothing is held', async () => {
        SettingsManager.set('notifications.itemStubs', false);
        const view = mountGame();
        expect(view.container.querySelector('[data-item-stubs]')).toBeNull();
        await collectPile('fixture_oak_wood', 2);
        runUntilAsleep();
        expect(landed).toHaveLength(1);
        expect(landed[0].landsOn).toBe('hall');
        expect(landed[0].x).toBeCloseTo(HALL.left + HALL.width / 2);
        expect(landed[0].y).toBeCloseTo(HALL.top + HALL.height / 2);
        expect(ItemStubs.shownNetOf(ItemStubs.getStub('fixture_oak_wood'))).toBe(2);
    });

    it('a new stub below a full column: a copy pops out over the bottom stubs, takes the landing, then slides back', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
        // Room for three stubs: ten makes it scroll.
        columnHeight = HEADER_PX + 3 * PITCH_PX;
        for (let i = 0; i < 10; i++) ItemStubs.recordFlow(`filler_${i}`, { added: 1 });
        const view = mountGame();
        act(() => ItemStubs.flush());
        expect(view.container.querySelector('[data-stubs-scroll]')).not.toBeNull();

        await collectPile('fixture_oak_wood', 3);
        const copy = view.container.querySelector('[data-stub-copy="fixture_oak_wood"]');
        expect(copy).not.toBeNull();
        expect(shownOn(copy)).toBe('0');

        runUntilAsleep();
        const viewBottom = SCROLL_VIEW.top + SCROLL_VIEW.height;
        expect(landed[0].landsOn).toBe('stub');
        expect(landed[0].y).toBeCloseTo(viewBottom - STUB_PX / 2);
        expect(landed[0].x).toBeCloseTo(1600 - SPRITE_INSET_PX);
        expect(shownOn(view.container.querySelector('[data-stub-copy="fixture_oak_wood"]'))).toBe('3');

        act(() => { vi.advanceTimersByTime(5000); });
        expect(getCopies()).toEqual([]);
        expect(view.container.querySelector('[data-stub-copy]')).toBeNull();
        vi.useRealTimers();
    });

    it('a click on the copy acts on its own item, never on the stub it covers', async () => {
        columnHeight = HEADER_PX + 3 * PITCH_PX;
        for (let i = 0; i < 10; i++) ItemStubs.recordFlow(`filler_${i}`, { added: 1 });
        const view = mountGame();
        act(() => ItemStubs.flush());
        await collectPile('fixture_oak_wood', 3);
        const copy = () => view.container.querySelector('[data-stub-copy="fixture_oak_wood"]');
        act(() => { fireEvent.click(copy()); });
        expect(ItemStubs.getStub('fixture_oak_wood').pinned).toBe(true);
        expect(ItemStubs.getStubs().filter(s => s.pinned).map(s => s.itemId)).toEqual(['fixture_oak_wood']);
        act(() => { fireEvent.contextMenu(copy()); });
        // A pinned stub is reset by a right-click; the stubs beneath are untouched.
        expect(ItemStubs.shownNetOf(ItemStubs.getStub('fixture_oak_wood'))).toBe(0);
        expect(ItemStubs.getStubs().filter(s => s.itemId.startsWith('filler_')).every(s => !s.pinned && !s.leaving)).toBe(true);
    });

    it('a flight the overlay drops (a window opened over the game) lets its count through at once', async () => {
        const view = mountGame();
        await collectPile('fixture_oak_wood', 2);
        runUntilAsleep();
        await collectPile('fixture_oak_wood', 3, 500, 700);
        act(() => ItemStubs.flush());
        expect(shownOn(stubEl(view, 'fixture_oak_wood'))).toBe('2');
        view.rerender(h('div', null,
            h('div', { 'data-board-origin': true, 'data-natural-width': '1600' },
                h('div', { 'data-token-art': 'true', 'data-guild-hall': 'true' })),
            h(ParticleOverlay, { disabled: true }),
            h('div', { style: { position: 'relative' } }, h(ItemStubColumn))
        ));
        expect(shownOn(stubEl(view, 'fixture_oak_wood'))).toBe('5');
    });

    it('loot past the burst cap does not fly, and counts at once', async () => {
        const view = mountGame();
        await collectPile('fixture_oak_wood', 1);
        runUntilAsleep();
        landed = [];
        // Thirteen piles in one sweep: twelve fly, the last is counted straight away.
        const piles = [];
        for (let i = 0; i < 13; i++) {
            const s = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, null);
            s.x = 100 + i * 10;
            s.y = 600;
            s.targetStackId = null;
            piles.push(s);
        }
        await act(async () => { for (const s of piles) SpriteLayer.collectSprite(s.id); });
        act(() => ItemStubs.flush());
        expect(shownOn(stubEl(view, 'fixture_oak_wood'))).toBe('2');
        runUntilAsleep();
        expect(landed).toHaveLength(12);
        expect(shownOn(stubEl(view, 'fixture_oak_wood'))).toBe('14');
    });
});

describe('the Bank is untouched by where the loot flies', () => {
    it('credits the same amount at the same moment with item stubs on or off', async () => {
        const counts = {};
        for (const on of [true, false]) {
            GameState.initNew();
            SpriteLayer.init();
            ItemStubs.reset();
            SettingsManager.set('notifications.itemStubs', on);
            const view = mountGame();
            await collectPile('fixture_oak_wood', 7);
            counts[on] = InventoryManager.getItemCount('fixture_oak_wood');
            runUntilAsleep();
            view.unmount();
        }
        expect(counts[true]).toBe(7);
        expect(counts[false]).toBe(7);
    });
});
