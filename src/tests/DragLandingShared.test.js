import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { useTokenDragLanding } from '../ui/components/board/MatRings.jsx';
import { DeckDndContext, DragPointerContext } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';

/**
 * ⭐ CR3-401 — while a Token is carried, `MatRings` and `FlagLayer` both ask
 * `useTokenDragLanding(matRef)` for the same answer every frame (same
 * `matRef`, same pointer, same payload). Before the fix each call re-did
 * `pointerToMat` + `MatPlacement.findSpot` from scratch; this pins that the
 * second call in the same frame is answered from a cache instead.
 */

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Probe({ matRef, out, slot }) {
    out[slot] = useTokenDragLanding(matRef);
    return null;
}

function renderBoth(matEl, pointer, activePayload) {
    const matRef = { current: matEl };
    const out = {};
    render(
        React.createElement(
            DeckDndContext.Provider,
            { value: { activePayload, isDragging: true } },
            React.createElement(
                DragPointerContext.Provider,
                { value: pointer },
                React.createElement(Probe, { key: 'a', matRef, out, slot: 'ringsLanding' }),
                React.createElement(Probe, { key: 'b', matRef, out, slot: 'flagLayerLanding' })
            )
        )
    );
    return out;
}

function fakeMatEl() {
    return { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1760, height: 1126, right: 1760, bottom: 1126, x: 0, y: 0 }) };
}

describe('useTokenDragLanding is shared across callers in the same frame (CR3-401)', () => {
    it('findSpot runs once per frame, not once per consumer, for the same matRef/pointer/payload', () => {
        const spy = vi.spyOn(MatPlacement, 'findSpot');
        const matEl = fakeMatEl();
        const pointer = { x: 500, y: 500 };
        const activePayload = { kind: DRAG_KIND.TOKEN, typeId: 'fixture_producer', from: { instanceId: 'tok-1' } };

        const out = renderBoth(matEl, pointer, activePayload);

        expect(spy).toHaveBeenCalledTimes(1);
        // Both callers still get the real, identical answer.
        expect(out.ringsLanding).toEqual(out.flagLayerLanding);
        expect(out.ringsLanding).not.toBeNull();
    });

    it('a new pointer (the next animation frame) recomputes', () => {
        const spy = vi.spyOn(MatPlacement, 'findSpot');
        const matEl = fakeMatEl();
        const activePayload = { kind: DRAG_KIND.TOKEN, typeId: 'fixture_producer', from: { instanceId: 'tok-1' } };

        renderBoth(matEl, { x: 500, y: 500 }, activePayload);
        expect(spy).toHaveBeenCalledTimes(1);

        renderBoth(matEl, { x: 600, y: 500 }, activePayload);
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('a non-Token payload (a flag or hero) answers null without calling findSpot', () => {
        const spy = vi.spyOn(MatPlacement, 'findSpot');
        const matEl = fakeMatEl();
        const out = renderBoth(matEl, { x: 500, y: 500 }, { kind: DRAG_KIND.FLAG, heroId: 'h1' });

        expect(spy).not.toHaveBeenCalled();
        expect(out.ringsLanding).toBeNull();
        expect(out.flagLayerLanding).toBeNull();
    });
});
