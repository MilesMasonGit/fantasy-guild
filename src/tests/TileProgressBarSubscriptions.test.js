import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { TileProgressBar } from '../ui/components/board/TileProgressBar.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';

/**
 * CR2-168 item 1 — hovering a tile used to tear down and rebuild the bar's
 * four EventBus subscriptions and cancel its animation frame.
 *
 * The effect that owned the subscriptions listed `isHovered` and `missingReqs`
 * in its dependency array, and `missingReqs` is a fresh object whenever `token`
 * changes identity. So moving the cursor across a working tile dropped the
 * `board:progress` subscription and reset the interpolation to inactive, and
 * the bar stayed frozen until the next progress event — up to ~300ms.
 *
 * These tests measure the churn directly: they count `EventBus.subscribe`
 * calls across a re-render. They cannot see the visual hitch — that needs eyes
 * on a running game — but they pin the mechanism that causes it.
 */

const BAR_EVENTS = [
    BOARD_EVENTS.PROGRESS,
    BOARD_EVENTS.ALERT_CHANGED,
    BOARD_EVENTS.CYCLE_COMPLETE,
    BOARD_EVENTS.TILE_CHANGED
];

/** Count subscribe/unsubscribe traffic on just the four events the bar uses. */
const withSubscriptionCounter = () => {
    const counts = { subscribe: 0, unsubscribe: 0 };
    const realSubscribe = EventBus.subscribe.bind(EventBus);
    const realUnsubscribe = EventBus.unsubscribe.bind(EventBus);

    const subSpy = vi.spyOn(EventBus, 'subscribe').mockImplementation((name, cb) => {
        if (BAR_EVENTS.includes(name)) counts.subscribe++;
        return realSubscribe(name, cb);
    });
    const unsubSpy = vi.spyOn(EventBus, 'unsubscribe').mockImplementation((name, cb) => {
        if (BAR_EVENTS.includes(name)) counts.unsubscribe++;
        return realUnsubscribe(name, cb);
    });

    return { counts, restore: () => { subSpy.mockRestore(); unsubSpy.mockRestore(); } };
};

const tree = (props) => React.createElement(
    EngineContext.Provider,
    { value: { EventBus } },
    React.createElement(TileProgressBar, props)
);

describe('TileProgressBar subscription churn (CR2-168 item 1)', () => {
    let meter;

    beforeEach(() => {
        meter = withSubscriptionCounter();
    });

    afterEach(() => {
        cleanup();
        meter.restore();
    });

    it('subscribes exactly four times on mount', () => {
        render(tree({ tile: 3, token: { typeId: 'fixture_producer', heroId: 'hero_1' } }));
        expect(meter.counts.subscribe).toBe(4);
        expect(meter.counts.unsubscribe).toBe(0);
    });

    it('does not resubscribe when the cursor enters or leaves the tile', () => {
        const token = { typeId: 'fixture_producer', heroId: 'hero_1' };
        const { rerender } = render(tree({ tile: 3, token, isHovered: false }));
        const afterMount = meter.counts.subscribe;

        rerender(tree({ tile: 3, token, isHovered: true }));
        rerender(tree({ tile: 3, token, isHovered: false }));

        expect(meter.counts.subscribe).toBe(afterMount);
        expect(meter.counts.unsubscribe).toBe(0);
    });

    it('does not resubscribe when the token object is rebuilt with the same content', () => {
        // `Board` rebuilds a fresh projection object per tile on every
        // `state_changed`, so the `token` prop changes identity every tick.
        // That used to invalidate `missingReqs` and with it the subscriptions.
        const { rerender } = render(tree({
            tile: 3,
            token: { typeId: 'fixture_producer', heroId: 'hero_1' }
        }));
        const afterMount = meter.counts.subscribe;

        for (let i = 0; i < 5; i++) {
            rerender(tree({
                tile: 3,
                token: { typeId: 'fixture_producer', heroId: 'hero_1' }
            }));
        }

        expect(meter.counts.subscribe).toBe(afterMount);
        expect(meter.counts.unsubscribe).toBe(0);
    });

    it('does not resubscribe when the alert changes', () => {
        const { rerender } = render(tree({
            tile: 3,
            token: { typeId: 'fixture_producer', heroId: 'hero_1' }
        }));
        const afterMount = meter.counts.subscribe;

        rerender(tree({
            tile: 3,
            token: { typeId: 'fixture_producer', heroId: 'hero_1', alert: 'inputs' }
        }));
        rerender(tree({
            tile: 3,
            token: { typeId: 'fixture_producer', heroId: 'hero_1' }
        }));

        expect(meter.counts.subscribe).toBe(afterMount);
    });

    it('does resubscribe when the tile index changes, and cleans up after itself', () => {
        const token = { typeId: 'fixture_producer', heroId: 'hero_1' };
        const { rerender } = render(tree({ tile: 3, token }));
        rerender(tree({ tile: 9, token }));

        expect(meter.counts.subscribe).toBe(8);
        expect(meter.counts.unsubscribe).toBe(4);
    });

    it('leaves no subscriptions behind on unmount', () => {
        const before = BAR_EVENTS.map(e => EventBus.getSubscriberCount(e));
        const { unmount } = render(tree({
            tile: 3,
            token: { typeId: 'fixture_producer', heroId: 'hero_1' }
        }));
        unmount();
        expect(BAR_EVENTS.map(e => EventBus.getSubscriberCount(e))).toEqual(before);
    });

    it('still shows the alert when it arrives by event, without resubscribing', () => {
        render(tree({ tile: 3, token: { typeId: 'fixture_producer', heroId: 'hero_1' } }));
        const afterMount = meter.counts.subscribe;

        EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { tile: 3, alert: 'inputs' });

        expect(meter.counts.subscribe).toBe(afterMount);
    });
});
