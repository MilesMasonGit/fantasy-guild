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
 * The Guild Hall upgrade web is its own drawing and a different size from the
 * playmat, so every caller passes its own natural size — the mat passes its
 * live size (`useMatSize`, slice 1.6d-3), the upgrade web its `WEB_W × WEB_H`
 * (B9; it was the 7×7 grid's `UPGRADE_BOARD_PX` until then). There is no
 * default: the old one was the deleted grid's `BOARD_PX` (slice 1.6d-2).
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
 * **Two-axis** — the free playmat is 1760 × 1126, so the height is as likely to
 * be the binding constraint as the width. Rounded to whole percent so a
 * one-pixel resize does not re-render the whole board.
 *
 * ## ⭐ It grows as well as shrinks (FP-99)
 * This used to be capped at 1, on the reasoning that the art is authored for 2×
 * and blowing it up would only blur it. That cost the mat every pixel of a large
 * monitor beyond its natural size, and the premise no longer holds: the sprites
 * are now drawn at a whole multiple of `ART_PX` chosen from this very number
 * (`boardScaleAt`, `TokenSprite`), so growing the mat steps the art up to 3× and
 * 4× rather than blurring it. The mat now always fills the space it is given.
 *
 * The 0.1 floor below is a different thing entirely and stays.
 *
 * Pure, so the fit can be tested without a DOM.
 */
export function fitScale(w, h, natW, natH = natW) {
    if (!w || !h || !natW || !natH) return null;
    /**
     * ⚠️ **Rounded DOWN to whole percent, never to nearest.**
     *
     * Rounding to nearest could round *up*, and a fit that rounds up makes the
     * mat wider than the box it was measured against — a 400px box fits at
     * 0.2272…, rounds to 0.23, and draws 404.8px of mat. Those 4.8px land under
     * the Tray, whose drop surface outranks the board's, so a Token let go there
     * is silently deposited in the Vault chest instead (CR2-179, and the reason
     * the floor below may not be raised). Flooring costs at most 1% of the fit
     * and makes "the mat never reaches under a column" true by construction
     * rather than by luck (FP-100).
     */
    const stepped = Math.floor(Math.min(w / natW, h / natH) * 100) / 100;
    return Math.max(MIN_BOARD_SCALE, stepped);
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
