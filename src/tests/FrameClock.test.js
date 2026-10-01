import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EngineContext } from '../ui/context/EngineContext';
import { TokenBadgeRow } from '../ui/components/board/TokenBadgeRow.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ **One frame loop for every sweeping ring** (CR3-011, R6 rule 2).
 *
 * Each worked Token's cycle ring used to run its own `requestAnimationFrame`
 * loop (6–7 at the realistic board). They now share one, and it stops when
 * the last ring stops (R6 rule 1).
 *
 * `requestAnimationFrame` is a queue this test flushes by hand, so "frames
 * requested" is the queue's length.
 */

const h = React.createElement;
const tree = (el) => h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el));
const token = (id, heroId = 'hero_1') => ({ typeId: 'fixture_producer', instanceId: id, heroId, alert: null, usesRemaining: null });
const rows = (ids, heroId) => h(React.Fragment, null, ...ids.map(id => h(TokenBadgeRow, { key: id, instanceId: id, token: token(id, heroId) })));
const progress = (id) => act(() => {
    EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: id, percent: 10, elapsedMs: 1600, cycleTimeMs: 16000 });
});

let queue;      // [{ id, cb }]
let nextId;
let clock;
function frame(ms = 6) {
    clock += ms;
    const due = queue;
    queue = [];
    for (const { cb } of due) cb(clock);
}

beforeEach(() => {
    queue = [];
    nextId = 1;
    clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb) => { const id = nextId++; queue.push({ id, cb }); return id; });
    vi.stubGlobal('cancelAnimationFrame', (id) => { queue = queue.filter(q => q.id !== id); });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('⭐ one shared frame clock for the cycle rings', () => {
    it('three sweeping rings ask for one frame a frame, not three', () => {
        const { container } = render(tree(rows(['ra', 'rb', 'rc'])));
        progress('ra'); progress('rb'); progress('rc');
        expect(queue.length).toBe(1);
        for (let i = 0; i < 10; i++) {
            frame();
            expect(queue.length).toBe(1);
        }
        // …and every ring still moved.
        for (const id of ['ra', 'rb', 'rc']) {
            const f = Number(container.querySelector(`[data-ring-row="${id}"] [data-ring="cycle"]`).getAttribute('data-ring-fraction'));
            expect(f).toBeGreaterThan(0.1);
        }
    });

    it('stops asking for frames when the last ring stops', () => {
        const { rerender } = render(tree(rows(['ra', 'rb'])));
        progress('ra'); progress('rb');
        frame();
        expect(queue.length).toBe(1);
        rerender(tree(rows(['ra', 'rb'], null)));   // both heroes leave
        expect(queue.length).toBe(0);
        frame(1000);
        expect(queue.length).toBe(0);
    });
});
