/**
 * Collected loot's trail (`ParticleOverlay`): solid shadows of the item's sprite behind it, in the
 * item's primary colour, each darker toward the tail, one to seven as the stack is big.
 * ⚠️ The colour work runs once per item, when its sprite loads ({@link trailArt}); a frame only
 * draws the canvases made then.
 */

/** How far back in its flight each shadow is, per shadow. */
export const TRAIL_STEP_MS = 35;

/** The tail shadow is mixed this far toward black; the one nearest the item not at all. */
export const TRAIL_DARKEN_MAX = 0.6;

/** The stack sizes where the trail gains a shadow: 1 to 9 one, 10 to 99 two ... 1,000,000 and more seven. */
export const TRAIL_STACK_STEPS = Object.freeze([10, 100, 1000, 10000, 100000, 1000000]);

/** The most shadows a trail has. */
export const TRAIL_MAX_SHADOWS = TRAIL_STACK_STEPS.length + 1;

/** Colours this dark are a sprite's outline, never its primary colour. */
const OUTLINE_LUMA = 0.1;

/** How many shadows a flight of `quantity` trails. */
export function trailShadowCount(quantity) {
    const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    let n = 1;
    for (const step of TRAIL_STACK_STEPS) if (q >= step) n++;
    return n;
}

/**
 * A sprite's primary colour: its most used opaque colour, near-black outline colours left out.
 * @param {Uint8ClampedArray|number[]} rgba the sprite's pixels, four bytes each
 * @returns {[number, number, number]|null} null when the sprite has no such colour
 */
export function primaryColour(rgba) {
    const counts = new Map();
    for (let i = 0; i + 3 < rgba.length; i += 4) {
        if (rgba[i + 3] < 128) continue;
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        if ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 <= OUTLINE_LUMA) continue;
        const key = (r << 16) | (g << 8) | b;
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    let best = -1, most = 0;
    for (const [key, n] of counts) if (n > most) { most = n; best = key; }
    return best < 0 ? null : [(best >> 16) & 255, (best >> 8) & 255, best & 255];
}

/** How far toward black shadow `i` (0 nearest the item) of `n` is mixed. */
export const shadeFraction = (i, n) => (n > 1 ? (i / (n - 1)) * TRAIL_DARKEN_MAX : 0);

/** The colour of shadow `i` (0 nearest the item) of `n`, as `#rrggbb`. */
export function shadowColour(rgb, i, n) {
    const f = shadeFraction(i, n);
    return '#' + rgb.map(v => Math.round(v * (1 - f)).toString(16).padStart(2, '0')).join('');
}

/**
 * Everything a trail of this sprite draws, made once: for each shadow count, its shadows' silhouettes
 * (the sprite's own shape in one solid colour, at the sprite's own size), nearest the item first.
 * @param {HTMLImageElement} img a loaded sprite
 * @param {() => HTMLCanvasElement} makeCanvas
 * @returns {{ colour: string, byCount: HTMLCanvasElement[][] }|null} null when the sprite cannot
 *   be read or has no primary colour: such an item flies with no trail
 */
export function trailArt(img, makeCanvas = () => document.createElement('canvas')) {
    const w = img?.naturalWidth || img?.width || 0;
    const h = img?.naturalHeight || img?.height || 0;
    if (!w || !h) return null;
    let rgb;
    try {
        const c = makeCanvas();
        c.width = w; c.height = h;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        rgb = primaryColour(g.getImageData(0, 0, w, h).data);
    } catch {
        return null;
    }
    if (!rgb) return null;
    const silhouettes = new Map();
    const silhouette = (colour) => {
        let c = silhouettes.get(colour);
        if (c) return c;
        c = makeCanvas();
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = colour;
        g.fillRect(0, 0, w, h);
        silhouettes.set(colour, c);
        return c;
    };
    const byCount = [[]];
    for (let n = 1; n <= TRAIL_MAX_SHADOWS; n++) {
        byCount.push(Array.from({ length: n }, (_, i) => silhouette(shadowColour(rgb, i, n))));
    }
    return { colour: shadowColour(rgb, 0, 1), byCount };
}
