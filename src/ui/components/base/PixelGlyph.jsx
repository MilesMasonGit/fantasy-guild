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

export const GLYPH_ART_PX = 8;

/** One glyph, `scale` screen pixels per art pixel (whole numbers only). */
export const PixelGlyph = ({ name, scale = 2, className, style, ...rest }) => {
    const rows = GLYPHS[name];
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
