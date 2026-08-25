import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { BOARD_PX } from '../../config/boardGeometry.js';

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
 * ## Why a transform rather than recomputing the tile size
 * `TILE_PX` is `ART_PX × 2` because Token art is 64px shown at exactly 2×
 * (D-216). Recomputing it from the available space breaks that integer ratio
 * and makes every sprite blurry. A CSS transform leaves every layout decision,
 * every constant and every stored coordinate in the 944px space untouched.
 *
 * ## Drop targeting comes along for free — mostly
 * `getBoundingClientRect()` reports the *transformed* box, and dnd-kit measures
 * its droppables that way, so tiles keep accepting drops exactly where they are
 * drawn. The one thing that does NOT come free is code converting a screen
 * pointer position back into board coordinates: that has to divide by `scale`,
 * because it is writing a number into the untransformed 944px space. There is
 * one such place, the free-floating Map position in `Board.jsx`.
 *
 * @returns {{ ref: Function, scale: number, size: number }}
 *   `ref` goes on the element whose space the board should fit inside; `scale`
 *   is the factor to transform by; `size` is the footprint to reserve, so
 *   surrounding layout sees the board's real on-screen size.
 */
export function useBoardScale() {
    const [scale, setScale] = useState(1);
    const nodeRef = useRef(null);
    const observerRef = useRef(null);

    const measure = useCallback((el) => {
        if (!el) return;
        // `clientWidth/Height` excludes the element's own border and
        // scrollbars, which is the space the board actually gets.
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (!w || !h) return;
        const next = Math.max(
            MIN_BOARD_SCALE,
            Math.min(1, w / BOARD_PX, h / BOARD_PX)
        );
        // Round to whole percent so a one-pixel resize does not re-render the
        // whole board, and so the value is stable enough to compare.
        const rounded = Math.round(next * 100) / 100;
        setScale(prev => (prev === rounded ? prev : rounded));
    }, []);

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

    return { ref, scale, size: Math.round(BOARD_PX * scale) };
}

export default useBoardScale;
