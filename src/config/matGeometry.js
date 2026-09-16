// Fantasy Guild — Token geometry on the free playmat (Free Playmat slice 1.6b)

import { getTokenType } from './registries/tokenRegistry.js';

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
 * ## The mat's own size (Free Playmat slice 1.6c, FP-92)
 *
 * The mat is `MAT_STEPS` of today's 160 u steps wide, at a 0.64 aspect:
 * **1760 × 1126 u**. Its top-left is (0, 0). The Mat Tuner's mat-size row
 * (slice 1.6d) changes `MAT_STEPS`.
 */
export const MAT_STEPS = 11;
export const MAT_STEP_U = 160;
export const MAT_ASPECT = 0.64;
export const MAT_W = MAT_STEPS * MAT_STEP_U;
export const MAT_H = Math.round(MAT_W * MAT_ASPECT);

/** A point clamped onto the mat. */
export function clampToMat(point) {
    return {
        x: Math.max(0, Math.min(MAT_W, point.x)),
        y: Math.max(0, Math.min(MAT_H, point.y))
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
