// A circle drawn as whole art pixels: a camp's reach ring.

/**
 * The cells of a one-pixel ring of radius `r` art pixels, by the midpoint circle algorithm: every
 * cell 8-connected to the next, never two thick. Cells are `[x, y]` around a centre cell `[0, 0]`.
 */
export function pixelRingCells(r) {
    const radius = Math.max(1, Math.round(r));
    const cells = new Set();
    const add = (x, y) => cells.add(`${x},${y}`);
    let x = radius;
    let y = 0;
    let err = 1 - radius;
    while (x >= y) {
        add(x, y); add(y, x); add(-y, x); add(-x, y);
        add(-x, -y); add(-y, -x); add(y, -x); add(x, -y);
        y++;
        if (err < 0) {
            err += 2 * y + 1;
        } else {
            x--;
            err += 2 * (y - x) + 1;
        }
    }
    return [...cells].map(k => k.split(',').map(Number));
}

/**
 * The ring as one SVG path in art-pixel units, a cell `[x, y]` covering `x..x+1, y..y+1`, so the
 * centre cell's middle is at (0.5, 0.5). Neighbouring cells in a row merge into one rectangle,
 * which keeps the path short: about four rectangles per art pixel of radius.
 */
export function pixelRingPath(r) {
    const rows = new Map();
    for (const [x, y] of pixelRingCells(r)) {
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push(x);
    }
    let d = '';
    for (const [y, xs] of rows) {
        xs.sort((a, b) => a - b);
        let start = xs[0];
        let prev = xs[0];
        for (let i = 1; i <= xs.length; i++) {
            if (i < xs.length && xs[i] === prev + 1) {
                prev = xs[i];
                continue;
            }
            const len = prev - start + 1;
            d += `M${start} ${y}h${len}v1h${-len}z`;
            if (i < xs.length) start = prev = xs[i];
        }
    }
    return d;
}
