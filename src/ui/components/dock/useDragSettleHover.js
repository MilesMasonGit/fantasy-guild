import { useCallback, useEffect, useRef, useState } from 'react';

/** How long after a drag ends a hovered hero in the bar or the hero column stays down (the reorder animation). */
export const DRAG_SETTLE_MS = 320;

/**
 * A hero figure's hover, and whether a drag has just ended (`settling`): no hover lift for
 * `DRAG_SETTLE_MS` after a drag ends.
 * Only a hovered figure is held down, so a drag's end sets no state on the rest of them; a figure
 * first hovered within the window is held down for what is left of it.
 * @param {boolean} dragging whether anything is in the hand (`useActiveDrag`)
 */
export function useDragSettleHover(dragging) {
    const [isHovered, setIsHovered] = useState(false);
    const [settling, setSettling] = useState(false);
    const prevDraggingRef = useRef(dragging);
    const hoveredRef = useRef(false);
    const endedAtRef = useRef(-Infinity);
    const timerRef = useRef(null);

    const settleFor = useCallback((ms) => {
        setSettling(true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setSettling(false), ms);
    }, []);

    useEffect(() => {
        const ended = prevDraggingRef.current && !dragging;
        prevDraggingRef.current = dragging;
        if (!ended) return;
        endedAtRef.current = performance.now();
        if (hoveredRef.current) settleFor(DRAG_SETTLE_MS);
    }, [dragging, settleFor]);
    useEffect(() => () => clearTimeout(timerRef.current), []);

    const onHoverChange = useCallback((on) => {
        hoveredRef.current = on;
        setIsHovered(on);
        const left = endedAtRef.current + DRAG_SETTLE_MS - performance.now();
        if (on && left > 0) settleFor(left);
    }, [settleFor]);

    return { isHovered, settling, onHoverChange };
}
