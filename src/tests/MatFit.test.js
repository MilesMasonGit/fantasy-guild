import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { ART_PX, artRadius, matW, matH } from '../config/matGeometry.js';
import { fitScale, MIN_BOARD_SCALE } from '../ui/hooks/useBoardScale.js';
import {
    boardArtSteps, boardScaleAt, tokenSizeFor, TOKEN_SURFACE, TOKEN_SCALE
} from '../ui/components/base/TokenSprite.jsx';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import {
    NOTIFICATION_COLUMN, TRAY_COLUMN, columnWidthAt, columnWidthCss
} from '../ui/components/board/boardConstants.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Free Playmat slice 1.7 — the mat UI.**
 *
 * Two owner rulings are held here:
 *
 * * **FP-99 — stepped art, smooth spacing.** Positions, the surface, rings and
 *   flags keep scaling smoothly, but a Token sprite is only ever *drawn* at a
 *   whole multiple of its 64px art, and never below 1×. The mat may now grow
 *   past 1:1, which is what the stepping makes safe.
 * * **FP-100 — the columns give way.** The flanking columns shrink on a narrow
 *   window so the mat keeps a readable size, and the mat can never reach under
 *   one of them.
 *
 * ⚠️ Collision is deliberately NOT part of this. FP-99 is a drawing rule, so the
 * tests below assert what is *painted* and say nothing about `minGap` or
 * `hitRadiusOf`.
 */

const h = React.createElement;

/** The mat rendered at a given on-screen fit. */
const mountAt = (fit) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } },
        h(DndContext, null,
            h(MatFitProvider, { value: fit }, h(MatBoard))))
);

const spriteOf = (container, id) =>
    container.querySelector(`[data-token-id="${id}"][data-token-art] img`);
const boxOf = (container, id) =>
    container.querySelector(`[data-token-id="${id}"][data-token-art]`);

/** Every fit worth checking, from the degenerate floor to a big monitor. */
const FITS = [0.1, 0.14, 0.2, 0.21, 0.25, 0.33, 0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5, 2, 2.5, 3];

registerTokenTypes({
    fit_large: {
        id: 'fit_large', name: 'Fit Large', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 100, sprite: 'skill_nature',
        size: 2, requiresHero: false
    }
});

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
afterEach(() => cleanup());

beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    clearMat();
});

// ---------------------------------------------------------------------------
// 1. FP-99 — the mat grows as well as shrinks
// ---------------------------------------------------------------------------

describe('⭐ the mat fills the space it is given (FP-99)', () => {
    it('grows past 1:1 rather than leaving a big monitor half empty', () => {
        expect(fitScale(matW() * 2, matH() * 2, matW(), matH())).toBe(2);
        expect(fitScale(matW() * 3, matH() * 3, matW(), matH())).toBe(3);
        // Still the smaller axis: a wide-but-short box does not stretch it.
        expect(fitScale(matW() * 3, matH() * 1.5, matW(), matH())).toBe(1.5);
    });

    it('the 0.1 floor is untouched — it is a degenerate-case guard, not a legibility floor', () => {
        expect(fitScale(1, 1, matW(), matH())).toBe(MIN_BOARD_SCALE);
        expect(MIN_BOARD_SCALE).toBe(0.1);
    });

    /**
     * ⚠️ The reason the floor may not be raised, restated as a test: the mat is
     * fitted to the box it was measured against, so the box always contains it.
     * A mat wider than its box would slide under the Tray, whose drop surface
     * outranks the board's — drops there are silently eaten by the Vault chest.
     */
    it('⭐ the fitted mat never exceeds the box it was measured against', () => {
        for (const w of [400, 700, 1000, 1600, 2400, 3600]) {
            for (const hh of [300, 600, 900, 1400, 2000]) {
                const scale = fitScale(w, hh, matW(), matH());
                // Above the floor the fit is exact on the binding axis and
                // smaller on the other; it never overflows either.
                if (scale > MIN_BOARD_SCALE) {
                    expect(matW() * scale).toBeLessThanOrEqual(w + 0.5);
                    expect(matH() * scale).toBeLessThanOrEqual(hh + 0.5);
                }
            }
        }
    });
});

// ---------------------------------------------------------------------------
// 2. FP-99 — the art steps, the spacing glides
// ---------------------------------------------------------------------------

describe('⭐ a Token sprite is only ever drawn at a whole multiple of ART_PX (FP-99)', () => {
    it('the step is the whole number nearest what the smooth scale would have given', () => {
        // Smooth would be 2 × fit; the step is that rounded, never below 1.
        expect(boardArtSteps(1)).toBe(2);        // 2.0 → 2, the natural scale
        expect(boardArtSteps(1.5)).toBe(3);      // 3.0 → 3
        expect(boardArtSteps(0.75)).toBe(2);     // 1.5 → 2
        expect(boardArtSteps(0.6)).toBe(1);      // 1.2 → 1
        expect(boardArtSteps(0.5)).toBe(1);      // 1.0 → 1
        expect(boardArtSteps(0.21)).toBe(1);     // 0.42 → would be 0: clamped
        expect(boardArtSteps(0.1)).toBe(1);      // 0.2  → would be 0: clamped
    });

    it('⭐ never below 1×: the art is never drawn smaller than it was authored', () => {
        for (const fit of FITS) expect(boardArtSteps(fit)).toBeGreaterThanOrEqual(1);
    });

    it('⭐ through the mat transform, every sprite lands on a whole multiple of 64px', () => {
        for (const fit of FITS) {
            const drawnPx = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, boardScaleAt(fit)) * fit;
            expect(drawnPx / ART_PX).toBeCloseTo(Math.round(drawnPx / ART_PX), 9);
            expect(drawnPx).toBeGreaterThanOrEqual(ART_PX - 1e-9);
            // And it is exactly the step the rule chose.
            expect(drawnPx).toBeCloseTo(boardArtSteps(fit) * ART_PX, 9);
        }
    });

    it('a 2×2 steps with the same rule, at twice the size', () => {
        for (const fit of FITS) {
            const drawnPx = tokenSizeFor(TOKEN_SURFACE.BOARD, 2, boardScaleAt(fit)) * fit;
            expect(drawnPx).toBeCloseTo(boardArtSteps(fit) * ART_PX * 2, 9);
        }
    });

    it('at 1:1 nothing changes: the board is still its natural 2×', () => {
        expect(boardScaleAt(1)).toBe(TOKEN_SCALE[TOKEN_SURFACE.BOARD]);
        expect(tokenSizeFor(TOKEN_SURFACE.BOARD, 1)).toBe(128);
        expect(tokenSizeFor(TOKEN_SURFACE.BOARD, 1, boardScaleAt(1))).toBe(128);
    });

    it('a nonsense fit falls back to the natural scale rather than dividing by zero', () => {
        for (const bad of [0, -1, NaN, Infinity, undefined]) {
            expect(boardScaleAt(bad)).toBe(TOKEN_SCALE[TOKEN_SURFACE.BOARD]);
        }
    });

    it('every other surface is left completely alone', () => {
        expect(tokenSizeFor(TOKEN_SURFACE.TRAY, 1)).toBe(64);
        expect(tokenSizeFor(TOKEN_SURFACE.CARRY, 1)).toBe(128);
        expect(tokenSizeFor(TOKEN_SURFACE.CATALOGUE, 1)).toBe(32);
    });
});

describe('⭐ the drawn Token, on the mat (FP-99)', () => {
    it('draws its sprite at the stepped size for the live fit', () => {
        const tok = placeAt('fixture_producer', 600, 400);
        // 0.21 is roughly what 1280 × 720 gave before FP-100.
        const { container } = mountAt(0.21);

        // 1 step of art: 305 u, which the 0.21 transform draws as 64 real px.
        const img = spriteOf(container, tok.id);
        expect(parseFloat(img.style.width)).toBeCloseTo(ART_PX / 0.21, 6);
        expect(parseFloat(img.style.width) * 0.21).toBeCloseTo(64, 6);
    });

    it('with no Board around it, the mat draws exactly what it always did', () => {
        const tok = placeAt('fixture_producer', 600, 400);
        // No provider: the context default of 1 stands in.
        const { container } = render(
            h(EngineContext.Provider, { value: { GameState, EventBus } },
                h(DndContext, null, h(MatBoard)))
        );

        const box = boxOf(container, tok.id);
        expect(parseFloat(box.style.width)).toBe(128);
        expect(parseFloat(box.style.left)).toBe(600 - 64);
        expect(parseFloat(spriteOf(container, tok.id).style.width)).toBe(128);
    });

    /**
     * ⭐ FPR-6, which the owner accepted: below 1× the art is bigger than the
     * Token's own circle and spills over its neighbours. The box is `clip-path`ed
     * to a circle, so it has to grow with the art or it would crop exactly the
     * spill the ruling calls for.
     */
    it('⭐ below 1× the art outgrows the Token’s circle, and is not cropped', () => {
        const tok = placeAt('fixture_producer', 600, 400);
        const { container } = mountAt(0.21);

        const box = boxOf(container, tok.id);
        const art = parseFloat(spriteOf(container, tok.id).style.width);

        expect(art).toBeGreaterThan(artRadius(1) * 2);         // spills its circle
        expect(parseFloat(box.style.width)).toBeCloseTo(art, 6); // and is not cut off
    });

    it('stays centred on its point however big the art gets', () => {
        const tok = placeAt('fixture_producer', 600, 400);
        const { container } = mountAt(0.21);

        const box = boxOf(container, tok.id);
        const w = parseFloat(box.style.width);
        expect(parseFloat(box.style.left) + w / 2).toBeCloseTo(600, 6);
        expect(parseFloat(box.style.top) + w / 2).toBeCloseTo(400, 6);
    });

    it('a 2×2’s box keeps its own wider circle when the art is the smaller of the two', () => {
        const tok = placeAt('fit_large', 700, 500);
        const { container } = mountAt(1);

        // 288 u circle, 256 u of art: the circle still wins, exactly as before.
        expect(parseFloat(boxOf(container, tok.id).style.width)).toBe(288);
        expect(parseFloat(spriteOf(container, tok.id).style.width)).toBe(256);
        expect(parseFloat(boxOf(container, tok.id).style.left)).toBe(700 - 144);
    });

    it('⭐ the Token’s point is untouched — this is a drawing rule only', () => {
        const tok = placeAt('fixture_producer', 600, 400);
        mountAt(0.21);
        const after = BoardState.getTokenById(tok.id);
        expect({ x: after.x, y: after.y }).toEqual({ x: 600, y: 400 });
    });
});

// ---------------------------------------------------------------------------
// 3. FP-100 — the columns give way
// ---------------------------------------------------------------------------

describe('⭐ the flanking columns give way before the mat does (FP-100)', () => {
    it('keeps its full width on a wide window', () => {
        expect(columnWidthAt(2560, NOTIFICATION_COLUMN)).toBe(NOTIFICATION_COLUMN.max);
        expect(columnWidthAt(2560, TRAY_COLUMN)).toBe(TRAY_COLUMN.max);
    });

    it('⭐ gives the mat real width back at 1280, where the problem actually shows', () => {
        // Was a fixed 356 + 320 = 676 px of column at this width.
        const given = columnWidthAt(1280, NOTIFICATION_COLUMN) + columnWidthAt(1280, TRAY_COLUMN);
        expect(given).toBeLessThan(676);
        expect(676 - given).toBeGreaterThanOrEqual(100);
    });

    it('shrinks as the window does, and never below what its contents need', () => {
        let last = Infinity;
        for (const vw of [2560, 1920, 1440, 1280, 1024, 800, 600, 320]) {
            const w = columnWidthAt(vw, NOTIFICATION_COLUMN);
            expect(w).toBeLessThanOrEqual(last);
            last = w;
            // Toast's own min-width (220) plus the column's 32px inside gutter.
            expect(w).toBeGreaterThanOrEqual(252);
        }
        for (const vw of [2560, 1280, 600, 320]) {
            // The 128px Vault chest, its padding, the border and the gutter.
            expect(columnWidthAt(vw, TRAY_COLUMN)).toBeGreaterThanOrEqual(184);
        }
    });

    it('the CSS the column is actually given is built from the same spec', () => {
        expect(columnWidthCss(NOTIFICATION_COLUMN)).toBe('clamp(256px, 20vw, 356px)');
        expect(columnWidthCss(TRAY_COLUMN)).toBe('clamp(244px, 19vw, 340px)');
    });

    /**
     * ⭐ The guarantee that matters: whatever the columns do, the mat is fitted
     * to what is left over, so it can never reach under one of them. Narrower
     * columns only ever RAISE the fit.
     */
    it('⭐ giving the columns less only ever gives the mat a bigger fit, never an overflow', () => {
        const CHROME = 150 + 64;   // the nav, and the mat cell's own p-8
        let previous = 0;
        for (const vw of [800, 1024, 1280, 1440, 1920, 2560]) {
            const columns = columnWidthAt(vw, NOTIFICATION_COLUMN) + columnWidthAt(vw, TRAY_COLUMN) + 80;
            const matCell = Math.max(1, vw - columns - CHROME);
            const scale = fitScale(matCell, 900, matW(), matH());

            expect(scale).toBeGreaterThanOrEqual(previous);
            previous = scale;
            if (scale > MIN_BOARD_SCALE) expect(matW() * scale).toBeLessThanOrEqual(matCell + 0.5);
        }
    });
});
