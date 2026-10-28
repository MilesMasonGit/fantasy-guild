// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { timerCellOf } from '../ui/components/board/idlePlate.js';
import { TURN_COUNTDOWN_REFRESH_MS } from '../ui/components/board/ringRow.js';
import { turnCountdownText } from '../ui/components/board/centreAlert.js';
import { matW, matH } from '../config/matGeometry.js';
import * as Flags from '../systems/board/Flags.js';
import { restHover } from './fixtures/hoverRest.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Token Lifecycle feedback, slice **Q8**: a Token that turns on its own
 * shows a countdown to its next roll, on the Coast and on the Shrimp Coast it
 * became: the timer on its idle plate, shown on hover only.
 */

registerTokenTypes({
    fixture_q8_coast: {
        id: 'fixture_q8_coast', name: 'Fixture Q8 Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nautical',
        turns: { into: [{ typeId: 'fixture_q8_shrimp', weight: 1 }], everyMs: 60000, chance: 100 }
    },
    fixture_q8_shrimp: {
        id: 'fixture_q8_shrimp', name: 'Fixture Q8 Shrimp Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nautical'
    }
});

const h = React.createElement;
const AT = { x: 560, y: 520 };
const mount = (el) => render(
    h(DndContext, null, el)
);
const overlay = (container, id) => container.querySelector(`[data-token-overlay="${id}"]`);
const countdownOf = (container, id) => container.querySelector(`[data-idle-plate="${id}"] [data-plate-cell="timer"]`);
const textOf = (el) => el?.textContent ?? null;

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.heroes = [];
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());

describe('countdown text (FB-14)', () => {
    it('reads m:ss, rounded up to the second', () => {
        expect(turnCountdownText(60000)).toBe('1:00');
        expect(turnCountdownText(34000)).toBe('0:34');
        expect(turnCountdownText(33001)).toBe('0:34');
        expect(turnCountdownText(1)).toBe('0:01');
        expect(turnCountdownText(0)).toBe('0:00');
        expect(turnCountdownText(125000)).toBe('2:05');
        expect(turnCountdownText(undefined)).toBeNull();
    });

    it('the timer cell draws what it reads, names the odds, and is nothing with nothing to read', () => {
        const turn = (extra) => ({ kind: 'turn', everyMs: 60000, chance: 30, ...extra });
        expect(timerCellOf(turn({ inMs: 34000, back: false })))
            .toMatchObject({ text: '0:34', glyph: 'turn', tip: 'Next roll to turn into something else in 0:34 (30% chance)' });
        expect(timerCellOf(turn({ inMs: 5000, back: true })).tip).toBe('Next roll to turn back in 0:05 (30% chance)');
        expect(timerCellOf(null)).toBeNull();
    });

    it('a resting Token’s timer says when it refills', () => {
        const cell = timerCellOf({ kind: 'respawn', mode: 'refill', inMs: 24000, totalMs: 30000, everyMs: 30000 });
        expect(cell.text).toBe('0:24');
        // Non-breaking between the number and its unit, so the tip never splits them.
        expect(cell.tip).toBe('Resting. Refills in 24\u00a0s');
    });
});

describe('on the mat (FB-14)', () => {
    it('a Coast counts down to its roll, and the Shrimp Coast it turns into counts down to its roll back', async () => {
        vi.useFakeTimers();
        const coast = BoardState.createTokenInstance('fixture_q8_coast');
        Placement.placeTokenAt(coast, AT);
        const { container } = mount(h(MatBoard));
        const root = container.querySelector('[data-mat-board]');
        root.getBoundingClientRect = () => ({
            left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0
        });
        const hover = () => { fireEvent.pointerMove(root, { clientX: AT.x, clientY: AT.y }); };
        // At rest, with a minute to go: nothing. Hovered: its plate, a minute to go.
        expect(countdownOf(container, coast.id)).toBeNull();
        act(hover);
        expect(countdownOf(container, coast.id)).toBeNull();
        restHover();
        expect(textOf(countdownOf(container, coast.id))).toBe('1:00');

        // 26 s of game time: the plate re-reads the clock on its next refresh.
        act(() => { TimedChanges.tick(26000); vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        expect(textOf(countdownOf(container, coast.id))).toBe('0:34');
        act(() => { TimedChanges.tick(19000); vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        expect(textOf(countdownOf(container, coast.id))).toBe('0:15');

        // The roll (100%): a Shrimp Coast, counting down afresh to its roll back.
        // (The mat re-reads its Token list on a microtask, hence the async act.)
        await act(async () => { TimedChanges.tick(15000); });
        act(() => { vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        const shrimp = BoardState.tokens().find(t => t.typeId === 'fixture_q8_shrimp');
        expect(shrimp?.turnedFrom).toBe('fixture_q8_coast');
        act(() => { fireEvent.pointerMove(root, { clientX: AT.x + 1, clientY: AT.y }); });
        act(() => { vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        const cell = countdownOf(container, shrimp.id);
        expect(textOf(cell)).toBe('1:00');
        fireEvent.pointerEnter(cell);
        expect(document.body.querySelector('[data-bubble-tip]').textContent).toContain('turn back');
    });

    it('⭐ not hovered, the countdown never comes up by itself, not even in its last seconds (brief 120)', () => {
        vi.useFakeTimers();
        const coast = BoardState.createTokenInstance('fixture_q8_coast');
        Placement.placeTokenAt(coast, AT);
        const { container } = mount(h(MatBoard));
        act(() => { TimedChanges.tick(49000); vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        expect(countdownOf(container, coast.id)).toBeNull();            // 11 s to go
        act(() => { TimedChanges.tick(2000); vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        expect(countdownOf(container, coast.id)).toBeNull();            // 9 s to go
    });

    it('a Token that does not turn has no countdown', () => {
        const plain = BoardState.createTokenInstance('fixture_producer');
        Placement.placeTokenAt(plain, AT);
        const { container } = mount(h(MatBoard));
        expect(overlay(container, plain.id)).not.toBeNull();
        expect(countdownOf(container, plain.id)).toBeNull();
    });
});
