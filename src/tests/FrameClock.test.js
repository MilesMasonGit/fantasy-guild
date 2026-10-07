// @vitest-environment jsdom
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
 * ⭐ **One frame loop for every sweeping ring** (R6 rule 2).
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

    it('⭐ CR3-351: writes the arc only when it moves a visible step, not every frame', () => {
        const writes = [];
        const real = Element.prototype.setAttribute;
        vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (name, value) {
            if (name === 'stroke-dasharray') writes.push(value);
            return real.call(this, name, value);
        });
        const { container } = render(tree(rows(['ra'])));
        progress('ra');                      // 10 % into a 16 s cycle
        writes.length = 0;
        for (let i = 0; i < 100; i++) frame(6);   // 0.6 s at 165 Hz: 3.75 % of the cycle
        // 400 steps a cycle: ~15 steps crossed, not 100 writes.
        expect(writes.length).toBeGreaterThan(10);
        expect(writes.length).toBeLessThanOrEqual(17);
        // …and it is where it should be.
        const f = Number(container.querySelector('[data-ring="cycle"]').getAttribute('data-ring-fraction'));
        expect(f).toBeCloseTo((1600 + 600) / 16000, 2);
    });

    it('CR3-351: the seconds still tick over on the frame they change', () => {
        const { container } = render(tree(rows(['ra'])));
        progress('ra');                      // 1.6 s in: "15s" left (rounded up)
        const cycle = container.querySelector('[data-ring="cycle"]');
        expect(cycle.getAttribute('data-ring-text')).toBe('15s');
        for (let i = 0; i < 70; i++) frame(6);   // 2.02 s in: 13.98 s left
        expect(cycle.getAttribute('data-ring-text')).toBe('14s');
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
