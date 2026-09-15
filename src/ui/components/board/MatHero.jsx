import { cn } from '../../utils/cn.js';
import { HERO_HIT_PX } from './boardConstants.js';
import { FLAG_PX } from './flagGeometry.js';
import { useEntityDrag, useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { PixelArt } from '../base/TokenSprite.jsx';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { isElementOpaqueAtPoint } from '../../utils/alphaHitTest.js';
import { EventBus } from '../../../systems/core/EventBus.js';

/**
 * A hero standing on the mat: working a Token, waiting on a spot for a restock,
 * or idle beside their flag.
 *
 * ⭐ **Dragging the hero drags their FLAG** (FP-76) — the player never moves a
 * hero. The payload is `DRAG_KIND.FLAG`, exactly as if the flag itself were
 * picked up: dropped on the mat it moves the flag and the hero goes to their
 * next job; dropped on the Dock it recalls. The hero stays drawn where they are
 * while the flag is in the hand.
 *
 * Left-click opens the hero sheet, right-click recalls them. Both answer **only
 * on opaque pixels** (`data-alpha-test`), so a click on the empty air around the
 * sprite reaches the Token underneath.
 *
 * ## Where it is drawn
 * `left`/`top` are mat units, given by whoever draws it — the hero's box is
 * `HERO_HIT_PX` wide (the clickable part) and one sprite tall, with the 128 px
 * art (FP-77) centred on it. Several heroes may overlap freely: the grid's
 * one-hero-per-tile rule (FPP-6) went with the grid.
 */
export const MatHero = ({
    heroId,
    name,
    sprite,
    left,
    top,
    z,
    glow = null,
    hovered = false,
    onHover,
    onRecall
}) => {
    const drag = useEntityDrag({
        id: `hero-${heroId}`,
        kind: DRAG_KIND.FLAG,
        payload: { heroId, name, from: { hero: true } },
        sourceSurface: DND_SURFACE.BOARD
    });

    // Only a hero carried out of the Dock is ever in the hand (FP-76).
    const { activePayload, isDragging } = useActiveDrag();
    const isThisHeroDragging = isDragging && activePayload?.kind === DRAG_KIND.HERO && activePayload?.heroId === heroId;

    const art = sprite ? resolveSpritePath(sprite) : null;
    const opaque = (e) => !e.currentTarget || isElementOpaqueAtPoint(e.currentTarget, e.clientX, e.clientY);

    return (
        <button
            ref={drag.setNodeRef}
            {...drag.handleProps}
            type="button"
            data-alpha-test="true"
            data-board-hero={heroId}
            aria-label={name || 'Hero'}
            onClick={(e) => {
                if (!opaque(e)) return;   // Transparent pixel: let it reach the Token underneath
                e.stopPropagation();
                EventBus.publish('inspect_hero', { heroId });
            }}
            onContextMenu={(e) => {
                if (!opaque(e)) return;
                e.preventDefault();
                e.stopPropagation();
                onRecall?.(heroId);
            }}
            onMouseEnter={() => onHover?.(heroId)}
            onMouseLeave={() => onHover?.(null)}
            style={{
                left,
                top,
                width: HERO_HIT_PX,
                height: FLAG_PX,
                zIndex: z,
                // A hero follows their Token when it is moved or pushed (FP-68).
                transition: 'left 220ms cubic-bezier(0.2, 0.8, 0.2, 1), top 220ms cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
            className={cn(
                'absolute p-0 m-0 bg-transparent border-0 outline-none',
                'pointer-events-auto cursor-grab active:cursor-grabbing',
                glow,
                isThisHeroDragging && 'opacity-0 pointer-events-none'
            )}
        >
            {art && (
                <div
                    className={cn(
                        'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                        hovered && !drag.isDragging && 'gi-token-hover-pulse'
                    )}
                >
                    <PixelArt
                        src={art}
                        alt={name || 'Hero'}
                        size={FLAG_PX}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    />
                </div>
            )}
        </button>
    );
};

export default MatHero;
