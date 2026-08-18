import { cn } from '../../utils/cn.js';
import { ART_PX } from '../board/boardConstants.js';
import { tokenName, tokenSpritePath, getTokenType } from '../../../config/registries/tokenRegistry.js';

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
 *   exact halving. `boardConstants.js` requires that nothing hardcode a pixel
 *   size so small mode stays a config change (roadmap G-20).
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

/** Scale against `ART_PX`. Whole numbers, or an exact halving. */
export const TOKEN_SCALE = {
    [TOKEN_SURFACE.BOARD]: 2,
    [TOKEN_SURFACE.CARRY]: 2,
    [TOKEN_SURFACE.FLOOR]: 1,
    [TOKEN_SURFACE.TRAY]: 1,
    [TOKEN_SURFACE.VAULT]: 1,
    [TOKEN_SURFACE.INSPECT]: 1,
    [TOKEN_SURFACE.CATALOGUE]: 0.5
};

/** Displayed pixel size for a surface, accounting for 1x1 vs 2x2 large tokens. */
export const tokenSizeFor = (surface, typeIdOrSize = 1) => {
    let sizeMultiplier = 1;
    if (typeof typeIdOrSize === 'number') {
        sizeMultiplier = typeIdOrSize;
    } else if (typeof typeIdOrSize === 'string') {
        sizeMultiplier = getTokenType(typeIdOrSize)?.size || 1;
    }
    return ART_PX * sizeMultiplier * (TOKEN_SCALE[surface] ?? 1);
};

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
const RESTING_SHADOW = 'drop-shadow(0 3px 2px rgba(0,0,0,0.80))';
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
 */
export const TokenSprite = ({ typeId, surface = TOKEN_SURFACE.BOARD, lifted = false, alt, className, style }) => {
    const src = tokenSpritePath(typeId);
    if (!src) return null;

    return (
        <PixelArt
            src={src}
            alt={alt ?? tokenName(typeId)}
            size={tokenSizeFor(surface, typeId)}
            lifted={lifted}
            className={className}
            style={style}
        />
    );
};

export default TokenSprite;

