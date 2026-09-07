import React, { useEffect, useRef } from 'react';
import { BOARD_PX } from '../../../config/boardGeometry.js';
import {
    LATTICE_SIZE, SUBTILE_PX, resolveLattice, variantAt
} from '../../../systems/board/TerrainLattice.js';
import { getTerrain, SUBSTRATES, substrateSprite } from '../../../config/registries/terrainRegistry.js';

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
    const key = `${substrateId}${variant}`;
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
            for (let sy = 0; sy < LATTICE_SIZE; sy++) {
                for (let sx = 0; sx < LATTICE_SIZE; sx++) {
                    const terrainId = grid[sy * LATTICE_SIZE + sx];
                    // Unpainted ground is left transparent rather than filled
                    // with anything: what shows through is the table the board
                    // sits on, which is what "nobody has been here" looks like.
                    if (!terrainId) continue;

                    const def = getTerrain(terrainId);
                    const substrate = def && SUBSTRATES[def.substrate];
                    if (!substrate) continue;

                    const variant = variantAt(sx, sy, substrate.variants, seed || 0);
                    const img = substrateImage(substrate.id, variant);
                    if (!img) continue;   // still loading; onload will redraw

                    ctx.drawImage(img, sx * SUBTILE_PX, sy * SUBTILE_PX, SUBTILE_PX, SUBTILE_PX);
                }
            }
        };

        pendingRedraw = draw;
        draw();
        return () => { if (pendingRedraw === draw) pendingRedraw = null; };
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
