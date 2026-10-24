import { memo, useMemo, useRef, useState } from 'react';
import { PixelTriangle } from '../base/ArrowScrollList.jsx';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as EquipmentManager from '../../../systems/equipment/EquipmentManager.js';
import { useEntityDrag, useEntityDrop, useActiveDrag, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { resolveSpritePath, resolveAnimationPath } from '../../../utils/AssetManager.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as Flags from '../../../systems/board/Flags.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { isRecallDrop, recallFromDrop } from './dockRecall.js';
import { useDragSettleHover } from './useDragSettleHover.js';
import { equipOrAnnounce } from './dockEquip.js';
import { useHeroBarBubbles, clearHeroBubbles, clearHeroBubble, BAR_BUBBLES_SHOWN, BAR_BUBBLE_FADE_MS } from './heroBarBubbles.js';
import { BubbleText } from '../board/BubbleText.jsx';
import { DOCK_STRIP_PX, isDeployedStatus, dockArtFilter } from './dockHeroView.js';
import { useHeroPortrait, PORTRAIT_PX } from './heroPortrait.js';
import { ENGINE_EVENTS, ORPHAN_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * The drag payload a hero picked up in the horizontal dock carries. Unchanged from the old
 * dock tab (`HeroDockTab`), so a drop on the mat plants the flag exactly as before.
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
 * One hero in the horizontal hero bar: a portrait and the name, nothing else (HP, wounds and the
 * rest are in the hero panel a click away). The portrait is cut once per class sheet
 * (`heroPortrait.js`) and never animates, so the bar draws nothing per frame. A hero out on the
 * mat is darkened; hover outlines the portrait in white.
 * Click, double-click, drag onto the mat, drop an item to equip, drop a flag to recall and
 * drop another dock hero to reorder all behave as the old tab did.
 * ⚠️ Two components on purpose. dnd-kit re-renders every component holding a drag hook at each
 * drag start, end and change of target. The hooks live in this thin shell, which works out the
 * few things the figure draws from a drag (lifted, a drop cue, held); the figure itself
 * (`DockHeroFigureBody`) is memoised on those, so a drag elsewhere does not redraw it.
 */
export const DockHeroFigure = memo(function DockHeroFigure(props) {
    const { heroId, index = null, heroIds = [], onReorder } = props;
    const { isDragging: globalDragging } = useActiveDrag();
    // No hover outline while a drop is settling (the reorder animation).
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
        // As the old tab: an item equips, a flag recalls, another dock hero reorders.
        accepts: p => (p.kind === DRAG_KIND.ITEM && p.fromHeroId !== heroId)
            || isRecallDrop(p)
            || (p.kind === DRAG_KIND.HERO && p.heroId !== heroId),
        onDrop: p => {
            if (isRecallDrop(p)) {
                recallFromDrop(Placement, p);
            } else if (p.kind === DRAG_KIND.ITEM && p.itemId) {
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
    const heroCue = drop.valid && globalDragging && carried?.kind === DRAG_KIND.HERO && !isRecallDrop(carried);
    const sourceIndex = heroCue ? heroIds.indexOf(carried.heroId) : -1;
    const targetIndex = index ?? heroIds.indexOf(heroId);
    const insertAfter = sourceIndex !== -1 && targetIndex !== -1 && sourceIndex < targetIndex;
    const lifted = isHovered && !globalDragging && !isDragSettling && !drag.isDragging;

    if (!hero) return null;
    return (
        <DockHeroFigureBody
            heroId={heroId}
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
    // Out on the mat or walking home: `HERO_MOVED` announces every plant, recall and defeat,
    // `HEROES_WALKED` a hero arriving home.
    const statusState = useGameState(
        () => Flags.statusOf(heroId).state,
        [BOARD_EVENTS.HERO_MOVED, BOARD_EVENTS.HEROES_WALKED, ENGINE_EVENTS.GAME_RESET],
        null,
        { deps: [heroId] }
    );

    const bubbles = useHeroBarBubbles(heroId);

    const deployed = isDeployedStatus(statusState);
    const isWounded = hero.status === 'wounded';
    const filter = dockArtFilter({ deployed, hovered: lifted });

    const sprite = hero.spriteId || hero.classId || null;
    const sheet = sprite ? resolveAnimationPath(sprite) : null;
    const cut = useHeroPortrait(sheet);
    const still = sheet ? null : resolveSpritePath(sprite || hero.icon || 'hn_recruit_por');

    return (
        <div
            ref={nodeRef}
            {...handleProps}
            {...droppableProps}
            data-dock-hero={heroId}
            data-dock-deployed={deployed ? 'true' : 'false'}
            data-dock-hover={lifted ? 'true' : 'false'}
            data-dock-selected={isSelected ? 'true' : undefined}
            data-dock-wounded={isWounded ? 'true' : undefined}
            onClick={() => {
                if (justDroppedRef.current) return;
                clearHeroBubbles(heroId);
                onSelect?.(heroId);
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onDoubleClick?.(heroId);
            }}
            onMouseEnter={() => onHoverChange(true)}
            onMouseLeave={() => onHoverChange(false)}
            style={{
                height: DOCK_STRIP_PX,
                width: '100%'
            }}
            className={cn(
                'relative flex items-end gap-1.5 select-none cursor-pointer active:cursor-grabbing',
                lifted ? 'z-50' : 'z-40',
                held && 'opacity-30'
            )}
        >
            {/* Reorder cue: a gold line on the side the dragged hero lands. */}
            {heroCue && (
                <div
                    className={cn(
                        'absolute top-0 bottom-0 w-0.5 z-50 pointer-events-none bg-gi-gold shadow-[0_0_10px_#f59e0b]',
                        insertAfter ? '-right-px' : '-left-px'
                    )}
                />
            )}

            {/* Item drop cue: a soft glow in the strip under the hero. */}
            {itemCue && (
                <div className="absolute inset-x-1 inset-y-0 rounded-t-lg bg-gi-primary/20 ring-2 ring-gi-primary/70 pointer-events-none" />
            )}

            {/* The portrait stands on the strip's bottom edge, cut at the chest. */}
            <div
                data-dock-portrait={sheet || still || undefined}
                data-dock-portrait-ready={cut || still ? 'true' : 'false'}
                className="relative shrink-0 pointer-events-none"
                style={{ width: PORTRAIT_PX, height: PORTRAIT_PX, filter }}
            >
                {(cut || still) && (
                    <img
                        src={cut || (still.startsWith('/') ? still : `/${still}`)}
                        alt=""
                        draggable={false}
                        style={{
                            width: PORTRAIT_PX,
                            height: PORTRAIT_PX,
                            maxWidth: 'none',
                            imageRendering: 'pixelated',
                            // A still portrait is not cut here, so it is turned to face left.
                            transform: cut ? undefined : 'scaleX(-1)'
                        }}
                    />
                )}
            </div>

            <span
                data-dock-name={heroId}
                className={cn(
                    'self-center min-w-0 break-words ui-text-body font-bold leading-tight tracking-wide pointer-events-none',
                    isSelected ? 'text-gi-gold' : isWounded ? 'text-red-300' : 'text-white'
                )}
                style={{ textShadow: '0 1px 3px #000, 0 0 4px #000' }}
            >
                {hero.name}
            </span>

            {bubbles.length > 0 && (
                <BarBubbles
                    heroId={heroId}
                    bubbles={bubbles}
                    bottom={DOCK_STRIP_PX + BUBBLE_GAP_PX}
                />
            )}
        </div>
    );
});

/** The gap between the bar's top edge and the lowest bubble's tail. */
const BUBBLE_GAP_PX = 6;

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
                    style={{ textShadow: '0 1px 2px #000' }}
                >
                    <button
                        type="button"
                        data-bar-bubble-older
                        aria-label="Older level-ups"
                        disabled={shownPage >= pages - 1}
                        onClick={turn(1)}
                        className="p-0.5 rounded-sm bg-black/60 enabled:hover:text-gi-gold enabled:cursor-pointer disabled:opacity-30"
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
                        className="p-0.5 rounded-sm bg-black/60 enabled:hover:text-gi-gold enabled:cursor-pointer disabled:opacity-30"
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
                        <div
                            key={b.key}
                            data-bar-bubble={b.key}
                            data-bar-bubble-fading={isFading ? 'true' : undefined}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isFading) fadeOut(b.key);
                            }}
                            className={cn(
                                'relative max-w-full px-1.5 py-0.5 rounded border border-yellow-500/70 bg-yellow-950/95 text-yellow-100',
                                'ui-text-body font-bold leading-tight text-center shadow cursor-pointer transition-opacity ease-out',
                                isFading ? 'opacity-0' : 'opacity-100'
                            )}
                            style={{ transitionDuration: `${BAR_BUBBLE_FADE_MS}ms` }}
                        >
                            <BubbleText text={b.text} />
                            {i === shown.length - 1 && (
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b border-yellow-500/70 bg-yellow-950/95" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DockHeroFigure;
