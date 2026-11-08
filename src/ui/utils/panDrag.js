// a drag that pans, followed on the window so it keeps going wherever the pointer leaves to

/**
 * Follow the pointer that went down (`e`) until it lifts or is cancelled. Once it has travelled
 * `thresholdPx` (measured in the same units as `scale` gives), `onPan(dx, dy)` gets the travel
 * from where it went down, `dx` and `dy` divided by `scale`. `onEnd(moved)` says whether it ever
 * passed the threshold, so the click that ends a pan can be swallowed.
 */
export function panDrag(e, { thresholdPx, scale = 1, onPan, onEnd }) {
    const start = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    const move = (ev) => {
        if (ev.pointerId !== start.id) return;
        const dx = (ev.clientX - start.x) / scale;
        const dy = (ev.clientY - start.y) / scale;
        if (!start.moved && Math.hypot(dx, dy) < thresholdPx) return;
        start.moved = true;
        onPan(dx, dy);
    };
    const up = (ev) => {
        if (ev.pointerId !== start.id) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        onEnd(start.moved);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
}
