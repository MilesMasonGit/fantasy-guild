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

export default PixelGlyph;
