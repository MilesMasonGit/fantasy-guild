// Fantasy Guild — screen pointer → mat point (Free Playmat slice 1.6c)

import { matW } from '../../../config/matGeometry.js';

/**
 * Where a screen pointer is on the mat, in mat units.
 *
 * The mat is drawn at its natural size (`matW()` wide) and CSS-scaled to fit, so
 * `rect` — the mat's `getBoundingClientRect()` — is the SCALED box. The scale is
 * `rect.width / matW()`; a screen offset from the rect's corner divides by it.
 *
 * ⚠️ The width is read on every call (slice 1.6d-3): the mat can be resized while
 * the game runs, and a pointer converted with yesterday's width would land
 * somewhere the player never pointed.
 *
 * `grab` is where inside the dragged thing the player took hold of it, in mat
 * units, added back so a Token lands where its centre was rather than where the
 * cursor was. It is 0 in slice 1.6c: the drag ghost is centred on the cursor.
 *
 * Pure: no DOM reads, so it can be tested with a plain rect.
 *
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
