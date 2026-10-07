import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { HERO_HIT_PX } from './boardConstants.js';
import { FLAG_PX } from './flagGeometry.js';
import { useEntityDrag, useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { tokenSizeFor, TOKEN_SURFACE, boardScaleAt, PixelArt } from '../base/TokenSprite.jsx';
import { AnimatedHeroSprite } from './AnimatedHeroSprite.jsx';
import { TICK_INTERVAL_MS } from '../../../config/loopConstants.js';

/** A limping hero: drained of colour, a touch darker, and a slower walk cycle. */
const LIMP_FILTER = 'grayscale(0.7) brightness(0.8) sepia(0.25)';
const LIMP_FRAME_MS = 250;
import { resolveSpritePath, resolveAnimationPath } from '../../../utils/AssetManager.js';
import { isElementOpaqueAtPoint } from '../../utils/alphaHitTest.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { useMatFit } from './MatFitContext.jsx';
import { isRealAttack } from './hitAnimations.js';
import { COMBAT_ATTACK_EVENT } from './TokenHitArt.jsx';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as HeroMotion from '../../../systems/board/HeroMotion.js';

/**
 * When this hero's last real attack began (`performance.now()`), while `listening`: a fighting
 * hero idles and plays the attack row once per `combat_hero_attack`. The enemy's knockback is
 * timed from the same event (`TokenHitArt`), so the blow and the reaction meet on the strike
 * frame. A stunned attempt is not an attack: the hero stays idle.
 */
function useLastAttackAt(heroId, listening) {
    const [at, setAt] = useState(null);
    useEffect(() => {
        if (!listening || !heroId) return undefined;
        return EventBus.subscribe(COMBAT_ATTACK_EVENT, (p) => {
            if (p?.heroId !== heroId || !isRealAttack(p)) return;
            setAt(typeof performance !== 'undefined' ? performance.now() : Date.now());
        });
    }, [heroId, listening]);
    return listening ? at : null;
}

/**
 * A hero standing on the mat: working a Token, or idle beside their flag.
 * **Dragging the hero drags their FLAG**: the player never moves a hero. The payload is
 * `DRAG_KIND.FLAG`, exactly as if the flag itself were picked up: dropped on the mat it moves
 * the flag and the hero goes to their next job; dropped on the Dock it recalls. The hero stays
 * drawn where they are while the flag is in the hand.
 */
/**
 * Where a hero's 64 × 128 box goes for a point, in mat units: centred on it. Null for no
 * point. `MatBoard.heroPlacement` is this.
 */
export function heroBoxAt(point) {
    if (!point || point.x == null || point.y == null) return null;
    return { left: point.x - HERO_HIT_PX / 2, top: point.y - FLAG_PX / 2 };
}

export const MatHero = memo(function MatHero({
    heroId,
    name,
    sprite,
    left,
    top,
    z,
    outline = null,
    hovered = false,
    onHover,
    onRecall,
    animationState = 'idle',
    moving = false,
    facing = 1,
    limp = false
}) {
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

    // Walking is the engine's: `HeroMotion` moves the hero ten times a second and says whether
    // they are moving and which way they face. The screen glides for exactly one tick between
    // those steps, so the walk looks continuous.
    const isWalking = moving;
    const facingLeft = facing < 0;

    // A moving hero is handed no point (so their steps do not redraw the mat). Read it live,
    // and let each step move the box directly.
    const followsItself = left == null || top == null;
    const live = followsItself ? heroBoxAt(HeroMotion.bodyView(heroId)) : null;
    const boxLeft = live ? live.left : (left ?? 0);
    const boxTop = live ? live.top : (top ?? 0);
    const boxRef = useRef(null);
    const setNodeRef = drag.setNodeRef;
    const setBoxRef = useCallback((el) => { boxRef.current = el; setNodeRef(el); }, [setNodeRef]);
    // A layout effect, so it is listening from the commit on, and it catches
    // up at once on any step taken between the render and now.
    useLayoutEffect(() => {
        if (!followsItself) return undefined;
        const follow = () => {
            const at = heroBoxAt(HeroMotion.bodyView(heroId));
            if (at && boxRef.current) boxRef.current.style.transform = `translate(${at.left}px, ${at.top}px)`;
        };
        follow();
        return EventBus.subscribe(BOARD_EVENTS.HEROES_WALKED, follow);
    }, [followsItself, heroId]);

    const activeAnimation = isWalking ? 'walk' : animationState;
    const attackAt = useLastAttackAt(heroId, activeAnimation === 'combat');

    return (
        <button
            ref={setBoxRef}
            {...drag.handleProps}
            type="button"
            data-alpha-test="true"
            data-board-hero={heroId}
            data-hero-limp={limp ? 'true' : undefined}
            data-outline={outline || undefined}
            aria-label={name || 'Hero'}
            onClick={(e) => {
                if (!opaque(e)) return;
                e.stopPropagation();
                EventBus.publish(UI_EVENTS.INSPECT_HERO, { heroId });
            }}
            onContextMenu={(e) => {
                if (!opaque(e)) return;
                e.preventDefault();
                e.stopPropagation();
                onRecall?.(heroId);
            }}
            onMouseEnter={() => onHover?.(heroId)}
            onMouseLeave={() => onHover?.(null)}
            // A walker moves by `transform`: a step costs no layout and the ground under the hero
            // is not redrawn. Always this style, walking or not, so a box switching from left/top
            // to a transform would not slide in from the mat corner. ⚠️ Never add `will-change` here: it measured 3× slower.
            style={{
                left: 0,
                top: 0,
                transform: `translate(${boxLeft}px, ${boxTop}px)`,
                width: HERO_HIT_PX,
                height: FLAG_PX,
                zIndex: z,
                transition: isWalking
                    ? `transform ${TICK_INTERVAL_MS}ms linear`
                    : 'none'
            }}
            className={cn(
                'absolute p-0 m-0 bg-transparent border-0 outline-none',
                'pointer-events-auto cursor-grab active:cursor-grabbing',
                isThisHeroDragging && 'opacity-0 pointer-events-none'
            )}
        >
            {(animArt || staticArt) && (
                <div
                    className={cn(
                        'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                        hovered && !drag.isDragging && 'gi-token-hover-hop'
                    )}
                    style={limp ? { filter: LIMP_FILTER } : undefined}
                >
                    {animArt ? (
                        <AnimatedHeroSprite
                            src={animArt}
                            heroId={heroId}
                            alt={name || 'Hero'}
                            size={artPx}
                            animationState={activeAnimation}
                            attackAt={attackAt}
                            facingLeft={facingLeft}
                            frameMs={limp ? LIMP_FRAME_MS : undefined}
                            outline={outline}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        />
                    ) : (
                        <PixelArt
                            src={staticArt}
                            alt={name || 'Hero'}
                            size={artPx}
                            outline={outline}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-200"
                            style={{ transform: facingLeft ? 'scaleX(-1)' : 'none' }}
                        />
                    )}
                </div>
            )}
        </button>
    );
});

export default MatHero;
