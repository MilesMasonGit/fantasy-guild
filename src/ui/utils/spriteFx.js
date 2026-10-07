
import { useSyncExternalStore } from 'react';
import { isDrawn } from '../dev/perf/drawSwitches.js';
import {
    SPRITE_FX_DIR, shadowScreenPx, outlineFolder, silhouetteFolder
} from '../../config/spriteFx.js';

/**
 * The game side of `scripts/spriteFx.mjs`. The generator writes a manifest of
 * every sprite it drew a silhouette (and outlines) for; this reads it once at
 * boot and answers "which image, how big, where" for `PixelArt` and the two
 * sprite-sheet animators.
 *
 * ⚠️ **Nothing here ever breaks a sprite.** A sprite the generator has not seen
 * — brand-new art before the dev watcher fires, a CMS data URL, a test with no
 * manifest — simply draws with no shadow and no outline.
 *
 * All sizes come back in the CALLER's CSS pixels. The outline is one ART
 * pixel, drawn at the sprite's own scale, so it needs nothing else. The
 * shadow's offset is rounded to whole screen pixels, so it takes `fit`: how
 * many screen pixels one caller pixel is — the mat's fit inside the mat
 * (`useMatFit`), 1 outside it (the drag ghost, the dock).
 */

/** @type {Record<string, {w:number,h:number,cols?:number,rows?:number,outlined:boolean}>|null} */
let sprites = null;
let version = 0;
const listeners = new Set();

function bump() {
    version++;
    listeners.forEach(fn => fn());
}

/** Use a manifest (`{ sprites }`), or null to forget it. Tests call this directly. */
export function setSpriteFxManifest(manifest) {
    sprites = manifest?.sprites || null;
    bump();
}

/** Fetch the generated manifest. Resolves either way; failure means "no effects". */
export async function loadSpriteFxManifest(fetchImpl = globalThis.fetch) {
    try {
        const res = await fetchImpl(`/${SPRITE_FX_DIR}/manifest.json`, { cache: 'no-cache' });
        if (!res?.ok) return false;
        setSpriteFxManifest(await res.json());
        return true;
    } catch {
        return false;
    }
}

// The dev server redraws a sprite the moment its file changes and says so.
if (import.meta.hot) {
    import.meta.hot.on('sprite-fx:update', () => { loadSpriteFxManifest(); });
}

const subscribe = (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const snapshot = () => version;

/** Re-renders the caller when the manifest arrives or is redrawn. */
export function useSpriteFxVersion() {
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** `'/assets/x.png?v=1'` → `'assets/x.png'`; null for anything that is not a local asset. */
export function assetKey(src) {
    if (typeof src !== 'string' || !src) return null;
    let s = src;
    if (/^(data|blob):/i.test(s)) return null;
    if (/^[a-z]+:\/\//i.test(s)) {
        try {
            const url = new URL(s);
            if (typeof location === 'undefined' || url.origin !== location.origin) return null;
            s = url.pathname;
        } catch { return null; }
    }
    s = s.split(/[?#]/)[0].replace(/^\.?\/+/, '');
    try { s = decodeURI(s); } catch { /* keep as is */ }
    return s.startsWith('assets/') ? s : null;
}

/** The manifest entry for a sprite, or null. */
export function spriteFxEntry(src) {
    const key = sprites ? assetKey(src) : null;
    const entry = key ? sprites[key] : null;
    return entry ? { key, ...entry } : null;
}

const url = (folder, key) => `/${SPRITE_FX_DIR}/${folder}/${key}`;

/**
 * Screen pixels per source pixel for a sprite drawn `drawnPx` CSS pixels wide
 * (a sheet: one frame cell).
 */
function screenPerSource(entry, drawnPx, fit) {
    const srcW = entry.cols ? entry.w / entry.cols : entry.w;
    return (drawnPx * fit) / srcW;
}

/**
 * The hard shadow for a single sprite drawn `size` CSS px wide: the
 * silhouette's url and its offset down-right (CSS px, the same both ways) —
 * 2 art pixels, in whole screen pixels. Null if there is no silhouette.
 */
export function shadowLayer(src, size, fit = 1) {
    if (!isDrawn('spriteFx')) return null;
    const entry = spriteFxEntry(src);
    if (!entry || entry.cols || !(size > 0) || !(fit > 0)) return null;
    const k = screenPerSource(entry, size, fit);
    return { url: url(silhouetteFolder(), entry.key), offset: shadowScreenPx(k) / fit };
}

/**
 * The outline for a single sprite drawn `size` CSS px wide, in `colour`
 * (`work` | `hover` | `alert`): its url, and how far it reaches past the
 * sprite on every side — exactly one art pixel at the size it is drawn
 * (`size / art width`). The image is drawn `pad` up-left of the sprite and
 * `size + 2·pad` across, so it is scaled exactly like the art and every
 * outline pixel lands on the art's grid. Null if this sprite has no outlines.
 */
export function outlineLayer(src, size, colour) {
    if (!isDrawn('spriteFx')) return null;
    const entry = spriteFxEntry(src);
    if (!entry || !entry.outlined || entry.cols || !colour || !(size > 0)) return null;
    return { url: url(outlineFolder(colour), entry.key), pad: size / entry.w };
}

/**
 * The outline sheet for an animated sprite sheet. It has the sheet's own size
 * and grid (each frame's ring grown inside its cell), so it is drawn exactly
 * like the sheet, with the same frame offset. Null if none.
 */
export function sheetOutlineLayer(src, colour) {
    if (!isDrawn('spriteFx')) return null;
    const entry = spriteFxEntry(src);
    if (!entry || !entry.outlined || !entry.cols || !colour) return null;
    return { url: url(outlineFolder(colour), entry.key) };
}

/**
 * The style for one generated layer: a background image stretched over its
 * box, pixelated. A `<span>`, not an `<img>`, on purpose — the alpha hit-test
 * (`isElementOpaqueAtPoint`) looks for the first `<img>` inside a hero, and
 * that must stay the sprite.
 */
export function layerStyle(imageUrl, left, top, width, height) {
    return {
        position: 'absolute',
        left,
        top,
        width,
        height,
        backgroundImage: `url("${imageUrl}")`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        pointerEvents: 'none'
    };
}
