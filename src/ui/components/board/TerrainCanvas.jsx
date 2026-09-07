import React, { useEffect, useRef } from 'react';
import { BOARD_PX } from '../../../config/boardGeometry.js';
import {
    LATTICE_SIZE, SUBTILE_PX, subtileArtPx, resolveLattice, variantAt, edgeStrips
} from '../../../systems/board/TerrainLattice.js';
import {
    getTerrain, SUBSTRATES, substrateSprite, substrateVariants, artSet
} from '../../../config/registries/terrainRegistry.js';
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
