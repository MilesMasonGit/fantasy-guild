import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus, UI_LISTENER } from '../systems/core/EventBus.js';

/**
 * A catch-up plays hours of game in seconds with nothing on screen to update, so the bus can go
 * quiet: listeners tagged as UI (drawing, toasts) are skipped and the engine's own still run.
 */

beforeEach(() => EventBus.clear());
afterEach(() => {
    EventBus.setQuiet(false);
    EventBus.clear();
});

describe('a quiet bus', () => {
    it('a quiet bus skips UI listeners and still calls engine ones', () => {
        const heard = [];
        EventBus.subscribe('test_event', () => heard.push('engine'));
        EventBus.subscribe('test_event', () => heard.push('ui'), UI_LISTENER);

        EventBus.setQuiet(true);
        EventBus.publish('test_event');
        expect(heard).toEqual(['engine']);

        EventBus.setQuiet(false);
        EventBus.publish('test_event');
        expect(heard).toEqual(['engine', 'engine', 'ui']);
    });

    it('keeps the engine listeners in their subscription order', () => {
        const heard = [];
        EventBus.subscribe('test_event', () => heard.push('a'));
        EventBus.subscribe('test_event', () => heard.push('ui 1'), UI_LISTENER);
        EventBus.subscribe('test_event', () => heard.push('b'));
        EventBus.subscribe('test_event', () => heard.push('ui 2'), UI_LISTENER);
        EventBus.subscribe('test_event', () => heard.push('c'));

        EventBus.setQuiet(true);
        EventBus.publish('test_event');
        expect(heard).toEqual(['a', 'b', 'c']);

        heard.length = 0;
        EventBus.setQuiet(false);
        EventBus.publish('test_event');
        expect(heard).toEqual(['a', 'ui 1', 'b', 'ui 2', 'c']);
    });

    it('an event named as an exception still reaches its UI listeners', () => {
        const heard = [];
        EventBus.subscribe('progress_event', () => heard.push('bar'), UI_LISTENER);
        EventBus.subscribe('test_event', () => heard.push('mat'), UI_LISTENER);

        EventBus.setQuiet(true, { except: ['progress_event'] });
        EventBus.publish('progress_event');
        EventBus.publish('test_event');
        expect(heard).toEqual(['bar']);
        expect(EventBus.isQuiet()).toBe(true);
    });

    it('unsubscribing a UI listener removes it in both modes', () => {
        const heard = [];
        const off = EventBus.subscribe('test_event', () => heard.push('ui'), UI_LISTENER);
        off();
        EventBus.publish('test_event');
        EventBus.setQuiet(true);
        EventBus.publish('test_event');
        expect(heard).toEqual([]);
        expect(EventBus.getSubscriberCount('test_event')).toBe(0);
    });

    it('a UI listener still counts as a subscriber', () => {
        EventBus.subscribe('test_event', () => {}, UI_LISTENER);
        expect(EventBus.getSubscriberCount('test_event')).toBe(1);
        expect(EventBus.hasSubscribers('test_event')).toBe(true);
    });
});
