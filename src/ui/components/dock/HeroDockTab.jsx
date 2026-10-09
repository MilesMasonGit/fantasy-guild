import { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrag, useEntityDrop, useActiveDrag, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { getJob } from '../../../config/registries/jobRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as Flags from '../../../systems/board/Flags.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { isRecallDrop, recallFromDrop } from './dockRecall.js';
import { equipOrAnnounce } from './dockEquip.js';
import { dockStatusLine } from '../board/flagText.js';
import { TopBarTip } from '../board/TopBarTip.jsx';
import { hpPercent, hpTone, HP_TONE_CLASS } from './dockHeroView.js';
import { ENGINE_EVENTS, ORPHAN_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * HeroDockTab: a hero's tab in the hero column beside the Bank (`BankHeroPanel`), read like a hero
 * in the bar: portrait, name and a thin HP bar, in one thin frame. A dot on the portrait marks a
 * hero working (green) or wounded (red). Hover lights the frame and shows the game's tooltip
 * (job, what they are doing, HP, items); nothing slides out. Click opens the hero panel; drag
 * sends the hero out, drops equip, recall and reorder as before.
 */
export const HeroDockTab = ({
    heroId,
    index = null,
    heroIds = [],
    isSelected = false,
    onSelect,
    onDoubleClick,
    onReorder,
    isDockLeft = false
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isDragSettling, setIsDragSettling] = useState(false);
    const engine = useEngine();
    const { isDragging: globalDragging } = useActiveDrag();
    const prevDraggingRef = useRef(globalDragging);
    const faceRef = useRef(null);

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

    // Flat projection per the useGameState selector contract: `hp` is rebuilt fresh from
    // primitives each evaluation, never the store's own nested object, so an in-place HP
    // mutation is actually seen as a change.
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
                equippedCount,
                hp: { current: h.hp?.current ?? 0, max: h.hp?.max ?? 100 }
            };
        },
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, ORPHAN_EVENTS.HERO_STATUS_CHANGED, ENGINE_EVENTS.STATE_CHANGED],
        null,
        { deps: [heroId] }
    );

    // What this hero is doing, from their flag's status: working, walking, idle at their flag,
    // or in the Guild.
    // ⚠️ `HERO_MOVED` is what every plant, claim change, recall and defeat announces;
    // `board:hero_placed` / `board:hero_recalled` are never published, so listening for them
    // would never fire.
    const status = useGameState(
        () => {
            const s = Flags.statusOf(heroId);
            return { state: s.state, instanceId: s.instanceId, typeId: s.typeId, limping: !!s.limping };
        },
        // HEROES_WALKED: a hero walking home arrives without any other event.
        [BOARD_EVENTS.HERO_MOVED, BOARD_EVENTS.HEROES_WALKED, ENGINE_EVENTS.STATE_CHANGED],
        null,
        { deps: [heroId] }
    );

    const justDroppedRef = useRef(false);

    const dragIdPrefix = 'bank-hero';

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
        // A hero off the board or a pennant dropped on any tab recalls: the tab is the smaller
        // target, so it must say yes itself or the Dock's own recall zone never gets the drop.
        // A tab dragged within the Dock is a reorder.
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

    const isWounded = hero.status === 'wounded';
    const job = hero.jobId ? getJob(hero.jobId) : null;
    const jobTitle = job ? job.name : (hero.className || 'Recruit');
    const headshotPath = resolveSpritePath(hero.icon || 'icon_recruit_0') || resolveSpritePath(hero.spriteId || 'hero_recruit_0');
    const hp = Math.max(0, Math.round(hero.hp?.current ?? 0));
    const hpMax = Math.max(1, hero.hp?.max ?? 100);
    const pct = hpPercent(hero.hp);
    const tone = hpTone(pct);

    // An item dragged over the tab marks it as a drop target. A hero dragged within the column
    // shows only the insertion line. No hover cue while a reorder is settling (~320 ms).
    const isDraggingItem = globalDragging && drop.activePayload?.kind === DRAG_KIND.ITEM;
    const isDraggingHero = globalDragging && drop.activePayload?.kind === DRAG_KIND.HERO && !isRecallDrop(drop.activePayload);
    const hovering = isHovered && !globalDragging && !isDragSettling && !drag.isDragging;

    const isHeroDropValid = drop.valid && isDraggingHero;
    const sourceIndex = isHeroDropValid && heroIds ? heroIds.indexOf(drop.activePayload.heroId) : -1;
    const targetIndex = index ?? (heroIds ? heroIds.indexOf(heroId) : -1);
    const isInsertionBelow = sourceIndex !== -1 && targetIndex !== -1 && sourceIndex < targetIndex;

    const statusLine = isWounded ? 'Wounded' : dockStatusLine(status);
    const tipLines = [
        jobTitle,
        statusLine,
        `${hp.toLocaleString('en-US')} / ${hpMax.toLocaleString('en-US')} HP`,
        `${hero.equippedCount}/9 items`
    ];

    return (
        <div
            data-hero-dock-tab="true"
            data-dock-hero-id={heroId}
            className={cn(
                'relative h-[72px] select-none shrink-0 w-full pointer-events-none',
                isHovered ? 'z-50' : 'z-40'
            )}
        >
            {isHeroDropValid && (
                <div
                    className={cn(
                        'absolute h-0.5 w-20 z-50 pointer-events-none bg-gi-gold shadow-[0_0_10px_#f59e0b]',
                        isDockLeft ? 'left-0' : 'right-0',
                        isInsertionBelow ? '-bottom-1.5' : '-top-1.5'
                    )}
                />
            )}
            <div
                ref={mergeRefs(drag.setNodeRef, drop.setNodeRef, faceRef)}
                {...drag.handleProps}
                {...drop.droppableProps}
                data-hero-tab-face
                data-hero-tab-status={isWounded ? 'wounded' : (status?.state || 'docked')}
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
                className={cn(
                    'absolute top-0 w-20 h-[72px] pointer-events-auto cursor-grab active:cursor-grabbing',
                    'flex flex-col items-center justify-center gap-1 px-1.5 bg-[#140e0b] border',
                    isDockLeft ? 'left-0 border-l-0 rounded-r' : 'right-0 border-r-0 rounded-l',
                    isSelected ? 'border-gi-gold'
                        : drop.valid && isDraggingItem ? 'border-gi-primary'
                        : 'border-white/10 hover:border-gi-gold/50',
                    drag.isDragging && 'opacity-30'
                )}
            >
                <div className="relative w-10 h-10 shrink-0">
                    {headshotPath ? (
                        <img
                            src={headshotPath.startsWith('/') ? headshotPath : `/${headshotPath}`}
                            alt={hero.name}
                            draggable={false}
                            className="w-10 h-10 object-contain pointer-events-none"
                            style={{ imageRendering: 'pixelated' }}
                        />
                    ) : (
                        <span className="text-xl">{hero.icon || '🧑'}</span>
                    )}
                    {(isWounded || status?.state === 'working') && (
                        <span
                            className={cn(
                                'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-black',
                                isWounded ? 'bg-red-500' : 'bg-emerald-400'
                            )}
                        />
                    )}
                </div>
                <span
                    className={cn(
                        'max-w-full truncate text-[10px] font-bold leading-none',
                        isSelected ? 'text-gi-gold' : isWounded ? 'text-red-300' : 'text-white'
                    )}
                >
                    {hero.name}
                </span>
                <div className="w-full h-1 rounded-full bg-black/70 overflow-hidden">
                    <div
                        data-hero-tab-hp
                        className={cn('h-full transition-[width] duration-300', HP_TONE_CLASS[tone])}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
            {hovering && <TopBarTip anchor={faceRef.current} title={hero.name} lines={tipLines} width={200} />}
        </div>
    );
};

export default HeroDockTab;
