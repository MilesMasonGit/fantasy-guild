import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMatFit } from './MatFitContext.jsx';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { MAT_Z } from './matLayers.js';
import { buildScreenPass, screenGrid } from './groundScreen.js';
import { groundSheetsReady, loadGroundSheets, onGroundSheetsReady, mutedSheet, drawnSheet } from './groundSheets.js';
import { timedBuild } from './groundBuilds.js';
import { buildGroundPlan } from '../../../systems/board/TerrainSurface.js';
import { sheetPath, propSheetPath } from '../../../config/registries/terrainRegistry.js';
import { onTuningChanged } from '../../../config/playmatTuning.js';

/**
 * The playmat's ground: the active Region's, drawn under every Token as one picture.
 *
 * Built in two stages, never in a tick or a frame (terrain roadmap decision 7):
 * - **the plan** (`buildGroundPlan`: which ground, band, wear and scatter at every 2-unit pixel),
 *   when the Region's ground changes (a travel, a load), a tuning slider moves, or the sheets first
 *   arrive;
 * - **the screen pass** (`groundScreen.js`: the plan resampled onto ground pixels of
 *   `boardScaleAt(fit)` mat units, so one ground pixel is one Token pixel on screen), when the
 *   plan changes or the fit does, {@link FIT_SETTLE_MS} after the fit stops moving.
 *
 * ⚠️ **It must stay in the mat's own layer** (`MatPixelLayers.test.js`, `bench:profile`). An
 * accelerated canvas is a composited layer, and every Token drawn after it would be pushed onto a
 * layer by overlap: soft, a pixel off, and more Layerize every frame (T-145). So the context is
 * asked for with `willReadFrequently: true` (CPU-backed, painted into its parent's layer), and the
 * canvas carries no `will-change`, filter, transform or opacity. The mute is in the sheets' bytes
 * (`groundSheets.js`); the corners, the light edge and the inset shadow are in the picture.
 *
 * Scenery only: no pointer, nothing to hover. Dropping and inspecting belong to the Tokens above.
 */

/** How long the fit must hold still before the picture is redrawn for it (a window being dragged). */
export const FIT_SETTLE_MS = 250;

/** How long a burst of tuning-slider moves is gathered into one rebuild. */
export const TUNING_SETTLE_MS = 50;

/** Whether every sheet has decoded; starts the decoding on first use. */
function useSheetsReady() {
    const [ready, setReady] = useState(groundSheetsReady);
    useEffect(() => {
        const off = onGroundSheetsReady(() => { if (groundSheetsReady()) setReady(true); });
        if (groundSheetsReady()) setReady(true);
        else loadGroundSheets();
        return off;
    }, []);
    return ready;
}

/** A count that moves once per burst of tuning-slider moves. */
function useTuningRevision() {
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let timer = null;
        const off = onTuningChanged(() => {
            if (timer) return;
            timer = setTimeout(() => {
                timer = null;
                setRevision(n => n + 1);
            }, TUNING_SETTLE_MS);
        });
        return () => {
            off();
            clearTimeout(timer);
        };
    }, []);
    return revision;
}

/**
 * The fit the picture is drawn for: the live fit once it has held still for
 * {@link FIT_SETTLE_MS}, or at once while nothing has been drawn yet.
 */
function useSettledFit(fit, waitForIt) {
    const [settled, setSettled] = useState(fit);
    useEffect(() => {
        if (fit === settled) return undefined;
        if (!waitForIt) {
            setSettled(fit);
            return undefined;
        }
        const timer = setTimeout(() => setSettled(fit), FIT_SETTLE_MS);
        return () => clearTimeout(timer);
    }, [fit, settled, waitForIt]);
    return settled;
}

const groundSheet = (id) => mutedSheet(sheetPath(id));
const propSheet = (id, asDrawn) => (asDrawn ? drawnSheet(propSheetPath(id)) : mutedSheet(propSheetPath(id)));

/**
 * @param {{ground: object}} props  the active Region's ground (`regionGround`), the same object
 *   while nothing about it changes
 */
export const TerrainCanvas = React.memo(function TerrainCanvas({ ground }) {
    const fit = useMatFit() || 1;
    const ready = useSheetsReady();
    const tuningRevision = useTuningRevision();
    const [hasPicture, setHasPicture] = useState(false);
    const drawFit = useSettledFit(fit, hasPicture);

    // ⚠️ `tuningRevision` is a dependency on purpose: the plan reads the tuning sliders, which no
    // prop carries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const plan = useMemo(() => (ready ? timedBuild('plan', () => buildGroundPlan(ground)) : null), [ready, ground, tuningRevision]);

    const unit = boardScaleAt(drawFit);
    const { w, h } = ground.mat;
    const grid = useMemo(() => screenGrid({ w, h }, unit), [w, h, unit]);

    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const imageRef = useRef(null);

    // Drawn before the browser paints: a canvas whose size changed has just been cleared.
    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !plan) return;
        if (!contextRef.current) contextRef.current = canvas.getContext('2d', { willReadFrequently: true });
        const ctx = contextRef.current;
        if (!ctx) return;
        let image = imageRef.current;
        if (!image || image.width !== grid.cols || image.height !== grid.rows) {
            image = ctx.createImageData(grid.cols, grid.rows);
            imageRef.current = image;
        }
        timedBuild('screen', () => buildScreenPass(plan, {
            mat: { w, h }, unit: grid.unit, sheet: groundSheet, prop: propSheet, out: image.data
        }));
        ctx.putImageData(image, 0, 0);
        setHasPicture(true);
    }, [plan, grid, w, h]);

    return (
        <canvas
            ref={canvasRef}
            data-terrain-ground
            aria-hidden="true"
            width={grid.cols}
            height={grid.rows}
            className="absolute left-0 top-0 pointer-events-none"
            style={{
                width: grid.cols * grid.unit,
                height: grid.rows * grid.unit,
                zIndex: MAT_Z.GROUND,
                imageRendering: 'pixelated'
            }}
        />
    );
});

export default TerrainCanvas;
