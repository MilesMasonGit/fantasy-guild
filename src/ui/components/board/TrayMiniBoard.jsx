import React, { useCallback, useRef } from 'react';
import { cn } from '../../utils/cn.js';
import { MAT_W, MAT_H, artRadius } from '../../../config/matGeometry.js';
import { useGameState } from '../../hooks/useGameState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE, DRAG_KIND } from '../../dnd/dragConstants.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import * as BoardState from '../../../systems/board/BoardState.js';
import { pointerToMat } from './matPoint.js';
import { dropOnMat } from './dropOnMat.js';

/**
 * ⭐ **The mini mat** — the playmat drawn small on the Tray, so a Token can
 * still be placed while a drawer covers the real board (FP-97).
 *
 * Until slice 1.6d this was a 6×6 grid of cells, each its own drop target. The
 * owner's framing rule leaves no tiles anywhere, so it is now what its name
 * always claimed: **a scaled picture of the mat**, with free placement on it.
 * Every Token on the real mat is drawn here at its own point, shrunk; a drop
 * anywhere on it is converted to a mat point by this board's own scale and
 * handed to the same `dropOnMat` the playmat uses. Placing here and placing
 * there cannot drift apart, because there is only one of each.
 *
 * ## The scale takes care of itself
 * The mini mat is laid out in **percentages of `MAT_W` × `MAT_H`**, so nothing
 * measures anything to draw. For the drop, `pointerToMat` already divides the
 * pointer's offset by `rect.width / MAT_W` — the same maths the full-size mat
 * uses, which at this size simply happens to be a much smaller number. So a
 * pointer 30% across this board and a pointer 30% across the playmat produce the
 * very same mat point.
 *
 * ⚠️ Slice 1.9 retires this entirely, when the drawer slides aside instead
 * (FP-45).
 */

/** What the mini mat takes: any Token, exactly as the playmat does. */
const accepts = (p) => p?.kind === DRAG_KIND.TOKEN;

export const TrayMiniBoard = ({ className }) => {
    const matRef = useRef(null);

    const tokens = useGameState(
        () => BoardState.tokens().map(t => ({
            id: t.id,
            typeId: t.typeId,
            x: t.x,
            y: t.y,
            size: getTokenType(t.typeId)?.size || 1
        })),
        [BOARD_EVENTS.TILE_CHANGED, 'state_changed'],
        null
    ) || [];

    const handleDrop = useCallback((payload, info) => {
        const el = matRef.current;
        if (!el) return undefined;
        const point = pointerToMat(info?.pointer, el.getBoundingClientRect());
        const result = dropOnMat(payload, point);
        // Nowhere to put it: the drag counts as a miss so the ghost flies back.
        return result?.flyBack ? false : undefined;
    }, []);

    const drop = useEntityDrop({
        id: 'mini-mat',
        surface: DND_SURFACE.MINIBOARD,
        accepts,
        onDrop: handleDrop
    });

    const setRef = useCallback((node) => {
        matRef.current = node;
        drop.setNodeRef(node);
    }, [drop.setNodeRef]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div
            data-dnd-region={DND_SURFACE.MINIBOARD}
            className={cn('pointer-events-auto w-full flex items-center justify-center px-1', className)}
        >
            <div
                ref={setRef}
                {...drop.droppableProps}
                data-mini-mat
                data-dnd-region={DND_SURFACE.MINIBOARD}
                className={cn(
                    'relative w-full max-w-[280px] md:max-w-[320px] rounded-lg overflow-hidden',
                    'bg-black/90 border-2 border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.9)] backdrop-blur-md',
                    'transition-all duration-100',
                    drop.valid && '!border-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.9)]',
                    drop.invalid && '!border-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.9)]'
                )}
                style={{ aspectRatio: `${MAT_W} / ${MAT_H}` }}
            >
                {tokens.map(t => {
                    const r = artRadius(t.size);
                    return (
                        <div
                            key={t.id}
                            data-mini-token={t.id}
                            className="absolute pointer-events-none"
                            style={{
                                left: `${((t.x - r) / MAT_W) * 100}%`,
                                top: `${((t.y - r) / MAT_H) * 100}%`,
                                width: `${((r * 2) / MAT_W) * 100}%`,
                                height: `${((r * 2) / MAT_H) * 100}%`
                            }}
                        >
                            <TokenSprite
                                typeId={t.typeId}
                                surface={TOKEN_SURFACE.BOARD}
                                alt={tokenName(t.typeId) || 'Token'}
                                className="w-full h-full"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TrayMiniBoard;
