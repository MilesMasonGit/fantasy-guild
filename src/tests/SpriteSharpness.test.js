// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { FlagLayer, FLAG_FADE_MS } from '../ui/components/board/FlagLayer.jsx';
import { MatHero } from '../ui/components/board/MatHero.jsx';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { PixelArt } from '../ui/components/base/TokenSprite.jsx';
import { setSpriteFxManifest } from '../ui/utils/spriteFx.js';
import { playLootArc, lootHopPoses, HOP_POSES } from '../ui/utils/lootArc.js';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { rosterFlagPayload } from '../ui/dnd/dragConstants.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { walkerGlide } from '../ui/components/board/walkerGlide.js';
import { setDrawn } from '../ui/dev/perf/drawSwitches.js';
import { walkHero } from './fixtures/walkHero.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Nothing on the mat goes soft while something else moves** (owner, 2026-11-08). The mat is
 * scaled to fit, so its sprites stand at fractional screen positions; an animation Chrome runs on
 * the compositor gets a layer of its own, every sprite drawn after it then needs one too, and those
 * are drawn resampled. So what fades or turns among the sprites runs on the main thread
 * (`will-change: contents`), or does not animate at all. `bench:crisp` checks the pixels; these
 * pin what the bench relies on.
 */

const h = React.createElement;
const TOKEN = { x: 600, y: 500 };
const BARE = { x: 1300, y: 800 };
const ITEM_SRC = '/assets/items/item_look.png';
/** A hero portrait with no animation sheet (`AssetManager` ANIMATION_MAP): drawn still. */
const STILL_HERO = 'hn_still_test_por';

function put(point, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}
const flagOf = (container) => container.querySelector('button[data-flag="h1"]');

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); setSpriteFxManifest(null); });
afterEach(() => cleanup());
beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [
        { id: 'h1', name: 'Aela', spriteId: 'hm_fighter_por', status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }
    ];
});

describe('⭐ (a) a flag fades on the main thread, on every path that fades it, and fades as it did', () => {
    const mount = (props = {}) => render(h(DndContext, null, h(FlagLayer, props)));
    const expectFadesAsBefore = (el) => {
        expect(el.style.willChange).toBe('contents');
        expect(el.className).toMatch(/\btransition-opacity\b/);
        expect(el.className).toMatch(/\bease-out\b/);
        expect(el.style.transitionDuration).toBe(`${FLAG_FADE_MS}ms`);
        expect(FLAG_FADE_MS).toBe(700);
    };

    it('a spot reached: the flag going down', () => {
        expect(Orders.orderAt('h1', BARE)).toMatchObject({ success: true, order: 'spot' });
        expect(Flags.statusOf('h1').state).toBe('idle');
        const { container } = mount();
        const el = flagOf(container);
        expect(el.getAttribute('data-flag-down')).toBe('true');
        expect(el.className).toMatch(/\bopacity-0\b/);
        expectFadesAsBefore(el);
    });

    it('the hero hovered on the mat or on their roster tab (both come in as hoverHeroId), and the hero inspected', () => {
        Orders.orderAt('h1', BARE);
        const view = mount();
        view.rerender(h(DndContext, null, h(FlagLayer, { hoverHeroId: 'h1' })));
        let el = flagOf(view.container);
        expect(el.hasAttribute('data-flag-down')).toBe(false);
        expect(el.className).not.toMatch(/\bopacity-0\b/);
        expectFadesAsBefore(el);
        view.rerender(h(DndContext, null, h(FlagLayer, { inspectedHeroId: 'h1' })));
        el = flagOf(view.container);
        expect(el.hasAttribute('data-flag-down')).toBe(false);
        expectFadesAsBefore(el);
    });

    it('a spot left: a Token order (the flag the drag fades to 30 %) on the same button', async () => {
        Orders.orderAt('h1', BARE);
        const view = mount();
        expect(flagOf(view.container).getAttribute('data-flag-down')).toBe('true');
        const t = put(TOKEN, 'fixture_producer');
        const before = flagOf(view.container);
        act(() => {
            dropOnMat(rosterFlagPayload('h1'), TOKEN);
            // The game's next tick says so; here, the event the flags listen for.
            EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, {});
        });
        await act(async () => { await new Promise(r => setTimeout(r, 20)); });
        const el = flagOf(view.container);
        expect(el).toBe(before);
        expect(el.getAttribute('data-flag-pinned')).toBe(t.id);
        expect(el.hasAttribute('data-flag-down')).toBe(false);
        expectFadesAsBefore(el);
    });
});

describe('⭐ (b) a hero turns at once', () => {
    // A portrait with no animation sheet (most heroes): the still art flips by a transform.
    const draw = (facing) => render(
        h(DndContext, null,
            h(MatFitProvider, { value: 0.83 },
                h(MatHero, { heroId: 'h1', name: 'h1', sprite: STILL_HERO, left: 0, top: 0, facing })))
    ).container;
    /** The portrait's box: the img's layered wrapper. */
    const artBox = (container) => container.querySelector('[data-board-hero="h1"] img').parentElement.parentElement;

    it('the flip is a plain scaleX with no transition: no squeeze through the widths in between', () => {
        const right = artBox(draw(1));
        expect(right.style.transform).toBe('none');
        expect(right.className).not.toMatch(/transition|duration/);
        cleanup();
        const left = artBox(draw(-1));
        expect(left.style.transform).toBe('scaleX(-1)');
        expect(left.className).not.toMatch(/transition|duration/);
        expect(left.style.transition || '').toBe('');
    });
});

describe('(d) the limp filter fades on the main thread', () => {
    const draw = (limp) => render(
        h(DndContext, null,
            h(MatHero, { heroId: 'h1', name: 'h1', sprite: STILL_HERO, left: 0, top: 0, limp }))
    ).container.querySelector('[data-board-hero="h1"]');

    it('the hero\'s box carries will-change: contents, limping or not, over the art; the fade itself is kept', () => {
        const well = draw(false);
        const art = well.querySelector(':scope > div.w-full.h-full');
        expect(well.style.willChange).toBe('contents');
        expect(art.style.filter).toBe('');
        expect(art.className).toMatch(/transition-\[filter\]/);
        cleanup();
        const limping = draw(true);
        expect(limping.style.willChange).toBe('contents');
        expect(limping.querySelector(':scope > div.w-full.h-full').style.filter).toBe('grayscale(0.7) brightness(0.8) sepia(0.25)');
    });
});

/**
 * ⭐ **X2: a walking hero glides as a walking enemy does** (brief 550). On the compositor (a smooth
 * `transform` transition with no `will-change`) the walking hero was drawn resampled, and
 * everything drawn over it on layers of their own. Now its box, and its speech stack, carry
 * `will-change: contents` and jump a whole screen pixel at a time (`walkerGlide`).
 */
describe('⭐ (X2) a walking hero glides in whole screen pixels, on the main thread', () => {
    afterEach(() => { setDrawn('walkDraw', true); BoardState.setInstantArrival(true); clearMat(); });

    it('every step: its box stepped by the screen pixels it covers, never a smooth glide; will-change: contents throughout', async () => {
        const seen = new Set();
        const { steps } = await walkHero({ fit: 1 }, (fig, dx, dy) => {
            expect(fig.style.willChange).toBe('contents');
            expect(fig.style.transition).toBe(walkerGlide(dx, dy, 1));
            expect(fig.style.transition).not.toMatch(/linear/);
            seen.add(fig.style.transition);
        });
        expect(steps).toBeGreaterThan(5);
        // About 11 u a tick at this walk speed: eleven jumps of under a pixel at a fit of 1.
        expect([...seen]).toContain('transform 100ms steps(11, start)');
    });

    it('at the mat\'s fit: a smaller mat takes fewer jumps', async () => {
        const seen = new Set();
        const { steps } = await walkHero({ fit: 0.5 }, (fig, dx, dy) => {
            expect(fig.style.transition).toBe(walkerGlide(dx, dy, 0.5));
            seen.add(fig.style.transition);
        });
        expect(steps).toBeGreaterThan(5);
        expect([...seen]).toContain('transform 100ms steps(6, start)');
    });

    it('standing, it carries will-change: contents too, and no glide', () => {
        const { container } = render(h(DndContext, null, h(MatHero, { heroId: 'hs', name: 'hs', sprite: STILL_HERO, left: 10, top: 20 })));
        const box = container.querySelector('[data-board-hero="hs"]');
        expect(box.style.willChange).toBe('contents');
        expect(box.style.transition).toBe('none');
    });

    it('with the walk drawing switched off, a step simply lands', async () => {
        setDrawn('walkDraw', false);
        const { steps } = await walkHero({}, (fig) => { expect(fig.style.transition).toBe('none'); });
        expect(steps).toBeGreaterThan(5);
    });

    it('its speech stack: will-change: contents, and each step a glide in whole screen pixels; a redraw in place keeps it', () => {
        const at = (x) => [{ heroId: 'hb', state: 'idle', x, y: 500, moving: true, tokenId: null, alert: null }];
        const view = render(h(DndContext, null, h(MatFitProvider, { value: 0.5 }, h(HeroBubbleLayer, { heroes: at(400) }))));
        act(() => { EventBus.publish('hero_leveled', { heroId: 'hb', skillName: 'Forestry', newLevel: 5 }); });
        const stack = () => view.container.querySelector('[data-hero-bubble-stack="hb"]');
        expect(stack().style.willChange).toBe('contents');
        expect(stack().style.transition).toBe('none');   // nowhere to come from yet
        view.rerender(h(DndContext, null, h(MatFitProvider, { value: 0.5 }, h(HeroBubbleLayer, { heroes: at(412) }))));
        expect(stack().style.transition).toBe(walkerGlide(12, 0, 0.5));
        expect(stack().style.transition).toBe('transform 100ms steps(6, start)');
        view.rerender(h(DndContext, null, h(MatFitProvider, { value: 0.5 }, h(HeroBubbleLayer, { heroes: at(412) }))));
        expect(stack().style.transition).toBe('transform 100ms steps(6, start)');
        view.rerender(h(DndContext, null, h(MatFitProvider, { value: 0.5 }, h(HeroBubbleLayer, { heroes: [{ ...at(412)[0], moving: false }] }))));
        expect(stack().style.transition).toBe('none');
        expect(stack().style.willChange).toBe('contents');
    });
});

describe('⭐ (c) the loot hop still lands its shadow under the item', () => {
    let calls;
    let restore;
    beforeEach(() => {
        setSpriteFxManifest({ sprites: { 'assets/items/item_look.png': { w: 32, h: 32, outlined: false } } });
        calls = [];
        const proto = window.Element.prototype;
        const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
        const original = proto.animate;
        proto.animate = function animate(keyframes, options) {
            const a = { el: this, keyframes, options, cancel: vi.fn() };
            calls.push(a);
            return a;
        };
        restore = () => { if (had) proto.animate = original; else delete proto.animate; };
    });
    afterEach(() => { restore(); setSpriteFxManifest(null); });

    it('on the drawn loot: the box hops, the ground shadow takes back each pose\'s height, and keeps its place', () => {
        const { container } = render(h('button', { 'data-item-sprite': 'true' }, h('div', null, h(PixelArt, { src: ITEM_SRC, size: 64, hovering: true }))));
        const box = container.querySelector('button');
        const shadow = container.querySelector('[data-sprite-shadow]');
        expect(shadow.style.translate).toBe('4px 4px');
        playLootArc(box, -120, 60, { unit: 2 });
        const hop = calls.find(a => a.el === box);
        const ground = calls.find(a => a.el === shadow);
        expect(hop).toBeTruthy();
        expect(ground).toBeTruthy();
        const poses = lootHopPoses(-120, 60, 2);
        // Mid-air the box is lifted and its shadow pushed back down by the same height: on the ground.
        const i = HOP_POSES / 2;
        expect(ground.keyframes[i].transform).toBe(`translate(0px, ${poses[i].lift * 2}px)`);
        expect(hop.keyframes[i].transform).toBe(`translate(${Math.round(poses[i].x) * 2}px, ${Math.round(poses[i].y) * 2}px)`);
        // The hop moves the shadow by `transform` only: its place under the item (`translate`) stands.
        expect(ground.keyframes.every(k => !('translate' in k))).toBe(true);
        expect(shadow.style.translate).toBe('4px 4px');
        // Landed: no lift, so the shadow is back exactly under the item.
        expect(ground.keyframes[ground.keyframes.length - 1].transform).toBe('translate(0px, 0px)');
        // The bob's box is not the hop's: nothing animates the art itself.
        expect(calls.some(a => a.el.classList?.contains('gi-sprite-hover'))).toBe(false);
    });
});
