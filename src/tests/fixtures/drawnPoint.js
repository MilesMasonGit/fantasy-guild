/**
 * Where an element is drawn, in its parent's units: the top-left corner of its
 * box, as `{ x, y }` (CR3-556).
 *
 * Mat Tokens, heroes and flags are placed with `left`/`top` today. R6's CR3-007
 * moves the walkers to a `transform` so a step costs no layout. Assertions that
 * read `style.left`/`style.top` directly would all go red on that change while
 * nothing a player sees had moved, so they read this instead, and this reads
 * both: `left`/`top`, plus any pixel `translate(…)`, `translate3d(…)`,
 * `translateX(…)` or `translateY(…)` in the element's own `transform`.
 *
 * A missing `left`/`top` with no translate reads as `NaN`, exactly as
 * `parseFloat(style.left)` did, so an element that is not positioned at all
 * still fails an equality check rather than passing as 0.
 */
export function drawnPoint(el) {
    const style = el.style;
    const t = translateOf(style.transform || '');
    const x = baseOf(style.left, t.hasX) + t.x;
    const y = baseOf(style.top, t.hasY) + t.y;
    return { x, y };
}

function baseOf(value, translated) {
    if (value === '' || value == null) return translated ? 0 : NaN;
    return parseFloat(value);
}

/** Sum every pixel translate in a transform string. Percent and other units are ignored. */
function translateOf(transform) {
    const out = { x: 0, y: 0, hasX: false, hasY: false };
    const px = (v) => {
        const m = /^\s*(-?\d*\.?\d+(?:e-?\d+)?)px\s*$/.exec(v ?? '');
        return m ? parseFloat(m[1]) : null;
    };
    for (const [, fn, args] of transform.matchAll(/(translate3d|translateX|translateY|translate)\(([^)]*)\)/g)) {
        const parts = args.split(',');
        if (fn === 'translateX') {
            const v = px(parts[0]);
            if (v !== null) { out.x += v; out.hasX = true; }
        } else if (fn === 'translateY') {
            const v = px(parts[0]);
            if (v !== null) { out.y += v; out.hasY = true; }
        } else {
            const vx = px(parts[0]);
            const vy = px(parts[1]);
            if (vx !== null) { out.x += vx; out.hasX = true; }
            if (vy !== null) { out.y += vy; out.hasY = true; }
        }
    }
    return out;
}
