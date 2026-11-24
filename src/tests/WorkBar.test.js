// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { WorkBarLayer } from '../ui/components/board/WorkBarLayer.jsx';
import { MAT_Z } from '../ui/components/board/matLayers.js';
import { BAR, barPlace, barStripH, cycleText, nameFootOf, plateUnit, workBarOf } from '../ui/components/board/matMarks.js';
import { createWorkBar, shareWorkBar } from '../ui/components/board/workBar.js';
import { setDrawn, resetDrawSwitches } from '../ui/dev/perf/drawSwitches.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **No plates on the mat** (brief 830 D3, concept_playmat_declutter §15): a worked Token shows a
 * green progress bar filling with each cycle and, beside it, the time one cycle takes ("12.0s"),
 * fixed while nothing changes; grey while blocked. No charges, no skill, no timers, no tooltip.
 */

const h = React.createElement;
const AT = { x: 600, y: 500 };

function hero(id, skills = { forestry: 50, alchemy: 50 }) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id === 'h1' ? 'Aela' : id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(typeId, point = AT, uses = undefined) {
    const instance = BoardState.createTokenInstance(typeId, uses === undefined ? tokenStartingUses(typeId) : uses);
    expect(Placement.placeTokenAt(instance, point).success).toBe(true);
    return instance;
}

const run = (ms) => act(() => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const mount = (props = {}) => render(h(DndContext, null, h(MatBoard, props)));
const stripOf = (c, id) => c.querySelector(`[data-work-strip="${id}"]`);

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [hero('h1')];
    GameState.state.inventory.maxSlots = 50;
});
afterEach(() => { cleanup(); resetDrawSwitches(); vi.useRealTimers(); });

describe('the rules, pure', () => {
    it('the cycle time reads to a tenth of a second, and nothing with no cycle known', () => {
        expect(cycleText(3000)).toBe('3.0s');
        expect(cycleText(4200)).toBe('4.2s');
        expect(cycleText(12000)).toBe('12.0s');
        expect(cycleText(null)).toBeNull();
        expect(cycleText(0)).toBeNull();
    });

    it('a plate pixel is a whole screen pixel: half the art steps, never below one', () => {
        expect(plateUnit(1) * 1).toBe(1);
        expect(plateUnit(0.9) * 0.9).toBeCloseTo(1);
        expect(plateUnit(0.4) * 0.4).toBeCloseTo(1);
        expect(plateUnit(2) * 2).toBe(2);
    });

    it('the bar is 24 art pixels by 4, in a one-pixel outline', () => {
        expect(BAR).toMatchObject({ W: 24, H: 4, OUTLINE: 1 });
    });

    it('stands on the seam on the hero’s side just under the name’s foot; at the mat’s foot it goes over the heads', () => {
        const right = barPlace({ x: 600, y: 500, typeId: 'fixture_producer', side: 1, fit: 1, width: 200 });
        const left = barPlace({ x: 600, y: 500, typeId: 'fixture_producer', side: -1, fit: 1, width: 200 });
        expect(right.left + right.width / 2).toBe(600 + (64 + 32) / 2);
        expect(left.left + left.width / 2).toBe(600 - (64 + 32) / 2);
        expect(right.top).toBe(500 + nameFootOf('fixture_producer', 1) + BAR.DROP * 2);
        const low = barPlace({ x: 600, y: 990, typeId: 'fixture_producer', side: 1, fit: 1, matH: 1040 });
        expect(low.top + barStripH(1)).toBeLessThanOrEqual(990 - 64);
    });

    it('a worked Token’s bar is blocked by any engine alert on it', () => {
        const t = put('fixture_producer', AT, 12);
        expect(workBarOf(t.id)).toBeNull();
        Orders.orderAt('h1', AT);
        run(200);
        expect(workBarOf(t.id)).toMatchObject({ heroId: 'h1', blocked: false });
        t.alert = ALERT.NO_ROOM;
        expect(workBarOf(t.id)).toMatchObject({ blocked: true });
        // Nothing of the old plate: no charges, no skill.
        expect(workBarOf(t.id)).not.toHaveProperty('charges');
        expect(workBarOf(t.id)).not.toHaveProperty('skill');
    });

    it('the model says the cycle’s length when the engine says a new one, never on a tick that only moves it', () => {
        const bar = createWorkBar(() => 0);
        const heard = [];
        bar.watchLength(ms => heard.push(ms));
        bar.progress({ elapsedMs: 100, cycleTimeMs: 3000 }, false);
        bar.progress({ elapsedMs: 900, cycleTimeMs: 3000 }, false);
        bar.progress({ elapsedMs: 100, cycleTimeMs: 2500 }, false);   // a speed boost
        bar.progress({ percent: 50 }, false);                           // a reset keeps the length
        expect(heard).toEqual([null, 3000, 2500]);
    });
});

describe('⭐ on the mat', () => {
    it('a bar shows only while a hero works the Token, in its own layer over the loot, taking no pointer', async () => {
        const t = put('fixture_producer', AT, 12);
        const { container } = mount();
        expect(container.querySelector('[data-work-strip]')).toBeNull();

        Orders.orderAt('h1', AT);
        run(200);
        await flush();
        expect(BoardState.workerOf(t.id)).toBe('h1');
        expect(stripOf(container, t.id)).not.toBeNull();
        const layer = container.querySelector('[data-work-bars]');
        expect(Number(layer.style.zIndex)).toBe(MAT_Z.WORK_BAR);
        expect(MAT_Z.WORK_BAR).toBeGreaterThan(MAT_Z.LOOT);
        expect(layer.className).toContain('pointer-events-none');
        expect(container.querySelector('[data-work-bar-slot]').className).toContain('pointer-events-none');

        await act(async () => { Flags.furl('h1', 'recall'); });
        await flush();
        expect(stripOf(container, t.id)).toBeNull();
    });

    it('⭐ the bar and the cycle time on the see-through strip; no plate, no charges, no cells', async () => {
        const t = put('fixture_producer', AT, 12);
        Orders.orderAt('h1', AT);
        run(200);
        const { container } = mount();
        // The time comes with the engine's next progress report (every few ticks).
        run(1000);
        await flush();
        const strip = stripOf(container, t.id);
        expect(strip.style.background).toBe('var(--color-mat-backing)');
        const track = strip.querySelector(`[data-work-bar="${t.id}"]`);
        expect(track.className).toContain('gi-work-bar');
        expect(track.style.width).toBe(`${BAR.W * 2}px`);
        expect(track.style.height).toBe(`${BAR.H * 2}px`);
        expect(strip.querySelector(`[data-work-cycle="${t.id}"]`).textContent).toBe('12.0s');
        expect(container.querySelector('[data-work-plate]')).toBeNull();
        expect(container.querySelector('[data-plate-cell]')).toBeNull();
        expect(strip.textContent).toBe('12.0s');
    });

    it('blocked: the bar is held grey', async () => {
        const t = put('fixture_producer', AT, 12);
        Orders.orderAt('h1', AT);
        run(200);
        const { container } = mount();
        await flush();
        const track = () => stripOf(container, t.id).querySelector('[data-work-bar]');
        expect(track().getAttribute('data-work-bar-blocked')).toBeNull();
        await act(async () => {
            t.alert = ALERT.NO_ROOM;
            EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { instanceId: t.id, alert: t.alert });
        });
        await flush();
        expect(track().getAttribute('data-work-bar-blocked')).toBe('true');
    });

    it('its draw switch stops drawing it, and nothing else', async () => {
        const t = put('fixture_producer', AT, 12);
        Orders.orderAt('h1', AT);
        run(200);
        setDrawn('workPlate', false);
        const { container } = mount();
        await flush();
        expect(container.querySelector('[data-work-bars]')).toBeNull();
        expect(BoardState.workerOf(t.id)).toBe('h1');
    });
});

describe('the layer on its own', () => {
    it('the cycle time follows the Token’s own bar model: a new length redraws it', async () => {
        const t = put('fixture_producer', AT, 12);
        Orders.orderAt('h1', AT);
        run(200);
        const bar = createWorkBar(() => 0);
        const stop = shareWorkBar(t.id, bar);
        const { container } = render(h(WorkBarLayer, { bars: [{ tokenId: t.id, heroId: 'h1', typeId: t.typeId, x: t.x, y: t.y }] }));
        await flush();
        expect(container.querySelector('[data-work-cycle]')).toBeNull();
        await act(async () => { bar.progress({ elapsedMs: 0, cycleTimeMs: 4200 }, false); });
        expect(container.querySelector('[data-work-cycle]').textContent).toBe('4.2s');
        await act(async () => { bar.progress({ elapsedMs: 0, cycleTimeMs: 3000 }, false); });
        expect(container.querySelector('[data-work-cycle]').textContent).toBe('3.0s');
        stop();
    });
});
