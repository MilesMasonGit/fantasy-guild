import React, { useCallback, useRef, useState } from 'react';
import { useBoardScale } from '../../hooks/useBoardScale.js';
import { MAT_W, MAT_H } from '../../../config/matGeometry.js';
import { dropOnMat } from './dropOnMat.js';
import { pointerToMat } from './matPoint.js';
import { MatBoard } from './MatBoard.jsx';
import { useEngine } from '../../hooks/useEngine.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { GameState } from '../../../state/GameState.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as StationRecipe from '../../../systems/board/StationRecipe.js';
import { bandStationRecipes } from '../../../systems/board/RecipeBands.js';
import { StationRecipeModal } from './StationRecipeModal.jsx';

/**
 * The playmat: one drop surface, scaled to fit, with `MatBoard` drawing what is
 * on it.
 *
 * Since slice 1.6c-2 this file owns only three things — **how big the mat is
 * drawn**, **that the whole mat is a single drop target**, and the station
 * recipe picker. Everything drawn on the mat is `MatBoard`'s, and everything
 * that happens on a drop is `dropOnMat`'s.
 */

/** What the playmat's own drop target takes: any Token, and a hero or a flag with a hero. */
export function matAccepts(p) {
    if (p?.kind === DRAG_KIND.TOKEN) return true;
    if (p?.kind === DRAG_KIND.HERO || p?.kind === DRAG_KIND.FLAG) return !!p.heroId;
    return false;
}

export const Board = ({ onInspectToken, onClearInspect, inspectedHeroId = null }) => {
    const { EventBus } = useEngine();

    // How much the 1760 × 1126 u mat is shrunk to fit this window (CR2-179).
    const fit = useBoardScale(MAT_W, MAT_H);

    // The mat's own element: every screen pointer is measured against it.
    const matRef = useRef(null);

    /**
     * ⭐ The whole mat is one drop target. There are no tiles to aim at, so a
     * drop is a **point**: where the player let go, in mat units.
     */
    const matDrop = useEntityDrop({
        id: 'mat',
        surface: DND_SURFACE.BOARD,
        accepts: matAccepts,
        onDrop: (p, info) => {
            const el = matRef.current;
            const point = el ? pointerToMat(info?.pointer, el.getBoundingClientRect()) : null;
            const result = dropOnMat(p, point);
            // A Token dropped well outside the landing area flies back (FP-93).
            return result?.flyBack ? false : undefined;
        }
    });
    const setMatRef = useCallback((node) => {
        matRef.current = node;
        matDrop.setNodeRef(node);
    }, [matDrop.setNodeRef]); // eslint-disable-line react-hooks/exhaustive-deps

    /**
     * Which station's recipe picker is open, by **Token instance id**. Kept here
     * rather than in the global inspect selection because the picker belongs to
     * one Token instance, not to a Token type.
     */
    const [recipeId, setRecipeId] = useState(null);
    const handleOpenRecipes = useCallback((id) => setRecipeId(id), []);
    const closeRecipes = useCallback(() => setRecipeId(null), []);

    const recipeInstance = recipeId ? BoardState.getTokenById(recipeId) : null;
    const recipeDef = recipeInstance ? getTokenType(recipeInstance.typeId) : null;
    const recipeBanding = recipeDef
        ? bandStationRecipes(recipeDef, BoardState.workerOf(recipeId), GameState.state?.heroes || [])
        : null;

    const handleSelectRecipe = useCallback((selectedRecipeId) => {
        if (!recipeId) return;
        const instance = BoardState.getTokenById(recipeId);
        // `setSelectedRecipe` is the only writer of `selectedRecipeId`, and it
        // refuses any id outside this station's own pool (P2).
        if (!StationRecipe.setSelectedRecipe(instance, selectedRecipeId)) return;
        // The gear badge's tooltip re-reads the Token on `state_changed`.
        EventBus?.publish('state_changed', {});
        setRecipeId(null);
    }, [recipeId, EventBus]);

    return (
        // `min-w-0` / `min-h-0` are load-bearing: without them this box grows to
        // its natural content size instead of reporting the space it actually
        // has, and the measurement below would always say "everything fits".
        <div
            ref={fit.ref}
            className="w-full h-full min-w-0 min-h-0 flex items-center justify-center p-8 overflow-hidden"
        >
            {/* Outer box reserves the mat's ON-SCREEN size, so the surrounding
                layout centres the scaled mat rather than the natural one. */}
            <div className="relative shrink-0" style={{ width: fit.size, height: fit.height }}>
                <div
                    ref={setMatRef}
                    {...matDrop.droppableProps}
                    data-board-origin
                    data-natural-width={MAT_W}
                    className="relative shrink-0"
                    style={{
                        width: MAT_W,
                        height: MAT_H,
                        transform: `scale(${fit.scale})`,
                        transformOrigin: 'top left'
                    }}
                >
                    <MatBoard
                        inspectedHeroId={inspectedHeroId}
                        onInspectToken={onInspectToken}
                        onClearInspect={onClearInspect}
                        onOpenRecipes={handleOpenRecipes}
                    />
                </div>
            </div>

            {/* Mounted only while open. Left mounted, the modal keeps rendering
                after the picker closes — with no station selected it has no
                pool to describe, so it reads as empty for a moment before
                Headless UI's leave transition retires it. */}
            {recipeId && recipeDef && (
                <StationRecipeModal
                    isOpen
                    onClose={closeRecipes}
                    tokenName={recipeInstance ? tokenName(recipeInstance.typeId) : null}
                    banding={recipeBanding}
                    selectedRecipeId={recipeInstance?.selectedRecipeId || null}
                    onSelect={handleSelectRecipe}
                />
            )}
        </div>
    );
};

export default Board;
