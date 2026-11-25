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
import { WorkBarTrack } from '../ui/components/board/WorkBarLayer.jsx';
import { BAR } from '../ui/components/board/matMarks.js';
import { PROBLEM_SEVERITY } from '../ui/components/board/problemMark.js';

/** Every alert value that can reach a Token (one enum). */
const ALERT_VALUES = Object.values(ALERT);

/**
 * Every alert the engine writes on a Token: all but resting, a Field's growing crop, a hero with
 * no bait, no arrows or a fish above them, and a shrine lit too full for an offering, which are
 * never written as one.
 */
const NOT_WRITTEN = [ALERT.RESTING, ALERT.GROWING, ALERT.NO_BAIT, ALERT.NO_AMMO, ALERT.FISH_LEVEL, ALERT.SHRINE_FULL];
const TOKEN_ALERTS = ALERT_VALUES.filter(a => !NOT_WRITTEN.includes(a));

const tree = (el) => React.createElement(DndContext, null, el);

const worked = (alert, extra = {}) => ({ typeId: 'fixture_missing_type', instanceId: 'tok_1', heroId: 'hero_1', alert, ...extra });

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpawnerSystem.resetAlerts();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('a Token with an alert: no words, one mark in its centre, worked or not (the card has the words)', () => {
    const row = (alert, extra = {}) => React.createElement(TokenBubbles, { instanceId: 'tok_1', token: worked(alert, extra) });
    /** A worked Token's bubbles and its work bar, held grey while it has an alert. */
    const withFill = (alert) => React.createElement(React.Fragment, null,
        row(alert),
        React.createElement(WorkBarTrack, { instanceId: 'tok_1', blocked: !!alert }));
    const bar = (container) => container.querySelector('[data-work-bar]');

    it.each(TOKEN_ALERTS)('nobody working it: no label, one %s mark', (alert) => {
        const { container } = render(tree(row(alert, { heroId: null })));
        expect(container.querySelector('[data-tile-alert-hint]')).toBeNull();
        const marks = container.querySelectorAll('[data-problem-mark]');
        expect(marks).toHaveLength(1);
        expect(marks[0].getAttribute('data-problem-severity')).toBe(PROBLEM_SEVERITY[alert]);
    });

    it.each(TOKEN_ALERTS)('worked: no label, one %s mark in the centre', (alert) => {
        const { container } = render(tree(row(alert)));
        expect(container.querySelector('[data-tile-alert-hint]')).toBeNull();
        const marks = container.querySelectorAll('[data-bubble-row="centre"] [data-problem-mark]');
        expect(marks).toHaveLength(1);
        expect(marks[0].getAttribute('data-problem-severity')).toBe(PROBLEM_SEVERITY[alert]);
    });

    it('nothing chosen, nobody working it: a yellow mark, not a fault', () => {
        for (const alert of GEAR_ONLY_ALERTS) {
            const { container, unmount } = render(tree(row(alert, { heroId: null })));
            expect(container.querySelector('[data-problem-mark]').getAttribute('data-problem-severity')).toBe('waiting');
            unmount();
        }
    });

    it('ignores progress while blocked, and runs again once the alert clears', () => {
        vi.useFakeTimers();
        // The bar draws on the shared step clock's next step.
        const step = () => act(() => { vi.advanceTimersByTime(STEP_MS + 20); });
        const { container, rerender } = render(tree(withFill(ALERT.INPUTS)));
        act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_1', percent: 50, elapsedMs: 5000, cycleTimeMs: 10000 }); });
        step();
        expect(bar(container).getAttribute('data-work-bar-fill')).toBe('0');

        rerender(tree(withFill(null)));
        expect(bar(container).getAttribute('data-work-bar-blocked')).toBeNull();
        expect(container.querySelector('[data-problem-mark]')).toBeNull();
        act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_1', percent: 50, elapsedMs: 5000, cycleTimeMs: 10000 }); });
        step();
        expect(Number(bar(container).getAttribute('data-work-bar-fill'))).toBe(BAR.W / 2);
    });
});
