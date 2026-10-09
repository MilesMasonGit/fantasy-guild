import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { HERO_HIT_PX } from './boardConstants.js';
import { FLAG_PX } from './flagGeometry.js';
import { useEntityDrag, useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { tokenSizeFor, TOKEN_SURFACE, boardScaleAt, PixelArt } from '../base/TokenSprite.jsx';
import { AnimatedHeroSprite } from './AnimatedHeroSprite.jsx';
import { TICK_INTERVAL_MS } from '../../../config/loopConstants.js';

const NO_POINTER = Object.freeze({ pointerEvents: 'none' });

/** A limping hero: drained of colour, a touch darker, and a slower walk cycle. */
const LIMP_FILTER = 'grayscale(0.7) brightness(0.8) sepia(0.25)';
const LIMP_FRAME_MS = 250;
import { resolveSpritePath, resolveAnimationPath } from '../../../utils/AssetManager.js';
import { isElementOpaqueAtPoint } from '../../utils/alphaHitTest.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { useMatFit } from './MatFitContext.jsx';
import { isRealAttack } from './hitAnimations.js';
import { COMBAT_ATTACK_EVENT } from './TokenHitArt.jsx';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { useDrawn } from '../../dev/perf/drawSwitches.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as HeroMotion from '../../../systems/board/HeroMotion.js';
import { useGameState } from '../../hooks/useGameState.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { HealthBar } from './HealthBar.jsx';
import { heroBarPlace } from './healthBar.js';

/**
 * A fighting hero's health bar, just over their figure's head. Reads the hero's HP as a flat
 * projection of primitives (the engine mutates `hp` in place), so it redraws only when the
 * number moves.
 */
function HeroHealthBar({ heroId, artPx }) {
    const hp = useGameState(
        (state) => {
            const h = (state.heroes || []).find(x => x.id === heroId);
            return h ? { cur: h.hp?.current ?? 0, max: h.hp?.max ?? 100 } : null;
        },
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.STATE_CHANGED],
        null,
        { deps: [heroId] }
    );
    if (!hp || !(hp.max > 0)) return null;
    return (
        <HealthBar
            who="hero"
            of={heroId}
            cur={hp.cur}
            max={hp.max}
            style={heroBarPlace(artPx)}
        />
    );
}

/** How long a hero's bar stays up after their fight ends, in ms. */
export const HERO_BAR_LINGER_MS = 3000;

/** True while `fighting`, and for `HERO_BAR_LINGER_MS` after it stops. */
function useBarLinger(fighting) {
    const [linger, setLinger] = useState(false);
    useEffect(() => {
        if (fighting) { setLinger(true); return undefined; }
        const t = setTimeout(() => setLinger(false), HERO_BAR_LINGER_MS);
        return () => clearTimeout(t);
    }, [fighting]);
    return fighting || linger;
}

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
        }, UI_LISTENER);
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

/**
 * ⚠️ Two components on purpose. dnd-kit re-renders every component holding a drag hook at each
 * drag start, end and change of target; the hook lives in this thin shell, and the figure
 * (`MatHeroBody`) is memoised on what it draws, so a drag elsewhere does not redraw it.
 */
export const MatHero = memo(function MatHero(props) {
    const { heroId, name } = props;
    const drag = useEntityDrag({
        id: `hero-${heroId}`,
        kind: DRAG_KIND.FLAG,
        payload: { heroId, name, from: { hero: true } },
        sourceSurface: DND_SURFACE.BOARD
    });
    // This hero carried out of the hero bar or the hero sheet: the figure on the mat steps aside.
    const { activePayload, isDragging } = useActiveDrag();
    const heroCarried = isDragging && activePayload?.kind === DRAG_KIND.HERO && activePayload?.heroId === heroId;
    return (
        <MatHeroBody
            {...props}
            heroCarried={heroCarried}
            flagHeld={drag.isDragging}
            dragRef={drag.setNodeRef}
            dragProps={drag.handleProps}
        />
    );
});

const MatHeroBody = memo(function MatHeroBody({
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
    limp = false,
    fighting = false,
    heroCarried = false,
    flagHeld = false,
    dragRef,
    dragProps
}) {

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
    const walkDrawn = useDrawn('walkDraw');
    const barsDrawn = useDrawn('bubbles');
    const barShown = useBarLinger(fighting);
    const facingLeft = facing < 0;

    // A moving hero is handed no point (so their steps do not redraw the mat). Read it live,
    // and let each step move the box directly.
    const followsItself = left == null || top == null;
    const live = followsItself ? heroBoxAt(HeroMotion.bodyView(heroId)) : null;
    const boxLeft = live ? live.left : (left ?? 0);
    const boxTop = live ? live.top : (top ?? 0);
    const boxRef = useRef(null);
    const setBoxRef = useCallback((el) => { boxRef.current = el; dragRef?.(el); }, [dragRef]);
    // A layout effect, so it is listening from the commit on, and it catches
    // up at once on any step taken between the render and now.
    useLayoutEffect(() => {
        if (!followsItself) return undefined;
        const follow = () => {
            const at = heroBoxAt(HeroMotion.bodyView(heroId));
            if (at && boxRef.current) boxRef.current.style.transform = `translate(${at.left}px, ${at.top}px)`;
        };
        follow();
        return EventBus.subscribe(BOARD_EVENTS.HEROES_WALKED, follow, UI_LISTENER);
    }, [followsItself, heroId]);

    const activeAnimation = isWalking ? 'walk' : animationState;
    const attackAt = useLastAttackAt(heroId, activeAnimation === 'combat');

    return (
        <button
            ref={setBoxRef}
            {...dragProps}
            type="button"
            data-alpha-test="true"
            data-alpha-flip={facingLeft ? 'x' : undefined}
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
                transition: isWalking && walkDrawn
                    ? `transform ${TICK_INTERVAL_MS}ms linear`
                    : 'none'
            }}
            className={cn(
                'absolute p-0 m-0 bg-transparent border-0 outline-none',
                'pointer-events-auto cursor-grab active:cursor-grabbing',
                heroCarried && 'opacity-0 pointer-events-none'
            )}
        >
            {(animArt || staticArt) && (
                <div
                    className={cn(
                        'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                        hovered && !flagHeld && 'gi-token-hover-hop'
                    )}
                    // The art is wider than the hero's box and takes no pointer: a press beside
                    // the figure reaches the flag or Token behind it.
                    style={limp ? { filter: LIMP_FILTER, pointerEvents: 'none' } : NO_POINTER}
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
            {barShown && barsDrawn && <HeroHealthBar heroId={heroId} artPx={artPx} />}
        </button>
    );
});

export default MatHero;
