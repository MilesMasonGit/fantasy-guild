import React, { useEffect, useRef } from 'react';
import { BOARD_PX } from '../../../config/boardGeometry.js';
import {
    LATTICE_SIZE, SUBTILE_PX, subtileArtPx, resolveLattice, variantAt, edgeStrips
} from '../../../systems/board/TerrainLattice.js';
import {
    getTerrain, SUBSTRATES, substrateSprite, substrateVariants, artSet, propSprite
} from '../../../config/registries/terrainRegistry.js';
import { propsForBoard } from '../../../systems/board/TerrainProps.js';
import { resolveArtPixels } from '../../../systems/board/TerrainLattice.js';
import { buildPatchMasks } from '../../../systems/board/TerrainPatches.js';
import { buildBandMasks, bandAppearance } from '../../../systems/board/TerrainBands.js';
import { EventBus } from '../../../systems/core/EventBus.js';

/**
 * The playmat's ground, drawn under everything else.
 *
 * ## Why a canvas and not 841 divs
 *
 * The lattice is 29×29, so a div-per-subtile would put **841 elements** under a
 * board that draws 53 today, and the whole page is 272. Each would carry its own
 * background image and its own style object, and React would reconcile all of
 * them every time a single Token moved. One canvas is one element, and a redraw
 * is a tight loop over a typed grid with no DOM work at all.
 *
 * The trade is that terrain cannot be hit-tested or hovered. It does not need to
 * be: dropping, hovering and inspection all belong to the tiles above, which are
 * still real elements. Terrain is scenery.
 *
 * ## Crispness
 *
 * `imageSmoothingEnabled = false` and integer coordinates throughout. The source
 * art is 16px drawn at 32px, an exact 2× — anything fractional would blur it,
 * which is the one thing pixel art cannot survive. The board's fit-to-window
 * scaling happens in CSS on an ancestor, so it scales the finished picture
 * rather than the arithmetic.
 *
 * ## Two passes
 *
 * The first fills every subtile flat. The second walks the boundaries between
 * subtiles holding *different* terrain and repaints a ragged strip across each,
 * so the join reads as a coastline rather than a cut (roadmap P3). Doing it as a
 * separate pass rather than per-subtile means every boundary is considered once,
 * from one side, so the two subtiles either side cannot disagree about where
 * they meet.
 *
 * A third shades each terrain's own outer edge — shallows at the sea's rim, wet
 * sand at the beach's. A fourth wears patches of bare earth through the ground,
 * and a fifth paints the scenery on top, back to front. Scenery has to be a pass of its own rather
 * than part of the first: a tree is taller than the subtile it stands in, so it
 * overlaps its neighbours, and drawing it while the ground was still being
 * filled would let later subtiles paint over its canopy.
 */

/**
 * Substrate images, loaded once and shared by every board.
 *
 * Module-level rather than component state on purpose: the images never change,
 * a remount should not re-fetch them, and a half-loaded cache is not a render
 * concern — the draw simply skips a subtile whose art has not arrived and the
 * `onload` schedules another pass.
 */
const imageCache = new Map();
let pendingRedraw = null;

function substrateImage(substrateId, variant) {
    // ⚠️ The art set is part of the key. Without it, switching sets would find
    // the other set's sprite already cached under the same name and keep
    // drawing it — the switch would appear to do nothing at all.
    const key = `${artSet()}:${substrateId}${variant}`;
    const cached = imageCache.get(key);
    if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;

    const img = new Image();
    img.onload = () => pendingRedraw?.();
    img.src = substrateSprite(substrateId, variant);
    imageCache.set(key, img);
    return null;
}

/**
 * A recoloured copy of a substrate sprite, for a shore band.
 *
 * ⚠️ Generated rather than drawn. There is no shallow-water or wet-sand art, and
 * the owner chose a tint over authoring sixteen more sprites for a band whose
 * width nobody had judged yet. The noise pattern is preserved exactly — only
 * the palette shifts — but a linear tint can land on colours a pixel artist
 * would not have chosen, so this is a placeholder a drawn substrate can replace
 * without the renderer changing.
 *
 * Cached like everything else, keyed by the tint, because building one means a
 * canvas allocation and a composite.
 */
const tintCache = new Map();

function tintedImage(img, tint, amount) {
    if (!img || amount <= 0) return img;
    const key = `${img.src}|${tint}|${amount.toFixed(3)}`;
    const cached = tintCache.get(key);
    if (cached) return cached;

    const off = document.createElement('canvas');
    off.width = img.naturalWidth;
    off.height = img.naturalHeight;
    const octx = off.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(img, 0, 0);
    // `source-atop` keeps the sprite's own alpha, so a transparent pixel stays
    // transparent instead of becoming a square of flat colour.
    octx.globalCompositeOperation = 'source-atop';
    octx.globalAlpha = Math.min(1, amount);
    octx.fillStyle = tint;
    octx.fillRect(0, 0, off.width, off.height);

    tintCache.set(key, off);
    return off;
}

/** Prop art, cached the same way the substrates are. Never varies by art set. */
function propImage(propId) {
    const key = `prop:${propId}`;
    const cached = imageCache.get(key);
    if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;

    const img = new Image();
    img.onload = () => pendingRedraw?.();
    img.src = propSprite(propId);
    imageCache.set(key, img);
    return null;
}

/**
 * Paint a substrate through an art-resolution alpha mask.
 *
 * Three passes wanted the same twenty lines — beaches, shore bands and ground
 * patches all mean "cover exactly these pixels with this ground". Written out
 * three times it was three places to get the compositing subtly wrong, and the
 * one thing this renderer has already proved is that a drawing mistake is
 * invisible to everything except a person looking closely.
 *
 * The mask goes onto a canvas the size of the board in ART pixels — 232 square,
 * not 928 — and is scaled up with smoothing off. Then `destination-in` cuts a
 * tiled fill down to it. A rectangle per pixel would be exact and cost tens of
 * thousands of clip-and-draw pairs on every repaint.
 */
function paintThroughMask(ctx, mask, maskSize, imageFor) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskSize;
    maskCanvas.height = maskSize;
    const maskCtx = maskCanvas.getContext('2d');
    const image = maskCtx.createImageData(maskSize, maskSize);
    for (let i = 0; i < mask.length; i++) image.data[i * 4 + 3] = mask[i];
    maskCtx.putImageData(image, 0, 0);

    const layer = document.createElement('canvas');
    layer.width = BOARD_PX;
    layer.height = BOARD_PX;
    const layerCtx = layer.getContext('2d');
    layerCtx.imageSmoothingEnabled = false;

    for (let sy = 0; sy < LATTICE_SIZE; sy++) {
        for (let sx = 0; sx < LATTICE_SIZE; sx++) {
            const img = imageFor(sx, sy);
            if (!img) return;   // art still loading; onload will redraw
            layerCtx.drawImage(img, sx * SUBTILE_PX, sy * SUBTILE_PX, SUBTILE_PX, SUBTILE_PX);
        }
    }

    layerCtx.globalCompositeOperation = 'destination-in';
    layerCtx.drawImage(maskCanvas, 0, 0, BOARD_PX, BOARD_PX);
    ctx.drawImage(layer, 0, 0);
}

export const TerrainCanvas = ({ terrain, seed }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;

        const draw = () => {
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);

            const grid = resolveLattice(terrain || {}, seed || 0);
            const at = (sx, sy) => (
                sx < 0 || sy < 0 || sx >= LATTICE_SIZE || sy >= LATTICE_SIZE
                    ? null
                    : grid[sy * LATTICE_SIZE + sx]
            );

            /** One subtile's substrate image, or null while it is still loading. */
            const imageFor = (terrainId, sx, sy) => {
                const def = getTerrain(terrainId);
                const substrate = def && SUBSTRATES[def.substrate];
                if (!substrate) return null;
                return substrateImage(
                    substrate.id,
                    variantAt(sx, sy, substrateVariants(substrate.id), seed || 0)
                );
            };

            // --- Pass 1: flat fills -----------------------------------------
            for (let sy = 0; sy < LATTICE_SIZE; sy++) {
                for (let sx = 0; sx < LATTICE_SIZE; sx++) {
                    const terrainId = grid[sy * LATTICE_SIZE + sx];
                    // Unpainted ground is left transparent rather than filled
                    // with anything: what shows through is the table the board
                    // sits on, which is what "nobody has been here" looks like.
                    if (!terrainId) continue;

                    const img = imageFor(terrainId, sx, sy);
                    if (!img) continue;   // still loading; onload will redraw

                    ctx.drawImage(img, sx * SUBTILE_PX, sy * SUBTILE_PX, SUBTILE_PX, SUBTILE_PX);
                }
            }

            // --- Pass 2: ragged boundaries ----------------------------------
            //
            // Art is 16px shown at 32px, so one art pixel is two on the canvas.
            // Everything below steps in art pixels and multiplies up, which is
            // what keeps the frontier on the pixel grid rather than half a pixel
            // off it — the one thing that would make this look blurry.
            const artPx = subtileArtPx();
            const scale = SUBTILE_PX / artPx;

            const raggedEdge = (sx, sy, axis) => {
                const here = at(sx, sy);
                const there = axis === 'v' ? at(sx + 1, sy) : at(sx, sy + 1);
                // Only two *different* terrains have anything to blend. An edge
                // against bare table stays crisp — there is no ground under it
                // to blend into, and the island's outline is the ownership
                // model's job, not this one's.
                if (!here || !there || here === there) return;

                for (const strip of edgeStrips(sx, sy, axis, here, there, seed || 0)) {
                    const img = imageFor(strip.terrainId, strip.variantSx, strip.variantSy);
                    if (!img) continue;

                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(
                        strip.x * scale, strip.y * scale,
                        strip.w * scale, strip.h * scale
                    );
                    ctx.clip();
                    // ⚠️ Positioned over the subtile the strip is being painted
                    // INTO, not over the subtile the terrain came from. Those
                    // are adjacent and never overlap, so drawing at the source
                    // put the whole texture outside the clip and painted
                    // nothing at all — which is what this did for three
                    // commits. The substrate is seamless noise, so re-anchoring
                    // it here still reads as that ground continuing.
                    ctx.drawImage(
                        img,
                        strip.intoSx * SUBTILE_PX, strip.intoSy * SUBTILE_PX,
                        SUBTILE_PX, SUBTILE_PX
                    );
                    ctx.restore();
                }
            };

            for (let sy = 0; sy < LATTICE_SIZE; sy++) {
                for (let sx = 0; sx < LATTICE_SIZE; sx++) {
                    if (sx + 1 < LATTICE_SIZE) raggedEdge(sx, sy, 'v');
                    if (sy + 1 < LATTICE_SIZE) raggedEdge(sx, sy, 'h');
                }
            }

            // --- Pass 3: beaches ---------------------------------------------
            //
            // Wherever water comes ashore, a seam of sand. Already written into
            // the terrain map by `resolveArtPixels`, so this only owes those
            // pixels a coat of the right substrate — and everything after it
            // treats them as real shore, which is why the wet-sand band lands on
            // the beach and the forest's dirt patches stop at it.
            const pixels = resolveArtPixels(grid, seed || 0);
            for (const { terrainId, mask } of pixels.fringes) {
                const def = getTerrain(terrainId);
                const substrate = def && SUBSTRATES[def.substrate];
                if (!substrate) continue;
                paintThroughMask(ctx, mask, pixels.size, (sx, sy) => substrateImage(
                    substrate.id,
                    variantAt(sx, sy, substrateVariants(substrate.id), seed || 0)
                ));
            }

            // --- Pass 4: shore bands ----------------------------------------
            //
            // Each banded terrain redraws its own outer edge in a tinted copy
            // of its own substrate. Same mask-and-composite trick as the
            // patches below: an alpha mask at art resolution, scaled up.
            const banded = buildBandMasks(grid, seed || 0);
            for (const { terrainId, mask } of banded.bands) {
                const band = bandAppearance(terrainId);
                const def = getTerrain(terrainId);
                const substrate = def && SUBSTRATES[def.substrate];
                if (!band || !substrate) continue;
                paintThroughMask(ctx, mask, banded.size, (sx, sy) => tintedImage(
                    substrateImage(
                        substrate.id,
                        variantAt(sx, sy, substrateVariants(substrate.id), seed || 0)
                    ),
                    band.tint, band.amount
                ));
            }

            // --- Pass 5: patches worn through the ground --------------------
            //
            // Built as an alpha mask at art resolution and scaled up, rather
            // than drawn as thousands of little rectangles. That is both far
            // faster and the only way to keep a patch's edge on the pixel grid:
            // a rectangle per pixel would be exact but cost tens of thousands
            // of clip-and-draw pairs on every repaint.
            const patches = buildPatchMasks(grid, seed || 0);
            for (const [substrateId, mask] of Object.entries(patches.masks)) {
                if (!SUBSTRATES[substrateId]) continue;
                paintThroughMask(ctx, mask, patches.width, (sx, sy) => substrateImage(
                    substrateId,
                    variantAt(sx, sy, substrateVariants(substrateId), seed || 0)
                ));
            }

            // --- Pass 6: scenery, back to front -----------------------------
            //
            // Already sorted by where each prop stands, so painting the list in
            // order is the whole depth rule: a tree lower on the board covers
            // one behind it.
            for (const prop of propsForBoard(grid, seed || 0, pixels)) {
                const img = propImage(prop.propId);
                if (!img) continue;
                ctx.drawImage(img, prop.x, prop.y, prop.size, prop.size);
            }
        };

        pendingRedraw = draw;
        draw();

        // The QA art-set toggle changes what every sprite is without changing
        // any game state, so nothing else would prompt a repaint.
        const unsubscribe = EventBus.subscribe('terrain_art_set_changed', draw);

        return () => {
            unsubscribe?.();
            if (pendingRedraw === draw) pendingRedraw = null;
        };
    }, [terrain, seed]);

    return (
        <canvas
            ref={canvasRef}
            width={BOARD_PX}
            height={BOARD_PX}
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ width: BOARD_PX, height: BOARD_PX, imageRendering: 'pixelated' }}
        />
    );
};

export default TerrainCanvas;
