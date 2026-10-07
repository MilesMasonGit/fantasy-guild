import { cn } from '../../utils/cn.js';
import { ART_PX, tokenBodyScale } from '../../../config/matGeometry.js';
import { tokenName, tokenSpritePath, getTokenType } from '../../../config/registries/tokenRegistry.js';
import { preloadAlphaMask } from '../../utils/alphaHitTest.js';
import { useMatFit } from '../board/MatFitContext.jsx';
import {
    useSpriteFxVersion, shadowLayer, outlineLayer, layerStyle
} from '../../utils/spriteFx.js';

/**
 * TokenSprite: the single component that draws a Token, anywhere.
 * Every surface routes through here so Token art never drifts to its own pixel size, and no
 * frame or shadow is added around it.
 * - **No frame, ever.** The art is the object; borders, rings and panel backgrounds belong to
 * the surface behind the Token.
 * - **No shadow at rest; a hard one in the hand**, see `PixelArt`.
 * - **Every size is `ART_PX × scale`**, and every scale is a whole number or an exact halving.
 * `ART_PX` lives in `matGeometry.js` and nothing may hardcode a pixel size, so small mode
 * stays a config change.
 */

/**
 * Where a Token is being drawn, and how big it is there. Two sizes: 128px when it is in play
 * or in the player's hand, 64px when it is stored or not yet picked up. Scales are relative to
 * `ART_PX` (64). `CATALOGUE` is the one exception: a Map pool wraps up to 29 entries, and 64px
 * chips would make that listing far taller. 0.5× is an exact halving (still crisp, but it
 * discards every other pixel), so it is only for dense listings.
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
 * Scale against `ART_PX`: whole numbers, or an exact halving. `BOARD`'s 2 is the surface's
 * natural scale, what it draws at when the mat is drawn 1:1. The mat is rarely drawn 1:1, so
 * the board actually uses `boardScaleAt(fit)` below; callers outside the mat's own transform
 * still get this number.
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
 * Stepped art, smooth spacing: the board surface only.
 * The mat is drawn at its natural size and fitted into the window with one CSS transform
 * (`useBoardScale`), so positions, the surface, rings, flags and the drop target all scale
 * smoothly. A sprite must not: at a fit of 0.21 a 128 u Token lands on screen as 26.88 px, a
 * fractional sample of 64 px art, which blurs. So the board's scale is chosen from the live
 * fit so that what the player sees is always a whole multiple of `ART_PX`.
 * `boardArtSteps` rounds the natural 2× times the fit to the nearest whole number, never below
 * 1. `boardScaleAt` divides that back by the fit, giving the size in MAT UNITS that the
 * transform lands on exactly `steps × ART_PX` screen pixels.
 * ⚠️ The mat-unit scale is deliberately fractional. The whole-number contract is about the
 * rendered pixel size, not the mat-unit number: `boardScaleAt(0.21)` is ~4.76 mat units and
 * exactly 64 px on screen. At a fit of 1 it is 2, so every caller outside the mat's transform
 * is unchanged.
 * ⚠️ Below 1× the art is bigger than the Token's circle, and that is intended: the art steps
 * while spacing glides, so sprites spill over their neighbours on a small mat. This is a
 * drawing rule only; collision, `hitRadiusOf` and `minGap` are untouched, so what is drawn can
 * disagree with what the engine allows.
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
 * Displayed size for a surface, accounting for 1x1 vs 2x2 large tokens. `scale` defaults to
 * the surface's own entry in `TOKEN_SCALE`; the board passes `boardScaleAt(fit)` instead so
 * its sprites land on whole pixels through the mat's transform.
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
 * The surfaces where a small Token is drawn at half size: the mat itself, the hand carrying a
 * Token onto it (the ghost is the size of the hole it is going into) and the floor. Listings
 * keep the full icon: they are about which Token, not how big it stands. Only a type id gets
 * the halving; a bare number is a footprint and means what it always did.
 */
const ON_MAT_SURFACES = new Set([TOKEN_SURFACE.BOARD, TOKEN_SURFACE.CARRY, TOKEN_SURFACE.FLOOR]);

/**
 * Hard pixel shadows and outlines, as pictures.
 * - **A sprite at rest has no shadow at all.**
 * - **A held Token (`lifted`) and floating loot (`hovering`) cast a hard shadow**: a solid
 * black silhouette of the art, 2 art pixels down and to the right, pixel-crisp.
 * - **`outline`** (`'work'` green, `'hover'` white, `'alert'` red) draws a sharp coloured
 * line, one art pixel thick and on the art's own grid, around the art's own black outline. Its
 * pixels touch the art edge to edge only (`src/config/spriteFx.js`).
 * Both are images made from the art by `scripts/spriteFx.mjs` and drawn as plain layers
 * (`src/ui/utils/spriteFx.js`), with no live filter. A sprite the generator has not seen draws
 * without them, never broken.
 * ⚠️ Never add `will-change` to a sprite (3x slower).
 */
const LIFT_OFFSET_PX = 4;

const spriteImgStyle = (size, extra) => ({
    width: size,
    height: size,
    // ⚠️ Tailwind's preflight sets `img { max-width: 100% }`, which silently SHRINKS the art
    // to fit whatever box it lands in, and a shrunk sprite is a fractionally-scaled sprite.
    // dnd-kit sizes its DragOverlay to the source node, so a 128px carried Token was being
    // clamped to a smaller slot. The size asked for is the size rendered, everywhere.
    maxWidth: 'none',
    maxHeight: 'none',
    // Non-negotiable for the same reason: the browser's default smoothing would blur any
    // surface that ever got a fractional box.
    imageRendering: 'pixelated',
    ...extra
});

/**
 * PixelArt: a raw pixel sprite at an exact size. Split out from `TokenSprite` because the
 * floor draws items as well as Tokens at the same displayed size, but an item resolves its art
 * from the item registry and is drawn from a 32px source rather than a 64px one.
 * A sprite with nothing extra (the usual case off the mat) is one `<img>`. A sprite that can
 * carry a shadow or an outline (`lifted`, `hovering`, or any `outline` prop at all, even null)
 * is a small box: the caller's class and style go on the box, the layers sit inside it under
 * the `<img>`. Callers on the mat always pass `outline`, so the box stays put as the outline
 * comes and goes.
 * @param {boolean} lifted    held in the hand: hard shadow, art raised 4 px
 * @param {boolean} hovering  floating loot: hard shadow, art bobbing
 * @param {'work'|'hover'|'alert'|null} [outline]
 */
export const PixelArt = (props) => {
    if (!props.src) return null;
    preloadAlphaMask(props.src);
    if (props.lifted || props.hovering || props.outline !== undefined) return <LayeredPixelArt {...props} />;
    const { src, alt, size, className, style } = props;
    return (
        <img
            src={src}
            alt={alt}
            draggable={false}
            className={cn('pointer-events-none select-none', className)}
            style={spriteImgStyle(size, style)}
        />
    );
};

function LayeredPixelArt({ src, alt, size, lifted = false, hovering = false, outline = null, className, style }) {
    useSpriteFxVersion();
    const fit = useMatFit();
    const shadow = (lifted || hovering) ? shadowLayer(src, size, fit) : null;
    const ring = outline ? outlineLayer(src, size, outline) : null;

    // `lifted` is a held object: raised by a fixed transform. `hovering` is a floating one:
    // raised by the bob keyframes instead. Either way the shadow rises with the art, always 2
    // art pixels down-right of it.
    return (
        <span
            className={cn('relative inline-block pointer-events-none select-none', className)}
            style={{ width: size, height: size, ...style }}
            data-sprite-outline={outline || undefined}
        >
            <span
                className={cn('absolute left-0 top-0', hovering && 'gi-sprite-hover')}
                style={{
                    width: size,
                    height: size,
                    transform: lifted ? `translateY(-${LIFT_OFFSET_PX}px)` : undefined
                }}
            >
                {shadow && (
                    <span
                        aria-hidden="true"
                        data-sprite-shadow="true"
                        style={layerStyle(shadow.url, shadow.offset, shadow.offset, size, size)}
                    />
                )}
                {ring && (
                    <span
                        aria-hidden="true"
                        data-sprite-ring={outline}
                        style={layerStyle(ring.url, -ring.pad, -ring.pad, size + 2 * ring.pad, size + 2 * ring.pad)}
                    />
                )}
                <img
                    src={src}
                    alt={alt}
                    draggable={false}
                    className="absolute left-0 top-0"
                    style={spriteImgStyle(size)}
                />
            </span>
        </span>
    );
}

/**
 * A Token, drawn for a given surface.
 * @param {string}  typeId    Token type id; art resolves through the registry.
 * @param {string}  surface   One of `TOKEN_SURFACE`. Decides the size; callers never state a
 * pixel value.
 * @param {boolean} lifted    Held by the cursor: hard shadow, art offset up. The size does not
 * change.
 * @param {string}  outline   `'work'` | `'hover'` | `'alert'` | null: the coloured outline.
 * Mat callers always pass it; elsewhere leave it out.
 * @param {string}  alt       Overrides the registry name, for callers that already have a
 * label.
 * @param {number}  scale     Overrides the surface's own scale. The board passes
 * `boardScaleAt(fit)`; nothing else sets it.
 */
export const TokenSprite = ({ typeId, surface = TOKEN_SURFACE.BOARD, size, scale, lifted = false, outline, alt, className, style }) => {
    const src = tokenSpritePath(typeId);
    if (!src) return null;

    return (
        <PixelArt
            src={src}
            alt={alt ?? tokenName(typeId)}
            size={size ?? tokenSizeFor(surface, typeId, scale)}
            lifted={lifted}
            outline={outline}
            className={className}
            style={style}
        />
    );
};

export default TokenSprite;

