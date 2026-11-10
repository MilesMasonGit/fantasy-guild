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

export const REACH_DOT_COLOUR = Object.freeze({ X: '#1c1a24', o: '#fff6dc', w: '#ffffff', shadow: '#000' });

/** One SVG path in art-pixel units for the cells of `pattern` whose letter passes `keep`. */
function cellsPath(pattern, keep) {
    let d = '';
    pattern.forEach((row, y) => {
        let x = 0;
        while (x < row.length) {
            if (!keep(row[x])) { x++; continue; }
            let len = 1;
            while (x + len < row.length && keep(row[x + len])) len++;
            d += `M${x} ${y}h${len}v1h${-len}z`;
            x += len;
        }
    });
    return d;
}

/** The dot as paths, in art pixels from its top-left cell: its whole shape (for the shadow) and each colour. */
export const REACH_DOT_PATHS = Object.freeze({
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
