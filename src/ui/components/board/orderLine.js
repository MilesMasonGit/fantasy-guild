// The marching dashed line from a carried hero to where they would be sent, in whole art pixels.

/** A dash and the gap after it, in art pixels. */
export const DASH_PX = 3;
export const GAP_PX = 3;

/** How fast the dashes march from the hero towards the flag, in art pixels a second. */
export const MARCH_PX_PER_S = 12;

/**
 * The cells of a one-pixel line from cell `a` to cell `b` (Bresenham): every cell 8-connected to
 * the next, `a` first.
 */
export function lineCells(a, b) {
    const out = [];
    let x = a.x;
    let y = a.y;
    const dx = Math.abs(b.x - x);
    const dy = -Math.abs(b.y - y);
    const sx = x < b.x ? 1 : -1;
    const sy = y < b.y ? 1 : -1;
    let err = dx + dy;
    for (;;) {
        out.push([x, y]);
        if (x === b.x && y === b.y) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
    }
    return out;
}

/**
 * The dashed line as one SVG path in art-pixel units (a cell `[x, y]` covers `x..x+1, y..y+1`).
 * `phase` (art pixels marched so far) shifts the dashes away from the start, so a growing phase
 * marches them towards `b`. A dash's cells in one row merge into one rectangle.
 * @param {{x:number,y:number}} a the start cell (the hero)
 * @param {{x:number,y:number}} b the end cell (the flag)
 * @param {number} phase
 */
export function dashedLinePath(a, b, phase = 0) {
    const period = DASH_PX + GAP_PX;
    const shift = ((Math.floor(phase) % period) + period) % period;
    const cells = lineCells(a, b);
    let d = '';
    let run = null;
    const flush = () => {
        if (run) d += `M${run.x} ${run.y}h${run.len}v1h${-run.len}z`;
        run = null;
    };
    for (let i = 0; i < cells.length; i++) {
        const on = ((i - shift) % period + period) % period < DASH_PX;
        if (!on) { flush(); continue; }
        const [x, y] = cells[i];
        if (run && run.y === y && x === run.x + run.len) { run.len++; continue; }
        if (run && run.y === y && x === run.x - 1) { run.x--; run.len++; continue; }
        flush();
        run = { x, y, len: 1 };
    }
    flush();
    return d;
}
