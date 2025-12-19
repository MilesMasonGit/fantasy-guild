/**
 * EventBus Tests
 * Tests the core pub/sub system functionality
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../systems/core/EventBus.js';

describe('EventBus', () => {
    beforeEach(() => {
        // Clear all subscribers between tests
        EventBus.clear();
    });

    describe('subscribe', () => {
        it('should return an unsubscribe function', () => {
            const unsubscribe = EventBus.subscribe('test_event', () => { });
            expect(typeof unsubscribe).toBe('function');
        });

        it('should call callback when event is published', () => {
            const callback = vi.fn();
            EventBus.subscribe('test_event', callback);

            EventBus.publish('test_event', { data: 'test' });

            expect(callback).toHaveBeenCalledOnce();
            expect(callback).toHaveBeenCalledWith({ data: 'test' });
        });

        it('should support multiple subscribers for same event', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            EventBus.subscribe('test_event', callback1);
            EventBus.subscribe('test_event', callback2);

            EventBus.publish('test_event', {});

            expect(callback1).toHaveBeenCalledOnce();
            expect(callback2).toHaveBeenCalledOnce();
        });
    });

    describe('unsubscribe', () => {
        it('should stop receiving events after unsubscribe', () => {
            const callback = vi.fn();
            const unsubscribe = EventBus.subscribe('test_event', callback);

            EventBus.publish('test_event', {});
            expect(callback).toHaveBeenCalledTimes(1);

            unsubscribe();

            EventBus.publish('test_event', {});
            expect(callback).toHaveBeenCalledTimes(1); // Still 1, not 2
        });
    });

    describe('publish', () => {
        it('should not throw if no subscribers exist', () => {
            expect(() => {
                EventBus.publish('nonexistent_event', {});
            }).not.toThrow();
        });
    });
});
