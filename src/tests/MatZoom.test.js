// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { Board, matZoomStyle } from '../ui/components/board/Board.jsx';
import { pointerToMat } from '../ui/components/board/matPoint.js';
import { boardPointToScreen } from '../ui/components/base/ParticleOverlay.jsx';
import { snapShift } from '../ui/components/board/OrderDragLine.jsx';
import { matW, matH } from '../config/matGeometry.js';
import { boardScaleAt, tokenSizeFor, TOKEN_SURFACE } from '../ui/components/base/TokenSprite.jsx';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ **The mat is fitted by CSS zoom, never by a transform.** Under `transform: scale(fit)` Chrome
 * rounded each sprite's box to whole mat units before the scale (166.23 → 166 or 167 at fit 0.77),
 * so a row of art pixels came out a pixel thin or thick and outlines slipped against the art
 * (`docs/active/research/sprite_sharpness_2_2026-11-08.md`). Zoomed, the mat is laid out at screen
 * size. `bench:crisp`'s art-pixel check is the drawn proof; these pin the style and the readers.
 *
 * Zoom keeps what the readers relied on: the mat's `getBoundingClientRect()` is its on-screen box
 * (natural size × fit) and offsets inside it stay in mat units. So every reader that turns a screen
 * point into mat units, or back, through `rect.width / natural width` reads the same under zoom.
 */
describe('⭐ the mat is fitted by zoom', () => {
    beforeEach(() => { GameState.initNew(); clearMat(); });
    afterEach(() => cleanup());

    it('the mat carries zoom and its own stacking context, and no transform', () => {
        const { container } = render(React.createElement(DndContext, null, React.createElement(Board)));
        const mat = container.querySelector('[data-board-origin]');
        const fit = Number(mat.getAttribute('data-board-scale'));
        expect(Number(mat.style.zoom)).toBe(fit);
        expect(mat.style.isolation).toBe('isolate');
        expect(mat.style.transform).toBe('');
        expect(mat.style.transformOrigin).toBe('');
        expect(parseFloat(mat.style.width)).toBe(matW());
        expect(parseFloat(mat.style.height)).toBe(matH());
    });

    it('matZoomStyle: natural size, zoom by the fit, isolation; nothing else', () => {
        expect(matZoomStyle(1760, 1126, 0.77)).toEqual({ width: 1760, height: 1126, zoom: 0.77, isolation: 'isolate' });
    });
});

/** The mat's box as Chrome reports it when zoomed by `fit` with its corner at (left, top). */
const zoomedRect = (fit, left = 358.5, top = 81) => ({ left, top, width: matW() * fit, height: matH() * fit, right: left + matW() * fit, bottom: top + matH() * fit });

describe('readers of the mat\'s box under zoom', () => {
    it('pointerToMat (drops, presses, the hero drag\'s aim): a screen point back to mat units at every fit', () => {
        for (const fit of [0.5, 0.55, 0.61, 0.77, 0.83, 1, 1.09, 1.15]) {
            const r = zoomedRect(fit);
            const p = pointerToMat({ x: r.left + 640 * fit, y: r.top + 300 * fit }, r);
            expect(p.x).toBeCloseTo(640, 9);
            expect(p.y).toBeCloseTo(300, 9);
            const grabbed = pointerToMat({ x: r.left + 640 * fit, y: r.top + 300 * fit }, r, { x: 12, y: -4 });
            expect(grabbed).toEqual({ x: expect.closeTo(652, 9), y: expect.closeTo(296, 9) });
        }
    });

    it('boardPointToScreen (loot sparkles, flights): a mat point onto the screen at every fit', () => {
        for (const fit of [0.55, 0.77, 0.83, 1]) {
            const r = zoomedRect(fit);
            const el = { getBoundingClientRect: () => r, getAttribute: (k) => (k === 'data-natural-width' ? String(matW()) : null) };
            const s = boardPointToScreen(el, 640, 300);
            expect(s.x).toBeCloseTo(r.left + 640 * fit, 9);
            expect(s.y).toBeCloseTo(r.top + 300 * fit, 9);
        }
    });

    it('the carried flag snaps onto a Token\'s screen point worked out from the zoomed box (OrderDragLine)', () => {
        const fit = 0.77;
        const r = zoomedRect(fit);
        const token = { x: 800, y: 420 };
        const s = r.width / matW();
        const target = { x: r.left + token.x * s, y: r.top + token.y * s };
        const ghost = { left: 900, top: 300, width: 50, height: 90 };
        const shift = snapShift(ghost, { x: 0, y: 0 }, target);
        expect(ghost.left + ghost.width / 2 + shift.x).toBeCloseTo(target.x, 9);
        expect(ghost.top + ghost.height / 2 + shift.y).toBeCloseTo(target.y, 9);
    });

    it('a Token zoomed by its fit is a whole multiple of its 64 px art on screen (what zoom lays out exactly)', () => {
        for (const fit of [0.5, 0.55, 0.61, 0.76, 0.77, 0.83, 1, 1.09, 1.15, 1.3]) {
            const onScreen = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, boardScaleAt(fit)) * fit;
            expect(onScreen / 64).toBeCloseTo(Math.round(onScreen / 64), 9);
        }
    });
});
