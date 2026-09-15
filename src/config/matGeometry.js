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
