// Where a Token's art begins, seen from its top-left corner: for the small job marker.
import { useEffect, useState } from 'react';
import { preloadAlphaMask } from '../../utils/alphaHitTest.js';

/** An art pixel counts as drawn at this alpha or more (as the hit test). */
const OPAQUE = 25;

/**
 * How far in from the top-left corner a sprite's art begins, along the corner's diagonal, in art
 * pixels on each axis: the first line `x + y = s` (a 45° line swept in from the corner) that
 * touches a drawn pixel, as `s / 2`. A square sprite filling its corner is 0; a round tree about 17.
 * @param {{width:number,height:number,data:Uint8Array}} mask the sprite's alpha
 * @returns {number|null} null for an empty sprite
 */
export function cornerInsetOfMask(mask) {
    if (!mask?.data || !(mask.width > 0)) return null;
    const { width, height, data } = mask;
    for (let s = 0; s <= width + height - 2; s++) {
        for (let x = Math.max(0, s - (height - 1)); x <= Math.min(s, width - 1); x++) {
            if (data[(s - x) * width + x] >= OPAQUE) return s / 2;
        }
    }
    return null;
}

const insets = new Map();

/** The art inset of the sprite at `src`, as a share of its width, or undefined until its alpha has loaded. */
export function cornerShareOf(src) {
    return insets.get(src);
}

/** Load the sprite's alpha (shared with the hit test) and work out its corner share once. */
export function loadCornerShare(src) {
    if (!src) return Promise.resolve(null);
    if (insets.has(src)) return Promise.resolve(insets.get(src));
    return preloadAlphaMask(src).then((mask) => {
        const inset = cornerInsetOfMask(mask);
        const share = inset == null ? null : inset / mask.width;
        insets.set(src, share);
        return share;
    });
}

/** `cornerShareOf(src)`, redrawn once the sprite's pixels have loaded; undefined until then, or for no `src`. */
export function useCornerShare(src) {
    const [share, setShare] = useState(() => (src ? cornerShareOf(src) : undefined));
    useEffect(() => {
        if (!src) return undefined;
        let live = true;
        const known = cornerShareOf(src);
        if (known !== undefined) { setShare(known); return undefined; }
        loadCornerShare(src).then((v) => { if (live) setShare(v); });
        return () => { live = false; };
    }, [src]);
    return src ? share : undefined;
}
