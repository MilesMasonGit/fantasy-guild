import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import { MAT_Z } from './matLayers.js';
import { MAT_EDGE } from './groundScreen.js';
import * as GroundRules from '../../../systems/board/GroundRules.js';

/**
 * The grid while placing: with a Token in the hand, the ground cells it may stand on light up and
 * the rest dim, so a Sailboat's player sees the sea before letting go.
 *
 * Shown only when that Token cannot stand everywhere here (TD-5 A): it has a "Stands on", or the
 * Region has water. That is exactly when placement's ground rule is in play (`GroundRules.rulesFor`
 * is not null), and the cells are that rule's own mask, so the picture can never disagree with
 * where a drop lands.
 *
 * Drawn once at pickup, one canvas pixel per cell, stretched over the mat; gone at the drop.
 * ⚠️ It must stay in the mat's own layer, like the ground (`TerrainCanvas`, `MatPixelLayers.test.js`):
 * a CPU-backed context (`willReadFrequently: true`) and no `will-change`, filter, transform or
 * opacity, or every Token drawn after it is pushed onto a layer of its own while the drag runs.
 */

/** A cell the Token may stand on: a warm light wash. RGBA; the alpha alternates for a checker. */
export const GRID_LIT = Object.freeze([255, 236, 170, 46]);
/** A cell it may not: a dark veil. */
export const GRID_DIM = Object.freeze([12, 10, 24, 120]);
/** How much the checker changes the alpha, so neighbouring cells of one kind still read as cells. */
const CHECKER = 14;

/** Paint `rules.mask` into `out` (RGBA, one pixel per cell). */
export function paintGrid(rules, out) {
    const { cols, rows } = rules.grid;
    const { mask } = rules;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            const colour = mask[i] === 1 ? GRID_LIT : GRID_DIM;
            const o = i * 4;
            out[o] = colour[0];
            out[o + 1] = colour[1];
            out[o + 2] = colour[2];
            out[o + 3] = (r + c) % 2 === 0 ? colour[3] : colour[3] - CHECKER;
        }
    }
    return out;
}

/**
 * @param {{mat: {w: number, h: number}}} props  the mat's size, in mat units
 */
export const TerrainGridOverlay = React.memo(function TerrainGridOverlay({ mat }) {
    const { isDragging, activePayload } = useActiveDrag();
    const typeId = isDragging && activePayload?.kind === DRAG_KIND.TOKEN ? activePayload.typeId ?? null : null;

    // Asked once per pickup: the drag context changes only at its start and end.
    const rules = useMemo(() => (typeId ? GroundRules.rulesFor(typeId) : null), [typeId]);

    const canvasRef = useRef(null);
    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !rules) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        const image = ctx.createImageData(rules.grid.cols, rules.grid.rows);
        paintGrid(rules, image.data);
        ctx.putImageData(image, 0, 0);
    }, [rules]);

    if (!rules) return null;

    const { cols, rows } = rules.grid;
    // A Region with no stored map is one cell standing for the whole mat.
    const width = cols > 1 ? cols * rules.cell : mat.w;
    const height = rows > 1 ? rows * rules.cell : mat.h;

    // The last row of cells runs past the mat's edge: clipped to the mat and its rounded corners.
    return (
        <div
            data-terrain-grid-clip
            aria-hidden="true"
            className="absolute left-0 top-0 pointer-events-none overflow-hidden"
            style={{ width: mat.w, height: mat.h, zIndex: MAT_Z.GROUND_GRID, borderRadius: MAT_EDGE.radius }}
        >
            <canvas
                ref={canvasRef}
                data-terrain-grid
                width={cols}
                height={rows}
                className="absolute left-0 top-0"
                style={{ width, height, imageRendering: 'pixelated' }}
            />
        </div>
    );
});

export default TerrainGridOverlay;
