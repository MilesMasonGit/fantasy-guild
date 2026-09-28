import { cn } from '../../utils/cn.js';
import { ART_PX, tokenBodyScale } from '../../../config/matGeometry.js';
import { tokenName, tokenSpritePath, getTokenType } from '../../../config/registries/tokenRegistry.js';
import { preloadAlphaMask } from '../../utils/alphaHitTest.js';

/**
 * TokenSprite — the single component that draws a Token, anywhere (D-222).
 *
 * ## Why this exists
 * Before this, **eight components drew Token art at six different sizes**, every
 * one of them a bare literal unrelated to `ART_PX`: 96 on a tile, 40 in the
 * Tray, 96/40 on the two drag ghosts, 36 on the floor, 32 in the Vault, 22 in
 * the Cartographer, 48 in the inspection header. The frame around it appeared
 * and vanished three times during a single pick-up-and-place.
 *
 * That is what D-143 exists to prevent — Tokens should *"read as solid objects
 * resting on a surface, not cells in a spreadsheet."* The board tile honoured
 * it; nothing else did. **This component completes D-143 rather than changing
 * it.**
 *
 * The seventh and eighth surfaces (Cartographer, inspection) had already
 * drifted before anyone counted them. Routing every caller through one place is
 * what stops a ninth doing the same.
 *
 * ## The rules it enforces
 * - **No frame, ever** (D-219). The art is the object. Borders, rings and panel
 *   backgrounds belong to the *surface* behind the Token, never to the Token.
 * - **One contact shadow everywhere** (D-215). Identical framing, proportion and
 *   weight on every surface — that is what makes it the same object even when
 *   it is not the same number of pixels.
 * - **Every size is `ART_PX × scale`** and every scale is a whole number, or an
 *   exact halving. `ART_PX` lives in `matGeometry.js`, and nothing may hardcode
 *   a pixel size, so small mode stays a config change (roadmap G-20).
 */

/**
 * Where a Token is being drawn, and how big it is there (D-217).
 *
 * **Two sizes, one sentence:** 128px when it is in play or in the player's hand,
 * 64px when it is stored or not yet picked up.
 *
 * Scales are relative to `ART_PX` (64). `CATALOGUE` is the one exception on the
 * record (D-217a) — a Map pool wraps up to 29 entries, and 64px chips would make
 * that listing roughly three times taller inside a pane R-3 is going to rework
 * anyway. 0.5× is an exact halving: still crisp, but it does discard every other
 * pixel, so it is only for dense listings.
 */
export const TOKEN_SURFACE = {
    BOARD: 'board',           // on a tile, in play
    CARRY: 'carry',           // held by the cursor mid-drag
    FLOOR: 'floor',           // loose on the board, not yet collected
    TRAY: 'tray',             // racked, waiting to be placed
    VAULT: 'vault',           // stored in the Token Bank
    INSPECT: 'inspect',       // the inspection panel's header
    CATALOGUE: 'catalogue'    // dense listings — Cartographer pool chips only
};

/**
 * Scale against `ART_PX`. Whole numbers, or an exact halving.
 *
 * `BOARD`'s 2 is the surface's **natural** scale — what it draws at when the mat
 * is drawn 1:1. The mat is rarely drawn 1:1, so what the board actually uses is
 * `boardScaleAt(fit)` below; this stays the number that answer is derived from,
 * and the one every board caller outside the mat's own transform still gets.
 */
export const TOKEN_SCALE = {
    [TOKEN_SURFACE.BOARD]: 2,
    [TOKEN_SURFACE.CARRY]: 2,
    [TOKEN_SURFACE.FLOOR]: 2,
    [TOKEN_SURFACE.TRAY]: 1,
    [TOKEN_SURFACE.VAULT]: 1,
    [TOKEN_SURFACE.INSPECT]: 1,
    [TOKEN_SURFACE.CATALOGUE]: 0.5
};

/**
 * ## ⭐ Stepped art, smooth spacing — the board surface only (FP-99)
 *
 * The mat is drawn at its natural size and then fitted into the window with one
 * CSS transform (`useBoardScale`). Everything on it therefore scales *smoothly*:
 * positions, the surface, rings, flags and the drop target all glide, which is
 * what keeps the mat filling the space it is given.
 *
 * A **sprite** must not glide with them. At a fit of 0.21 a 128 u Token lands on
 * screen as 26.88 px — a fractional sample of 64 px art, which is exactly the
 * blur this file exists to prevent. So the board's scale is not a constant: it
 * is chosen from the live fit, so that what the player actually sees is always a
 * whole multiple of `ART_PX`.
 *
 * **How the whole number is chosen.** `boardArtSteps` takes what the smooth
 * scale *would* have produced — the natural 2×, multiplied by the fit — and
 * rounds it to the nearest whole number, never below 1. `boardScaleAt` then
 * divides that back out by the fit, giving the size in **mat units** that the
 * transform will land on exactly `steps × ART_PX` screen pixels.
 *
 * ⚠️ **The mat-unit scale is deliberately fractional, and this does not break
 * the contract above.** The contract is about what is *rendered*: under the
 * mat's transform the mat-unit number is not the pixel number, and it is the
 * pixel number that has to be whole. `boardScaleAt(0.21)` is ~4.76 in mat units
 * and exactly 64 px on screen. At a fit of 1 it is 2, the natural scale, so
 * every caller outside the mat's transform is unchanged.
 *
 * ⚠️ **Below 1× the art is bigger than the Token's circle, and that is
 * intended** (FPR-6, accepted by the owner): the art steps while spacing glides,
 * so sprites spill over their neighbours on a small mat. This is a drawing rule
 * only — collision, `hitRadiusOf` and `minGap` are untouched, so what is drawn
 * can disagree with what the engine allows. FP-100 is what keeps that
 * disagreement small.
 */
export const boardArtSteps = (fit = 1) => {
    if (!Number.isFinite(fit) || fit <= 0) return TOKEN_SCALE[TOKEN_SURFACE.BOARD];
    return Math.max(1, Math.round(TOKEN_SCALE[TOKEN_SURFACE.BOARD] * fit));
};

/** The BOARD surface's scale in MAT UNITS at a given mat fit (see above). */
export const boardScaleAt = (fit = 1) => {
    if (!Number.isFinite(fit) || fit <= 0) return TOKEN_SCALE[TOKEN_SURFACE.BOARD];
    return boardArtSteps(fit) / fit;
};

/**
 * Displayed size for a surface, accounting for 1x1 vs 2x2 large tokens.
 *
 * `scale` defaults to the surface's own entry in `TOKEN_SCALE`; the board passes
 * `boardScaleAt(fit)` instead, so its sprites land on whole pixels through the
 * mat's transform. Every other surface leaves it alone.
 */
export const tokenSizeFor = (surface, typeIdOrSize = 1, scale = TOKEN_SCALE[surface] ?? 1) => {
    let sizeMultiplier = 1;
    if (typeof typeIdOrSize === 'number') {
        sizeMultiplier = typeIdOrSize;
    } else if (typeof typeIdOrSize === 'string') {
        sizeMultiplier = (getTokenType(typeIdOrSize)?.size || 1) *
            (ON_MAT_SURFACES.has(surface) ? tokenBodyScale(typeIdOrSize) : 1);
    }
    return ART_PX * sizeMultiplier * scale;
};

/**
 * ⭐ TL-19 / B8.1: the surfaces where a **small** Token is drawn at half size —
 * the mat itself, the hand carrying a Token onto it (D-220: the ghost is the
 * size of the hole it is going into) and the floor. Listings (Tray, Vault,
 * inspection, catalogue chips) keep the full icon: they are about which Token,
 * not how big it stands.
 *
 * Only a **type id** gets the halving; a bare number is a footprint and means
 * what it always did. At the board's whole-step scale (FP-99) a small Token
 * lands on `steps × 32` screen pixels — a whole multiple of 32 px art, and of a
 * borrowed 64 px sprite whenever `steps` is even (at 1× it is an exact halving,
 * as `CATALOGUE` already draws).
 */
const ON_MAT_SURFACES = new Set([TOKEN_SURFACE.BOARD, TOKEN_SURFACE.CARRY, TOKEN_SURFACE.FLOOR]);

/**
 * The contact shadow that makes a Token sit *on* a surface rather than be
 * printed on it (D-215).
 *
 * Two states, because a lifted object is the one thing that legitimately looks
 * different (D-220): **resting** is tight and dark and close underneath;
 * **lifted** is larger, softer and further away, and the art offsets upward.
 * That is what a real object does when you pick it up off a table, and it is
 * what replaces the retired "bloom on cross-over" — the Token itself never
 * changes size mid-drag.
 */
export const RESTING_SHADOW = 'drop-shadow(0 3px 2px rgba(0,0,0,0.80))';
const LIFTED_SHADOW = 'drop-shadow(0 10px 7px rgba(0,0,0,0.55))';
const LIFT_OFFSET_PX = 4;

/**
 * PixelArt — a raw pixel sprite at an exact size, with the shared weight.
 *
 * Split out from `TokenSprite` because the floor draws **items** as well as
 * Tokens (D-158) and they must be the same displayed size there, but an item
 * resolves its art from the item registry and is drawn from a 32px source
 * rather than a 64px one. Both land on whole-number scales at every size this
 * file produces, so one renderer is correct for both.
 */
export const PixelArt = ({ src, alt, size, lifted = false, hovering = false, className, style }) => {
    if (!src) return null;
    preloadAlphaMask(src);

    // `lifted` and `hovering` are the same physical idea reached two ways.
    // `lifted` is a held object: the offset is a fixed inline transform.
    // `hovering` is a floating one (D-221): the offset comes from the bob
    // keyframes instead, because setting it inline here would be overridden by
    // the animation anyway.
    const off = lifted || hovering;

    return (
        <img
            src={src}
            alt={alt}
            draggable={false}
            className={cn('pointer-events-none select-none', hovering && 'gi-sprite-hover', className)}
            style={{
                width: size,
                height: size,
                // ⚠️ Tailwind's preflight sets `img { max-width: 100% }`, which
                // silently SHRINKS the art to fit whatever box it lands in — and
                // a shrunk sprite is a fractionally-scaled sprite, the exact
                // defect this component exists to prevent. It bit the drag ghost
                // first: dnd-kit sizes its DragOverlay to the source node, so a
                // 128px carried Token was being clamped to a 74px Tray slot.
                // The size asked for is the size rendered, everywhere.
                maxWidth: 'none',
                maxHeight: 'none',
                // Non-negotiable for the same reason: the browser's default
                // smoothing would blur any surface that ever got a fractional box.
                imageRendering: 'pixelated',
                filter: off ? LIFTED_SHADOW : RESTING_SHADOW,
                transform: lifted ? `translateY(-${LIFT_OFFSET_PX}px)` : undefined,
                ...style
            }}
        />
    );
};

/**
 * A Token, drawn for a given surface.
 *
 * @param {string}  typeId    Token type id; art resolves through the registry.
 * @param {string}  surface   One of `TOKEN_SURFACE`. Decides the size — callers
 *                            never state a pixel value.
 * @param {boolean} lifted    Held by the cursor: bigger softer shadow, art
 *                            offset up. The size does **not** change (D-220).
 * @param {string}  alt       Overrides the registry name, for callers that
 *                            already have a label.
 * @param {number}  scale     Overrides the surface's own scale. The board passes
 *                            `boardScaleAt(fit)` (FP-99); nothing else sets it.
 */
export const TokenSprite = ({ typeId, surface = TOKEN_SURFACE.BOARD, size, scale, lifted = false, alt, className, style }) => {
    const src = tokenSpritePath(typeId);
    if (!src) return null;

    return (
        <PixelArt
            src={src}
            alt={alt ?? tokenName(typeId)}
            size={size ?? tokenSizeFor(surface, typeId, scale)}
            lifted={lifted}
            className={className}
            style={style}
        />
    );
};

export default TokenSprite;

