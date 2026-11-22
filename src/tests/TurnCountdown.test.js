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
 * ⭐ Token Lifecycle feedback, slice **Q8**: a Token that changes on its own clock
 * (here a growing Sapling) shows a countdown to its next change: the timer on its
 * idle plate, shown on hover only.
 */

registerTokenTypes({
    fixture_q8_sapling: {
        id: 'fixture_q8_sapling', name: 'Fixture Q8 Sapling', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        grows: { into: 'fixture_q8_tree', afterMs: 60000 }
    },
    fixture_q8_tree: {
        id: 'fixture_q8_tree', name: 'Fixture Q8 Tree', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature'
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

    it('the timer cell draws what it reads, and is nothing with nothing to read', () => {
        expect(timerCellOf({ kind: 'grow', inMs: 34000, totalMs: 60000, into: 'fixture_q8_tree' }))
            .toMatchObject({ text: '0:34', glyph: 'grow', tip: 'Grows into Fixture Q8 Tree in 0:34' });
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
    it('a Sapling counts down to its growth, and its Tree has no countdown', async () => {
        vi.useFakeTimers();
        const sapling = BoardState.createTokenInstance('fixture_q8_sapling');
        Placement.placeTokenAt(sapling, AT);
        const { container } = mount(h(MatBoard));
        const root = container.querySelector('[data-mat-board]');
        root.getBoundingClientRect = () => ({
            left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0
        });
        const hover = () => { fireEvent.pointerMove(root, { clientX: AT.x, clientY: AT.y }); };
        // At rest, with a minute to go: nothing. Hovered: its plate, a minute to go.
        expect(countdownOf(container, sapling.id)).toBeNull();
        act(hover);
        expect(countdownOf(container, sapling.id)).toBeNull();
        restHover();
        expect(textOf(countdownOf(container, sapling.id))).toBe('1:00');

        // 26 s of game time: the plate re-reads the clock on its next refresh.
        act(() => { TimedChanges.tick(26000); vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        expect(textOf(countdownOf(container, sapling.id))).toBe('0:34');
        act(() => { TimedChanges.tick(19000); vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        expect(textOf(countdownOf(container, sapling.id))).toBe('0:15');

        // It grows: the Tree has nothing counting.
        // (The mat re-reads its Token list on a microtask, hence the async act.)
        await act(async () => { TimedChanges.tick(15000); });
        act(() => { vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        const tree = BoardState.tokens().find(t => t.typeId === 'fixture_q8_tree');
        expect(tree).toBeTruthy();
        act(() => { fireEvent.pointerMove(root, { clientX: AT.x + 1, clientY: AT.y }); });
        act(() => { vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        expect(countdownOf(container, tree.id)).toBeNull();
    });

    it('⭐ not hovered, the countdown never comes up by itself, not even in its last seconds (brief 120)', () => {
        vi.useFakeTimers();
        const coast = BoardState.createTokenInstance('fixture_q8_sapling');
        Placement.placeTokenAt(coast, AT);
        const { container } = mount(h(MatBoard));
        act(() => { TimedChanges.tick(49000); vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        expect(countdownOf(container, coast.id)).toBeNull();            // 11 s to go
        act(() => { TimedChanges.tick(2000); vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        expect(countdownOf(container, coast.id)).toBeNull();            // 9 s to go
    });

    it('a Token with no clock has no countdown', () => {
        const plain = BoardState.createTokenInstance('fixture_producer');
        Placement.placeTokenAt(plain, AT);
        const { container } = mount(h(MatBoard));
        expect(overlay(container, plain.id)).not.toBeNull();
        expect(countdownOf(container, plain.id)).toBeNull();
    });
});
