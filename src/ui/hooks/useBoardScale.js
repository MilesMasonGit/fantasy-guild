import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * A degenerate-case guard, NOT a legibility floor.
 * Do not raise it to stop shrinking at 0.5: a floor means the board can still be wider than
 * the space it was given, and the part that sticks out lands under an overlapping drop surface
 * (a drawer) that outranks the board's, so drops there silently go to the wrong place. A board
 * too small to read is a visible problem the player can react to; a board that quietly eats
 * drops is not. The only floor here is the one that stops a zero-width container producing a
 * zero-size board.
 */
export const MIN_BOARD_SCALE = 0.1;

/**
 * How much the board scales to fit the space it has been given.
 * The board is drawn at its natural size and then CSS-transformed to fit, rather than
 * recomputing Token sizes: sprite sizes are a whole multiple of `ART_PX`, and recomputing from
 * the available space would break that ratio and blur every sprite. A transform leaves every
 * layout decision, constant and stored coordinate in the natural space untouched.
 * Drop targeting comes along for free, mostly: `getBoundingClientRect()` reports the
 * transformed box and dnd-kit measures its droppables that way. Code converting a screen
 * pointer position back into board coordinates must divide by `scale`.
 * Two boards, two natural sizes: the Guild Hall upgrade web is a different size from the
 * playmat, so every caller passes its own natural size (the mat its live size via
 * `useMatSize`, the web its `WEB_W × WEB_H`). There is no default.
 * ⚠️ The mat's natural size is not fixed (the Mat Tuner can change it while the game runs), so
 * this hook re-measures when `naturalPx` changes. How big the mat is in mat units and how much
 * it is shrunk on screen are two separate questions.
 * @param {number} [naturalPx] The board's untransformed size in pixels.
 * @returns {{ ref: Function, scale: number, size: number }} `ref` goes on the element whose
 * space the board should fit inside; `scale` is the factor to transform by; `size` is the
 * footprint to reserve, so surrounding layout sees the board's real on-screen size.
 */
/**
 * How much a `natW × natH` board must shrink (or grow) to fit `w × h` of space.
 * Two-axis: the free playmat is 1760 × 1126, so the height is as likely to be the binding
 * constraint as the width. Rounded to whole percent so a one-pixel resize does not re-render
 * the whole board.
 * It grows as well as shrinks: sprites are drawn at a whole multiple of `ART_PX` chosen from
 * this very number (`boardScaleAt`, `TokenSprite`), so growing the mat steps the art up to 3×
 * and 4× rather than blurring it.
 * The 0.1 floor below is a different thing and stays.
 * Pure, so the fit can be tested without a DOM.
 */
export function fitScale(w, h, natW, natH = natW) {
    if (!w || !h || !natW || !natH) return null;
    /**
     * ⚠️ Rounded DOWN to whole percent, never to nearest.
     * Rounding up makes the mat wider than the box it was measured against (a 400px box fits
     * at 0.2272, rounds to 0.23 and draws 404.8px of mat), and the overhang lands under an
     * overlapping drop surface that outranks the board's. Flooring costs at most 1% of the fit
     * and makes 'the mat never reaches under a column' true by construction; it is also why
     * the floor below may not be raised.
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

    // `size` is the width (a square board's only side); `height` is for a board that is not
    // square, like the free playmat (1760 × 1126 u).
    return { ref, scale, size: Math.round(naturalPx * scale), height: Math.round(naturalH * scale) };
}

export default useBoardScale;
