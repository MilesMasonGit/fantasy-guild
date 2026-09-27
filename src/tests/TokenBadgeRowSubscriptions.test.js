import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { TokenBadgeRow } from '../ui/components/board/TokenBadgeRow.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';

/**
 * ⭐ Since B1.2 (TL-22) the progress bar is the ring row (`TokenBadgeRow`),
 * and every guarantee below carries over to it unchanged.
 *
 * CR2-168 item 1 — hovering a Token used to tear down and rebuild the bar's
 * four EventBus subscriptions and cancel its animation frame.
 *
 * The effect that owned the subscriptions listed `isHovered` and `missingReqs`
 * in its dependency array, and `missingReqs` is a fresh object whenever `token`
 * changes identity. So moving the cursor across a working Token dropped the
 * `board:progress` subscription and reset the interpolation to inactive, and
 * the bar stayed frozen until the next progress event — up to ~300ms.
 *
 * ## And since slice 1.6c-2, the count stops growing with the board
 * Bars no longer talk to the bus at all: they go through `tokenEvents.js`,
 * which holds **one subscription per event type** and dispatches by instance
 * id. Eighty Tokens on a free mat used to mean 320 subscriptions, every one of
 * them woken by every progress tick to compare an id and return.
 *
 * These tests measure the churn directly: they count `EventBus.subscribe`
 * calls. They cannot see the visual hitch — that needs eyes on a running game —
 * but they pin the mechanism that causes it.
 */

/**
 * Three since B1.1: the bar stopped drawing alerts, and the alert it still
 * greys for comes down as `token.alert` from `MatToken`, which re-reads it on
 * `ALERT_CHANGED` itself. (The -1 floater inside the row listens for
 * `TOKEN_CHARGES_CHANGED`, which is not counted here.)
 */
const BAR_EVENTS = [
    BOARD_EVENTS.PROGRESS,
    BOARD_EVENTS.CYCLE_COMPLETE,
    BOARD_EVENTS.TILE_CHANGED
];

/** Count subscribe/unsubscribe traffic on just the events the bar uses. */
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

const bar = (props) => React.createElement(TokenBadgeRow, props);

const tree = (props) => React.createElement(
    EngineContext.Provider,
    { value: { EventBus } },
    bar(props)
);

describe('TokenBadgeRow subscription churn (CR2-168 item 1, carried over from the bar)', () => {
    let meter;

    beforeEach(() => {
        meter = withSubscriptionCounter();
    });

    afterEach(() => {
        cleanup();
        meter.restore();
    });

    it('subscribes exactly three times on mount', () => {
        render(tree({ instanceId: 'tok_a', token: { typeId: 'fixture_producer', heroId: 'hero_1' } }));
        expect(meter.counts.subscribe).toBe(3);
        expect(meter.counts.unsubscribe).toBe(0);
    });

    it('⭐ eighty Tokens still cost three subscriptions, not two hundred and forty', () => {
        const bars = Array.from({ length: 80 }, (_, i) => bar({
            key: `tok_${i}`,
            instanceId: `tok_${i}`,
            token: { typeId: 'fixture_producer', heroId: 'hero_1' }
        }));
        render(React.createElement(EngineContext.Provider, { value: { EventBus } }, bars));

        expect(meter.counts.subscribe).toBe(3);
        expect(meter.counts.unsubscribe).toBe(0);
    });

    it('does not resubscribe when the cursor enters or leaves the Token', () => {
        const token = { typeId: 'fixture_producer', heroId: 'hero_1' };
        const { rerender } = render(tree({ instanceId: 'tok_a', token, isHovered: false }));
        const afterMount = meter.counts.subscribe;

        rerender(tree({ instanceId: 'tok_a', token, isHovered: true }));
        rerender(tree({ instanceId: 'tok_a', token, isHovered: false }));

        expect(meter.counts.subscribe).toBe(afterMount);
        expect(meter.counts.unsubscribe).toBe(0);
    });

    it('does not resubscribe when the token object is rebuilt with the same content', () => {
        // The mat rebuilds a fresh projection object per Token on every
        // `state_changed`, so the `token` prop changes identity every tick.
        // That used to invalidate `missingReqs` and with it the subscriptions.
        const { rerender } = render(tree({
            instanceId: 'tok_a',
            token: { typeId: 'fixture_producer', heroId: 'hero_1' }
        }));
        const afterMount = meter.counts.subscribe;

        for (let i = 0; i < 5; i++) {
            rerender(tree({
                instanceId: 'tok_a',
                token: { typeId: 'fixture_producer', heroId: 'hero_1' }
            }));
        }

        expect(meter.counts.subscribe).toBe(afterMount);
        expect(meter.counts.unsubscribe).toBe(0);
    });

    it('does not resubscribe when the alert changes', () => {
        const { rerender } = render(tree({
            instanceId: 'tok_a',
            token: { typeId: 'fixture_producer', heroId: 'hero_1' }
        }));
        const afterMount = meter.counts.subscribe;

        rerender(tree({
            instanceId: 'tok_a',
            token: { typeId: 'fixture_producer', heroId: 'hero_1', alert: 'inputs' }
        }));
        rerender(tree({
            instanceId: 'tok_a',
            token: { typeId: 'fixture_producer', heroId: 'hero_1' }
        }));

        expect(meter.counts.subscribe).toBe(afterMount);
    });

    it('does resubscribe when it is pointed at a different Token, and cleans up after itself', () => {
        const token = { typeId: 'fixture_producer', heroId: 'hero_1' };
        const { rerender } = render(tree({ instanceId: 'tok_a', token }));
        rerender(tree({ instanceId: 'tok_b', token }));

        // The last listener for each event left, so the router closed its bus
        // subscription and opened a fresh one for the new Token.
        expect(meter.counts.subscribe).toBe(6);
        expect(meter.counts.unsubscribe).toBe(3);
    });

    it('leaves no subscriptions behind on unmount', () => {
        const before = BAR_EVENTS.map(e => EventBus.getSubscriberCount(e));
        const { unmount } = render(tree({
            instanceId: 'tok_a',
            token: { typeId: 'fixture_producer', heroId: 'hero_1' }
        }));
        unmount();
        expect(BAR_EVENTS.map(e => EventBus.getSubscriberCount(e))).toEqual(before);
    });

    it('does not listen for ALERT_CHANGED at all (B1.1)', () => {
        const before = EventBus.getSubscriberCount(BOARD_EVENTS.ALERT_CHANGED);
        render(tree({ instanceId: 'tok_a', token: { typeId: 'fixture_producer', heroId: 'hero_1' } }));
        expect(EventBus.getSubscriberCount(BOARD_EVENTS.ALERT_CHANGED)).toBe(before);
    });
});
