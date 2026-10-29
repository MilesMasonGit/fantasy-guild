/**
 * Small pixel icons drawn in code: placeholders until the owner draws the sprites
 * (`docs/active/owner_art_list.md`, "Small UI icons"). Each is an 8×8 bitmap, `#` a lit pixel,
 * drawn as square cells at a whole-pixel scale in the text colour, so it stays crisp.
 */
export const GLYPHS = Object.freeze({
    clock: [
        '..####..',
        '.#....#.',
        '#..#...#',
        '#..#...#',
        '#..###.#',
        '#......#',
        '.#....#.',
        '..####..'
    ],
    charges: [
        '....##..',
        '...##...',
        '..##....',
        '.######.',
        '....##..',
        '...##...',
        '..##....',
        '........'
    ],
    regrow: [
        '..###.#.',
        '.#...##.',
        '#...###.',
        '#.......',
        '#......#',
        '.#....#.',
        '..####..',
        '........'
    ],
    spawn: [
        '..#.....',
        '.###....',
        '..#.....',
        '....##..',
        '...####.',
        '...####.',
        '....##..',
        '........'
    ],
    grow: [
        '.##..##.',
        '#..##..#',
        '.#.##.#.',
        '...##...',
        '...##...',
        '...##...',
        '.######.',
        '........'
    ],
    reach: [
        '..####..',
        '.#....#.',
        '#......#',
        '#..##..#',
        '#..##..#',
        '#......#',
        '.#....#.',
        '..####..'
    ],
    turn: [
        '.####...',
        '#....#..',
        '#...###.',
        '#....#..',
        '..#....#',
        '.###...#',
        '..#....#',
        '...####.'
    ],
    // The job marker's pixel look: a pennant on a pole (pole in column 1, its foot the bottom row).
    flag: [
        '.#......',
        '.###....',
        '.#####..',
        '.#######',
        '.#####..',
        '.###....',
        '.#......',
        '.#......'
    ]
});

/**
 * The hero loadout slots' kind marks, one per equip category (`equipmentCategories.js`), keyed
 * `slot_<category>`; `slot_unknown` stands in for a category with no mark yet. Placeholders too.
 */
export const SLOT_GLYPHS = Object.freeze({
    slot_hand: [
        '...#.#..',
        '.#.#.#..',
        '.#.#.#.#',
        '.#######',
        '.######.',
        '.######.',
        '..####..',
        '...###..'
    ],
    slot_hat: [
        '........',
        '..####..',
        '..####..',
        '..####..',
        '..####..',
        '########',
        '########',
        '........'
    ],
    slot_chest: [
        '.##..##.',
        '########',
        '########',
        '.######.',
        '..####..',
        '..####..',
        '..####..',
        '..####..'
    ],
    slot_trinket: [
        '...##...',
        '..#..#..',
        '...##...',
        '.##..##.',
        '#......#',
        '#......#',
        '.#....#.',
        '..####..'
    ],
    slot_food: [
        '....###.',
        '...#####',
        '...#####',
        '..#####.',
        '.###....',
        '.##.....',
        '#.#.....',
        '.#......'
    ],
    slot_drink: [
        '.#####..',
        '.#...###',
        '.#...#.#',
        '.#...#.#',
        '.#...###',
        '.#...#..',
        '.#####..',
        '........'
    ],
    slot_consumable: [
        '...##...',
        '...##...',
        '..####..',
        '.#....#.',
        '#......#',
        '#.####.#',
        '#.####.#',
        '.######.'
    ],
    slot_unknown: [
        '..####..',
        '.#....#.',
        '......#.',
        '....##..',
        '...#....',
        '...#....',
        '........',
        '...#....'
    ]
});

/** The kind mark for an equip category: its own, or the stand-in when it has none. */
export function slotGlyphName(category) {
    const name = `slot_${category}`;
    return SLOT_GLYPHS[name] ? name : 'slot_unknown';
}

export const GLYPH_ART_PX = 8;

/** One glyph, `scale` screen pixels per art pixel (whole numbers only). */
export const PixelGlyph = ({ name, scale = 2, className, style, ...rest }) => {
    const rows = GLYPHS[name] || SLOT_GLYPHS[name];
    if (!rows) return null;
    const cells = [];
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            if (row[x] === '#') cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
        }
    });
    const px = GLYPH_ART_PX * scale;
    return (
        <svg
            data-glyph={name}
            width={px}
            height={px}
            viewBox={`0 0 ${GLYPH_ART_PX} ${GLYPH_ART_PX}`}
            shapeRendering="crispEdges"
            fill="currentColor"
            aria-hidden="true"
            className={className}
            style={{ flexShrink: 0, ...style }}
            {...rest}
        >
            {cells}
        </svg>
    );
};

/** Whether art cell (x, y) of a glyph is lit. */
const lit = (rows, x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] === '#';

/**
 * The cells of the ring `n` cells out round a glyph's lit cells (8-way), on a grid padded by
 * `pad` cells on every side: ring 1 is the glyph's outline, ring 2 the line round that.
 */
export function glyphRing(rows, ring, pad) {
    const size = GLYPH_ART_PX + 2 * pad;
    const dist = (x, y) => {
        let best = Infinity;
        for (let gy = 0; gy < GLYPH_ART_PX; gy++) {
            for (let gx = 0; gx < GLYPH_ART_PX; gx++) {
                if (lit(rows, gx, gy)) best = Math.min(best, Math.max(Math.abs(gx - x), Math.abs(gy - y)));
            }
        }
        return best;
    };
    const out = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (dist(x - pad, y - pad) === ring) out.push([x, y]);
        }
    }
    return out;
}

const ringCache = new Map();
function ringOf(name, rows, ring, pad) {
    const key = `${name}|${ring}|${pad}`;
    if (!ringCache.has(key)) ringCache.set(key, glyphRing(rows, ring, pad));
    return ringCache.get(key);
}

/**
 * One glyph with a hard one-cell outline, for drawing on the mat's ground: the glyph in `fill`,
 * its outline in `edge`, and a second line round that in `halo` when given (the white hover line;
 * its room is always kept, so the box never moves). `px` is the whole box's size; the art is
 * 8 cells plus 2 on each side.
 */
export const OutlinedGlyph = ({ name, px, fill, edge, halo = null, className, style, ...rest }) => {
    const rows = GLYPHS[name] || SLOT_GLYPHS[name];
    if (!rows) return null;
    const pad = 2;
    const size = GLYPH_ART_PX + 2 * pad;
    const cell = ([x, y], colour) => <rect key={`${colour}-${x}-${y}`} x={x} y={y} width={1} height={1} fill={colour} />;
    const cells = [];
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === '#') cells.push(cell([x + pad, y + pad], fill));
    });
    return (
        <svg
            data-glyph={name}
            width={px}
            height={px}
            viewBox={`0 0 ${size} ${size}`}
            shapeRendering="crispEdges"
            aria-hidden="true"
            className={className}
            style={{ flexShrink: 0, display: 'block', ...style }}
            {...rest}
        >
            {halo && ringOf(name, rows, 2, pad).map(p => cell(p, halo))}
            {ringOf(name, rows, 1, pad).map(p => cell(p, edge))}
            {cells}
        </svg>
    );
};

export default PixelGlyph;
