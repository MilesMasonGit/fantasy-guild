import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DragPointerProvider, useDragPointer } from '../ui/dnd/DndKit.jsx';

/**
 * ⭐ the per-frame cursor used to live in `DeckDndProvider` itself, so
 * publishing it re-ran that whole component's render on every pointer move,
 * recreating the `<DndContext>` element dnd-kit was given — which made
 * dnd-kit redo its own collision/overlay work a second time on top of the
 * move it had already handled.
 */

let queue;
beforeEach(() => {
    queue = [];
    vi.stubGlobal('requestAnimationFrame', (cb) => { queue.push(cb); return queue.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function flush() {
    const due = queue;
    queue = [];
    for (const cb of due) cb();
}

function PlainChild({ renders }) {
    renders.count++;
    return null;
}

function PointerReader({ renders, out }) {
    renders.count++;
    out.value = useDragPointer();
    return null;
}

describe('DragPointerProvider only re-renders its own context consumers (CR3-404)', () => {
    it('a sibling that does not read useDragPointer is not re-rendered when the cursor updates', () => {
        const plainRenders = { count: 0 };
        const pointerRef = { current: { x: 0, y: 0 } };
        const activePayload = { kind: 'TOKEN' };

        render(
            React.createElement(
                DragPointerProvider,
                { activePayload, pointerRef },
                React.createElement(PlainChild, { renders: plainRenders })
            )
        );
        expect(plainRenders.count).toBe(1);

        act(() => {
            window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 10 }));
        });
        act(() => { flush(); });

        // The provider re-rendered (it owns dragPointer state), but its
        // unrelated sibling child did not — same element, so React bails out.
        expect(plainRenders.count).toBe(1);
    });

    it('a real consumer of useDragPointer does see each published update', () => {
        const renders = { count: 0 };
        const out = { value: undefined };
        const pointerRef = { current: { x: 1, y: 1 } };
        const activePayload = { kind: 'TOKEN' };

        render(
            React.createElement(
                DragPointerProvider,
                { activePayload, pointerRef },
                React.createElement(PointerReader, { renders, out })
            )
        );
        // Seeded immediately at mount, from pointerRef's starting value.
        expect(out.value).toEqual({ x: 1, y: 1 });
        const afterSeed = renders.count;

        act(() => {
            window.dispatchEvent(new MouseEvent('pointermove', { clientX: 42, clientY: 7 }));
        });
        act(() => { flush(); });

        expect(out.value).toEqual({ x: 42, y: 7 });
        expect(renders.count).toBeGreaterThan(afterSeed);
    });

    it('clears to null when the drag ends (activePayload goes falsy)', () => {
        const out = { value: 'untouched' };
        const pointerRef = { current: { x: 5, y: 5 } };

        const { rerender } = render(
            React.createElement(
                DragPointerProvider,
                { activePayload: { kind: 'TOKEN' }, pointerRef },
                React.createElement(PointerReader, { renders: { count: 0 }, out })
            )
        );
        expect(out.value).toEqual({ x: 5, y: 5 });

        act(() => {
            rerender(
                React.createElement(
                    DragPointerProvider,
                    { activePayload: null, pointerRef },
                    React.createElement(PointerReader, { renders: { count: 0 }, out })
                )
            );
        });
        expect(out.value).toBeNull();
    });
});
