import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import { MAT_Z } from './matLayers.js';
import { MAT_EDGE } from './groundScreen.js';
import * as GroundRules from '../../../systems/board/GroundRules.js';

/**
 * The grid while placing: with a Token in the hand, the ground cells it may not stand on take a soft
 * red tint, so a Sailboat's player sees where it cannot go before letting go. The cells it may
 * stand on stay clear: most of the mat is allowed, and lighting it all washed the whole mat over.
 *
 * Shown only when that Token cannot stand everywhere here (TD-5 A): it has a "Stands on", or the
 * Region has water. That is exactly when placement's ground rule is in play (`GroundRules.rulesFor`
 * is not null), and the cells are that rule's own mask, so the picture can never disagree with
 * where a drop lands.
 *
 * Drawn once at pickup, one canvas pixel per cell, stretched over the mat; gone at the drop. With
 * no forbidden cell under the mat there is nothing to draw, and no canvas is mounted.
 * ⚠️ It must stay in the mat's own layer, like the ground (`TerrainCanvas`, `MatPixelLayers.test.js`):
 * a CPU-backed context (`willReadFrequently: true`) and no `will-change`, filter, transform or
 * opacity, or every Token drawn after it is pushed onto a layer of its own while the drag runs.
 */

/** A cell the Token may stand on: left clear. RGBA. */
export const GRID_CLEAR = Object.freeze([0, 0, 0, 0]);
/** A cell it may not: a soft red tint (red is "can't", UI_STYLE). The alpha alternates for a checker. */
export const GRID_FORBIDDEN = Object.freeze([150, 28, 24, 84]);
/** How much the checker changes the alpha, so neighbouring forbidden cells still read as cells. */
const CHECKER = 14;

/** Paint `rules.mask` into `out` (RGBA, one pixel per cell). */
export function paintGrid(rules, out) {
    const { cols, rows } = rules.grid;
    const { mask } = rules;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            const o = i * 4;
            if (mask[i] === 1) {
                out[o] = GRID_CLEAR[0];
                out[o + 1] = GRID_CLEAR[1];
                out[o + 2] = GRID_CLEAR[2];
                out[o + 3] = GRID_CLEAR[3];
                continue;
            }
            out[o] = GRID_FORBIDDEN[0];
            out[o + 1] = GRID_FORBIDDEN[1];
            out[o + 2] = GRID_FORBIDDEN[2];
            out[o + 3] = (r + c) % 2 === 0 ? GRID_FORBIDDEN[3] : GRID_FORBIDDEN[3] - CHECKER;
        }
    }
    return out;
}

/** Whether any cell of `rules.mask` is forbidden. */
function hasForbiddenCell(rules) {
    const { mask } = rules;
    for (let i = 0; i < mask.length; i++) if (mask[i] !== 1) return true;
    return false;
}

/**
 * @param {{mat: {w: number, h: number}}} props  the mat's size, in mat units
 */
export const TerrainGridOverlay = React.memo(function TerrainGridOverlay({ mat }) {
    const { isDragging, activePayload } = useActiveDrag();
    const typeId = isDragging && activePayload?.kind === DRAG_KIND.TOKEN ? activePayload.typeId ?? null : null;

    // Asked once per pickup: the drag context changes only at its start and end.
    const rules = useMemo(() => {
        const found = typeId ? GroundRules.rulesFor(typeId) : null;
        return found && hasForbiddenCell(found) ? found : null;
    }, [typeId]);

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
