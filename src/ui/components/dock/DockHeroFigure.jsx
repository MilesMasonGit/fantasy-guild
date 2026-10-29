import { memo, useMemo, useRef, useState } from 'react';
import { PixelTriangle } from '../base/ArrowScrollList.jsx';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import * as EquipmentManager from '../../../systems/equipment/EquipmentManager.js';
import { useEntityDrag, useEntityDrop, useActiveDrag, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { resolveSpritePath, resolveAnimationPath } from '../../../utils/AssetManager.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as Flags from '../../../systems/board/Flags.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { AnimatedHeroSprite } from '../board/AnimatedHeroSprite.jsx';
import { rosterStateOf, flagStatusLine } from '../board/flagText.js';
import { setRosterHover } from '../board/orderLit.js';
import { PROBLEM_SPRITE, SEVERITY } from '../board/problemMark.js';
import { Tooltip } from '../base/Tooltip.jsx';
import { t } from '../../../i18n/index.js';
import { useDragSettleHover } from './useDragSettleHover.js';
import { equipOrAnnounce } from './dockEquip.js';
import { useHeroBarBubbles, clearHeroBubbles, clearHeroBubble, BAR_BUBBLES_SHOWN, BAR_BUBBLE_FADE_MS } from './heroBarBubbles.js';
import { BubbleText } from '../board/BubbleText.jsx';
import { SpeechFrame } from '../board/SpeechFrame.jsx';
import { SPEECH_TONE } from '../board/speechTone.js';
import {
    DOCK_STRIP_PX, DOCK_LABEL_GAP_PX,
    dockArtOffset, hpPercent, hpTone, HP_TONE_CLASS, ROSTER_STATE_CLASS
} from './dockHeroView.js';
import { ENGINE_EVENTS, ORPHAN_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * The drag payload a hero picked up on the roster carries: dropped on the mat it gives the hero an
 * order (`Orders.orderAt`), exactly as dragging their figure on the mat does.
 */
export function dockHeroDragPayload(heroId, hero) {
    return {
        kind: DRAG_KIND.HERO,
        heroId,
        name: hero?.name,
        spriteId: hero?.spriteId || hero?.icon || hero?.heroSprite || hero?.classId,
        from: { dock: true }
    };
}

/**
 * One hero standing on the roster.
 * The idle sprite the mat uses (`AnimatedHeroSprite`), at the mat's art size, cut off at the
 * waist by the strip's bottom edge. The name, HP bar and state (idle, busy, hurt) sit above the
 * head at the same height for every hero, with the "needs a job" mark beside the name when the
 * hero's Token is gone for good; the art lifts on hover.
 * The sprite writes its frames straight to the element (the shared sprite clock), so an idle
 * frame re-renders nothing: not this figure, and not the slot, whose reorder animation would
 * measure its layout again.
 * Click finds the hero (outlined on the mat, their sheet open); hovering outlines them and lights
 * their job; drag onto the mat gives an order; drop an item to equip, another roster hero to
 * reorder.
 * ⚠️ Two components on purpose. dnd-kit re-renders every component holding a drag hook at each
 * drag start, end and change of target. The hooks live in this thin shell, which works out the
 * few things the figure draws from a drag (lifted, a drop cue, held); the figure itself
 * (`DockHeroFigureBody`) is memoised on those, so a drag elsewhere does not redraw it.
 */
export const DockHeroFigure = memo(function DockHeroFigure(props) {
    const { heroId, index = null, heroIds = [], onReorder } = props;
    const { isDragging: globalDragging } = useActiveDrag();
    // No hover lift while a drop is settling (the reorder animation).
    const { isHovered, settling: isDragSettling, onHoverChange } = useDragSettleHover(globalDragging);

    const hero = useDockHero(heroId);
    const justDroppedRef = useRef(false);

    const drag = useEntityDrag({
        id: `dock-hero-${heroId}`,
        sourceSurface: DND_SURFACE.DRAWER,
        kind: DRAG_KIND.HERO,
        payload: dockHeroDragPayload(heroId, hero)
    });

    const drop = useEntityDrop({
        id: `dock-hero-drop-${heroId}`,
        surface: DND_SURFACE.DRAWER,
        // An item equips, another roster hero reorders.
        accepts: p => (p.kind === DRAG_KIND.ITEM && p.fromHeroId !== heroId)
            || (p.kind === DRAG_KIND.HERO && p.heroId !== heroId),
        onDrop: p => {
            if (p.kind === DRAG_KIND.ITEM && p.itemId) {
                if (!equipOrAnnounce(EquipmentManager, heroId, p.itemId, null, p)) return false;
                justDroppedRef.current = true;
                setTimeout(() => { justDroppedRef.current = false; }, 250);
                EventBus.publish(UI_EVENTS.INSPECT_HERO, { heroId, afterDrop: true });
            } else if (p.kind === DRAG_KIND.HERO && p.heroId && p.heroId !== heroId) {
                onReorder?.(p.heroId, heroId);
            }
        }
    });
    const nodeRef = useMemo(() => mergeRefs(drag.setNodeRef, drop.setNodeRef), [drag.setNodeRef, drop.setNodeRef]);

    const carried = drop.activePayload;
    const itemCue = drop.valid && globalDragging && carried?.kind === DRAG_KIND.ITEM;
    const heroCue = drop.valid && globalDragging && carried?.kind === DRAG_KIND.HERO;
    const sourceIndex = heroCue ? heroIds.indexOf(carried.heroId) : -1;
    const targetIndex = index ?? heroIds.indexOf(heroId);
    const insertAfter = sourceIndex !== -1 && targetIndex !== -1 && sourceIndex < targetIndex;
    const lifted = isHovered && !globalDragging && !isDragSettling && !drag.isDragging;

    if (!hero) return null;
    return (
        <DockHeroFigureBody
            heroId={heroId}
            artPx={props.artPx}
            isSelected={props.isSelected}
            onSelect={props.onSelect}
            onDoubleClick={props.onDoubleClick}
            hero={hero}
            lifted={lifted}
            held={drag.isDragging}
            itemCue={itemCue}
            heroCue={heroCue}
            insertAfter={insertAfter}
            nodeRef={nodeRef}
            handleProps={drag.handleProps}
            droppableProps={drop.droppableProps}
            onHoverChange={onHoverChange}
            justDroppedRef={justDroppedRef}
        />
    );
});

/**
 * Flat projection per the useGameState selector contract: `hp` is rebuilt fresh from primitives
 * each evaluation, never the store's own nested object, so an in-place HP mutation is actually
 * seen as a change.
 */
function useDockHero(heroId) {
    return useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId);
            return h ? {
                name: h.name,
                spriteId: h.spriteId,
                icon: h.icon,
                heroSprite: h.heroSprite,
                classId: h.classId,
                status: h.status,
                hp: { current: h.hp?.current ?? 0, max: h.hp?.max ?? 100 }
            } : null;
        },
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, ORPHAN_EVENTS.HERO_STATUS_CHANGED, ENGINE_EVENTS.GAME_RESET],
        null,
        { deps: [heroId] }
    );
}

const DockHeroFigureBody = memo(function DockHeroFigureBody({
    heroId,
    hero,
    artPx = 128,
    isSelected = false,
    onSelect,
    onDoubleClick,
    lifted = false,
    held = false,
    itemCue = false,
    heroCue = false,
    insertAfter = false,
    nodeRef,
    handleProps,
    droppableProps,
    onHoverChange,
    justDroppedRef
}) {
    // Idle, busy or hurt, and whether their job is gone: `HERO_MOVED` announces every order,
    // claim and defeat, `HEROES_WALKED` a hero arriving, `HEROES_UPDATED` a wound healing.
    const roster = useGameState(
        () => ({ state: rosterStateOf(heroId), needsJob: Flags.needsJob(heroId) }),
        [BOARD_EVENTS.HERO_MOVED, BOARD_EVENTS.HEROES_WALKED, BOARD_EVENTS.TILE_CHANGED, ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.GAME_RESET],
        null,
        { deps: [heroId] }
    ) || { state: 'idle', needsJob: false };

    const bubbles = useHeroBarBubbles(heroId);

    const isWounded = hero.status === 'wounded';
    const hp = Math.max(0, Math.round(hero.hp?.current ?? 0));
    const hpMax = Math.max(1, hero.hp?.max ?? 100);
    const pct = hpPercent(hero.hp);
    const tone = hpTone(pct);

    const offset = dockArtOffset(artPx, { hovered: lifted });

    const sprite = hero.spriteId || hero.classId || null;
    const animArt = sprite ? resolveAnimationPath(sprite) : null;
    const staticArt = animArt ? null : resolveSpritePath(sprite || hero.icon || 'hn_recruit_por');

    // The sprite frame's top edge sits half the art above the strip's bottom; the labels sit
    // just above that, whatever the art is doing.
    const labelBottom = artPx / 2 + DOCK_LABEL_GAP_PX;

    return (
        <div
            ref={nodeRef}
            {...handleProps}
            {...droppableProps}
            data-dock-hero={heroId}
            data-dock-state={roster.state}
            data-dock-needs-job={roster.needsJob ? 'true' : undefined}
            data-dock-hover={lifted ? 'true' : 'false'}
            data-dock-selected={isSelected ? 'true' : undefined}
            data-dock-wounded={isWounded ? 'true' : undefined}
            data-dock-art-offset={offset}
            onClick={() => {
                if (justDroppedRef.current) return;
                clearHeroBubbles(heroId);
                onSelect?.(heroId);
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onDoubleClick?.(heroId);
            }}
            onMouseEnter={() => { onHoverChange(true); setRosterHover(heroId); }}
            onMouseLeave={() => { onHoverChange(false); setRosterHover(null); }}
            style={{
                height: DOCK_STRIP_PX,
                width: '100%'
            }}
            className={cn(
                'relative select-none cursor-pointer active:cursor-grabbing',
                lifted ? 'z-50' : 'z-40',
                held && 'opacity-30'
            )}
        >
            {/* Reorder cue: a gold line on the side the dragged hero lands. */}
            {heroCue && (
                <div
                    className={cn(
                        'absolute top-0 bottom-0 w-0.5 z-50 pointer-events-none bg-gi-gold',
                        insertAfter ? '-right-px' : '-left-px'
                    )}
                />
            )}

            {/* Item drop cue: a soft glow in the strip under the hero. */}
            {itemCue && (
                <div data-dock-drop-cue className="absolute inset-x-1 inset-y-0 bg-gi-primary/20 outline-2 outline-solid -outline-offset-2 outline-[var(--color-ui-white)] pointer-events-none" />
            )}

            {/**
             * The art window: bottom-anchored on the strip's edge and one art tall, clipping
             * everything below the edge (the lower body). Its empty top half is room to lift
             * into; it never takes the pointer, so the mat above stays clickable.
             */}
            <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 overflow-hidden pointer-events-none"
                style={{ width: artPx, height: artPx }}
            >
                <div
                    data-dock-art
                    className="absolute left-0 transition-[transform,filter] duration-200 ease-out"
                    style={{
                        top: artPx / 2,
                        width: artPx,
                        height: artPx,
                        transform: `translateY(${offset}px)`
                    }}
                >
                    {animArt ? (
                        <AnimatedHeroSprite
                            src={animArt}
                            heroId={heroId}
                            alt={hero.name || 'Hero'}
                            size={artPx}
                            animationState="idle"
                        />
                    ) : staticArt ? (
                        <img
                            src={staticArt.startsWith('/') ? staticArt : `/${staticArt}`}
                            alt={hero.name || 'Hero'}
                            draggable={false}
                            style={{ width: artPx, height: artPx, maxWidth: 'none', imageRendering: 'pixelated' }}
                        />
                    ) : null}
                </div>
            </div>

            {/* Name, HP bar and state: one height for every hero. */}
            <div
                data-dock-label
                className="absolute inset-x-0 flex flex-col items-center gap-0.5 pointer-events-none"
                style={{ bottom: labelBottom }}
            >
                <span
                    data-dock-name={heroId}
                    className={cn(
                        'max-w-full truncate px-1 ui-text-body font-bold leading-none tracking-wide',
                        isSelected ? 'text-gi-gold' : isWounded ? 'text-red-300' : 'text-white'
                    )}
                    style={{ textShadow: '0 1px 3px #000, 0 0 4px #000' }}
                >
                    {isWounded && <span aria-label="Wounded" className="text-red-400">✚ </span>}
                    {hero.name}
                </span>
                <span className="flex items-center gap-1 leading-none">
                    {roster.needsJob && (
                        <Tooltip content={t('orders.needsJob')}>
                            <img
                                data-dock-needs-job-mark
                                src={PROBLEM_SPRITE[SEVERITY.WAITING]}
                                alt={t('orders.needsJob')}
                                draggable={false}
                                className="pointer-events-auto"
                                style={{ width: 16, height: 16, imageRendering: 'pixelated', filter: 'drop-shadow(1px 1px 0 #000)' }}
                            />
                        </Tooltip>
                    )}
                    <Tooltip content={flagStatusLine(heroId)}>
                        <span
                            data-dock-state-word={roster.state}
                            className={cn('ui-text-small font-bold pointer-events-auto', ROSTER_STATE_CLASS[roster.state])}
                            style={{ textShadow: '0 1px 3px #000, 0 0 4px #000' }}
                        >
                            {t(`orders.${roster.state}`)}
                        </span>
                    </Tooltip>
                </span>
                <div
                    data-dock-hp={pct}
                    data-dock-hp-tone={tone}
                    title={`${hp.toLocaleString()} / ${hpMax.toLocaleString()} HP${isWounded ? ' (wounded)' : ''}`}
                    className={cn(
                        'w-14 h-1 bg-black/70 overflow-hidden',
                        isWounded && 'ring-1 ring-red-500/80'
                    )}
                >
                    <div
                        className={cn('h-full transition-[width] duration-300', HP_TONE_CLASS[tone])}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>

            {bubbles.length > 0 && (
                <BarBubbles
                    heroId={heroId}
                    bubbles={bubbles}
                    bottom={labelBottom + LABEL_PX}
                />
            )}
        </div>
    );
});

/** The name and HP bar's height plus a small gap, so a bubble's tail stops clear of the name. */
const LABEL_PX = 28;

/** A wheel turn this soon after the last one is the same flick: one page per flick. */
const WHEEL_GAP_MS = 200;

/**
 * A hero's level-up alerts, standing over the name: newest nearest the head, at most
 * `BAR_BUBBLES_SHOWN` at a time, with arrows (or the mouse wheel) paging back through older ones;
 * each page slides a few pixels in from the side it came from. Never wider than the hero's slot;
 * a line may wrap to two. A click on an alert fades out and clears that one alert without opening
 * the hero; they let the pointer through while something is being dragged.
 */
const BarBubbles = ({ heroId, bubbles, bottom }) => {
    const { isDragging: passive } = useActiveDrag();
    const [page, setPage] = useState(0);
    const [slide, setSlide] = useState(null);
    const lastWheelRef = useRef(-Infinity);
    const [fading, setFading] = useState(() => new Set());
    const pages = Math.max(1, Math.ceil(bubbles.length / BAR_BUBBLES_SHOWN));
    const shownPage = Math.min(page, pages - 1);
    const end = bubbles.length - shownPage * BAR_BUBBLES_SHOWN;
    const shown = bubbles.slice(Math.max(0, end - BAR_BUBBLES_SHOWN), end);

    const fadeOut = (key) => {
        setFading(prev => new Set(prev).add(key));
        setTimeout(() => {
            clearHeroBubble(heroId, key);
            setFading(prev => {
                if (!prev.has(key)) return prev;
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }, BAR_BUBBLE_FADE_MS);
    };
    const stop = e => e.stopPropagation();
    const go = (delta) => {
        const next = Math.max(0, Math.min(pages - 1, shownPage + delta));
        if (next === shownPage) return;
        setPage(next);
        setSlide(delta > 0 ? 'older' : 'newer');
    };
    const turn = (delta) => (e) => {
        e.stopPropagation();
        go(delta);
    };
    // Wheel up for older, down for newer, as the arrows stand.
    const onWheel = (e) => {
        e.stopPropagation();
        if (pages <= 1 || !e.deltaY) return;
        const now = Date.now();
        const flick = now - lastWheelRef.current < WHEEL_GAP_MS;
        lastWheelRef.current = now;
        if (!flick) go(e.deltaY < 0 ? 1 : -1);
    };

    return (
        <div
            data-bar-bubbles={heroId}
            className={cn(
                'absolute inset-x-0 mx-auto flex flex-col items-center gap-0.5 px-0.5',
                passive ? 'pointer-events-none' : 'pointer-events-auto'
            )}
            style={{ bottom, maxWidth: '100%' }}
            // ⚠️ Stops the press reaching the hero's drag handle: a bubble is clicked, not dragged.
            onPointerDown={stop}
            onClick={stop}
            onDoubleClick={stop}
            onWheel={onWheel}
        >
            {pages > 1 && (
                <div
                    data-bar-bubble-pager
                    className="flex items-center gap-0.5 ui-text-body font-bold leading-none text-yellow-100"
                    style={{ textShadow: '2px 2px 0 #000' }}
                >
                    <button
                        type="button"
                        data-bar-bubble-older
                        aria-label="Older level-ups"
                        disabled={shownPage >= pages - 1}
                        onClick={turn(1)}
                        className="p-0.5 bg-black/60 enabled:hover:text-gi-gold enabled:cursor-pointer disabled:opacity-30"
                    >
                        <PixelTriangle dir="up" />
                    </button>
                    <span data-bar-bubble-page className="tabular-nums">{`${shownPage + 1}/${pages}`}</span>
                    <button
                        type="button"
                        data-bar-bubble-newer
                        aria-label="Newer level-ups"
                        disabled={shownPage === 0}
                        onClick={turn(-1)}
                        className="p-0.5 bg-black/60 enabled:hover:text-gi-gold enabled:cursor-pointer disabled:opacity-30"
                    >
                        <PixelTriangle dir="down" />
                    </button>
                </div>
            )}
            <div
                key={shownPage}
                data-bar-bubble-slide={slide || undefined}
                className={cn('flex flex-col items-center gap-0.5 max-w-full', slide && `gi-bar-slide-${slide}`)}
            >
                {shown.map((b, i) => {
                    const isFading = fading.has(b.key);
                    return (
                        <SpeechFrame
                            key={b.key}
                            data-bar-bubble={b.key}
                            data-bar-bubble-fading={isFading ? 'true' : undefined}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isFading) fadeOut(b.key);
                            }}
                            tone={SPEECH_TONE.ATTENTION}
                            tail={i === shown.length - 1}
                            className={cn(
                                'max-w-full ui-text-body font-bold leading-tight text-center cursor-pointer transition-opacity ease-out',
                                isFading ? 'opacity-0' : 'opacity-100'
                            )}
                            style={{ transitionDuration: `${BAR_BUBBLE_FADE_MS}ms` }}
                        >
                            <BubbleText text={b.text} />
                        </SpeechFrame>
                    );
                })}
            </div>
        </div>
    );
};

export default DockHeroFigure;
