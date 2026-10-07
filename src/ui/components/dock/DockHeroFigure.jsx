import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrag, useEntityDrop, useActiveDrag, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { resolveSpritePath, resolveAnimationPath } from '../../../utils/AssetManager.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as Flags from '../../../systems/board/Flags.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { AnimatedHeroSprite } from '../board/AnimatedHeroSprite.jsx';
import { isRecallDrop, recallFromDrop } from './dockRecall.js';
import { equipOrAnnounce } from './dockEquip.js';
import {
    DOCK_STRIP_PX, DOCK_LABEL_GAP_PX,
    isDeployedStatus, dockArtOffset, dockArtFilter, hpPercent, hpTone, HP_TONE_CLASS
} from './dockHeroView.js';
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
 * One hero standing in the horizontal dock.
 * The idle sprite the mat uses (`AnimatedHeroSprite`), at the mat's art size, cut off at the
 * waist by the strip's bottom edge. The name and HP bar sit above the head at the same height
 * for every hero; only the ART sinks and darkens when the hero is out on the mat, and lifts on
 * hover.
 * The sprite runs its own frame clock, so an idle frame re-renders the sprite alone, never
 * this figure or the dock around it.
 * Click, double-click, drag onto the mat, drop an item to equip, drop a flag to recall and
 * drop another dock hero to reorder all behave as the old tab did.
 */
export const DockHeroFigure = ({
    heroId,
    index = null,
    heroIds = [],
    artPx = 128,
    isSelected = false,
    onSelect,
    onDoubleClick,
    onReorder
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isDragSettling, setIsDragSettling] = useState(false);
    const engine = useEngine();
    const { isDragging: globalDragging } = useActiveDrag();
    const prevDraggingRef = useRef(globalDragging);

    // No hover lift while a drop is settling (the reorder animation).
    useEffect(() => {
        if (prevDraggingRef.current && !globalDragging) {
            setIsDragSettling(true);
            const timer = setTimeout(() => setIsDragSettling(false), 320);
            prevDraggingRef.current = globalDragging;
            return () => clearTimeout(timer);
        }
        prevDraggingRef.current = globalDragging;
        return undefined;
    }, [globalDragging]);

    // Flat projection per the useGameState selector contract: `hp` is rebuilt fresh from
    // primitives each evaluation, never the store's own nested object, so an in-place HP
    // mutation is actually seen as a change.
    const hero = useGameState(
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
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, ORPHAN_EVENTS.HERO_STATUS_CHANGED, ENGINE_EVENTS.STATE_CHANGED],
        null,
        { deps: [heroId] }
    );

    // Out on the mat or walking home: `HERO_MOVED` announces every plant, recall and defeat,
    // `HEROES_WALKED` a hero arriving home.
    const statusState = useGameState(
        () => Flags.statusOf(heroId).state,
        [BOARD_EVENTS.HERO_MOVED, BOARD_EVENTS.HEROES_WALKED, ENGINE_EVENTS.STATE_CHANGED],
        null,
        { deps: [heroId] }
    );

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
                recallFromDrop(engine.BoardPlacement, p);
            } else if (p.kind === DRAG_KIND.ITEM && p.itemId) {
                if (!equipOrAnnounce(engine, heroId, p.itemId)) return false;
                justDroppedRef.current = true;
                setTimeout(() => { justDroppedRef.current = false; }, 250);
                EventBus.publish(UI_EVENTS.INSPECT_HERO, { heroId });
            } else if (p.kind === DRAG_KIND.HERO && p.heroId && p.heroId !== heroId) {
                onReorder?.(p.heroId, heroId);
            }
        }
    });

    if (!hero) return null;

    const deployed = isDeployedStatus(statusState);
    const isWounded = hero.status === 'wounded';
    const hp = Math.max(0, Math.round(hero.hp?.current ?? 0));
    const hpMax = Math.max(1, hero.hp?.max ?? 100);
    const pct = hpPercent(hero.hp);
    const tone = hpTone(pct);

    const lifted = isHovered && !globalDragging && !isDragSettling && !drag.isDragging;
    const offset = dockArtOffset(artPx, { deployed, hovered: lifted });
    const filter = dockArtFilter({ deployed, hovered: lifted });

    const sprite = hero.spriteId || hero.classId || null;
    const animArt = sprite ? resolveAnimationPath(sprite) : null;
    const staticArt = animArt ? null : resolveSpritePath(sprite || hero.icon || 'hero_recruit_0');

    const isDraggingItem = globalDragging && drop.activePayload?.kind === DRAG_KIND.ITEM;
    const isDraggingHero = globalDragging && drop.activePayload?.kind === DRAG_KIND.HERO && !isRecallDrop(drop.activePayload);
    const isHeroDropValid = drop.valid && isDraggingHero;
    const sourceIndex = isHeroDropValid ? heroIds.indexOf(drop.activePayload.heroId) : -1;
    const targetIndex = index ?? heroIds.indexOf(heroId);
    const insertAfter = sourceIndex !== -1 && targetIndex !== -1 && sourceIndex < targetIndex;

    // The sprite frame's top edge sits half the art above the strip's bottom; the labels sit
    // just above that, whatever the art is doing.
    const labelBottom = artPx / 2 + DOCK_LABEL_GAP_PX;

    return (
        <div
            ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
            {...drag.handleProps}
            {...drop.droppableProps}
            data-dock-hero={heroId}
            data-dock-deployed={deployed ? 'true' : 'false'}
            data-dock-hover={lifted ? 'true' : 'false'}
            data-dock-selected={isSelected ? 'true' : undefined}
            data-dock-wounded={isWounded ? 'true' : undefined}
            data-dock-art-offset={offset}
            onClick={() => {
                if (justDroppedRef.current) return;
                onSelect?.(heroId);
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onDoubleClick?.(heroId);
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                height: DOCK_STRIP_PX,
                width: '100%'
            }}
            className={cn(
                'relative select-none cursor-pointer active:cursor-grabbing',
                lifted ? 'z-50' : 'z-40',
                drag.isDragging && 'opacity-30'
            )}
        >
            {/* Reorder cue: a gold line on the side the dragged hero lands. */}
            {isHeroDropValid && (
                <div
                    className={cn(
                        'absolute top-0 bottom-0 w-0.5 z-50 pointer-events-none bg-gi-gold shadow-[0_0_10px_#f59e0b]',
                        insertAfter ? '-right-px' : '-left-px'
                    )}
                />
            )}

            {/* Item drop cue: a soft glow in the strip under the hero. */}
            {drop.valid && isDraggingItem && (
                <div className="absolute inset-x-1 inset-y-0 rounded-t-lg bg-gi-primary/20 ring-2 ring-gi-primary/70 pointer-events-none" />
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
                        transform: `translateY(${offset}px)`,
                        filter
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

            {/* Name and HP bar: one height for every hero, deployed or not. */}
            <div
                data-dock-label
                className="absolute inset-x-0 flex flex-col items-center gap-0.5 pointer-events-none"
                style={{ bottom: labelBottom }}
            >
                <span
                    data-dock-name={heroId}
                    className={cn(
                        'max-w-full truncate px-1 text-[10px] font-bold leading-none tracking-wide',
                        isSelected ? 'text-gi-gold' : isWounded ? 'text-red-300' : 'text-white'
                    )}
                    style={{ textShadow: '0 1px 3px #000, 0 0 4px #000' }}
                >
                    {isWounded && <span aria-label="Wounded" className="text-red-400">✚ </span>}
                    {hero.name}
                </span>
                <div
                    data-dock-hp={pct}
                    data-dock-hp-tone={tone}
                    title={`${hp} / ${hpMax} HP${isWounded ? ' (wounded)' : ''}`}
                    className={cn(
                        'w-12 h-1.5 rounded-full bg-black/80 border overflow-hidden',
                        isWounded ? 'border-red-500/80' : 'border-white/20'
                    )}
                >
                    <div
                        className={cn('h-full transition-[width] duration-300', HP_TONE_CLASS[tone])}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default DockHeroFigure;
