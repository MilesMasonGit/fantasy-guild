/**
 * The art bake's colour maths, per opaque RGB colour: the browser's
 * `filter: brightness(b) saturate(s)` in sRGB. Brightness multiplies each
 * channel; saturate is the W3C luminance-preserving colour matrix. A colour
 * whose brightest channel is at or below `outline` is returned unchanged.
 *
 * ⚠️ The only copy of this maths: the art script (`scripts/artBrighten.mjs`)
 * and the Studio's palette brightening both call it, so palettes and sprites
 * can never drift apart. Changing it changes what a re-run of the bake does.
 */

/** A colour whose brightest channel (0–255) is at or below this stays exactly as drawn. */
export const DEFAULT_OUTLINE = 40;

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * A function `(r, g, b) => [r, g, b]` for one setting, or null when the
 * setting changes nothing (brightness 1, saturation 1).
 */
export function makeColorBrightener({ brightness = 1, saturation = 1, outline = DEFAULT_OUTLINE } = {}) {
    if (brightness === 1 && saturation === 1) return null;
    const s = saturation;
    const m = [
        0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s
    ];
    return (r0, g0, b0) => {
        if (Math.max(r0, g0, b0) <= outline) return [r0, g0, b0];
        const r = clamp255(r0 * brightness), g = clamp255(g0 * brightness), b = clamp255(b0 * brightness);
        return [
            Math.round(clamp255(m[0] * r + m[1] * g + m[2] * b)),
            Math.round(clamp255(m[3] * r + m[4] * g + m[5] * b)),
            Math.round(clamp255(m[6] * r + m[7] * g + m[8] * b))
        ];
    };
}

/** One colour `[r, g, b]` (0–255) brightened with `settings`. */
export function brightenColor([r, g, b], settings) {
    const f = makeColorBrightener(settings);
    return f ? f(r, g, b) : [r, g, b];
}

const HEX = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** A `#rrggbb` colour brightened with `settings`, as lower-case `#rrggbb`; anything not a six-digit hex comes back as given. */
export function brightenHex(hex, settings) {
    const m = typeof hex === 'string' ? HEX.exec(hex.trim()) : null;
    if (!m) return hex;
    const rgb = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    const out = brightenColor(rgb, settings);
    if (out.every((c, i) => c === rgb[i])) return hex;
    return '#' +out.map((c) => c.toString(16).padStart(2, '0')).join('');
}
