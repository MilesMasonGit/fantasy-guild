// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import { ALERT, BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EventBus } from '../systems/core/EventBus.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import { GEAR_ONLY_ALERTS } from '../ui/components/board/centreAlert.js';
import { STEP_MS } from '../ui/components/board/frameClock.js';
import { WORK_BAR_ART_W } from '../ui/components/board/workBar.js';
import { PROBLEM_SEVERITY } from '../ui/components/board/problemMark.js';

/** Every alert value that can reach a Token (one enum). */
const ALERT_VALUES = Object.values(ALERT);

/** Every alert the engine writes on a Token: all but resting, which is never written as one. */
const TOKEN_ALERTS = ALERT_VALUES.filter(a => a !== ALERT.RESTING);

const tree = (el) => React.createElement(DndContext, null, el);

const worked = (alert, extra = {}) => ({ typeId: 'fixture_missing_type', instanceId: 'tok_1', heroId: 'hero_1', alert, ...extra });

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpawnerSystem.resetAlerts();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('a worked Token with an alert: no words, its bar held grey, one mark', () => {
    const row = (alert) => React.createElement(TokenBubbles, { instanceId: 'tok_1', token: worked(alert) });
    const bar = (container) => container.querySelector('[data-work-bar]');

    it.each(TOKEN_ALERTS)('prints no label, holds the bar grey and shows one %s mark', (alert) => {
        const { container } = render(tree(row(alert)));
        expect(container.querySelector('[data-tile-alert-hint]')).toBeNull();
        expect(bar(container).getAttribute('data-work-bar-blocked')).toBe('true');
        const marks = container.querySelectorAll('[data-problem-mark]');
        expect(marks).toHaveLength(1);
        expect(marks[0].getAttribute('data-problem-severity')).toBe(PROBLEM_SEVERITY[alert]);
    });

    it('nothing chosen holds the bar too: the cycle cannot run (a yellow mark, not a fault)', () => {
        for (const alert of GEAR_ONLY_ALERTS) {
            const { container, unmount } = render(tree(row(alert)));
            expect(bar(container).getAttribute('data-work-bar-blocked')).toBe('true');
            expect(container.querySelector('[data-problem-mark]').getAttribute('data-problem-severity')).toBe('waiting');
            unmount();
        }
    });

    it('ignores progress while blocked, and runs again once the alert clears', () => {
        vi.useFakeTimers();
        // The bar draws on the shared step clock's next step.
        const step = () => act(() => { vi.advanceTimersByTime(STEP_MS + 20); });
        const { container, rerender } = render(tree(row(ALERT.INPUTS)));
        act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_1', percent: 50, elapsedMs: 5000, cycleTimeMs: 10000 }); });
        step();
        expect(bar(container).getAttribute('data-work-bar-fill')).toBe('0');

        rerender(tree(row(null)));
        expect(bar(container).getAttribute('data-work-bar-blocked')).toBeNull();
        expect(container.querySelector('[data-problem-mark]')).toBeNull();
        act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_1', percent: 50, elapsedMs: 5000, cycleTimeMs: 10000 }); });
        step();
        expect(Number(bar(container).getAttribute('data-work-bar-fill'))).toBe(WORK_BAR_ART_W / 2);
    });
});
