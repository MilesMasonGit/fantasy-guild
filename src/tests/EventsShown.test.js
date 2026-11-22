// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createElement } from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as EventTokens from '../systems/board/EventTokens.js';
import * as EventClock from '../systems/events/EventClock.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setEventsForTests, resetEventsForTests } from '../config/registries/eventRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as Banners from '../systems/notifications/banners.js';
import { wireNotifications, unwireNotifications } from '../systems/notifications/routing.js';
import { effectBreakdown, EFFECT_KEY, SOURCE_KIND } from '../systems/board/EffectBreakdown.js';
import { tokenCardModel, CARD_BLOCK } from '../ui/components/board/tokenCard.js';
import { timerCellOf } from '../ui/components/board/idlePlate.js';
import {
    watchEventArrivals, takeArrival, resetEventArrivals, nodeFallPoses, buffDriftPoses, NODE_FALL
} from '../ui/components/board/fx/eventArrival.js';
import { pulseSubjects, BANNER_PULSE_ATTR, PULSE_MS } from '../ui/components/notifications/bannerHighlight.js';
import { useShowOnMat } from '../ui/hooks/useShowOnMat.js';
import { BannerStack, slidesBetween } from '../ui/components/notifications/BannerStack.jsx';
import { MAT_TOP_BAR_PX } from '../ui/components/board/MatTopBar.jsx';
import { SETTLE } from '../ui/components/board/HallCamera.jsx';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Events as the player sees them (brief 640 E2): the arrival by kind, the banner that names the
 * event and points to its Token, the time left on the hover plate and the card, and the event's name
 * on the effect badges. None of it draws a random number.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const ORE = 'fixture_copper_ore';

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerTokenTypes({
    evs_comet: {
        id: 'evs_comet', name: 'EVS Comet Token', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 3, sprite: 't_ore_vein_copper',
        requiresHero: true, staysPut: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [{ itemId: ORE, quantity: 6, chance: 100 }] }
    },
    evs_mythril: {
        id: 'evs_mythril', name: 'EVS Mythril Token', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 100, sprite: 't_ore_vein_copper',
        requiresHero: true, staysPut: true,
        config: { skill: 'mining', skillRequired: 60, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [{ itemId: ORE, quantity: 6, chance: 100 }] }
    },
    evs_rain: {
        id: 'evs_rain', name: 'EVS Rain Token', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_minecart_copper',
        statements: [{
            id: 'stm_evs_rain', keyword: 'provides', to: { mode: 'id', value: 'evs_vein' }, reach: 'nearby',
            payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.2 }
        }]
    },
    evs_vein: {
        id: 'evs_vein', name: 'EVS Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 1000, sprite: 't_ore_vein_copper',
        requiresHero: true, staysPut: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [{ itemId: ORE, quantity: 1, chance: 100 }] }
    }
});

const COMET = { id: 'evs_e_comet', name: 'Copper Comet', typeId: 'evs_comet', kind: 'node', weight: 10 };
const MYTHRIL = { id: 'evs_e_mythril', name: 'Mythril Comet', typeId: 'evs_mythril', kind: 'node', weight: 10 };
const RAIN = { id: 'evs_e_rain', name: 'Rainfall', typeId: 'evs_rain', kind: 'buff', weight: 10, durationMinutes: 20 };
const table = (...rows) => Object.fromEntries(rows.map(r => [r.id, r]));

const VEIN = { x: 700, y: 500 };

function freshGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.rebuildAll();
}

function runFor(ms, step = 1000) {
    for (let t = 0; t < ms; t += step) GameLoop.runHandlers(step);
}

function landBeside(event, at = { x: VEIN.x + 150, y: VEIN.y }) {
    const { instance } = EventClock.landNow(event.id);
    BoardState.setTokenPoint(instance.id, at.x, at.y);
    TileModifiers.rebuildAll();
    return instance;
}

const eventBanners = () => Banners.getAll().filter(b => b.kind === 'event');

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

beforeEach(() => {
    EventClock.setEnabled(true);
    wireNotifications();
    Banners.reset();
});

afterEach(() => {
    cleanup();
    EventClock.setEnabled(false);
    resetEventsForTests();
    resetEventArrivals();
    Banners.reset();
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    unwireNotifications();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the banner', () => {
    it('names a landed node and points to its Token', () => {
        setEventsForTests(table(COMET));
        freshGame();
        const { instance } = EventClock.landNow(COMET.id);
        const [banner] = eventBanners();
        expect(banner).toMatchObject({ title: 'Special Event! Copper Comet!', tone: 'milestone', subjects: [{ type: 'token', id: instance.id }] });
        expect(banner.line).toBe('leaves in 1 h if unworked');
        expect(banner.sprite).toEqual({ kind: 'token', id: 'evs_comet' });
    });

    it('a buff\'s banner says its minutes in the second line, and goes when the buff leaves', () => {
        setEventsForTests(table(RAIN));
        freshGame();
        EventClock.landNow(RAIN.id);
        expect(eventBanners()).toHaveLength(1);
        expect(eventBanners()[0].title).toBe('Special Event! Rainfall!');
        expect(eventBanners()[0].line).toBe('for 20 min');
        const view = render(createElement(BannerStack));
        expect(view.container.querySelector('[data-banner-title]').textContent).toBe('Special Event! Rainfall!');
        expect(view.container.querySelector('[data-banner-line]').textContent).toBe('for 20 min');
        view.unmount();
        runFor(20 * MIN);
        expect(eventBanners()).toEqual([]);
    });

    it('a worked-out node takes its banner with it', () => {
        setEventsForTests(table(COMET));
        freshGame();
        fixtures.makeHeroes(1, { mining: 10 });
        const { instance } = EventClock.landNow(COMET.id);
        BoardState.removeToken(instance.id);
        EventBus.publish(BOARD_EVENTS.EVENT_ENDED, EventTokens.endedPayload(instance, EventTokens.ENDED.WORKED_OUT));
        expect(eventBanners()).toEqual([]);
    });

    it('withdraw takes back a waiting banner as well as one on screen', () => {
        for (let i = 0; i < Banners.MAX_SHOWN; i++) Banners.push({ kind: 'hero', parts: { heroes: [`H${i}`] }, groupKey: `h${i}` });
        Banners.push({ kind: 'event', parts: { name: 'Rainfall', kind: 'buff', minutes: 20 }, groupKey: 'event:x' });
        expect(Banners.getView().waiting).toBe(1);
        Banners.withdraw('event:x');
        expect(Banners.getView().waiting).toBe(0);
        expect(eventBanners()).toEqual([]);
    });
});

describe('the banner on screen', () => {
    it('over the World Map or the Hall only the banners that point to a Token show', () => {
        Banners.push({ kind: 'hero', parts: { heroes: ['Aela'] } });
        Banners.push({ kind: 'event', parts: { name: 'Rainfall', kind: 'buff', minutes: 20 }, groupKey: 'event:x' });
        const mat = render(createElement(BannerStack));
        expect([...mat.container.querySelectorAll('[data-banner]')].map(b => b.dataset.banner)).toEqual(['event', 'hero']);
        mat.unmount();
        const away = render(createElement(BannerStack, { away: true }));
        expect([...away.container.querySelectorAll('[data-banner]')].map(b => b.dataset.banner)).toEqual(['event']);
        expect(away.container.querySelector('[data-banners]').dataset.banners).toBe('away');
    });

    it('the view changing keeps the same event banner on screen (no drop again) and only hides the others', () => {
        Banners.push({ kind: 'hero', parts: { heroes: ['Aela'] } });
        Banners.push({ kind: 'event', parts: { name: 'Rainfall' }, groupKey: 'event:x' });
        const view = render(createElement(BannerStack, { away: false }));
        const before = view.container.querySelector('[data-banner="event"]');
        view.rerender(createElement(BannerStack, { away: true }));
        expect(view.container.querySelector('[data-banner="event"]')).toBe(before);
        expect(view.container.querySelector('[data-banner="hero"]')).toBeNull();
        view.rerender(createElement(BannerStack, { away: false }));
        expect(view.container.querySelector('[data-banner="event"]')).toBe(before);
        expect(view.container.querySelector('[data-banner="hero"]')).not.toBeNull();
    });

    it('sits just under where the mat\'s top bar is, whatever the view', () => {
        Banners.push({ kind: 'event', parts: { name: 'Rainfall' }, groupKey: 'event:x' });
        for (const away of [false, true]) {
            const view = render(createElement(BannerStack, { away }));
            expect(view.container.firstChild.style.top).toBe(`${MAT_TOP_BAR_PX}px`);
            view.unmount();
        }
    });

    it('a banner that stays slides from its old place to its new one; a new one has no old place', () => {
        const before = new Map([['b1', 0], ['b2', 90]]);
        const after = new Map([['b3', 0], ['b1', 90], ['b2', 180]]);
        expect(slidesBetween(before, after)).toEqual([{ id: 'b1', dy: -90 }, { id: 'b2', dy: -90 }]);
        expect(slidesBetween(after, new Map([['b1', 0], ['b2', 90]]))).toEqual([{ id: 'b1', dy: 90 }, { id: 'b2', dy: 90 }]);
        expect(slidesBetween(before, before)).toEqual([]);
    });

    it('a new banner on top pushes the one below down by a slide that waits for frames to flow, and never holds it for good', () => {
        vi.useFakeTimers();
        const top = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
        const slides = [];
        Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
            configurable: true,
            get() { return this.hasAttribute('data-banner-slot') ? [...this.parentElement.children].indexOf(this) * 90 : 0; }
        });
        HTMLElement.prototype.animate = function animate(keyframes, timing) {
            const anim = { el: this, keyframes, timing, state: 'running', pause() { this.state = 'paused'; }, play() { this.state = 'running'; }, cancel() { this.state = 'cancelled'; } };
            slides.push(anim);
            return anim;
        };
        try {
            Banners.push({ kind: 'event', parts: { name: 'Rainfall' }, groupKey: 'event:x' });
            const view = render(createElement(BannerStack));
            expect(slides).toEqual([]);
            act(() => { Banners.push({ kind: 'hero', parts: { heroes: ['Aela'] } }); });
            expect(slides).toHaveLength(1);
            expect(slides[0].el.dataset.banner).toBe('event');
            expect(slides[0].keyframes[0].transform).toBe('translateY(-90px)');
            expect(slides[0].timing.composite).toBe('add');
            // Held where it was until frames flow (here no frame comes: the timer starts it).
            expect(slides[0].state).toBe('paused');
            vi.advanceTimersByTime(SETTLE.maxMs);
            expect(slides[0].state).toBe('running');
            view.unmount();
        } finally {
            delete HTMLElement.prototype.animate;
            if (top) Object.defineProperty(HTMLElement.prototype, 'offsetTop', top);
            vi.useRealTimers();
        }
    });

    it('a click on an event\'s banner asks for its Token on the mat; another banner\'s click does not', () => {
        setEventsForTests(table(RAIN));
        freshGame();
        const { instance } = EventClock.landNow(RAIN.id);
        Banners.push({ kind: 'hero', parts: { heroes: ['Aela'] } });
        const asked = [];
        const off = EventBus.subscribe(UI_EVENTS.SHOW_ON_MAT, (p) => asked.push(p));
        const view = render(createElement(BannerStack));
        fireEvent.click(view.container.querySelector('[data-banner="hero"]'));
        expect(asked).toEqual([]);
        fireEvent.click(view.container.querySelector('[data-banner="event"]'));
        expect(asked).toEqual([{ subjects: [{ type: 'token', id: instance.id }] }]);
        off();
    });

    it('clicked over the World Map, the banner is gone even though its stack goes with the view at once', () => {
        Banners.push({ kind: 'event', parts: { name: 'Rainfall', kind: 'buff', minutes: 20 }, groupKey: 'event:x' });
        const away = render(createElement(BannerStack, { away: true }));
        fireEvent.click(away.container.querySelector('[data-banner="event"]'));
        away.unmount();
        expect(eventBanners()).toEqual([]);
    });

    it('hovering an event\'s banner outlines its Token in gold', () => {
        setEventsForTests(table(RAIN));
        freshGame();
        const { instance } = EventClock.landNow(RAIN.id);
        const art = document.createElement('div');
        art.setAttribute('data-token-art', 'true');
        art.setAttribute('data-token-id', instance.id);
        document.body.appendChild(art);
        const view = render(createElement(BannerStack));
        fireEvent.mouseEnter(view.container.querySelector('[data-banner="event"]'));
        expect(art.getAttribute('data-banner-outline')).toBe('gold');
        fireEvent.mouseLeave(view.container.querySelector('[data-banner="event"]'));
        expect(art.hasAttribute('data-banner-outline')).toBe(false);
        art.remove();
    });
});

describe('the pulse', () => {
    it('outlines the Token after the delay, for a short while, then clears', () => {
        vi.useFakeTimers();
        try {
            const art = document.createElement('div');
            art.setAttribute('data-token-art', 'true');
            art.setAttribute('data-token-id', 'tok_1');
            document.body.appendChild(art);
            pulseSubjects([{ type: 'token', id: 'tok_1' }], { delayMs: 500 });
            expect(art.hasAttribute(BANNER_PULSE_ATTR)).toBe(false);
            vi.advanceTimersByTime(500);
            expect(art.getAttribute(BANNER_PULSE_ATTR)).toBe('gold');
            vi.advanceTimersByTime(PULSE_MS);
            expect(art.hasAttribute(BANNER_PULSE_ATTR)).toBe(false);
            art.remove();
        } finally {
            vi.useRealTimers();
        }
    });

    it('asked with the Encyclopedia open, the book closes and the Token pulses at once', () => {
        const art = document.createElement('div');
        art.setAttribute('data-token-art', 'true');
        art.setAttribute('data-token-id', 'tok_1');
        document.body.appendChild(art);
        const backToMat = vi.fn();
        const Probe = () => { useShowOnMat({ awayOpen: false, bookOpen: true, backToMat }); return null; };
        render(createElement(Probe));
        EventBus.publish(UI_EVENTS.SHOW_ON_MAT, { subjects: [{ type: 'token', id: 'tok_1' }] });
        expect(backToMat).toHaveBeenCalledTimes(1);
        expect(art.getAttribute(BANNER_PULSE_ATTR)).toBe('gold');
        art.remove();
    });

    it('asked on the mat, nothing closes and the Token pulses at once', () => {
        const art = document.createElement('div');
        art.setAttribute('data-token-art', 'true');
        art.setAttribute('data-token-id', 'tok_1');
        document.body.appendChild(art);
        const backToMat = vi.fn();
        const Probe = () => { useShowOnMat({ awayOpen: false, bookOpen: false, backToMat }); return null; };
        render(createElement(Probe));
        EventBus.publish(UI_EVENTS.SHOW_ON_MAT, { subjects: [{ type: 'token', id: 'tok_1' }] });
        expect(backToMat).not.toHaveBeenCalled();
        expect(art.getAttribute(BANNER_PULSE_ATTR)).toBe('gold');
        art.remove();
    });
});

describe('time left', () => {
    it('the hover plate counts a buff down like a refreshing node, with its own tip', () => {
        expect(timerCellOf({ kind: 'leave', inMs: 125_000, buff: true })).toMatchObject({ kind: 'timer', glyph: 'clock', text: '2:05' });
        expect(timerCellOf({ kind: 'leave', inMs: 125_000, buff: true }).tip).toMatch(/^Leaves in 2\u00a0min\u00a05\u00a0s$/);
        expect(timerCellOf({ kind: 'leave', inMs: 60_000, buff: false }).tip).toMatch(/^An event: leaves in/);
    });

    it('the card says "Leaves in m:ss" for a buff, ticking down', () => {
        setEventsForTests(table(RAIN));
        freshGame();
        const { instance } = EventClock.landNow(RAIN.id);
        const line = () => tokenCardModel('evs_rain', instance.id).blocks.find(b => b.id === CARD_BLOCK.LIFECYCLE)?.lines?.[0];
        expect(line()).toMatchObject({ icon: 'clock', label: 'Leaves in', text: '20:00' });
        runFor(5 * MIN + 30_000);
        expect(line().text).toBe('14:30');
    });

    it('a rich node shows its charges and its leaving time, worked or not', () => {
        setEventsForTests(table(COMET, MYTHRIL));
        freshGame();
        fixtures.makeHeroes(1, { mining: 10 });
        const comet = EventClock.landNow(COMET.id).instance;
        const cometCard = tokenCardModel('evs_comet', comet.id);
        expect(cometCard.blocks.find(b => b.id === CARD_BLOCK.CYCLE).uses).toBe(3);
        expect(cometCard.blocks.find(b => b.id === CARD_BLOCK.LIFECYCLE).lines[0]).toMatchObject({ label: 'Leaves in', text: '60:00' });

        BoardState.removeToken(comet.id);
        const mythril = EventClock.landNow(MYTHRIL.id).instance;
        const card = tokenCardModel('evs_mythril', mythril.id);
        expect(card.blocks.find(b => b.id === CARD_BLOCK.CYCLE).uses).toBe(100);
        expect(card.blocks.find(b => b.id === CARD_BLOCK.LIFECYCLE).lines[0]).toMatchObject({ label: 'Leaves in', text: '60:00' });
        expect(EventTokens.leavesInMs(mythril)).toBe(HOUR);
    });
});

describe('the badges', () => {
    it('name an event buff by its event, as one more source', () => {
        setEventsForTests(table(RAIN));
        freshGame();
        const vein = fixtures.placeAt('evs_vein', VEIN.x, VEIN.y);
        TileModifiers.rebuildAll();
        const rain = landBeside(RAIN);
        const speed = effectBreakdown(vein.id).effects.find(e => e.key === EFFECT_KEY.SPEED);
        expect(speed.sources).toEqual([expect.objectContaining({ name: 'Rainfall nearby', kind: SOURCE_KIND.EVENT, tokenId: rain.id, eventId: RAIN.id })]);
    });
});

describe('the arrival', () => {
    it('is remembered by kind for the Token to play as it is drawn, once', () => {
        setEventsForTests(table(COMET, RAIN));
        freshGame();
        const off = watchEventArrivals();
        const comet = EventClock.landNow(COMET.id).instance;
        BoardState.removeToken(comet.id);
        const rain = EventClock.landNow(RAIN.id).instance;
        off();
        expect(takeArrival(comet.id)).toBe('node');
        expect(takeArrival(comet.id)).toBeNull();
        expect(takeArrival(rain.id)).toBe('buff');
    });

    it('a node falls from up and across to its spot and lands; a buff drifts in from unseen', () => {
        const fall = nodeFallPoses();
        expect(fall[0]).toMatchObject({ x: NODE_FALL.x, y: NODE_FALL.y });
        expect(fall.at(-1)).toMatchObject({ x: 0, y: 0 });
        expect(fall.every(p => Number.isInteger(p.x) && Number.isInteger(p.y))).toBe(true);
        const drift = buffDriftPoses();
        expect(drift[0]).toMatchObject({ x: -16, opacity: 0 });
        expect(drift.map(p => p.opacity)).toEqual([0, 0.25, 0.5, 0.75]);
        expect(drift.map(p => p.x)).toEqual([-16, -12, -8, -4]);
    });

    it('the banner and the arrival draw no random numbers', () => {
        setEventsForTests(table(RAIN));
        freshGame();
        const { instance } = EventClock.landNow(RAIN.id);
        Banners.reset();
        const off = watchEventArrivals();
        const spy = vi.spyOn(Math, 'random');
        try {
            act(() => {
                EventBus.publish(BOARD_EVENTS.EVENT_LANDED, {
                    instanceId: instance.id, typeId: 'evs_rain', eventId: RAIN.id, kind: 'buff', name: 'Rainfall', x: instance.x, y: instance.y
                });
            });
            expect(eventBanners()).toHaveLength(1);
            expect(takeArrival(instance.id)).toBe('buff');
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
            off();
        }
    });
});
