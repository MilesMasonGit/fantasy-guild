import { MAP_MODE } from '../../hooks/useMapMode.js';

/**
 * The map mode's cursor over a Token, drawn in code as pixel art until the owner's art comes
 * (owner_art_list.md): an X in red for Demolish.
 * Each art pixel is drawn 2 × 2 with a 1-art-pixel black edge, so it reads on any ground.
 * `MatBoard` hands the cursor to the mat as `--map-mode-cursor`; `tailwind.css` puts it on the
 * Tokens' hit circles (`[data-map-mode] [data-token-hit]`).
 */

const GLYPHS = {
    [MAP_MODE.DEMOLISH]: [
        'xx.....xx',
        'xxx...xxx',
        '.xxx.xxx.',
        '..xxxxx..',
        '...xxx...',
        '..xxxxx..',
        '.xxx.xxx.',
        'xxx...xxx',
        'xx.....xx'
    ]
};

/** The colour of each mode's glyph: UI_STYLE's red. */
const COLOURS = {
    [MAP_MODE.DEMOLISH]: '#ff2d55'
};

const SCALE = 2;

/** The glyph's art pixels and its black edge (every clear pixel touching it edge to edge). */
export function cursorPixels(rows) {
    const h = rows.length + 2;
    const w = rows[0].length + 2;
    const on = (x, y) => rows[y - 1]?.[x - 1] === 'x';
    const fill = [];
    const edge = [];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (on(x, y)) fill.push([x, y]);
            else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) edge.push([x, y]);
        }
    }
    return { w, h, fill, edge };
}

function svgOf(rows, colour) {
    const { w, h, fill, edge } = cursorPixels(rows);
    const rect = (c) => ([x, y]) => `<rect x='${x * SCALE}' y='${y * SCALE}' width='${SCALE}' height='${SCALE}' fill='${c}'/>`;
    return `<svg xmlns='http://www.w3.org/2000/svg' width='${w * SCALE}' height='${h * SCALE}' shape-rendering='crispEdges'>`
        + edge.map(rect('#000')).join('') + fill.map(rect(colour)).join('') + '</svg>';
}

const cache = new Map();
const iconCache = new Map();

/** A mode's glyph as an image URL (the cursor's own picture), or null with no mode. */
export function mapModeIconSrc(mode) {
    const rows = GLYPHS[mode];
    if (!rows) return null;
    if (!iconCache.has(mode)) iconCache.set(mode, `data:image/svg+xml,${encodeURIComponent(svgOf(rows, COLOURS[mode]))}`);
    return iconCache.get(mode);
}

/** The glyph's drawn size in px, edge included (22 for the 9 × 9 glyphs). */
export function mapModeIconPx(mode) {
    const rows = GLYPHS[mode];
    return rows ? (rows.length + 2) * SCALE : 0;
}

/** The CSS `cursor` value for a mode (hot spot in the glyph's centre), or null with no mode. */
export function mapModeCursor(mode) {
    const src = mapModeIconSrc(mode);
    if (!src) return null;
    if (!cache.has(mode)) {
        const half = mapModeIconPx(mode) / 2;
        cache.set(mode, `url("${src}") ${half} ${half}, pointer`);
    }
    return cache.get(mode);
}
