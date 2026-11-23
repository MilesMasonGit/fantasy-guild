// The in-reach dot: the mark on each Token inside a reach ring.

/**
 * The owner's pick (look A, 2026-11-10): a small cream dot, seven art pixels across, with a dark
 * one-pixel edge and a white highlight pixel, over a black copy one art pixel down-right (the
 * hard shadow the problem mark and the ring use). `X` edge, `o` fill, `w` highlight.
 */
export const REACH_DOT = Object.freeze([
    '..XXX..',
    '.XoooX.',
    'XowoooX',
    'XoooooX',
    'XoooooX',
    '.XoooX.',
    '..XXX..'
]);

/** The dot's size in art pixels, and the cell that sits on the Token's centre. */
export const REACH_DOT_ART_PX = REACH_DOT.length;
export const REACH_DOT_MIDDLE = Math.floor(REACH_DOT_ART_PX / 2);

export const REACH_DOT_COLOUR = Object.freeze({ X: '#1c1a24', o: '#fff6dc', w: '#ffffff', shadow: '#000', halo: '#ffffff' });

/**
 * The dot's pulse as it comes into a growing ring: held poses in whole art pixels
 * (`fx/pixelSteps.js`), a hop up and back with the white halo lit for the first two frames. No
 * scaling: a scaled dot would be drawn soft.
 */
export const REACH_DOT_PULSE = Object.freeze([
    { ms: 60, y: -2 },
    { ms: 60, y: -1 }
]);
export const REACH_DOT_HALO = Object.freeze([{ ms: 120, visibility: 'visible' }]);

/** One SVG path in art-pixel units for the cells of `pattern` whose letter passes `keep`, moved by `off`. */
function cellsPath(pattern, keep, off = 0) {
    let d = '';
    pattern.forEach((row, y0) => {
        const y = y0 + off;
        let x = 0;
        while (x < row.length) {
            if (!keep(row[x])) { x++; continue; }
            let len = 1;
            while (x + len < row.length && keep(row[x + len])) len++;
            d += `M${x + off} ${y}h${len}v1h${-len}z`;
            x += len;
        }
    });
    return d;
}

/** The cells touching the dot's shape (side by side, not corner to corner), one art pixel out all round. */
function haloPattern(pattern) {
    const n = pattern.length + 2;
    const on = (x, y) => pattern[y]?.[x] !== undefined && pattern[y][x] !== '.';
    const rows = [];
    for (let y = 0; y < n; y++) {
        let row = '';
        for (let x = 0; x < n; x++) {
            const px = x - 1;
            const py = y - 1;
            const near = on(px - 1, py) || on(px + 1, py) || on(px, py - 1) || on(px, py + 1);
            row += !on(px, py) && near ? 'h' : '.';
        }
        rows.push(row);
    }
    return rows;
}

/**
 * The dot as paths, in art pixels from its top-left cell: its whole shape (for the shadow), each
 * colour, and the halo one art pixel outside it (the flash of its pulse in).
 */
export const REACH_DOT_PATHS = Object.freeze({
    halo: cellsPath(haloPattern(REACH_DOT), ch => ch === 'h', -1),
    shape: cellsPath(REACH_DOT, ch => ch !== '.'),
    X: cellsPath(REACH_DOT, ch => ch === 'X'),
    o: cellsPath(REACH_DOT, ch => ch === 'o'),
    w: cellsPath(REACH_DOT, ch => ch === 'w')
});

/**
 * The art-pixel grid cell a mat point falls in, as the mat units of its top-left corner: how the
 * ring and the dots land on whole screen pixels through the mat's zoom.
 */
export const snapToArt = (v, artScale) => Math.round(v / artScale - 0.5) * artScale;
