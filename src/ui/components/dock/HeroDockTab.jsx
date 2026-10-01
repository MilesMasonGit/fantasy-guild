import { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrag, useEntityDrop, useActiveDrag, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getJob } from '../../../config/registries/jobRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { Pencil, Backpack, Heart } from 'lucide-react';
import { isRecallDrop, recallFromDrop } from './dockRecall.js';
import { dockStatusLine } from '../board/flagText.js';

/** The status line's colour: working green, idle at a flag stone, in the Guild blue. */
const STATUS_TONE = {
    working: 'text-emerald-400',
    idle: 'text-stone-300'
};

/**
 * HeroDockTab — sliding hero tab in the rightmost Hero Dock.
 * - Collapsed: 56px headshot portrait on the left, vertical HP bar to its right, top hero name.
 * - Hover: Slides out to preview stats without displacing the dock.
 * - Drag over: Pops out slightly without showing full title or 400px width.
 * - Sits above the inspection sheet with z-30 / z-40.
 */
export const HeroDockTab = ({
    heroId,
    index = null,
    heroIds = [],
    forceExpanded = false,
    isSelected = false,
    onSelect,
    // `HeroDockCard` (the pinned-card route) passes its pin toggle as `onClick`.
    // Both names are accepted so neither caller has to know about the other.
    onClick,
    onDoubleClick,
    onEdit,
    onReorder,
    // Pinned cards render the header in its "open" state and must NOT also
    // hover-lift: the lift would fight the pinned position and detach the
    // header from the body sitting under it.
    pinned = false,
    small = false,
    lift = true,
    vertical = false,
    isDockLeft = false
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isDragSettling, setIsDragSettling] = useState(false);
    const engine = useEngine();
    const { isDragging: globalDragging } = useActiveDrag();
    const prevDraggingRef = useRef(globalDragging);

    useEffect(() => {
        if (prevDraggingRef.current && !globalDragging) {
            setIsDragSettling(true);
            const timer = setTimeout(() => {
                setIsDragSettling(false);
            }, 320);
            return () => clearTimeout(timer);
        }
        prevDraggingRef.current = globalDragging;
    }, [globalDragging]);

    // Flat projection per the useGameState selector contract (CR-044, CR3-300):
    // `hp` is rebuilt fresh from primitives each evaluation, never the store's
    // own nested object, so an in-place HP mutation is actually seen as a change.
    const hero = useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId);
            if (!h) return null;
            const equippedCount = Array.isArray(h.equipment)
                ? h.equipment.filter(Boolean).length
                : Object.values(h.equipment || {}).filter(Boolean).length;
            return {
                name: h.name,
                spriteId: h.spriteId,
                icon: h.icon,
                heroSprite: h.heroSprite,
                classId: h.classId,
                status: h.status,
                jobId: h.jobId,
                className: h.className,
                level: h.level,
                equippedCount,
                hp: { current: h.hp?.current ?? 0, max: h.hp?.max ?? 100 }
            };
        },
        ['heroes_updated', 'hero_equipment_changed', 'hero:status_changed', 'state_changed'],
        null,
        { deps: [heroId] }
    );

    // What this hero is doing, from their flag's status: working, walking,
    // idle at their flag, or in the Guild (slice 1.5's status line).
    // ⚠️ It listened for `board:hero_placed` / `board:hero_recalled`, which
    // nothing has ever published; `HERO_MOVED` is what every plant, claim
    // change, recall and defeat actually announces.
    const status = useGameState(
        () => {
            const s = Flags.statusOf(heroId);
            return { state: s.state, instanceId: s.instanceId, typeId: s.typeId, limping: !!s.limping };
        },
        // HEROES_WALKED: a hero walking home arrives without any other event.
        [BOARD_EVENTS.HERO_MOVED, BOARD_EVENTS.HEROES_WALKED, 'state_changed'],
        null,
        { deps: [heroId] }
    );
    const workId = status?.state === 'working' ? status.instanceId : null;

    const token = useGameState(
        // The Token they work, by instance id (Free Playmat slice 1.6b).
        () => workId == null ? null : BoardState.getTokenById(workId),
        [BOARD_EVENTS.TILE_CHANGED, 'state_changed'],
        null,
        { deps: [workId] }
    );

    const justDroppedRef = useRef(false);

    const dragIdPrefix = vertical ? 'bank-hero' : 'dock-hero';

    const drag = useEntityDrag({
        id: `${dragIdPrefix}-${heroId}`,
        sourceSurface: DND_SURFACE.DRAWER,
        kind: DRAG_KIND.HERO,
        payload: {
            kind: DRAG_KIND.HERO,
            heroId,
            name: hero?.name,
            spriteId: hero?.spriteId || hero?.icon || hero?.heroSprite || hero?.classId,
            from: { dock: true }
        }
    });

    const drop = useEntityDrop({
        id: `${dragIdPrefix}-drop-${heroId}`,
        surface: DND_SURFACE.DRAWER,
        // A hero off the board or a pennant dropped on any tab recalls (slice
        // 1.5) — the tab is the smaller target, so it must say yes itself or
        // the Dock's own recall zone never gets the drop. A tab dragged within
        // the Dock is a reorder.
        accepts: p => (p.kind === DRAG_KIND.ITEM && p.fromHeroId !== heroId)
            || isRecallDrop(p)
            || (p.kind === DRAG_KIND.HERO && p.heroId !== heroId),
        onDrop: p => {
            if (isRecallDrop(p)) {
                recallFromDrop(engine.BoardPlacement, p);
            } else if (p.kind === DRAG_KIND.ITEM && p.itemId) {
                justDroppedRef.current = true;
                setTimeout(() => { justDroppedRef.current = false; }, 250);
                engine.EquipmentManager.equipItem(heroId, p.itemId);
                EventBus.publish('inspect_hero', { heroId });
            } else if (p.kind === DRAG_KIND.HERO && p.heroId && p.heroId !== heroId) {
                onReorder?.(p.heroId, heroId);
            }
        }
    });

    if (!hero) return null;

    const def = token ? getTokenType(token.typeId) : null;
    const isWorking = workId != null && !!def?.config && !token.alert;
    const isWounded = hero.status === 'wounded';
    const job = hero.jobId ? getJob(hero.jobId) : null;
    const jobTitle = job ? job.name : (hero.className || 'Recruit');
    const level = Math.floor(hero.level || 1);

    // Inventory count out of 9 — computed in the selector's flat projection.
    const equippedCount = hero.equippedCount;

    // Sprite & Icon paths
    const headshotPath = resolveSpritePath(hero.icon || 'icon_recruit_0') || resolveSpritePath(hero.spriteId || 'hero_recruit_0');

    // Health
    const hp = Math.max(0, Math.round(hero.hp?.current ?? 0));
    const hpMax = Math.max(1, hero.hp?.max ?? 100);
    const hpPercent = Math.min(100, Math.round((hp / hpMax) * 100));

    // Status Pip Tone
    const pipColor = isWounded
        ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)] animate-pulse'
        : isWorking
        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
        : 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]';

    // When dragging something globally:
    // - Item drag: pop out slightly as a drop target with highlight
    // - Hero drag: do NOT pop out or highlight the tab; only the insertion line between tabs is shown
    // - Drag settle delay: block hover popout during the spring layout reorder animation (~320ms)
    const isDraggingItem = globalDragging && drop.activePayload?.kind === DRAG_KIND.ITEM;
    const isDraggingHero = globalDragging && drop.activePayload?.kind === DRAG_KIND.HERO && !isRecallDrop(drop.activePayload);

    const expanded = (forceExpanded || (!globalDragging && !isDragSettling && isHovered)) && lift && !pinned && !drag.isDragging;
    const isDraggingHover = isDraggingItem && isHovered && !pinned && !forceExpanded;

    const titleText = expanded ? `${hero.name}, Lv ${level} ${jobTitle}` : hero.name;

    // Determine insertion position indicator (above or below this tab)
    const isHeroDropValid = drop.valid && isDraggingHero;
    const sourceIndex = isHeroDropValid && heroIds ? heroIds.indexOf(drop.activePayload.heroId) : -1;
    const targetIndex = index ?? (heroIds ? heroIds.indexOf(heroId) : -1);
    const isInsertionBelow = sourceIndex !== -1 && targetIndex !== -1 && sourceIndex < targetIndex;

    if (vertical) {
        return (
            <div
                data-hero-dock-tab="true"
                data-dock-hero-id={heroId}
                className={cn(
                    'relative h-[72px] select-none shrink-0 w-full pointer-events-none',
                    isHovered ? 'z-50' : 'z-40'
                )}
            >
                {/* Insertion Line Highlight Indicator between Hero Dock Tabs */}
                {isHeroDropValid && (
                    <div
                        className={cn(
                            "absolute -left-4 -right-1 h-1 z-50 pointer-events-none flex items-center justify-between",
                            isInsertionBelow ? "-bottom-1.5" : "-top-1.5"
                        )}
                    >
                        <div className="w-2 h-2 rotate-45 bg-gi-gold shadow-[0_0_8px_#f59e0b] border border-amber-300 shrink-0" />
                        <div className="flex-1 h-0.5 bg-gradient-to-r from-gi-gold via-amber-200 to-gi-gold shadow-[0_0_10px_#f59e0b]" />
                        <div className="w-2 h-2 rotate-45 bg-gi-gold shadow-[0_0_8px_#f59e0b] border border-amber-300 shrink-0" />
                    </div>
                )}
                <div
                    ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
                    {...drag.handleProps}
                    {...drop.droppableProps}
                    onClick={() => {
                        if (justDroppedRef.current) return;
                        onSelect?.(heroId);
                        onClick?.(heroId);
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        onDoubleClick?.(heroId);
                    }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className={cn(
                        'absolute top-0 h-[72px] border-2 border-[#3a271d] pointer-events-auto',
                        isDockLeft ? 'left-0 rounded-r-xl border-l-0' : 'right-0 rounded-l-xl border-r-0',
                        'bg-[#140e0b]/95 shadow-2xl transition-all duration-200 ease-out select-none flex flex-col justify-between pt-1 pb-1.5 px-1.5',
                        pinned
                            ? 'w-full z-40 ring-2 ring-gi-primary/70 border-gi-primary/70 bg-[#1e1511] cursor-grab active:cursor-grabbing ' + (isDockLeft ? 'rounded-r-xl' : 'rounded-l-xl')
                            : expanded
                            ? 'w-full z-50 bg-[#1e1511] border-[#8a5d45] shadow-[0_4px_24px_rgba(0,0,0,0.9)] cursor-grab active:cursor-grabbing ' + (isSelected ? 'ring-2 ring-gi-gold border-gi-gold' : '')
                            : isSelected
                            ? (small ? 'w-12' : 'w-20') + ' z-40 ring-2 ring-gi-gold border-gi-gold bg-[#1e1511]'
                            : isDraggingHover
                            ? 'w-24 z-50 ring-2 ring-gi-primary/80 border-gi-primary/80 bg-[#1e1511] shadow-[0_4px_20px_rgba(0,0,0,0.8)] cursor-grab active:cursor-grabbing'
                            : (small ? 'w-12' : 'w-20') + ' z-40 hover:border-[#6a4431] cursor-grab active:cursor-grabbing',
                        drop.valid && isDraggingItem && 'ring-2 ring-gi-primary/80 border-gi-primary/80 bg-[#1e1511]',
                        drag.isDragging && 'opacity-30'
                    )}
                >
                    {/* Top: Hero Name sits above the headshot, sliding out with it */}
                    <div className={cn("absolute -top-3.5 flex items-center gap-1 pointer-events-none z-20", isDockLeft ? "left-2" : "right-2")}>
                        <span
                            className="text-[10px] font-bold text-white whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,1)] tracking-wide leading-none"
                            style={{ textShadow: '0 1px 3px #000, 0 0 4px #000' }}
                        >
                            {titleText}
                        </span>
                        {expanded && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit?.(heroId);
                                }}
                                className="p-0.5 rounded hover:bg-white/10 text-gi-muted hover:text-gi-gold transition-colors pointer-events-auto drop-shadow"
                            >
                                <Pencil size={10} />
                            </button>
                        )}
                    </div>

                    {/* Main Content Area */}
                    <div className={cn("flex-1 flex items-center gap-1.5 min-h-0 overflow-hidden pt-0.5", isDockLeft ? "flex-row pr-1 pl-2" : "flex-row-reverse pl-1 pr-2")}>
                        {/* Left/Right: 56px Headshot Portrait with Activity Pip */}
                        <div className="w-14 h-14 rounded-lg bg-black/60 border border-white/15 flex items-center justify-center overflow-hidden shrink-0 relative shadow-inner">
                            <div
                                className={cn("absolute top-1 right-1 w-2 h-2 rounded-full z-10", pipColor)}
                            />
                            {headshotPath ? (
                                <img
                                    src={headshotPath.startsWith('/') ? headshotPath : `/${headshotPath}`}
                                    alt={hero.name}
                                    className="w-14 h-14 object-contain"
                                    style={{ imageRendering: 'pixelated' }}
                                />
                            ) : (
                                <span className="text-xl">{hero.icon || '🧑'}</span>
                            )}
                        </div>

                        {/* Vertical Health Bar directly to the right of the portrait */}
                        <div
                            className="w-1.5 h-14 bg-black/80 rounded-full overflow-hidden border border-white/10 shrink-0 flex flex-col justify-end p-px shadow-inner"
                        >
                            <div
                                className={cn(
                                    "w-full rounded-full transition-all duration-300",
                                    hpPercent > 50 ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.7)]" : hpPercent > 20 ? "bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.7)]" : "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)] animate-pulse"
                                )}
                                style={{ height: `${hpPercent}%` }}
                            />
                        </div>

                        {/* Right: Expanded Info when Hovered */}
                        {expanded && (
                            <div className="flex-1 flex items-center justify-between h-full py-0.5 px-2 min-w-0 pointer-events-auto animate-in fade-in duration-150">
                                <div className="flex flex-col justify-center space-y-1 min-w-0 flex-1 pr-2">
                                    <div className="text-[11px] truncate font-medium">
                                        {isWounded ? (
                                            <span className="text-red-400 font-bold">Wounded</span>
                                        ) : (
                                            <span data-dock-status={status?.state || 'docked'} className={cn('truncate', STATUS_TONE[status?.state] || 'text-blue-300')}>
                                                {dockStatusLine(status)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 text-[10px] text-gi-muted">
                                        <div className="flex items-center gap-1">
                                            <Heart size={10} className="text-red-400 shrink-0" />
                                            <span className="text-white/90">{hp} / {hpMax} HP</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Backpack size={11} className="text-amber-400 shrink-0" />
                                            <span className="text-gi-gold font-medium">{equippedCount}/9 Items</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            data-hero-dock-tab="true"
            data-dock-hero-id={heroId}
            className={cn(
                'relative w-[72px] select-none shrink-0 flex flex-col justify-end',
                isHovered ? 'z-50' : 'z-40',
                pinned ? 'h-full' : small ? 'h-12' : 'h-20'
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Insertion Line Highlight Indicator between Hero Dock Tabs */}
            {isHeroDropValid && (
                <div
                    className={cn(
                        "absolute -top-4 -bottom-1 w-1 z-50 pointer-events-none flex flex-col items-center justify-between",
                        isInsertionBelow ? "-right-1.5" : "-left-1.5"
                    )}
                >
                    <div className="w-2 h-2 rotate-45 bg-gi-gold shadow-[0_0_8px_#f59e0b] border border-amber-300 shrink-0" />
                    <div className="w-0.5 flex-1 bg-gradient-to-b from-gi-gold via-amber-200 to-gi-gold shadow-[0_0_10px_#f59e0b]" />
                    <div className="w-2 h-2 rotate-45 bg-gi-gold shadow-[0_0_8px_#f59e0b] border border-amber-300 shrink-0" />
                </div>
            )}
            <div
                ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
                {...drag.handleProps}
                {...drop.droppableProps}
                onClick={() => {
                    if (justDroppedRef.current) return;
                    onSelect?.(heroId);
                    onClick?.(heroId);
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDoubleClick?.(heroId);
                }}
                className={cn(
                    'absolute bottom-0 left-0 w-[72px] rounded-t-xl border-2 border-b-0 border-[#3a271d]',
                    'bg-[#140e0b]/95 shadow-[0_-4px_15px_rgba(0,0,0,0.5)] transition-all duration-200 ease-out select-none flex flex-col justify-end p-1.5',
                    pinned
                        ? 'h-full z-40 ring-2 ring-gi-primary/70 border-gi-primary/70 bg-[#1e1511] cursor-grab active:cursor-grabbing'
                        : isSelected
                        ? (small ? 'h-12' : 'h-20') + ' z-40 ring-2 ring-gi-gold border-gi-gold bg-[#1e1511]'
                        : expanded
                        ? 'h-[160px] z-50 bg-[#1e1511] border-[#8a5d45] shadow-[0_-8px_24px_rgba(0,0,0,0.9)] cursor-grab active:cursor-grabbing'
                        : isDraggingHover
                        ? 'h-24 z-50 ring-2 ring-gi-primary/80 border-gi-primary/80 bg-[#1e1511] shadow-[0_-4px_20px_rgba(0,0,0,0.8)] cursor-grab active:cursor-grabbing'
                        : (small ? 'h-12' : 'h-20') + ' z-40 hover:border-[#6a4431] cursor-grab active:cursor-grabbing',
                    drop.valid && isDraggingItem && 'ring-2 ring-gi-primary/80 border-gi-primary/80 bg-[#1e1511]',
                    drag.isDragging && 'opacity-30'
                )}
            >
                {/* Top: Hero Name sits above the dock tab */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-none z-20">
                    <span
                        className="text-[10px] font-bold text-white whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,1)] tracking-wide leading-none"
                        style={{ textShadow: '0 1px 3px #000, 0 0 4px #000' }}
                    >
                        {titleText}
                    </span>
                    {expanded && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit?.(heroId);
                            }}
                            className="p-0.5 rounded hover:bg-white/10 text-gi-muted hover:text-gi-gold transition-colors pointer-events-auto drop-shadow"
                        >
                            <Pencil size={10} />
                        </button>
                    )}
                </div>

                {/* Expanded Content Area (Top) */}
                {expanded && (
                    <div className="flex-1 flex flex-col justify-start w-full px-1 pt-1 min-h-0 pointer-events-auto animate-in fade-in duration-150">
                        <div className="flex flex-col space-y-1 mb-2">
                            <div className="text-[10px] text-center leading-tight">
                                {isWounded ? (
                                    <span className="text-red-400 font-bold">Wounded</span>
                                ) : (
                                    <span data-dock-status={status?.state || 'docked'} className={cn('block line-clamp-2', STATUS_TONE[status?.state] || 'text-blue-300')}>
                                        {dockStatusLine(status)}
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-col items-center gap-1.5 text-[10px] text-gi-muted border-t border-white/10 pt-1.5">
                                <div className="flex items-center gap-1 w-full justify-between">
                                    <Heart size={10} className="text-red-400 shrink-0" />
                                    <span className="text-white/90">{hp} / {hpMax}</span>
                                </div>
                                <div className="flex items-center gap-1 w-full justify-between">
                                    <Backpack size={11} className="text-amber-400 shrink-0" />
                                    <span className="text-gi-gold font-medium">{equippedCount}/9</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Base Portrait Area (Bottom) */}
                <div className="flex items-center gap-1 w-full shrink-0">
                    {/* Vertical Health Bar to the left */}
                    <div
                        className="w-1.5 h-14 bg-black/80 rounded-full overflow-hidden border border-white/10 shrink-0 flex flex-col justify-end p-px shadow-inner"
                    >
                        <div
                            className={cn(
                                "w-full rounded-full transition-all duration-300",
                                hpPercent > 50 ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.7)]" : hpPercent > 20 ? "bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.7)]" : "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)] animate-pulse"
                            )}
                            style={{ height: `${hpPercent}%` }}
                        />
                    </div>

                    {/* 56px Headshot Portrait */}
                    <div className="w-14 h-14 rounded-lg bg-black/60 border border-white/15 flex items-center justify-center overflow-hidden shrink-0 relative shadow-inner">
                        <div
                            className={cn("absolute top-1 right-1 w-2 h-2 rounded-full z-10", pipColor)}
                        />
                        {headshotPath ? (
                            <img
                                src={headshotPath.startsWith('/') ? headshotPath : `/${headshotPath}`}
                                alt={hero.name}
                                className="w-14 h-14 object-contain"
                                style={{ imageRendering: 'pixelated' }}
                            />
                        ) : (
                            <span className="text-xl">{hero.icon || '🧑'}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HeroDockTab;
