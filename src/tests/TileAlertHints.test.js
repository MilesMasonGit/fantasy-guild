// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import { ALERT, BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EngineContext } from '../ui/context/EngineContext';
import { EventBus } from '../systems/core/EventBus.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import { GEAR_ONLY_ALERTS } from '../ui/components/board/centreAlert.js';
import { STEP_MS } from '../ui/components/board/frameClock.js';

/** Every alert value that can reach a Token (one enum). */
const ALERT_VALUES = Object.values(ALERT);

/**
 * The worked-Token alerts: every value except "nothing chosen", which the pulsing recipe gear
 * says instead.
 */
const MARK_ALERTS = ALERT_VALUES.filter(a => !GEAR_ONLY_ALERTS.has(a));

const tree = (el) => React.createElement(
    EngineContext.Provider,
    { value: { GameState, EventBus } },
    React.createElement(DndContext, null, el)
);

const worked = (alert, extra = {}) => ({ typeId: 'fixture_missing_type', instanceId: 'tok_1', heroId: 'hero_1', alert, ...extra });

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpawnerSystem.resetAlerts();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('the ring row draws no alerts, and greys its cycle ring while blocked', () => {
    const row = (alert) => React.createElement(TokenBubbles, { instanceId: 'tok_1', token: worked(alert) });
    const cycle = (container) => container.querySelector('[data-ring="cycle"]');

    it.each(MARK_ALERTS)('prints no label and greys the cycle ring for "%s"', (alert) => {
        const { container } = render(tree(row(alert)));
        expect(container.querySelector('[data-tile-alert-hint]')).toBeNull();
        expect(cycle(container).getAttribute('data-ring-greyed')).toBe('true');
        expect(cycle(container).getAttribute('data-ring-text')).toBe('');
    });

    it('a gear-only alert does not grey the ring (the gear says it, not the centre mark)', () => {
        for (const alert of GEAR_ONLY_ALERTS) {
            const { container, unmount } = render(tree(row(alert)));
            expect(cycle(container).getAttribute('data-ring-greyed')).toBeNull();
            unmount();
        }
    });

    it('ignores progress while blocked, and runs again once the alert clears', () => {
        vi.useFakeTimers();
        // The ring draws on the shared step clock's next step.
        const step = () => act(() => { vi.advanceTimersByTime(STEP_MS + 20); });
        const { container, rerender } = render(tree(row(ALERT.INPUTS)));
        act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_1', percent: 50, elapsedMs: 5000, cycleTimeMs: 10000 }); });
        step();
        expect(cycle(container).getAttribute('data-ring-text')).toBe('');
        expect(cycle(container).getAttribute('data-ring-fraction')).toBe('0.000');

        rerender(tree(row(null)));
        expect(cycle(container).getAttribute('data-ring-greyed')).toBeNull();
        act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_1', percent: 50, elapsedMs: 5000, cycleTimeMs: 10000 }); });
        step();
        expect(cycle(container).getAttribute('data-ring-text')).toBe('5s');
    });
});
