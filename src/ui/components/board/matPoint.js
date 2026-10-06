
import { matW } from '../../../config/matGeometry.js';

/**
 * Where a screen pointer is on the mat, in mat units.
 * The mat is drawn at its natural size (`matW()` wide) and CSS-scaled to fit, so `rect` (the
 * mat's `getBoundingClientRect()`) is the SCALED box. The scale is `rect.width / matW()`; a
 * screen offset from the rect's corner divides by it.
 * ⚠️ The width is read on every call: the mat can be resized while the game runs, and a
 * pointer converted with a stale width would land somewhere the player never pointed.
 * `grab` is where inside the dragged thing the player took hold of it, in mat units, added
 * back so a Token lands where its centre was rather than where the cursor was.
 * Pure: no DOM reads, so it can be tested with a plain rect.
 * @param {{x:number,y:number}} pointer viewport coordinates
 * @param {{left:number,top:number,width:number}} rect the mat's on-screen box
 * @param {{x:number,y:number}} [grab]
 * @returns {{x:number,y:number}|null}
 */
export function pointerToMat(pointer, rect, grab = { x: 0, y: 0 }) {
    if (!pointer || !rect || !(rect.width > 0)) return null;
    const s = rect.width / matW();
    return {
        x: (pointer.x - rect.left) / s + (grab?.x || 0),
        y: (pointer.y - rect.top) / s + (grab?.y || 0)
    };
}

/**
 * The mat's on-screen box cannot change mid-drag (a window resize cancels the drag, dnd-kit's
 * own rule), so `getBoundingClientRect()` on it only needs reading once per drag, not once per
 * frame per caller.
 * Cached on the mat element plus `session`: dnd-kit hands out a fresh `activePayload` object
 * every time a drag starts, so passing that as `session` means a new drag, or a different mat
 * element, reads fresh, and every caller during the same drag (`MatRings`, `FlagLayer`) shares
 * the one read.
 * @param {HTMLElement|null} matEl
 * @param {object|null} session identity that is stable for one drag
 * @returns {DOMRect|null}
 */
let cachedMatRectEl = null;
let cachedMatRectSession = null;
let cachedMatRect = null;

export function matRectForDrag(matEl, session) {
    if (!matEl || !session) return matEl ? matEl.getBoundingClientRect() : null;
    if (cachedMatRectEl === matEl && cachedMatRectSession === session) {
        return cachedMatRect;
    }
    cachedMatRectEl = matEl;
    cachedMatRectSession = session;
    cachedMatRect = matEl.getBoundingClientRect();
    return cachedMatRect;
}
