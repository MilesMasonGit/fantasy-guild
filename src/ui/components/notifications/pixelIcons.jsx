/**
 * The item stub's two icons, drawn in code as whole art pixels at 2x: placeholders until the owner
 * draws a pin and a reset sprite (owner_art_list.md).
 */

const ART_PX = 2;

const PIN = [
    '..####..',
    '..####..',
    '..####..',
    '.######.',
    '########',
    '...##...',
    '...##...',
    '...#....'
];

const RESET = [
    '..####.#',
    '.#....##',
    '#....###',
    '#.......',
    '#.......',
    '#......#',
    '.#....#.',
    '..####..'
];

const Glyph = ({ rows, label }) => (
    <svg
        width={rows[0].length * ART_PX}
        height={rows.length * ART_PX}
        viewBox={`0 0 ${rows[0].length} ${rows.length}`}
        shapeRendering="crispEdges"
        aria-label={label}
        role="img"
        className="block"
    >
        {rows.flatMap((row, y) => [...row].map((c, x) => (c === '#'
            ? <rect key={`${x}_${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
            : null)))}
    </svg>
);

export const PinGlyph = () => <Glyph rows={PIN} label="Pin" />;
export const ResetGlyph = () => <Glyph rows={RESET} label="Reset" />;
