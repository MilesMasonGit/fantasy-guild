// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { SpriteLayerView } from '../ui/components/board/SpriteLayerView.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

// A loot sprite draws its art once per render of its own; the four fixture items have four names.
const drawn = new Map();
vi.mock('../ui/components/base/TokenSprite.jsx', async (orig) => {
    const real = await orig();
    const PixelArt = (props) => { drawn.set(props.alt, (drawn.get(props.alt) || 0) + 1); return real.PixelArt(props); };
    return { ...real, PixelArt };
});

/**
 * ⭐ **One loot sprite's change redraws that sprite and no other.** Every floor sprite used to be
 * handed the whole floor, so a drop, a pickup or a pile joining a stack redrew every piece of loot
 * on the mat (brief 60, cause #3).
 */

const h = React.createElement;
const ITEMS = ['fixture_oak_wood', 'fixture_charcoal', 'fixture_copper_ore', 'fixture_control_item'];
const nameOf = (id) => getItem(id)?.name || id;
const at = (x, y) => ({ centre: { x, y } });
const snap = () => new Map(drawn);
const redrawn = (before) => Object.fromEntries(ITEMS.map(id => [id, (drawn.get(nameOf(id)) || 0) - (before.get(nameOf(id)) || 0)]));

/** The WAAPI calls the floor sprites make: the throw's arc, and the slide into a stack. */
let animations;
const slides = () => animations.filter(a => String(a.keyframes?.[1]?.transform).includes('scale(0.6)'));
const arcs = () => animations.filter(a => !String(a.keyframes?.[1]?.transform).includes('scale(0.6)'));

const mount = () => render(h(SpriteLayerView));
const flush = (fn) => act(async () => { fn(); });

beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.board.sprites = [];
    drawn.clear();
    animations = [];
    HTMLElement.prototype.animate = function (keyframes, options) {
        animations.push({ el: this, keyframes, options });
        return { cancel() {}, finished: Promise.resolve() };
    };
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete HTMLElement.prototype.animate;
});

/** Three piles of three different items, far apart. */
function floor() {
    const a = SpriteLayer.addSprite('item', ITEMS[0], 3, at(300, 300));
    const b = SpriteLayer.addSprite('item', ITEMS[1], 2, at(1200, 300));
    const c = SpriteLayer.addSprite('item', ITEMS[2], 1, at(700, 900));
    return { a, b, c };
}

describe('⭐ a floor sprite redraws only for its own change', () => {
    it('every pile draws once on mount', () => {
        floor();
        mount();
        expect(redrawn(new Map())).toMatchObject({ [ITEMS[0]]: 1, [ITEMS[1]]: 1, [ITEMS[2]]: 1 });
    });

    it('a drop: the new pile draws, the others do not', async () => {
        floor();
        mount();
        const before = snap();
        await flush(() => SpriteLayer.addSprite('item', ITEMS[3], 1, at(1500, 900)));
        expect(redrawn(before)).toEqual({ [ITEMS[0]]: 0, [ITEMS[1]]: 0, [ITEMS[2]]: 0, [ITEMS[3]]: 1 });
    });

    it('a pickup: nothing left on the floor redraws', async () => {
        const { b } = floor();
        mount();
        const before = snap();
        await flush(() => expect(SpriteLayer.collectSprite(b.id)).toBe(true));
        expect(GameState.state.board.sprites.map(s => s.id)).not.toContain(b.id);
        expect(redrawn(before)).toMatchObject({ [ITEMS[0]]: 0, [ITEMS[2]]: 0 });
    });

    it('a pile whose count changes redraws, and only it', async () => {
        floor();
        mount();
        const before = snap();
        await flush(() => expect(SpriteLayer.consumeFromSprites(ITEMS[0], 1)).toBe(1));
        expect(redrawn(before)).toEqual({ [ITEMS[0]]: 1, [ITEMS[1]]: 0, [ITEMS[2]]: 0, [ITEMS[3]]: 0 });
    });

    it('a sprite joining a stack: the stack redraws when it absorbs it, nothing else does', async () => {
        const { a } = floor();
        mount();
        let before = snap();
        let child;
        await flush(() => { child = SpriteLayer.addSprite('item', ITEMS[0], 2, at(310, 310)); });
        expect(child.targetStackId).toBe(a.id);
        // The newcomer draws (it shares the stack's name); the other piles do not.
        expect(redrawn(before)).toMatchObject({ [ITEMS[1]]: 0, [ITEMS[2]]: 0 });

        before = snap();
        await flush(() => SpriteLayer.absorbSprite(child.id));
        expect(GameState.state.board.sprites.find(s => s.id === a.id).quantity).toBe(5);
        expect(redrawn(before)).toEqual({ [ITEMS[0]]: 1, [ITEMS[1]]: 0, [ITEMS[2]]: 0, [ITEMS[3]]: 0 });
    });
});

describe('⭐ a floor sprite\'s own motion is not replayed by its neighbours', () => {
    it('the slide into a stack plays once, however the floor changes while it waits to be absorbed', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        const { a } = floor();
        mount();
        let child;
        await flush(() => { child = SpriteLayer.addSprite('item', ITEMS[0], 2, at(310, 310)); });
        expect(child.targetStackId).toBe(a.id);

        await act(async () => { vi.advanceTimersByTime(850); });
        expect(slides()).toHaveLength(1);
        expect(slides()[0].el.getAttribute('data-item-sprite')).toBe('true');

        // Other piles come and go in the 300 ms before the stack takes it.
        await flush(() => SpriteLayer.addSprite('item', ITEMS[3], 1, at(1500, 900)));
        await act(async () => { vi.advanceTimersByTime(50); });
        await flush(() => SpriteLayer.consumeFromSprites(ITEMS[1], 1));
        await act(async () => { vi.advanceTimersByTime(50); });
        expect(slides()).toHaveLength(1);
    });

    it('a thrown sprite\'s arc plays once, however the floor changes during it', async () => {
        floor();
        mount();
        expect(arcs()).toHaveLength(3);
        await flush(() => SpriteLayer.addSprite('item', ITEMS[3], 1, at(1500, 900)));
        await flush(() => SpriteLayer.consumeFromSprites(ITEMS[0], 1));
        expect(arcs()).toHaveLength(4);
    });
});
