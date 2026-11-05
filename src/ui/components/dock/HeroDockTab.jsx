import { memo, useCallback, useMemo, useRef } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import * as EquipmentManager from '../../../systems/equipment/EquipmentManager.js';
import { useEntityDrag, useEntityDrop, useActiveDrag, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE, rosterFlagPayload, isRosterFlag } from '../../dnd/dragConstants.js';
import { resolveSpritePath, resolveAnimationPath } from '../../../utils/AssetManager.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { useDragSettleHover } from './useDragSettleHover.js';
import { equipOrAnnounce } from './dockEquip.js';
import { rosterStateOf, rosterAlertOf, rosterBubbleLine, ROSTER_ALERT } from '../board/flagText.js';
import { PROBLEM_SPRITE, SEVERITY } from '../board/problemMark.js';
import { setRosterHover } from '../board/orderLit.js';
import { TopBarTip } from '../board/TopBarTip.jsx';
import { useHeroPortrait, PORTRAIT_PX } from './heroPortrait.js';
import { SLOT_ORDER } from '../../../config/registries/equipmentConstants.js';
import { ENGINE_EVENTS, ORPHAN_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';

/** A tab's height: the portrait, and the name overlapping its foot. */
const TAB_H_PX = 88;

/** The alert's size on a tab: its 16 art pixels at 2×, as on the hero bar at 128 px. */
const TAB_ALERT_PX = 32;

/** The stepped corners of the frames and the HP bar, on the dark plate behind a name. */
const STEPPED = 'polygon(2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px), 0 2px, 2px 2px)';

/**
 * HeroDockTab: a hero's tab in the hero column beside the Bank (`BankHeroPanel`): a portrait (the
 * head and shoulders of the hero's own sheet, facing left, cut once per sheet), the name over its
 * foot and an alert when wounded or the player must act, as on the hero bar, in one thin frame.
 * Hover lights the frame and shows the game's tooltip (what they are doing, HP, items); nothing
 * slides out. Click opens the hero panel; dragging
 * carries the hero's flag, as on the mat: dropped on the mat it gives an order, dropped on another
 * tab it reorders. An item dropped on it equips. Hovering outlines the hero on the mat and lights
 * their job.
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
    const { isDragging: globalDragging } = useActiveDrag();
    const { isHovered, settling: isDragSettling, onHoverChange } = useDragSettleHover(globalDragging);

    const hero = useTabHero(heroId);
    const justDroppedRef = useRef(false);

    const dragIdPrefix = 'bank-hero';

    const drag = useEntityDrag({
        id: `${dragIdPrefix}-${heroId}`,
        sourceSurface: DND_SURFACE.DRAWER,
        kind: DRAG_KIND.FLAG,
        payload: rosterFlagPayload(heroId, hero?.name)
    });

    const drop = useEntityDrop({
        id: `${dragIdPrefix}-drop-${heroId}`,
        surface: DND_SURFACE.DRAWER,
        // An item equips; a tab dragged within the column is a reorder.
        accepts: p => (p.kind === DRAG_KIND.ITEM && p.fromHeroId !== heroId)
            || (isRosterFlag(p) && p.heroId !== heroId),
        onDrop: p => {
            if (p.kind === DRAG_KIND.ITEM && p.itemId) {
                if (!equipOrAnnounce(EquipmentManager, heroId, p.itemId, null, p)) return false;
                justDroppedRef.current = true;
                setTimeout(() => { justDroppedRef.current = false; }, 250);
                EventBus.publish(UI_EVENTS.INSPECT_HERO, { heroId, afterDrop: true });
            } else if (isRosterFlag(p) && p.heroId && p.heroId !== heroId) {
                onReorder?.(p.heroId, heroId);
            }
        }
    });
    const nodeRef = useMemo(() => mergeRefs(drag.setNodeRef, drop.setNodeRef), [drag.setNodeRef, drop.setNodeRef]);

    if (!hero) return null;

    // An item dragged over the tab marks it as a drop target. A hero dragged within the column
    // shows only the insertion line. No hover cue while a reorder is settling (~320 ms).
    const isDraggingItem = globalDragging && drop.activePayload?.kind === DRAG_KIND.ITEM;
    const isDraggingHero = globalDragging && isRosterFlag(drop.activePayload);
    const hovering = isHovered && !globalDragging && !isDragSettling && !drag.isDragging;

    const isHeroDropValid = drop.valid && isDraggingHero;
    const sourceIndex = isHeroDropValid && heroIds ? heroIds.indexOf(drop.activePayload.heroId) : -1;
    const targetIndex = index ?? (heroIds ? heroIds.indexOf(heroId) : -1);
    const isInsertionBelow = sourceIndex !== -1 && targetIndex !== -1 && sourceIndex < targetIndex;

    return (
        <HeroDockTabBody
            heroId={heroId}
            hero={hero}
            isSelected={isSelected}
            onSelect={onSelect}
            onDoubleClick={onDoubleClick}
            isDockLeft={isDockLeft}
            isHovered={isHovered}
            onHoverChange={onHoverChange}
            hovering={hovering}
            itemCue={drop.valid && isDraggingItem}
            heroCue={isHeroDropValid}
            isInsertionBelow={isInsertionBelow}
            held={drag.isDragging}
            nodeRef={nodeRef}
            handleProps={drag.handleProps}
            droppableProps={drop.droppableProps}
            justDroppedRef={justDroppedRef}
        />
    );
};

/**
 * Flat projection per the useGameState selector contract: `hp` is rebuilt fresh from primitives
 * each evaluation, never the store's own nested object, so an in-place HP mutation is actually
 * seen as a change.
 */
function useTabHero(heroId) {
    return useGameState(
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
                equippedCount,
                hp: { current: h.hp?.current ?? 0, max: h.hp?.max ?? 100 }
            };
        },
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, ORPHAN_EVENTS.HERO_STATUS_CHANGED, ENGINE_EVENTS.GAME_RESET],
        null,
        { deps: [heroId] }
    );
}

// ⚠️ Apart from its drag hooks on purpose: dnd-kit redraws their holder at every drag start, end
// and change of target; the tab is memoised on what it draws.
const HeroDockTabBody = memo(function HeroDockTabBody({
    heroId,
    hero,
    isSelected,
    onSelect,
    onDoubleClick,
    isDockLeft,
    isHovered,
    onHoverChange,
    hovering,
    itemCue,
    heroCue,
    isInsertionBelow,
    held,
    nodeRef,
    handleProps,
    droppableProps,
    justDroppedRef
}) {
    const faceRef = useRef(null);
    const setFace = useCallback((el) => { faceRef.current = el; nodeRef(el); }, [nodeRef]);

    // The hero bar's own state and alert. `HERO_MOVED` announces every order, claim and defeat,
    // `HEROES_WALKED` a hero arriving, `HEROES_UPDATED` a wound healing, `ALERT_CHANGED` a Token
    // sticking under its hero, `TOOL_NEEDED` a flag finding on its next look that the tool is gone.
    const roster = useGameState(
        () => ({ state: rosterStateOf(heroId), alert: rosterAlertOf(heroId) }),
        [
            BOARD_EVENTS.HERO_MOVED, BOARD_EVENTS.HEROES_WALKED, BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.ALERT_CHANGED,
            BOARD_EVENTS.GROWTH_ALERT_CHANGED, BOARD_EVENTS.TOOL_NEEDED, ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.GAME_RESET
        ],
        null,
        { deps: [heroId] }
    ) || { state: 'idle', alert: null };

    const isWounded = hero.status === 'wounded';
    const sprite = hero.spriteId || hero.classId || null;
    const sheet = sprite ? resolveAnimationPath(sprite) : null;
    const cut = useHeroPortrait(sheet);
    const still = sheet ? null : resolveSpritePath(sprite || hero.icon || 'hn_recruit_por');
    const hp = Math.max(0, Math.round(hero.hp?.current ?? 0));
    const hpMax = Math.max(1, hero.hp?.max ?? 100);

    const tipLines = hovering ? [
        rosterBubbleLine(heroId),
        `${hp.toLocaleString('en-US')} / ${hpMax.toLocaleString('en-US')} HP`,
        `${hero.equippedCount}/${SLOT_ORDER.length} items`
    ] : null;

    return (
        <div
            data-hero-dock-tab="true"
            data-dock-hero-id={heroId}
            className={cn(
                'relative select-none shrink-0 w-full pointer-events-none',
                isHovered ? 'z-50' : 'z-40'
            )}
            style={{ height: TAB_H_PX }}
        >
            {heroCue && (
                <div
                    className={cn(
                        'absolute h-1 w-20 z-50 pointer-events-none bg-gi-gold',
                        isDockLeft ? 'left-0' : 'right-0',
                        isInsertionBelow ? '-bottom-1' : '-top-1'
                    )}
                />
            )}
            <div
                ref={setFace}
                {...handleProps}
                {...droppableProps}
                data-hero-tab-face
                data-dnd-region={DND_SURFACE.DRAWER}
                data-hero-tab-status={isWounded ? 'wounded' : roster.state}
                onClick={() => {
                    if (justDroppedRef.current) return;
                    onSelect?.(heroId);
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDoubleClick?.(heroId);
                }}
                onMouseEnter={() => { onHoverChange(true); setRosterHover(heroId); }}
                onMouseLeave={() => { onHoverChange(false); setRosterHover(null); }}
                className={cn(
                    'absolute inset-y-0 w-20 pointer-events-auto cursor-grab active:cursor-grabbing',
                    'flex flex-col items-center bg-[#140e0b] border',
                    isDockLeft ? 'left-0 border-l-0' : 'right-0 border-r-0',
                    isSelected ? 'border-gi-gold'
                        : itemCue ? 'border-gi-primary'
                        : 'border-white/10 hover:border-gi-gold/50',
                    held && 'opacity-30'
                )}
            >
                <div
                    data-hero-tab-portrait={sheet || still || undefined}
                    className="shrink-0 pointer-events-none"
                    style={{ width: PORTRAIT_PX, height: PORTRAIT_PX }}
                >
                    {(cut || still) && (
                        <img
                            src={cut || (still.startsWith('/') ? still : `/${still}`)}
                            alt={hero.name}
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
                {roster.alert && (
                    <img
                        data-hero-tab-alert={roster.alert}
                        src={PROBLEM_SPRITE[roster.alert === ROSTER_ALERT.WOUNDED ? SEVERITY.CANT : SEVERITY.WAITING]}
                        alt=""
                        draggable={false}
                        className="absolute top-0 pointer-events-none"
                        style={{
                            [isDockLeft ? 'right' : 'left']: 0,
                            width: TAB_ALERT_PX,
                            height: TAB_ALERT_PX,
                            imageRendering: 'pixelated',
                            filter: 'drop-shadow(2px 2px 0 #000)'
                        }}
                    />
                )}
                <span
                    data-hero-tab-name
                    className={cn(
                        'absolute inset-x-0 bottom-0 break-words text-center font-bold leading-none pointer-events-none',
                        'ui-text-body py-1 px-1',
                        isSelected ? 'text-gi-gold' : isWounded ? 'text-red-300' : 'text-white'
                    )}
                    style={{ background: '#000', clipPath: STEPPED }}
                >
                    {hero.name}
                </span>
            </div>
            {hovering && <TopBarTip anchor={faceRef.current} title={hero.name} lines={tipLines} width={200} />}
        </div>
    );
});

export default HeroDockTab;
