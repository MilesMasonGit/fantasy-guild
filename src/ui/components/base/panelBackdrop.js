// The coloured pixel backdrop behind every full panel: hard bands from a tint at the top down to
// the frames' own dark fill, with a dithered edge between bands. One static picture per colour.

/** The frames' fill colour (the centre pixel of `u_frame_studs.png` and `u_frame_chamfer.png`). */
export const PANEL_BASE = '#0d0a08';

/**
 * Each full panel's colour, starting from its nav bubble's. Changing a colour here changes that
 * panel everywhere. Panels with no bubble take a colour of their own, apart from their neighbours.
 */
export const PANEL_TONES = Object.freeze({
    bank: '#eab308',      // gold, the Bank bubble
    shop: '#22c55e',      // green, the Shop bubble
    world: '#3b82f6',     // blue, the Atlas bubble: the Atlas and world map panels
    settings: '#ef4444',  // red, the Settings bubble
    hall: '#a855f7',      // purple, the Guild Hall bubble: the star panel
    hero: '#14b8a6',      // teal: the hero sheet, beside the gold Bank
    fight: '#f97316',     // rust: the fight windows
    away: '#6366f1'       // indigo: the away summary
});

/**
 * How much of the tone each band carries, top to bottom; the rest is the base. The top band is
 * the brightest and stays dark enough for white and gold text.
 */
export const BAND_MIX = Object.freeze([0.26, 0.215, 0.175, 0.14, 0.11, 0.085]);

/** One art pixel in screen px (the frames draw at 2×), so the dither's squares match the frame's. */
const ART_PX = 2;

const hexToRgb = (hex) => {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** The tone mixed into the base at `share` (0-1), as a hex colour. */
export function mixTone(tone, share, base = PANEL_BASE) {
    const a = hexToRgb(tone);
    const b = hexToRgb(base);
    return toHex(a.map((v, i) => v * share + b[i] * (1 - share)));
}

/** The band colours for a tone, top to bottom. */
export function bandColours(tone) {
    return BAND_MIX.map(share => mixTone(tone, share));
}

/**
 * The backdrop picture: an SVG with no viewBox, so it draws at the panel's own size in screen
 * pixels. The bands split the height evenly; above each band's top edge, two dithered rows of
 * the lower band's colour (a quarter, then half the pixels) step into the band above.
 */
export function backdropSvg(tone) {
    const colours = bandColours(tone);
    const n = colours.length;
    const p = ART_PX;
    const pct = (k) => `${((k / n) * 100).toFixed(4)}%`;
    const defs = [];
    const body = [`<rect width='100%' height='100%' fill='${colours[n - 1]}'/>`];
    colours.forEach((c, k) => {
        body.push(`<rect y='${pct(k)}' width='100%' height='${pct(1)}' fill='${c}'/>`);
    });
    for (let k = 1; k < n; k++) {
        const c = colours[k];
        // Half: a checker of 1-art-pixel squares. Quarter: one square in four.
        defs.push(`<pattern id='h${k}' width='${2 * p}' height='${2 * p}' patternUnits='userSpaceOnUse'><rect width='${p}' height='${p}' fill='${c}'/><rect x='${p}' y='${p}' width='${p}' height='${p}' fill='${c}'/></pattern>`);
        defs.push(`<pattern id='q${k}' width='${2 * p}' height='${2 * p}' patternUnits='userSpaceOnUse'><rect width='${p}' height='${p}' fill='${c}'/></pattern>`);
        body.push(`<svg y='${pct(k)}' overflow='visible'><rect y='${-4 * p}' width='100%' height='${2 * p}' fill='url(#q${k})'/><rect y='${-2 * p}' width='100%' height='${2 * p}' fill='url(#h${k})'/></svg>`);
    }
    return `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' shape-rendering='crispEdges'><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
}

const cache = new Map();

/**
 * The style that paints a panel's backdrop: built once per tone and kept, so a panel opening or
 * redrawing never builds it again. Unknown tones give null (no backdrop).
 */
export function panelBackdropStyle(toneName) {
    const tone = PANEL_TONES[toneName];
    if (!tone) return null;
    if (!cache.has(toneName)) {
        const svg = backdropSvg(tone).replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E');
        cache.set(toneName, Object.freeze({
            backgroundImage: `url("data:image/svg+xml,${svg}")`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated'
        }));
    }
    return cache.get(toneName);
}
