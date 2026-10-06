// Fantasy Guild — Token geometry on the free playmat

import { getTokenType } from './registries/tokenRegistry.js';
import { matTuning } from './matTuning.js';

/**
 * A Token on the free playmat is a **circle at a point**. This
 * file holds the one table of how big that circle is, by Token size.
 *
 * * **Art radius** — half the drawn art: a 1×1 Token is 128 u across (64 u
 *   radius), a 2×2 Token 288 u across (144 u radius). A point inside it is
 *   "on" the Token (`Flags.pointOnToken`).
 *
 * Mat units: 1 u = one natural board pixel.
 */

/**
 * ## The mat's own size — live
 *
 * The mat is `matSteps()` of today's 160 u steps wide, at a fixed 0.64 aspect.
 * At the shipped 11 steps that is **1760 × 1126 u**; its top-left is always
 * (0, 0). The Mat Tuner's **Mat size** row moves it between 6 and 20 steps while
 * the game runs.
 *
 * ## ⚠️ Functions, not constants — and nothing may cache them
 * A constant would be captured at import and go on measuring a mat that no longer exists once the Mat Tuner slider moves.
 * So: **call `matW()` / `matH()` at the point of use, every time.** Never
 * lift one into a module constant, a default argument, a frozen object or a
 * `useMemo` with no dependency on the size.
 *
 * On screen the size reaches React through `useMatSize()`, which re-renders the
 * mat and every layer on it when the tuner changes (`onMatTuningChanged`).
 *
 * ⚠️ This is the mat's size in **mat units**, not on screen. How much the mat is
 * then shrunk to fit the window is `useBoardScale`'s, a separate question.
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
 * ## How big a Token is drawn
 *
 * Token art is authored at 64px and shown at exactly 2×, so a 1×1 Token
 * is drawn 128 u across.
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

/**
 * ## Two Token sizes — standard and small
 *
 * A Token type may carry **`artSize: 'small'`** (authored in the CMS Token
 * editor's *Token Size* control). A small Token is drawn at **half size** —
 * 32 px art at 64 u on the mat, where a standard one is 64 px art at 128 u —
 * and everything about its body halves with it: the art radius (32 u), so the
 * hit area, the hitbox and the spacing gaps, the mat-edge clamp and where a
 * hero stands beside it.
 *
 * ⚠️ **`artSize`, not `size`.** `size` is the Token's *footprint* (1 = 1×1,
 * 2 = 2×2). A missing `artSize` (or `'standard'`) is a standard Token.
 *
 * ⚠️ **Small applies to 1×1 Tokens only.** A 2×2 marked small is drawn and
 * spaced as a normal 2×2 — the game ignores the field there, and the CMS
 * refuses it (the control is disabled on a 2×2 and a switch to 2×2 clears it).
 *
 * The one question every reader asks — "how much of the standard body does this
 * Token have?" — is {@link tokenBodyScale}; nothing else reads `artSize`.
 */
export const TOKEN_ART_SIZE = Object.freeze({ STANDARD: 'standard', SMALL: 'small' });

/** How much of a standard body a small Token has: exactly half. */
export const SMALL_TOKEN_SCALE = 0.5;

/**
 * Whether a Token type (id or definition) is a **small** Token: marked
 * `artSize: 'small'` and 1×1. Unknown types are standard.
 */
export function isSmallToken(typeIdOrDef) {
    const def = typeof typeIdOrDef === 'string' ? getTokenType(typeIdOrDef) : typeIdOrDef;
    if (!def || def.artSize !== TOKEN_ART_SIZE.SMALL) return false;
    return (def.size || 1) === 1;
}

/**
 * ⭐ The single helper for a Token's body size: **0.5 for a small Token,
 * 1 for everything else.** `artRadiusOf` (so every hit test, gap, clamp and
 * standing spot) and `TokenSprite.tokenSizeFor` (so every on-mat drawing and
 * the drag ghost) both multiply by it.
 */
export function tokenBodyScale(typeIdOrDef) {
    return isSmallToken(typeIdOrDef) ? SMALL_TOKEN_SCALE : 1;
}

/**
 * The art radius of a Token type — its footprint's radius, halved for a small
 * Token (32 u rather than 64 u). ⭐ Every engine consumer of a Token's
 * body goes through this: `Flags.pointOnToken` / `tokenAtPoint` (hover, click,
 * flag pins), `MatPlacement` (hitbox, `minGap`, the mat edge, restock,
 * `findSpot` and so every drop, nudge, spawn and `MatResize` clamp),
 * `HeroMotion.standingSpot`, `EnemyMotion`'s potter ring, `EffectActions`'
 * spawn-beside, the pinned flag's point, and `MatToken`'s box.
 */
export function artRadiusOf(typeId) {
    const def = getTokenType(typeId);
    return artRadius(def?.size || 1) * tokenBodyScale(def);
}
