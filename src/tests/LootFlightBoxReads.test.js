// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { wireNotifications, unwireNotifications } from '../systems/notifications/routing.js';
import * as ItemStubs from '../systems/notifications/itemStubs.js';
import { ParticleOverlay, flightDurationMs } from '../ui/components/base/ParticleOverlay.jsx';
import { ItemStubColumn } from '../ui/components/notifications/ItemStubColumn.jsx';
import { resetCopies } from '../ui/components/notifications/stubLanding.js';
import { STUB_PX, HEADER_PX, SPRITE_INSET_PX } from '../ui/components/notifications/stubGeometry.js';
import './fixtures/fixtureItems.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ **Auto-collect reads no box inside the engine's tick.** A sweep used to read the mat's box for
 * every flight it started, which made the browser lay the page out in the middle of the tick and
 * again for the frame. A flight is now booked in the tick and placed on its first frame. It must look
 * the same: every case below that follows a flight frame by frame computes the path by hand, from the
 * same formula the flight has always had, and runs the same on the old code.
 *
 * jsdom lays nothing out: the boxes stand in for the screen (a 1600×1000 window, the mat at half size
 * from (100, 50), the column flush right from y 40, the Hall in the middle).
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });

const COLUMN = { left: 1400, top: 40, width: 200, height: 900 };
const HALL = box(600, 400, 128, 128);
const DOCK_HERO = box(40, 700, 60, 80);
const FIT = 0.5;

let matBox;
let reads;

function fakeRect() {
    reads++;
    if (this.matches?.('[data-board-origin]')) return matBox;
    if (this.matches?.('[data-item-stubs]')) return box(COLUMN.left, COLUMN.top, COLUMN.width, COLUMN.height);
    if (this.matches?.('[data-guild-hall="true"]')) return HALL;
    if (this.matches?.('[data-dock-hero-id]')) return DOCK_HERO;
    if (this.matches?.('[data-item-stub]')) {
        const group = this.closest('[data-item-stubs]');
        const i = [...group.querySelectorAll('[data-item-stub]')].indexOf(this);
        return box(1600 - 80, COLUMN.top + HEADER_PX + i * STUB_PX, 80, STUB_PX);
    }
    if (this.matches?.('[data-stub-sprite]')) {
        const r = this.closest('[data-item-stub]').getBoundingClientRect();
        return box(r.right - SPRITE_INSET_PX - 16, r.top + 6, 32, 32);
    }
    return box(0, 0, 0, 0);
}

const realRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = fakeRect;
afterAll(() => { Element.prototype.getBoundingClientRect = realRect; });

let queue;
let clock;
let landed;
let unsubLanded;
/** Where each frame drew an item, in screen pixels. */
let drawn;
const recordingCtx = new Proxy({}, {
    get: (target, key) => {
        if (key === 'fillText') return (text, x, y) => drawn.push({ x, y });
        if (key === 'drawImage') return (img, x, y, w, ht) => drawn.push({ x: x + w / 2, y: y + ht / 2 });
        return key in target ? target[key] : () => ({ addColorStop() {} });
    },
    set: (target, key, value) => { target[key] = value; return true; }
});

function frame(ms = 16) {
    clock += ms;
    const due = queue;
    queue = [];
    act(() => { for (const cb of due) cb(clock); });
}

function mountGame() {
    return render(h('div', null,
        h('div', { 'data-board-origin': true, 'data-natural-width': String(matBox.width / FIT) },
            h('div', { 'data-token-art': 'true', 'data-guild-hall': 'true' })),
        h('div', { 'data-dock-hero-id': 'hero_1' }),
        h(ParticleOverlay, { disabled: false }),
        h('div', { style: { position: 'relative' } }, h(ItemStubColumn))
    ));
}

function pile(itemId, qty, x, y) {
    const sprite = SpriteLayer.addSprite('item', itemId, qty, null);
    sprite.x = x;
    sprite.y = y;
    sprite.targetStackId = null;
    return sprite;
}

/** `collect()` as a tick would: how many boxes it read before anything else ran. */
async function boxesReadBy(collect) {
    let during = -1;
    await act(async () => {
        reads = 0;
        collect();
        during = reads;
    });
    return during;
}

/** The arc every flight has flown, by hand: the mid point lifted by a fifth of the distance. */
function pathOf(from, to, { floorY = -Infinity } = {}) {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    return {
        from, to, dist,
        cp: { x: (from.x + to.x) / 2, y: Math.max(floorY, (from.y + to.y) / 2 - dist * 0.2) },
        duration: flightDurationMs(dist)
    };
}

function pointOn(path, k) {
    const inv = 1 - k;
    return {
        x: Math.round(inv * inv * path.from.x + 2 * inv * k * path.cp.x + k * k * path.to.x),
        y: Math.round(inv * inv * path.from.y + 2 * inv * k * path.cp.y + k * k * path.to.y)
    };
}

/** Fly it out, frame by frame, and check every frame against the path, from a start at `startedAt`. */
function expectFlownAlong(path, startedAt) {
    drawn = [];
    const seen = [];
    while (queue.length) {
        frame();
        seen.push({ k: Math.min(1, (clock - startedAt) / path.duration), at: drawn.at(-1) ?? null });
        drawn = [];
    }
    const inFlight = seen.filter(s => s.k < 1 && s.at);
    expect(inFlight.length).toBeGreaterThan(10);
    for (const { k, at } of inFlight) expect(at).toEqual(pointOn(path, k));
    expect(landed).toHaveLength(1);
    expect(landed[0].x).toBeCloseTo(path.to.x);
    expect(landed[0].y).toBeCloseTo(path.to.y);
}

const onMat = (x, y) => ({ x: matBox.left + x * FIT, y: matBox.top + y * FIT });
const stubEl = (view, id) => view.container.querySelector(`[data-item-stub="${id}"]`);
const shownOn = (el) => el?.getAttribute('data-stub-net');

beforeEach(() => {
    queue = [];
    clock = 0;
    landed = [];
    drawn = [];
    reads = 0;
    matBox = box(100, 50, 800, 500);
    GameState.initNew();
    SpriteLayer.init();
    ItemStubs.reset();
    resetCopies();
    wireNotifications();
    SettingsManager.set('notifications.itemStubs', true);
    SettingsManager.set('ui.itemParticles', true);
    SettingsManager.set('gameplay.autoCollectLoot', true);
    SettingsManager.set('gameplay.autoCollectDelayMs', 0);
    Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb) => { queue.push(cb); return queue.length; });
    vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(recordingCtx);
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
    SettingsManager.set('gameplay.autoCollectLoot', false);
    SettingsManager.set('gameplay.autoCollectDelayMs', 2500);
});

describe('⭐ a collection reads no box inside the tick', () => {
    it('an auto-collect sweep, flying to the stubs: no box read until the frame', async () => {
        mountGame();
        pile('fixture_oak_wood', 1, 300, 600);
        pile('fixture_copper_ore', 1, 500, 600);
        expect(await boxesReadBy(() => SpriteLayer.tick(100))).toBe(0);
        expect(SpriteLayer.getSprites()).toHaveLength(0);
        expect(queue.length).toBe(1);
        reads = 0;
        frame();
        expect(reads).toBeGreaterThan(0);
    });

    it('with the stubs off, flying to the Guild Hall: no box read until the frame', async () => {
        SettingsManager.set('notifications.itemStubs', false);
        mountGame();
        pile('fixture_oak_wood', 1, 300, 600);
        expect(await boxesReadBy(() => SpriteLayer.tick(100))).toBe(0);
        reads = 0;
        frame();
        expect(reads).toBeGreaterThan(0);
    });

    it('a hero called back to the dock: no box read until the frame', async () => {
        GameState.state.heroes = [{ id: 'hero_1', spriteId: 'recruit' }];
        mountGame();
        const publish = () => EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
            kind: 'hero', refId: 'hero_1', heroId: 'hero_1', quantity: 1, x: 300, y: 600, destination: 'dock'
        });
        expect(await boxesReadBy(publish)).toBe(0);
    });
});

describe('⭐ the flight looks as it did: the same start, the same arc, the same timing', () => {
    it('to the Guild Hall, frame by frame', async () => {
        SettingsManager.set('notifications.itemStubs', false);
        mountGame();
        const startedAt = clock;
        await act(async () => { SpriteLayer.collectSprite(pile('fixture_oak_wood', 1, 300, 600).id); });
        const hall = { x: HALL.left + HALL.width / 2, y: HALL.top + HALL.height / 2 };
        expectFlownAlong(pathOf(onMat(300, 600), hall), startedAt);
        expect(landed[0].landsOn).toBe('hall');
    });

    it('to its stub, frame by frame, with the arc held under the top of the screen', async () => {
        const view = mountGame();
        const startedAt = clock;
        await act(async () => { SpriteLayer.collectSprite(pile('fixture_oak_wood', 1, 300, 120).id); });
        const sprite = stubEl(view, 'fixture_oak_wood').querySelector('[data-stub-sprite]').getBoundingClientRect();
        const path = pathOf(onMat(300, 120), { x: sprite.left + 16, y: sprite.top + 16 }, { floorY: 25 });
        expect(path.cp.y).toBe(25);
        expectFlownAlong(path, startedAt);
        expect(landed[0].landsOn).toBe('stub');
    });

    it('a burst keeps its stagger: each flight starts 60 ms after the last', async () => {
        SettingsManager.set('notifications.itemStubs', false);
        mountGame();
        pile('fixture_oak_wood', 1, 300, 600);
        pile('fixture_oak_wood', 1, 300, 900);
        pile('fixture_oak_wood', 1, 300, 300);
        await act(async () => { SpriteLayer.tick(100); });
        const starts = [];
        for (let i = 0; i < 16; i++) {
            drawn = [];
            frame();
            starts.push(drawn.length);
        }
        // Frames at 16, 32 … 240 ms: one flight until 60 ms, two until 120 ms, then all three.
        expect(starts.slice(0, 3)).toEqual([1, 1, 1]);
        expect(starts.slice(4, 7)).toEqual([2, 2, 2]);
        expect(starts.slice(8, 12)).toEqual([3, 3, 3, 3]);
    });

    it('a mat that moved between the tick and the frame: it flies from where the pile was on screen by then', async () => {
        SettingsManager.set('notifications.itemStubs', false);
        mountGame();
        const startedAt = clock;
        await act(async () => { SpriteLayer.collectSprite(pile('fixture_oak_wood', 1, 300, 600).id); });
        matBox = box(140, 90, 800, 500);
        const hall = { x: HALL.left + HALL.width / 2, y: HALL.top + HALL.height / 2 };
        expectFlownAlong(pathOf(onMat(300, 600), hall), startedAt);
    });
});

describe('a flight that cannot fly, found out at the frame', () => {
    it('off the screen: nothing flies, and its count is let through before anything is drawn', async () => {
        matBox = box(100, 5000, 800, 500);
        const view = mountGame();
        await act(async () => { SpriteLayer.collectSprite(pile('fixture_oak_wood', 2, 300, 600).id); });
        expect(queue.length).toBe(1);
        frame();
        act(() => ItemStubs.flush());
        expect(landed).toEqual([]);
        expect(drawn).toEqual([]);
        expect(queue.length).toBe(0);
        expect(shownOn(stubEl(view, 'fixture_oak_wood'))).toBe('2');
    });

    it('on the Hall already: the same', async () => {
        SettingsManager.set('notifications.itemStubs', false);
        matBox = box(0, 0, 800, 500);
        mountGame();
        // The Hall's centre, on a mat at half size from the corner.
        await act(async () => { SpriteLayer.collectSprite(pile('fixture_oak_wood', 2, 1328, 928).id); });
        frame();
        expect(landed).toEqual([]);
        expect(drawn).toEqual([]);
        expect(queue.length).toBe(0);
    });
});
