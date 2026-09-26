import { cn } from '../../utils/cn.js';
import { HERO_HIT_PX } from './boardConstants.js';
import { FLAG_PX } from './flagGeometry.js';
import { useEntityDrag, useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { tokenSizeFor, TOKEN_SURFACE, boardScaleAt, PixelArt } from '../base/TokenSprite.jsx';
import { AnimatedHeroSprite } from './AnimatedHeroSprite.jsx';
import { TICK_INTERVAL_MS } from '../../../config/loopConstants.js';

/** A limping hero (HM-6): drained of colour, a touch darker, and a slower walk cycle. */
const LIMP_FILTER = 'grayscale(0.7) brightness(0.8) sepia(0.25)';
const LIMP_FRAME_MS = 250;
import { resolveSpritePath, resolveAnimationPath } from '../../../utils/AssetManager.js';
import { isElementOpaqueAtPoint } from '../../utils/alphaHitTest.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { useMatFit } from './MatFitContext.jsx';

/**
 * A hero standing on the mat: working a Token, or idle beside their flag.
 *
 * ⭐ **Dragging the hero drags their FLAG** (FP-76) — the player never moves a
 * hero. The payload is `DRAG_KIND.FLAG`, exactly as if the flag itself were
 * picked up: dropped on the mat it moves the flag and the hero goes to their
 * next job; dropped on the Dock it recalls. The hero stays drawn where they are
 * while the flag is in the hand.
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
    onRecall,
    animationState = 'idle',
    moving = false,
    facing = 1,
    limp = false
}) => {
    const drag = useEntityDrag({
        id: `hero-${heroId}`,
        kind: DRAG_KIND.FLAG,
        payload: { heroId, name, from: { hero: true } },
        sourceSurface: DND_SURFACE.BOARD
    });

    const { activePayload, isDragging } = useActiveDrag();
    const isThisHeroDragging = isDragging && activePayload?.kind === DRAG_KIND.HERO && activePayload?.heroId === heroId;

    const animArt = sprite ? resolveAnimationPath(sprite) : null;
    const staticArt = sprite ? resolveSpritePath(sprite) : null;
    const opaque = (e) => !e.currentTarget || isElementOpaqueAtPoint(e.currentTarget, e.clientX, e.clientY);
    
    const fit = useMatFit();
    const artScale = boardScaleAt(fit);
    const artPx = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, artScale);

    // ⭐ Walking is the engine's (Hero Movement M1): `HeroMotion` moves the hero
    // ten times a second and says whether they are moving and which way they
    // face. The screen glides for exactly one tick between those steps, so the
    // walk looks continuous. (A distance-guessed slide stood here before
    // walking existed; it lagged and fought the real movement.)
    const isWalking = moving;
    const facingLeft = facing < 0;

    const activeAnimation = isWalking ? 'walk' : animationState;

    return (
        <button
            ref={drag.setNodeRef}
            {...drag.handleProps}
            type="button"
            data-alpha-test="true"
            data-board-hero={heroId}
            data-hero-limp={limp ? 'true' : undefined}
            aria-label={name || 'Hero'}
            onClick={(e) => {
                if (!opaque(e)) return;
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
                transition: isWalking
                    ? `left ${TICK_INTERVAL_MS}ms linear, top ${TICK_INTERVAL_MS}ms linear`
                    : 'none'
            }}
            className={cn(
                'absolute p-0 m-0 bg-transparent border-0 outline-none',
                'pointer-events-auto cursor-grab active:cursor-grabbing',
                glow,
                isThisHeroDragging && 'opacity-0 pointer-events-none'
            )}
        >
            {(animArt || staticArt) && (
                <div
                    className={cn(
                        'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                        hovered && !drag.isDragging && 'gi-token-hover-pulse'
                    )}
                    // A defeated hero limping home looks wounded (HM-6).
                    style={limp ? { filter: LIMP_FILTER } : undefined}
                >
                    {animArt ? (
                        <AnimatedHeroSprite
                            src={animArt}
                            alt={name || 'Hero'}
                            size={artPx}
                            animationState={activeAnimation}
                            facingLeft={facingLeft}
                            frameMs={limp ? LIMP_FRAME_MS : undefined}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        />
                    ) : (
                        <PixelArt
                            src={staticArt}
                            alt={name || 'Hero'}
                            size={artPx}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-200"
                            style={{ transform: facingLeft ? 'scaleX(-1)' : 'none' }}
                        />
                    )}
                </div>
            )}
        </button>
    );
};

export default MatHero;
