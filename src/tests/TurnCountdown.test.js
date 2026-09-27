import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { TurnCountdownBadge, TURN_COUNTDOWN_REFRESH_MS } from '../ui/components/board/TokenBadges.jsx';
import { turnCountdownText } from '../ui/components/board/centreAlert.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Token Lifecycle feedback, slice **Q8 — FB-14**: a Token that turns on its
 * own shows a countdown to its next roll (TL-12), on the Coast and on the
 * Shrimp Coast it became. A plain badge bottom-left for now (brief B1 makes it
 * a ring).
 */

registerTokenTypes({
    fixture_q8_coast: {
        id: 'fixture_q8_coast', name: 'Fixture Q8 Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        turns: { into: [{ typeId: 'fixture_q8_shrimp', weight: 1 }], everyMs: 60000, chance: 100 }
    },
    fixture_q8_shrimp: {
        id: 'fixture_q8_shrimp', name: 'Fixture Q8 Shrimp Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nautical'
    }
});

const h = React.createElement;
const AT = { x: 560, y: 520 };
const mount = (el) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el))
);
const overlay = (container, id) => container.querySelector(`[data-token-overlay="${id}"]`);
const countdownOf = (container, id) => overlay(container, id)?.querySelector('[data-turn-countdown]') ?? null;

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.heroes = [];
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

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

    it('the badge draws what it reads, names the odds, and hides while dragging', () => {
        const read = () => ({ inMs: 34000, chance: 30, back: false });
        const badge = mount(h(TurnCountdownBadge, { read, isDragging: false })).container.querySelector('[data-turn-countdown]');
        expect(badge.textContent).toBe('0:34');
        expect(badge.getAttribute('aria-label')).toBe('Next chance to turn in 0:34 (30%)');
        cleanup();
        const back = () => ({ inMs: 5000, chance: 30, back: true });
        expect(mount(h(TurnCountdownBadge, { read: back, isDragging: false })).container
            .querySelector('[data-turn-countdown]').getAttribute('aria-label')).toBe('Next chance to turn back in 0:05 (30%)');
        cleanup();
        expect(mount(h(TurnCountdownBadge, { read, isDragging: true })).container.querySelector('[data-turn-countdown]')).toBeNull();
        cleanup();
        expect(mount(h(TurnCountdownBadge, { read: () => null, isDragging: false })).container.querySelector('[data-turn-countdown]')).toBeNull();
    });
});

describe('on the mat (FB-14)', () => {
    it('a Coast counts down to its roll, and the Shrimp Coast it turns into counts down to its roll back', async () => {
        vi.useFakeTimers();
        const coast = BoardState.createTokenInstance('fixture_q8_coast');
        Placement.placeTokenAt(coast, AT);
        const { container } = mount(h(MatBoard));
        expect(countdownOf(container, coast.id).textContent).toBe('1:00');

        // 26 s of game time: the badge re-reads the clock on its next refresh.
        act(() => { TimedChanges.tick(26000); vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        expect(countdownOf(container, coast.id).textContent).toBe('0:34');

        // The roll (100%): a Shrimp Coast, counting down afresh to its roll back.
        // (The mat re-reads its Token list on a microtask, hence the async act.)
        await act(async () => { TimedChanges.tick(34000); });
        act(() => { vi.advanceTimersByTime(TURN_COUNTDOWN_REFRESH_MS); });
        const shrimp = BoardState.tokens().find(t => t.typeId === 'fixture_q8_shrimp');
        expect(shrimp?.turnedFrom).toBe('fixture_q8_coast');
        const badge = countdownOf(container, shrimp.id);
        expect(badge.textContent).toBe('1:00');
        expect(badge.getAttribute('aria-label')).toContain('turn back');
    });

    it('a Token that does not turn has no countdown', () => {
        const plain = BoardState.createTokenInstance('fixture_producer');
        Placement.placeTokenAt(plain, AT);
        const { container } = mount(h(MatBoard));
        expect(overlay(container, plain.id)).not.toBeNull();
        expect(countdownOf(container, plain.id)).toBeNull();
    });
});
