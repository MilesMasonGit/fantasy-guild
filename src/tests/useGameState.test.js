import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameState } from '../ui/hooks/useGameState';
import { useEngine } from '../ui/hooks/useEngine';

// Mock the useEngine hook
vi.mock('../ui/hooks/useEngine.js', () => ({
    useEngine: vi.fn()
}));

describe('useGameState', () => {
    let mockEventBus;
    let mockGameState;

    beforeEach(() => {
        // Setup mock GameState
        mockGameState = {
            currency: { gold: 100, gems: 0 },
            heroes: [{ id: 'h1', name: 'Arthur' }],
            inventory: new Map([['item1', 5]])
        };

        // Setup mock EventBus pub/sub
        const subscribers = new Map();
        mockEventBus = {
            subscribe: vi.fn((event, callback) => {
                if (!subscribers.has(event)) subscribers.set(event, new Set());
                subscribers.get(event).add(callback);
                return () => subscribers.get(event).delete(callback);
            }),
            publish: (event, data) => {
                if (subscribers.has(event)) {
                    subscribers.get(event).forEach(cb => cb(data));
                }
            }
        };

        // Provide the mocks to the useEngine mock
        useEngine.mockReturnValue({
            GameState: mockGameState,
            EventBus: mockEventBus
        });

        // Use fake timers to process the microtask queue predictably
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns initial state from selector', () => {
        const { result } = renderHook(() => useGameState(state => state.currency));
        expect(result.current).toEqual({ gold: 100, gems: 0 });
    });

    it('does not re-render if state data is identical (deep equality bailout)', async () => {
        let renderCount = 0;
        const selector = (state) => {
            renderCount++;
            return state.currency;
        };

        const { result } = renderHook(() => useGameState(selector));

        // Initial render causes 1 selector call.
        // We capture the initial reference.
        const initialRef = result.current;
        const initialRenderCount = renderCount;

        // Simulate an engine tick that fires an event but data is exactly the same
        await act(async () => {
            mockEventBus.publish('state_changed');
            // Advance microtasks
            await Promise.resolve();
        });

        // The hook's reference should be exactly the same (meaning React skipped the update)
        expect(result.current).toBe(initialRef);
        // The selector should have been evaluated inside the setState
        expect(renderCount).toBeGreaterThan(initialRenderCount);
    });

    it('re-renders and returns new deep clone when state data changes', async () => {
        const { result } = renderHook(() => useGameState(state => state.currency));
        const initialRef = result.current;

        await act(async () => {
            // Mutate the mock GameState
            mockGameState.currency.gold = 150;
            // Fire event
            mockEventBus.publish('state_changed');
            // Flush microtasks
            await Promise.resolve();
        });

        // Reference should change, and value should update
        expect(result.current).not.toBe(initialRef);
        expect(result.current).toEqual({ gold: 150, gems: 0 });
    });

    it('debounces multiple synchronous events into a single update evaluation', async () => {
        let renderCount = 0;
        const selector = (state) => {
            renderCount++;
            return state.heroes;
        };

        // Subscribing to multiple events
        renderHook(() => useGameState(selector, ['state_changed', 'heroes_updated']));

        // Let component mount fully
        const countAfterMount = renderCount;

        await act(async () => {
            // Simulate game engine firing multiple events in one synchronous pass
            mockGameState.heroes.push({ id: 'h2', name: 'Lancelot' });

            mockEventBus.publish('state_changed');
            mockEventBus.publish('heroes_updated');

            // Advance microtask queue
            await Promise.resolve();
        });

        // Even though 2 events fired, the selector inside setState should only run ONCE
        // because the microtask queue debounces it
        expect(renderCount - countAfterMount).toBe(1);
    });

    it('eventFilter skips events that do not match the filter', async () => {
        let selectorCallCount = 0;
        const selector = (state) => {
            selectorCallCount++;
            return state.currency;
        };
        // Only process events where cardId === 'my-card'
        const filter = (eventData) => !eventData?.cardId || eventData.cardId === 'my-card';

        renderHook(() => useGameState(selector, ['state_changed'], filter));

        // Wait for mount + initial sync to complete
        await act(async () => {
            await Promise.resolve();
        });
        const countAfterMount = selectorCallCount;

        await act(async () => {
            // Publish event for a DIFFERENT card — should be filtered out
            mockEventBus.publish('state_changed', { cardId: 'other-card' });
            await Promise.resolve();
        });

        // Selector should NOT have been called again
        expect(selectorCallCount).toBe(countAfterMount);
    });

    it('eventFilter allows events that match the filter', async () => {
        const selector = (state) => state.currency;
        const filter = (eventData) => !eventData?.cardId || eventData.cardId === 'my-card';

        const { result } = renderHook(() => useGameState(selector, ['state_changed'], filter));
        const initialRef = result.current;

        await act(async () => {
            mockGameState.currency.gold = 200;
            // Publish event for OUR card — should pass filter
            mockEventBus.publish('state_changed', { cardId: 'my-card' });
            await Promise.resolve();
        });

        expect(result.current).not.toBe(initialRef);
        expect(result.current.gold).toBe(200);
    });

    it('eventFilter allows events with no payload (bulk updates)', async () => {
        const selector = (state) => state.currency;
        const filter = (eventData) => !eventData?.cardId || eventData.cardId === 'my-card';

        const { result } = renderHook(() => useGameState(selector, ['state_changed'], filter));
        const initialRef = result.current;

        await act(async () => {
            mockGameState.currency.gold = 300;
            // Publish event with NO data — should pass filter (backwards compat)
            mockEventBus.publish('state_changed');
            await Promise.resolve();
        });

        expect(result.current).not.toBe(initialRef);
        expect(result.current.gold).toBe(300);
    });
});
