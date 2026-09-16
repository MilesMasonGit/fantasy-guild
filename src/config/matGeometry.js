// Fantasy Guild — Token geometry on the free playmat (Free Playmat slice 1.6b)

import { getTokenType } from './registries/tokenRegistry.js';
import { matTuning } from './matTuning.js';

/**
 * A Token on the free playmat is a **circle at a point** (plan §A, §C). This
 * file holds the one table of how big that circle is, by Token size.
 *
 * * **Art radius** — half the drawn art: a 1×1 Token is 128 u across (64 u
 *   radius), a 2×2 Token 288 u across (144 u radius). A point inside it is
 *   "on" the Token (`Flags.pointOnToken`).
 * * The **hitbox** (art radius × hitbox %) and the spacing rules that use it
 *   arrive with free placement in slice 1.6d.
 *
 * Mat units: 1 u = one natural board pixel.
 */

/**
 * ## ⭐ The mat's own size — **live** (Free Playmat slice 1.6d-3, FP-92)
 *
 * The mat is `matSteps()` of today's 160 u steps wide, at a fixed 0.64 aspect.
 * At the shipped 11 steps that is **1760 × 1126 u**; its top-left is always
 * (0, 0). The Mat Tuner's **Mat size** row moves it between 6 and 20 steps while
 * the game runs.
 *
 * ## ⚠️ Functions, not constants — and nothing may cache them
 * These used to be the module constants `MAT_STEPS`, `MAT_W` and `MAT_H`, read
 * by about fifteen files. A constant is captured at import, so a file holding one
 * would go on measuring a mat that no longer exists the moment the owner moved
 * the slider — the mat would resize and that file's edge, clamp or canvas would
 * not. So: **call `matW()` / `matH()` at the point of use, every time.** Never
 * lift one into a module constant, a default argument, a frozen object or a
 * `useMemo` with no dependency on the size.
 *
 * On screen the size reaches React through `useMatSize()`, which re-renders the
 * mat and every layer on it when the tuner changes (`onMatTuningChanged`).
 *
 * ⚠️ This is the mat's size in **mat units**, not on screen. How much the mat is
 * then shrunk to fit the window is `useBoardScale`'s, and is a separate question
 * (slice 1.7 makes the mat grow to fill the window instead).
 */
export const MAT_STEP_U = 160;
export const MAT_ASPECT = 0.64;

/** How many 160 u steps wide the mat currently is (Mat Tuner, 6–20). */
export function matSteps() {
    return matTuning('matSteps');
}

/** The mat's width in mat units, right now. */
export function matW() {
    return matSteps() * MAT_STEP_U;
}

/** The mat's height in mat units, right now — the width at the 0.64 aspect. */
export function matH() {
    return Math.round(matW() * MAT_ASPECT);
}

/** A point clamped onto the mat as it is now. */
export function clampToMat(point) {
    return {
        x: Math.max(0, Math.min(matW(), point.x)),
        y: Math.max(0, Math.min(matH(), point.y))
    };
}

/**
 * ## How big a Token is drawn (Free Playmat slice 1.6d-2)
 *
 * Token art is authored at 64px and shown at exactly 2× (D-216), so a 1×1 Token
 * is drawn 128 u across. These used to be `ART_PX` and `TILE_PX` in the deleted
 * `boardGeometry.js`; `TOKEN_PX` is the same number under a name that does not
 * claim there is a tile under it.
 *
 * ⚠️ The 2× is an integer ratio on purpose. Deriving either number from the
 * space available breaks it and makes every sprite blurry — the mat is scaled
 * with a CSS transform instead (`useBoardScale`).
 */
export const ART_PX = 64;
export const TOKEN_SCALE = 2;
export const TOKEN_PX = ART_PX * TOKEN_SCALE;

/** Art radius by Token size, in mat units. */
export const ART_RADIUS_BY_SIZE = Object.freeze({ 1: 64, 2: 144 });

/**
 * The largest art radius any Token has (a 2×2's 144 u). Rebuild coverage adds
 * it to the Near radius, so a Token of any shape near a changed point is found
 * (`nearby.tokensAround`).
 */
export const LARGEST_ART_RADIUS = Math.max(...Object.values(ART_RADIUS_BY_SIZE));

/** The art radius of a Token of `size` (unknown sizes read as 1×1). */
export function artRadius(size = 1) {
    return ART_RADIUS_BY_SIZE[size] ?? ART_RADIUS_BY_SIZE[1];
}

/** The art radius of a Token type. */
export function artRadiusOf(typeId) {
    return artRadius(getTokenType(typeId)?.size || 1);
}
