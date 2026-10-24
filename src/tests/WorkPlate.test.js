// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as Charges from '../systems/board/Charges.js';
import * as Demolition from '../systems/board/Demolition.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { WorkPlateLayer } from '../ui/components/board/WorkPlateLayer.jsx';
import { CHARGE_FLOATERS } from '../ui/components/board/TokenBadges.jsx';
import { MAT_Z } from '../ui/components/board/matLayers.js';
import { PLATE, CELL, plateCells, plateUnit, platePlace, clockText, workPlateOf } from '../ui/components/board/workPlate.js';
import { setDrawn, resetDrawSwitches } from '../ui/dev/perf/drawSwitches.js';
import { restHover } from './fixtures/hoverRest.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **The work plate** (T-239, mock-up C): while a hero works a Token, one plate on the seam
 * between them, below their feet, says what is being made (its cycle along the foot), the charges
 * left, or exactly what the Token waits for. It replaces that Token's work bar, "!" and charges
 * ring; a Token nobody works keeps its own. The "-1" floaters are off: the plate counts down.
 */

const h = React.createElement;
const P = (x, y) => ({ x, y });
const AT = P(600, 500);

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
const plateOf = (c, id) => c.querySelector(`[data-work-plate="${id}"]`);
const cellsOf = (c, id) => [...plateOf(c, id).querySelectorAll('[data-plate-cell]')].map(el => el.getAttribute('data-plate-cell'));
const overlay = (c, id) => c.querySelector(`[data-token-overlay="${id}"]`);
/** The pointer resting on a Token's centre (fake timers). */
const hoverAt = (container, tok) => {
    const root = container.querySelector('[data-mat-board]');
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });
    fireEvent.pointerMove(root, { clientX: tok.x, clientY: tok.y });
    restHover();
};

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 400);
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
    const plate = (extra) => ({ output: 'fixture_oak_wood', skill: 'forestry', charges: null, problem: null, severity: null, missing: [], ...extra });
    const kinds = (p, open) => plateCells(p, { open }).map(c => c.kind);

    it('at rest: what it makes, then its charges; open: the skill, the output, the charges and the time to the next one', () => {
        expect(kinds(plate(), false)).toEqual([CELL.OUTPUT]);
        expect(kinds(plate({ charges: 248 }), false)).toEqual([CELL.OUTPUT, CELL.CHARGES]);
        expect(kinds(plate({ charges: 248 }), true)).toEqual([CELL.SKILL, CELL.OUTPUT, CELL.CHARGES, CELL.TIMER]);
    });

    it('waiting: exactly what it waits for instead of the charges, and no time to the next one', () => {
        const waiting = plate({
            charges: 12, problem: ALERT.INPUTS, severity: 'waiting',
            missing: [{ itemId: 'a', have: 0, need: 6 }, { itemId: 'b', have: 1, need: 2 }, { itemId: 'c', have: 0, need: 1 }]
        });
        expect(kinds(waiting, false)).toEqual([CELL.OUTPUT, CELL.MISSING, CELL.MISSING]);
        expect(plateCells(waiting)[1]).toMatchObject({ itemId: 'a', have: 0, need: 6 });
        expect(kinds(waiting, true)).toEqual([CELL.SKILL, CELL.OUTPUT, CELL.MISSING, CELL.MISSING, CELL.CHARGES]);
        expect(kinds(plate({ problem: ALERT.NO_ROOM, severity: 'cant' }), false)).toEqual([CELL.OUTPUT, CELL.PROBLEM]);
    });

    it('making no item, the skill stands in for the output', () => {
        expect(kinds(plate({ output: null }), false)).toEqual([CELL.SKILL]);
        expect(kinds(plate({ output: null }), true)).toEqual([CELL.SKILL, CELL.TIMER]);
    });

    it('times read 0:34 and 4:05, rounded up', () => {
        expect(clockText(13000)).toBe('0:13');
        expect(clockText(12001)).toBe('0:13');
        expect(clockText(245000)).toBe('4:05');
    });

    it('a plate pixel is a whole screen pixel: half the art steps, never below one', () => {
        expect(plateUnit(1) * 1).toBe(1);          // art at 2×: one screen pixel
        expect(plateUnit(0.9) * 0.9).toBeCloseTo(1);
        expect(plateUnit(0.4) * 0.4).toBeCloseTo(1); // art at 1×: kept at its 2× size, not halved
        expect(plateUnit(2) * 2).toBe(2);          // art at 4×: two screen pixels
    });

    it('stands on the seam on the hero’s side, tucked under the feet; at the mat’s foot it goes over the heads', () => {
        const right = platePlace({ x: 600, y: 500, typeId: 'fixture_producer', side: 1, fit: 1 });
        const left = platePlace({ x: 600, y: 500, typeId: 'fixture_producer', side: -1, fit: 1 });
        expect(right.left + right.width / 2).toBe(600 + (64 + 32) / 2);
        expect(left.left + left.width / 2).toBe(600 - (64 + 32) / 2);
        expect(right.top).toBe(500 + 64 - PLATE.TUCK);
        const low = platePlace({ x: 600, y: 990, typeId: 'fixture_producer', side: 1, fit: 1, matH: 1040 });
        expect(low.top + (PLATE.H + PLATE.SHADOW)).toBeLessThanOrEqual(990 - 64);
    });
});

describe('⭐ on the mat', () => {
    it('a plate shows only while a hero works the Token, in its own layer over the loot', async () => {
        const t = put('fixture_producer', AT, 12);
        const { container } = mount();
        expect(container.querySelector('[data-work-plate]')).toBeNull();

        Flags.plant('h1', P(700, 500));
        run(200);
        await flush();
        expect(BoardState.workerOf(t.id)).toBe('h1');
        expect(plateOf(container, t.id)).not.toBeNull();
        expect(Number(container.querySelector('[data-work-plates]').style.zIndex)).toBe(MAT_Z.WORK_PLATE);
        expect(MAT_Z.WORK_PLATE).toBeGreaterThan(MAT_Z.LOOT);

        await act(async () => { Flags.furl('h1', 'recall'); });
        await flush();
        expect(plateOf(container, t.id)).toBeNull();
    });

    it('it replaces the worked Token’s own work bar, "!" and charges ring', async () => {
        vi.useFakeTimers();
        const t = put('fixture_producer', AT, 12);
        Flags.plant('h1', P(700, 500));
        run(200);
        const { container } = mount();
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        const o = overlay(container, t.id);
        expect(o.querySelector('[data-work-bar]')).toBeNull();
        expect(plateOf(container, t.id).querySelector('[data-work-bar]')).not.toBeNull();
        hoverAt(container, t);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(o.querySelector('[data-token-name]')).not.toBeNull();
        expect(o.querySelector('[data-bubble="charges"]')).toBeNull();
        expect(plateOf(container, t.id).getAttribute('data-work-plate-open')).toBe('true');
        await act(async () => {
            t.alert = ALERT.NO_ROOM;
            EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { instanceId: t.id, alert: t.alert });
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(o.querySelector('[data-problem-mark]')).toBeNull();
        expect(plateOf(container, t.id).getAttribute('data-work-plate-tone')).toBe('cant');
        // Open (the pointer rests on it): the problem in place of the time to the next one.
        expect(cellsOf(container, t.id)).toEqual([CELL.SKILL, CELL.OUTPUT, CELL.PROBLEM, CELL.CHARGES]);
    });

    it('waiting on an input: the missing item with its have/need in red, the frame gold, the cycle held grey', async () => {
        const t = put('fixture_consumer', AT);
        InventoryManager.addItem('fixture_oak_wood', 2);
        Flags.plant('h1', P(700, 500));
        run(20000);
        expect(t.alert).toBe(ALERT.INPUTS);
        expect(BoardState.workerOf(t.id)).toBe('h1');
        const { container } = mount();
        await flush();
        const plate = plateOf(container, t.id);
        expect(plate.getAttribute('data-work-plate-tone')).toBe('waiting');
        expect(cellsOf(container, t.id)).toEqual([CELL.OUTPUT, CELL.MISSING]);
        const missing = plate.querySelector('[data-plate-cell="missing"] span');
        expect(missing.textContent).toBe('0/2');
        expect(missing.style.color).toBe('var(--color-ui-red)');
        expect(plate.querySelector('[data-work-bar]').getAttribute('data-work-bar-blocked')).toBe('true');
        expect(overlay(container, t.id).querySelector('[data-problem-mark]')).toBeNull();

        // Its hover says how many, read when the pointer arrives.
        fireEvent.pointerEnter(plate.querySelector('[data-plate-cell="missing"]'));
        expect(document.body.querySelector('[data-bubble-tip]').textContent).toContain('Needs 2');

        // The Bank's own count is drawn as it changes.
        await act(async () => { InventoryManager.addItem('fixture_oak_wood', 1); });
        await flush();
        expect(plateOf(container, t.id).querySelector('[data-plate-cell="missing"] span').textContent).toBe('1/2');
    });

    it('the charges tick down in the plate, and nothing floats', async () => {
        const t = put('fixture_producer', AT, 12);
        Flags.plant('h1', P(700, 500));
        run(200);
        const { container } = mount();
        await flush();
        const count = () => plateOf(container, t.id).querySelector('[data-plate-cell="charges"] span').textContent;
        expect(count()).toBe('12');
        await act(async () => { Charges.applyDelta(t, -1); });
        await flush();
        expect(count()).toBe('11');
        expect(CHARGE_FLOATERS).toBe(false);
        expect(container.querySelector('[data-charge-floater]')).toBeNull();
    });

    it('a Token nobody works keeps its own "!", and gets no plate', async () => {
        const t = put('fixture_producer', AT, 12);
        const { container } = mount();
        await act(async () => {
            t.alert = ALERT.NO_ROOM;
            EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { instanceId: t.id, alert: t.alert });
        });
        await flush();
        expect(overlay(container, t.id).querySelector('[data-problem-mark]').getAttribute('data-problem-severity')).toBe('cant');
        expect(plateOf(container, t.id)).toBeNull();
    });

    it('resting the pointer on the hero opens the full line, the time to the next one included; the names drop below it', async () => {
        vi.useFakeTimers();
        const t = put('fixture_producer', AT, 12);
        Flags.plant('h1', P(700, 500));
        run(200);
        const { container } = mount();
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(cellsOf(container, t.id)).toEqual([CELL.OUTPUT, CELL.CHARGES]);
        const figure = container.querySelector('[data-board-hero="h1"]');
        fireEvent.mouseEnter(figure);
        restHover();
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(plateOf(container, t.id).getAttribute('data-work-plate-open')).toBe('true');
        expect(cellsOf(container, t.id)).toEqual([CELL.SKILL, CELL.OUTPUT, CELL.CHARGES, CELL.TIMER]);
        expect(plateOf(container, t.id).querySelector('[data-plate-cell="timer"] span').textContent).toMatch(/^\d+:\d\d$|^–$/);
        const name = figure.querySelector('[data-token-name]');
        expect(parseFloat(name.style.top.replace(/[^\d.]/g, ' ').trim().split(/\s+/).pop())).toBeGreaterThan(PLATE.H);
        fireEvent.mouseLeave(figure);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(plateOf(container, t.id).getAttribute('data-work-plate-open')).toBeNull();
    });

    it('a Token being taken down shows the work, not what it would have made, and no charges', () => {
        GameState.state.heroes = [hero('h1', { forestry: 50, construction: 50 })];
        const t = put('fixture_producer', AT, 12);
        Flags.plant('h1', P(700, 500));
        run(200);
        expect(workPlateOf(t.id)).toMatchObject({ output: 'fixture_oak_wood', charges: 12 });
        expect(Demolition.mark(t).success).toBe(true);
        run(200);
        expect(BoardState.workerOf(t.id)).toBe('h1');
        expect(workPlateOf(t.id)).toMatchObject({ output: null, skill: 'construction', charges: null });
    });

    it('its draw switch stops drawing it, and nothing else', async () => {
        const t = put('fixture_producer', AT, 12);
        Flags.plant('h1', P(700, 500));
        run(200);
        setDrawn('workPlate', false);
        const { container } = mount();
        await flush();
        expect(container.querySelector('[data-work-plates]')).toBeNull();
        expect(BoardState.workerOf(t.id)).toBe('h1');
        expect(workPlateOf(t.id)).toMatchObject({ heroId: 'h1', charges: 12 });
    });
});

describe('the layer on its own', () => {
    it('pressing a plate hands its Token to the mat’s grab, like pressing the Token', async () => {
        const t = put('fixture_producer', AT, 12);
        Flags.plant('h1', P(700, 500));
        run(200);
        const onPress = vi.fn();
        const { container } = render(h('div', { 'data-mat-board': '' },
            h(WorkPlateLayer, { plates: [{ tokenId: t.id, heroId: 'h1', typeId: t.typeId, x: t.x, y: t.y }], onPress })));
        await flush();
        fireEvent.pointerDown(plateOf(container, t.id));
        expect(onPress).toHaveBeenCalledTimes(1);
        expect(onPress.mock.calls[0][1]).toMatchObject({ id: t.id, typeId: 'fixture_producer' });
    });
});
