import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * A degenerate-case guard, NOT a legibility floor.
 *
 * It is tempting to stop shrinking at 0.5, where Tokens are drawn at their
 * native 64px art size and stay perfectly crisp. Resist it: a floor means the
 * board can still be wider than the space it was given, and the part that
 * sticks out lands under the Tray — whose drop surface deliberately outranks
 * the board's, so Tokens dropped there are silently deposited in the Tray
 * chest instead. A board that is too small to read is a visible problem the
 * player can react to; a board that quietly eats drops is not. So the only
 * floor here is the one that stops a zero-width container producing a
 * zero-size board.
 *
 * Legibility on genuinely small windows is "small mode" — separate, later
 * work, which will win the board more room by shrinking the columns beside it
 * rather than by refusing to shrink the board.
 */
export const MIN_BOARD_SCALE = 0.1;

/**
 * How much the board scales to fit the space it has been given.
 *
 * The playmat is a fixed 944×944 (7 tiles of 128px plus six 8px gaps) and used
 * to be rendered at that size unconditionally. On any window shorter or
 * narrower than that plus its chrome, part of the board went off-screen or slid
 * under the Tray — and the covered tiles did not merely look wrong, they
 * stopped accepting drops, because the Tray's drop surface deliberately ranks
 * above the board's where the two overlap. The player got a plausible-looking
 * wrong outcome instead of an error (CR2-179).
 *
 * The owner's ruling is that everything scales: the sprites are authored to be
 * shown at double size on a big monitor, so halving them still reads. So rather
 * than a minimum window size or smaller tiles, the whole board is drawn at its
 * natural size and then transformed to fit.
 *
 * ## Why a transform rather than recomputing the Token size
 * `TOKEN_PX` is `ART_PX × 2` because Token art is 64px shown at exactly 2×
 * (D-216). Recomputing it from the available space breaks that integer ratio
 * and makes every sprite blurry. A CSS transform leaves every layout decision,
 * every constant and every stored coordinate in the natural space untouched.
 *
 * ## Drop targeting comes along for free — mostly
 * `getBoundingClientRect()` reports the *transformed* box, and dnd-kit measures
 * its droppables that way, so tiles keep accepting drops exactly where they are
 * drawn. The one thing that does NOT come free is code converting a screen
 * pointer position back into board coordinates: that has to divide by `scale`,
 * because it is writing a number into the untransformed 944px space. There is
 * one such place, the free-floating Map position in `Board.jsx`.
 *
 * ## Two boards, two natural sizes
 * The Guild Hall upgrade board is its own 7×7 surface and is a different number
 * of pixels wide from the playmat, so every caller passes its own `naturalPx` —
 * the mat passes its live size (`useMatSize`, slice 1.6d-3), the upgrade board
 * `UPGRADE_BOARD_PX`. There is no default: the old one was the deleted grid's
 * `BOARD_PX` (slice 1.6d-2).
 *
 * ⚠️ The mat's natural size is no longer fixed — the Mat Tuner can change it
 * while the game runs — so this hook re-measures when `naturalPx` changes. How
 * big the mat is in mat units and how much it is shrunk on screen stay two
 * separate questions.
 *
 * @param {number} [naturalPx] The board's untransformed size in pixels.
 * @returns {{ ref: Function, scale: number, size: number }}
 *   `ref` goes on the element whose space the board should fit inside; `scale`
 *   is the factor to transform by; `size` is the footprint to reserve, so
 *   surrounding layout sees the board's real on-screen size.
 */
/**
 * How much a `natW × natH` board must shrink to fit `w × h` of space.
 *
 * **Shrink-only** (never past 1: the art is authored for 2×, and blowing it up
 * would only blur it) and **two-axis** — the free playmat is 1760 × 1126, so the
 * height is as likely to be the binding constraint as the width. Rounded to
 * whole percent so a one-pixel resize does not re-render the whole board.
 *
 * Pure, so the fit can be tested without a DOM.
 */
export function fitScale(w, h, natW, natH = natW) {
    if (!w || !h || !natW || !natH) return null;
    const next = Math.max(MIN_BOARD_SCALE, Math.min(1, w / natW, h / natH));
    return Math.round(next * 100) / 100;
}

export function useBoardScale(naturalPx, naturalH = naturalPx) {
    const [scale, setScale] = useState(1);
    const nodeRef = useRef(null);
    const observerRef = useRef(null);

    const measure = useCallback((el) => {
        if (!el) return;
        // `clientWidth/Height` excludes the element's own border and
        // scrollbars, which is the space the board actually gets.
        const rounded = fitScale(el.clientWidth, el.clientHeight, naturalPx, naturalH);
        if (rounded == null) return;
        setScale(prev => (prev === rounded ? prev : rounded));
    }, [naturalPx, naturalH]);

    const ref = useCallback((el) => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        nodeRef.current = el;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => measure(el));
        ro.observe(el);
        observerRef.current = ro;
        measure(el);
    }, [measure]);

    // Belt and braces alongside the ResizeObserver. The observer is the precise
    // one — it catches a column opening or closing, which never touches the
    // window — but it is also the one that can be starved in an environment
    // that is not painting frames. A plain resize listener costs nothing and
    // guarantees the common case (the player dragging the window edge) is
    // never missed.
    useLayoutEffect(() => {
        const onResize = () => measure(nodeRef.current);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            observerRef.current?.disconnect();
        };
    }, [measure]);

    // `size` is the width (a square board's only side); `height` is for a board
    // that is not square — the free playmat (1760 × 1126 u, slice 1.6c).
    return { ref, scale, size: Math.round(naturalPx * scale), height: Math.round(naturalH * scale) };
}

export default useBoardScale;
