import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useBoardScale } from '../../hooks/useBoardScale.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { dropOnMat, matAccepts } from './dropOnMat.js';
import { pointerToMat } from './matPoint.js';
import { MatBoard } from './MatBoard.jsx';
import { PerfProfiler } from '../../dev/perf/PerfProfiler.jsx';
import { ErrorBoundary } from '../base/ErrorBoundary.jsx';
import { MatFitProvider, setLiveMatFit } from './MatFitContext.jsx';
import * as BoardState from '../../../systems/board/BoardState.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE } from '../../dnd/dragConstants.js';
import { requestRecipeList } from './recipeFlip.js';
import { isShopPayload, pointerOverShopPanel } from '../drawer/ShopPanel.jsx';

/**
 * The playmat: one drop surface, scaled to fit, with `MatBoard` drawing what is on it.
 * This file owns only two things: **how big the mat is drawn** and **that the whole mat is a
 * single drop target**. Everything drawn on the mat is
 * `MatBoard`'s, and everything that happens on a drop is `dropOnMat`'s, what the mat takes
 * included (`matAccepts`, shared with the right-click's orders).
 */
export { matAccepts };

/**
 * How the mat is fitted to the window: CSS `zoom`, never `transform: scale`.
 * Under a transform Chrome lays the mat out in mat units and rounds every picture's box to whole
 * mat units before the scale, so a 166.23-unit Token lands 127.8 or 128.6 px wide and one row of
 * its art pixels is drawn a pixel thin or thick (and its outline slips against it). Zoomed, the mat
 * is laid out at screen size and rounded in screen pixels, so every sprite `boardScaleAt` sizes is
 * exactly its whole multiple of the art. `getBoundingClientRect()` answers in screen pixels and
 * `offsetWidth` in mat units, as they did under the transform.
 * ⚠️ `isolation`: the mat must stay a stacking context (`matLayers.js`: its z-values run to tens of
 * millions); a transform made one, zoom does not.
 */
export function matZoomStyle(w, h, fit) {
    return { width: w, height: h, zoom: fit, isolation: 'isolate' };
}

export const Board = ({ onInspectToken, onClearInspect, inspectedHeroId = null, inspectedTokenId = null }) => {
    // How big the mat is (the Mat Tuner can change it live), and how much it is then shrunk to
    // fit this window.
    const mat = useMatSize();
    const fit = useBoardScale(mat.w, mat.h);
    // The hero dock under the mat draws heroes at the mat's art size.
    useEffect(() => { setLiveMatFit(fit.scale); }, [fit.scale]);

    // The mat's own element: every screen pointer is measured against it.
    const matRef = useRef(null);

    /**
     * The whole mat is one drop target. There are no tiles to aim at, so a drop is a
     * **point**: where the player let go, in mat units.
     */
    const matDrop = useEntityDrop({
        id: 'mat',
        surface: DND_SURFACE.BOARD,
        accepts: matAccepts,
        onDrop: (p, info) => {
            // A Shop Token let go over the Shop panel or its lip, which cover the mat's foot,
            // is a plain cancel, not a purchase.
            if (isShopPayload(p) && pointerOverShopPanel(info?.pointer)) return false;
            const el = matRef.current;
            const point = el ? pointerToMat(info?.pointer, el.getBoundingClientRect()) : null;
            const result = dropOnMat(p, point);
            // A Token dropped well outside the landing area flies back.
            return result?.flyBack ? false : undefined;
        }
    });
    const setMatRef = useCallback((node) => {
        matRef.current = node;
        matDrop.setNodeRef(node);
    }, [matDrop.setNodeRef]); // eslint-disable-line react-hooks/exhaustive-deps

    // The recipe gear opens the Token's card on its recipe list.
    const handleOpenRecipes = useCallback((id) => {
        const instance = BoardState.getTokenById(id);
        if (!instance) return;
        requestRecipeList(id);
        const rect = document.querySelector(`[data-token-id="${id}"]`)?.getBoundingClientRect() || null;
        onInspectToken?.(instance.typeId, rect, id);
    }, [onInspectToken]);

    /**
     * What the mat draws, as one element kept while its inputs hold.
     * ⚠️ This component holds the mat's drop hook, which dnd-kit re-renders at every drag start,
     * end and change of target; a kept element is not redrawn with it.
     */
    const matContents = useMemo(() => (
        <MatFitProvider value={fit.scale}>
            {/**
             * A render error on the mat goes to a 'Something went wrong here'
             * panel in this box only, rather than unmounting the whole app while
             * the engine keeps ticking and saving underneath it.
             */}
            <ErrorBoundary label="MatBoard">
                {/**
                 * Counts every React commit in the mat SUBTREE for the Perf HUD (a
                 * hero's frame step counts too; MatBoard's own renders are counted
                 * inside it): dev builds only, and only when armed.
                 */}
                <PerfProfiler id="MatBoard">
                    <MatBoard
                        inspectedHeroId={inspectedHeroId}
                        inspectedTokenId={inspectedTokenId}
                        onInspectToken={onInspectToken}
                        onClearInspect={onClearInspect}
                        onOpenRecipes={handleOpenRecipes}
                    />
                </PerfProfiler>
            </ErrorBoundary>
        </MatFitProvider>
    ), [fit.scale, inspectedHeroId, inspectedTokenId, onInspectToken, onClearInspect, handleOpenRecipes]);

    return (
        // `min-w-0` / `min-h-0` are load-bearing: without them this box grows to
        // its natural content size instead of reporting the space it actually
        // has, and the measurement below would always say "everything fits".
        // ⚠️ `overflow-clip`, not `overflow-hidden`: the mat is fitted to this box with its
        // padding, so it can overhang the padding a little, and a hidden box is still a scroll
        // container. Focus handed back to a flag or hero partly in the overhang scrolled it, and
        // the whole mat jumped up under the top bar.
        <div
            ref={fit.ref}
            className="w-full h-full min-w-0 min-h-0 flex items-center justify-center p-8 overflow-clip"
        >
            {/* Outer box reserves the mat's ON-SCREEN size, so the surrounding
                layout centres the scaled mat rather than the natural one. */}
            <div className="relative shrink-0" style={{ width: fit.size, height: fit.height }}>
                <div
                    ref={setMatRef}
                    {...matDrop.droppableProps}
                    data-board-origin
                    data-natural-width={mat.w}
                    data-board-scale={fit.scale}
                    className="relative shrink-0"
                    style={matZoomStyle(mat.w, mat.h, fit.scale)}
                >
                    {/**
                     * The sprites on the mat need to know what this zoom is about to do to
                     * them (`MatFitProvider`), so they can step to a whole multiple of ART_PX
                     * through it. Nothing else on the mat cares: the zoom handles the rest.
                     */}
                    {matContents}
                </div>
            </div>
        </div>
    );
};

export default Board;
