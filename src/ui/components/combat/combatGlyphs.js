/**
 * The combat screen's small icons, drawn in code until the owner draws them
 * (`docs/active/owner_art_list.md`, "Combat screen"): 8 × 8, `#` a lit pixel, shown at 2×. Each
 * becomes one picture (`glyphSrc`), so a float or a log line draws it as a single `<img>`.
 */
export const COMBAT_GLYPHS = Object.freeze({
    fight: [
        '#......#',
        '.#....#.',
        '..#..#..',
        '...##...',
        '...##...',
        '.##..##.',
        '.#....#.',
        '#......#'
    ],
    hit: [
        '#..#..#.',
        '.#.#.#..',
        '..###...',
        '#######.',
        '..###...',
        '.#.#.#..',
        '#..#..#.',
        '........'
    ],
    shield: [
        '.######.',
        '.######.',
        '.######.',
        '.######.',
        '..####..',
        '..####..',
        '...##...',
        '........'
    ],
    heart: [
        '........',
        '.##.##..',
        '#######.',
        '#######.',
        '.#####..',
        '..###...',
        '...#....',
        '........'
    ],
    drop: [
        '...#....',
        '...#....',
        '..###...',
        '.#####..',
        '.#####..',
        '.#####..',
        '..###...',
        '........'
    ],
    flame: [
        '...#....',
        '..##....',
        '..###.#.',
        '.#####..',
        '.######.',
        '.######.',
        '..####..',
        '........'
    ],
    star: [
        '...#....',
        '...#....',
        '#######.',
        '.#####..',
        '..###...',
        '.##.##..',
        '.#...#..',
        '........'
    ],
    miss: [
        '........',
        '........',
        '........',
        '.######.',
        '........',
        '........',
        '........',
        '........'
    ],
    potion: [
        '..###...',
        '...#....',
        '..###...',
        '.#####..',
        '.#####..',
        '.#####..',
        '..###...',
        '........'
    ],
    bag: [
        '..###...',
        '...#....',
        '.#####..',
        '#######.',
        '#######.',
        '#######.',
        '.#####..',
        '........'
    ],
    down: [
        '........',
        '........',
        '#######.',
        '.#####..',
        '..###...',
        '...#....',
        '........',
        '........'
    ],
    clock: [
        '..####..',
        '.#....#.',
        '#..#...#',
        '#..#...#',
        '#..###.#',
        '#......#',
        '.#....#.',
        '..####..'
    ]
});

/** The kit colours as plain values: a picture cannot read a CSS variable. */
export const GLYPH_COLOUR = Object.freeze({
    white: '#ffffff', red: '#ff2d55', green: '#09b554', gold: '#fbbf24', muted: '#737373', text: '#e5e5e5'
});

const cache = new Map();

/**
 * A glyph as an SVG picture in `colour`; `outlined` adds a one-pixel black ring around its lit
 * pixels (a 10 × 10 picture), so a bare glyph reads on the grass with no filter.
 */
export function glyphSrc(name, colour = GLYPH_COLOUR.white, outlined = false) {
    const key = `${name}|${colour}|${outlined}`;
    if (cache.has(key)) return cache.get(key);
    const rows = COMBAT_GLYPHS[name] || [];
    const pad = outlined ? 1 : 0;
    const lit = new Set();
    rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') lit.add(`${x + pad},${y + pad}`); }));
    let ring = '';
    if (outlined) {
        const seen = new Set();
        for (const p of lit) {
            const [x, y] = p.split(',').map(Number);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const q = `${x + dx},${y + dy}`;
                    if (!lit.has(q) && !seen.has(q)) { seen.add(q); ring += `M${x + dx} ${y + dy}h1v1h-1z`; }
                }
            }
        }
    }
    let body = '';
    for (const p of lit) { const [x, y] = p.split(','); body += `M${x} ${y}h1v1h-1z`; }
    const n = 8 + 2 * pad;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${n}' height='${n}' shape-rendering='crispEdges'>`
        + (ring ? `<path fill='#000' d='${ring}'/>` : '') + `<path fill='${colour}' d='${body}'/></svg>`;
    const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    cache.set(key, uri);
    return uri;
}
