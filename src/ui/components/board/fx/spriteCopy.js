import { tintUrl, ditherUrl } from '../../../utils/spriteFx.js';

/**
 * Copies of a Token's sprite, for the mat's tinted-copy effects (a flash, an afterimage, a
 * dissolve), made the way the hard shadow and the outlines are: pictures generated from the art
 * (`scripts/spriteFx.mjs`), never a filter. A copy is an element of its own, made when an effect
 * starts and taken away when it ends, so a Token at rest carries none.
 * ⚠️ Generated pictures, not a CSS mask over a colour: with every Token on the 128 board flashing
 * at once, the mask took about 60 % more of the graphics card's time and its slowest frames were
 * twice as long (PERFORMANCE.md, "Animation batch").
 */

const URL_RE = /url\(["']?([^"')]+)["']?\)/;

/**
 * What a Token's art wrapper draws, read from its elements (no layout read): a still sprite's
 * picture and size, or an animated sheet's picture, size, frame and facing as they are now.
 * @returns {{src: string, size: number, sheet?: {size: string, position: string, transform: string}}|null}
 */
export function spriteOf(wrapper) {
    if (!wrapper?.querySelector) return null;
    const img = wrapper.querySelector('img');
    if (img) {
        const size = parseFloat(img.style.width);
        const src = img.getAttribute('src');
        return src && size > 0 ? { src, size } : null;
    }
    const art = wrapper.querySelector('[role="img"]');
    const m = art ? URL_RE.exec(art.style.backgroundImage || '') : null;
    const size = parseFloat(art?.parentElement?.style.width);
    if (!m || !(size > 0)) return null;
    return {
        src: m[1],
        size,
        sheet: {
            size: art.style.backgroundSize,
            position: art.style.backgroundPosition || '0px 0px',
            transform: art.style.transform || ''
        }
    };
}

/**
 * A copy of `sprite` (from {@link spriteOf}) as a new element, not yet in the page: centred where
 * the sprite is drawn in the same wrapper, hidden until an animation shows it, taking no pointer.
 * The outer element is the one to move; the inner one holds the picture (and a sheet's facing).
 * `tint`: a `TINT_COLOURS` name; `dither`: a `DITHER_STEPS` share of the art's pixels, in its own
 * colours or (with `tint`, the `TRAIL_TINT` only) all that colour; neither: the art itself.
 * @returns {HTMLElement|null} null where no copy can be drawn (no generated tint for this sprite)
 */
export function makeCopy(sprite, { tint = null, dither = null } = {}) {
    if (!sprite || typeof document === 'undefined') return null;
    const { src, size, sheet } = sprite;
    const bgSize = sheet ? sheet.size : '100% 100%';
    const bgPos = sheet ? sheet.position : '0px 0px';
    const inner = document.createElement('span');
    Object.assign(inner.style, {
        position: 'absolute',
        left: '0px',
        top: '0px',
        width: '100%',
        height: '100%',
        imageRendering: 'pixelated',
        backgroundRepeat: 'no-repeat',
        backgroundSize: bgSize,
        backgroundPosition: bgPos,
        transform: sheet?.transform || ''
    });
    const picture = dither ? ditherUrl(src, dither, tint) : tint ? tintUrl(src, tint) : src;
    if (!picture) return null;
    inner.style.backgroundImage = `url("${picture}")`;
    const outer = document.createElement('span');
    outer.setAttribute('aria-hidden', 'true');
    outer.setAttribute('data-fx-copy', [tint, dither ? `dither-${dither}` : null].filter(Boolean).join('-') || 'art');
    Object.assign(outer.style, {
        position: 'absolute',
        inset: '0px',
        margin: 'auto',
        width: `${size}px`,
        height: `${size}px`,
        pointerEvents: 'none',
        visibility: 'hidden',
        // ⚠️ On the main thread: a copy plays among the resting Tokens (tailwind.css, at `.gi-token-land`).
        willChange: 'contents'
    });
    outer.appendChild(inner);
    return outer;
}
