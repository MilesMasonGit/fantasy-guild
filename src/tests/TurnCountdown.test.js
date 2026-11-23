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
import { timerCellsOf } from '../ui/components/board/idlePlate.js';
import { turnLine } from '../ui/components/board/tokenTimers.js';
import { TURN_COUNTDOWN_REFRESH_MS } from '../ui/components/board/ringRow.js';
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

describe('the turn timer (FB-14)', () => {
    const coast = { name: 'Coast', turns: { into: [{ typeId: 'shrimp', weight: 1 }], everyMs: 60000, chance: 30 } };
    const src = { tokenName: (id) => (id === 'shrimp' ? 'Shrimp Coast' : 'Coast') };

    it('the timer cell draws what the card says: the odds, the cycle and the next roll', () => {
        const [cell] = timerCellsOf([turnLine({ id: 'c', typeId: 'coast' }, coast, { inMs: 34000, chance: 30, into: ['shrimp'] }, src)]);
        expect(cell).toMatchObject({ text: '34s', glyph: 'turn', tip: 'A 30% chance every 1m to turn into Shrimp Coast, and the same to turn back. Next roll in 34s' });
        const back = turnLine({ id: 's', typeId: 'shrimp', turnedFrom: 'coast' }, coast, { inMs: 125000, chance: 30, back: true }, src);
        // Non-breaking between a time's parts, so the tip never splits them.
        expect(back.tip).toBe('A 30% chance to turn back into Coast in 2m\u00a05s');
        expect(timerCellsOf(null)).toEqual([]);
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
        expect(textOf(countdownOf(container, coast.id))).toBe('1m 0s');

        // 26 s of game time: the plate re-reads the clock on its next refresh.
        act(() => { TimedChanges.tick(26000); vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        expect(textOf(countdownOf(container, coast.id))).toBe('34s');
        act(() => { TimedChanges.tick(19000); vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        expect(textOf(countdownOf(container, coast.id))).toBe('15s');

        // The roll (100%): a Shrimp Coast, counting down afresh to its roll back.
        // (The mat re-reads its Token list on a microtask, hence the async act.)
        await act(async () => { TimedChanges.tick(15000); });
        act(() => { vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        const shrimp = BoardState.tokens().find(t => t.typeId === 'fixture_q8_shrimp');
        expect(shrimp?.turnedFrom).toBe('fixture_q8_coast');
        act(() => { fireEvent.pointerMove(root, { clientX: AT.x + 1, clientY: AT.y }); });
        act(() => { vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        const cell = countdownOf(container, shrimp.id);
        expect(textOf(cell)).toBe('1m 0s');
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
