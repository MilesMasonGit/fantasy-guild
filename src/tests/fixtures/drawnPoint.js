/**
 * Where an element is drawn, in its parent's units: the top-left corner of its
 * box, as `{ x, y }`.
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
