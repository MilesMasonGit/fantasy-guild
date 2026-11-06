// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as World from '../systems/world/World.js';
import { resetMatTuning } from '../config/matTuning.js';
import { ArrivalCard } from '../ui/components/atlas/ArrivalCard.jsx';
import { SETTLE_TITLE, SETTLE_FANFARE } from '../ui/components/atlas/SettleTitle.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn(), recordKill: vi.fn(), recordEnemyKill: vi.fn() }
}));

/**
 * ⭐ The title on settling a place (brief 380 M5): after the gold banner, the place's name and its
 * land and line across the mat with a fanfare, for a moment; a click or any key skips it; under
 * reduced motion it neither opens nor closes. Travel to a place settled before keeps the plain
 * arrival card, with no title and no fanfare.
 */

const q = (c, sel) => c.querySelector(sel);
let sounds = [];
let offSound = null;

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    EngineBootstrap.createDefaultGameData();
    World.createWorld({ seed: 4242 });
}

function settleRingOne() {
    const cell = World.currentWorld().cells.find(c => c.ring === 1);
    GameState.state.progress.rosterLimit = 4;
    const hero = HeroManager.addHero(generateHero());
    for (const { skill, level } of cell.requires.skills) addXP(hero.id, skill, xpForLevel(level) - (hero.skills[skill]?.xp || 0));
    for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty);
    let result;
    act(() => { result = World.settleCell(cell.id); });
    expect(result.success, result.reason).toBe(true);
    return { cell, result };
}

const fanfares = () => sounds.filter(s => s.clip === SETTLE_FANFARE);
const reduceMotion = (on) => {
    window.matchMedia = vi.fn(() => ({ matches: on, addEventListener() {}, removeEventListener() {} }));
};

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

beforeEach(() => {
    vi.useFakeTimers();
    resetMatTuning();
    newGame();
    reduceMotion(false);
    sounds = [];
    offSound = EventBus.subscribe(ENGINE_EVENTS.AUDIO_PLAY, (p) => sounds.push({ clip: p.clip, ...p.options }));
});

afterEach(() => {
    offSound?.();
    cleanup();
    vi.useRealTimers();
    delete window.matchMedia;
});

afterAll(() => vi.restoreAllMocks());

describe('⭐ the title on settling a place', () => {
    it('⭐ after the gold banner: the place\'s name and its land and line, with the fanfare once, gone by itself', () => {
        const { container } = render(React.createElement(ArrivalCard));
        const { cell, result } = settleRingOne();
        // The banner's moment: neither the title nor the plain travel card yet.
        expect(q(container, '[data-arrival-card]')).toBeNull();
        expect(fanfares()).toEqual([]);
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.delayMs); });
        const title = q(container, `[data-settle-title="${result.region.id}"]`);
        expect(title).toBeTruthy();
        expect(q(title, '[data-arrival-name]').textContent).toBe(World.placeName(cell));
        expect(q(title, '[data-settle-terrain]').textContent).toBe(World.cellName(cell));
        expect(q(title, '[data-banner-art]').getAttribute('data-banner-art')).toBeTruthy();
        // ⚠️ No pitch variance: a fanfare must not draw from the game's random stream.
        expect(fanfares()).toEqual([{ clip: SETTLE_FANFARE, pitchVariance: 0 }]);
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.holdMs - SETTLE_TITLE.closeMs); });
        expect(q(container, '[data-settle-title]').getAttribute('data-settle-closing')).toBe('true');
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.closeMs); });
        expect(q(container, '[data-arrival-card]')).toBeNull();
        expect(fanfares()).toHaveLength(1);
    });

    it('⭐ a click skips it', () => {
        const { container } = render(React.createElement(ArrivalCard));
        settleRingOne();
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.delayMs); });
        fireEvent.pointerDown(q(container, '[data-settle-title]'));
        expect(q(container, '[data-arrival-card]')).toBeNull();
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.holdMs); });
        expect(q(container, '[data-arrival-card]')).toBeNull();
    });

    it('⭐ any key skips it once it shows; a key before then (finishing the glide back from the map) does not', () => {
        const { container } = render(React.createElement(ArrivalCard));
        settleRingOne();
        fireEvent.keyDown(window, { key: ' ' });
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.delayMs); });
        expect(q(container, '[data-settle-title]')).toBeTruthy();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(q(container, '[data-arrival-card]')).toBeNull();

        const home = Atlas.list().find(r => r.kind === Atlas.REGION_KIND.STARTER).id;
        act(() => { Atlas.travel(home); });
        act(() => { vi.advanceTimersByTime(5000); });
        const cell = World.currentWorld().cells.filter(c => c.ring === 1)[1];
        const hero = GameState.heroes[0];
        for (const { skill, level } of cell.requires.skills) addXP(hero.id, skill, Math.max(0, xpForLevel(level) - (hero.skills[skill]?.xp || 0)));
        for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty);
        act(() => { expect(World.settleCell(cell.id).success).toBe(true); });
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.delayMs + 10); });
        fireEvent.keyDown(window, { key: 'Enter' });
        expect(q(container, '[data-arrival-card]')).toBeNull();
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.holdMs); });
        expect(q(container, '[data-arrival-card]')).toBeNull();
        expect(fanfares()).toHaveLength(2);
    });

    it('⭐ travel to a place settled before: the plain arrival card, no title, no fanfare', () => {
        const { container } = render(React.createElement(ArrivalCard));
        const { result } = settleRingOne();
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.delayMs + SETTLE_TITLE.holdMs); });
        sounds = [];
        const home = Atlas.list().find(r => r.kind === Atlas.REGION_KIND.STARTER).id;
        act(() => { Atlas.travel(home); });
        act(() => { vi.advanceTimersByTime(5000); });
        act(() => { Atlas.travel(result.region.id); });
        expect(q(container, `[data-arrival-card="${result.region.id}"]`)).toBeTruthy();
        expect(q(container, '[data-settle-title]')).toBeNull();
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.delayMs); });
        expect(q(container, '[data-settle-title]')).toBeNull();
        expect(fanfares()).toEqual([]);
    });

    it('under reduced motion it stands still: open at once, and never closes by a wipe', () => {
        reduceMotion(true);
        const { container } = render(React.createElement(ArrivalCard));
        settleRingOne();
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.delayMs); });
        const band = q(container, '[data-settle-title]');
        expect(band.style.clipPath).toBe('inset(0% 0% 0% 0%)');
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.holdMs - SETTLE_TITLE.closeMs); });
        expect(q(container, '[data-settle-title]').style.clipPath).toBe('inset(0% 0% 0% 0%)');
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.closeMs); });
        expect(q(container, '[data-arrival-card]')).toBeNull();
    });

    it('with motion it opens from its middle line', () => {
        const { container } = render(React.createElement(ArrivalCard));
        settleRingOne();
        act(() => { vi.advanceTimersByTime(SETTLE_TITLE.delayMs); });
        expect(q(container, '[data-settle-title]').style.clipPath).toBe('inset(50% 0% 50% 0%)');
    });
});
