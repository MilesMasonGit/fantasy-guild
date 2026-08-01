import React from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { AREA_EVENTS } from '../../../systems/core/areaEvents.js';
import { DOCK_TAB_H, DOCK_TAB_W, DOCK_TAB_W_SMALL } from './dockConstants.js';
import { describeActivity, PILL_TONE_CLASS } from './dockActivity.js';
import { useEngine } from '../../hooks/useEngine.js';
import {
    useEntityDrag, useEntityDrop, mergeRefs, ACCEPT_CLS, REJECT_CLS
} from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { isConsumableItem } from '../banner/bannerCards.jsx';
import { Swords, HeartCrack } from 'lucide-react';

/** Pill icons, keyed by what describeActivity asks for. */
const PILL_ICON = { wound: HeartCrack, combat: Swords };

/**
 * HeroDockTab — one hero's tab in the Hero Dock (concept §3, State A).
 *
 * This is the TOP HEADER of the hero card and nothing else: portrait on the
 * left, name + level and an activity pill stacked on the right. Phase 5's
 * pinned card renders this exact component as its own header, so pulling a
 * card up out of the dock is visually continuous.
 *
 * The pill names the AREA rather than "Banner 1" — areas are named in this
 * game and there are only a few, so "Whispering Woods" reads better than a
 * number the player has to map back to a place (roadmap, settled).
 */

/** Activity, derived from the hero's status and the area they're deployed to. */
function useHeroActivity(heroId) {
    return useGameState(
        state => {
            const hero = (state.heroes || []).find(h => h.id === heroId);
            if (!hero) return null;

            // Which area holds this hero, if any. Scanning areaStates keeps
            // this a flat projection — see the useGameState selector contract.
            let areaId = null;
            for (const [id, areaState] of Object.entries(state.areaStates || {})) {
                if (areaState.assignedHeroId === heroId) { areaId = id; break; }
            }

            return {
                name: hero.name,
                level: Math.floor(hero.level || 1),
                spriteId: hero.spriteId,
                classId: hero.classId,
                wounded: hero.status === 'wounded',
                areaId,
                areaStatus: areaId ? (state.areaStates[areaId]?.status || null) : null
            };
        },
        ['heroes_updated', AREA_EVENTS.HERO_CHANGED, AREA_EVENTS.STATUS_CHANGED, 'state_changed'],
        null,
        { deps: [heroId] }
    );
}

export const HeroDockTab = ({
    heroId, onClick, style, className, innerRef,
    pinned = false, lift = true, small = false, ...rest
}) => {
    const engine = useEngine();
    const activity = useHeroActivity(heroId);

    // Drag source: pull the hero out to deploy them onto a banner's hero slot,
    // which already accepts this payload (roadmap F3). The 8px activation
    // distance on the shared PointerSensor is what separates this from the
    // click that pins the card — owner confirmed keeping the global value.
    const drag = useEntityDrag({
        id: `dock-hero-${heroId}`,
        kind: DRAG_KIND.HERO,
        payload: {
            heroId,
            name: activity?.name,
            spriteId: activity?.spriteId,
            classId: activity?.classId
        },
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: !activity
    });

    // Drop target: the whole tab equips (concept §4.2 "Card-Wide Target").
    // Deliberately the UNPINNED tab, which is always on screen — dragging from
    // the Bank starts outside the dock and so unpins everything first (D11).
    const drop = useEntityDrop({
        id: `dock-hero-drop-${heroId}`,
        surface: DND_SURFACE.DRAWER,
        accepts: p => {
            // A deployed hero dropped anywhere on the dock is a recall. Tabs
            // have to handle this as well as the strip behind them: collision
            // resolves to the SMALLEST target under the cursor, so a tab always
            // wins over the strip and would otherwise reject the drop.
            if (p.kind === DRAG_KIND.HERO) return !!p.from?.areaId;
            // Food, drink and consumables live on the hero again (D-4/D-7).
            if (p.kind !== DRAG_KIND.ITEM) return false;
            // A hero-to-hero transfer landing back on its own source is a no-op.
            return p.fromHeroId !== heroId;
        },
        onDrop: p => {
            if (p.kind === DRAG_KIND.HERO) {
                engine.HeroAssignmentManager.unassignHero(p.from.areaId);
                return;
            }
            // Hero-to-hero transfer: strip the item off the source first, or
            // the shared-reference model leaves it equipped on BOTH heroes
            // whenever the bank holds a spare (roadmap F2).
            if (p.fromHeroId && p.fromSlot) {
                engine.EquipmentManager.unequipItem(p.fromHeroId, p.fromSlot);
            }
            engine.EquipmentManager.equipItem(heroId, p.itemId);
        }
    });

    if (!activity) return null;

    const { label, icon, tone } = describeActivity(activity);
    const Icon = PILL_ICON[icon] || null;

    // Small Mode collapses to a square face-only chip (concept §3 State C).
    // A pinned card always uses the full width — six equipment slots and
    // fifteen skills cannot live in 48px, so the chip expands as it opens.
    const collapsed = small && !pinned;
    const width = collapsed ? DOCK_TAB_W_SMALL : DOCK_TAB_W;

    return (
        <button
            ref={mergeRefs(innerRef, drag.setNodeRef, drop.setNodeRef)}
            type="button"
            onClick={onClick}
            aria-pressed={pinned}
            title={`${activity.name} (Lv${activity.level}) — ${label}`}
            style={{ width, height: DOCK_TAB_H, ...style }}
            className={cn(
                'shrink-0 flex items-center select-none',
                collapsed ? 'justify-center px-0' : 'gap-2 px-2.5 text-left',
                'rounded-t-xl border border-b-0 bg-gi-surface',
                'shadow-[0_-4px_14px_rgba(0,0,0,0.45)]',
                'transition-[transform,border-color,width] duration-150',
                'cursor-grab active:cursor-grabbing',
                // Press-down cue (concept §5.1): the tab depresses under the
                // finger before the 8px threshold decides click vs drag.
                'active:scale-[0.98] active:translate-y-px',
                // Pinned: the header is the top of an open card, so it takes
                // the card's accent border and stops behaving like a tab.
                pinned ? 'border-gi-primary/60' : 'border-gi-border/70',
                lift && 'hover:-translate-y-1 hover:border-gi-primary/60',
                !pinned && activity.wounded && 'border-gi-danger/40',
                drag.isDragging && 'opacity-40',
                drop.valid && ACCEPT_CLS,
                drop.invalid && REJECT_CLS,
                className
            )}
            {...drag.handleProps}
            {...drop.droppableProps}
            {...rest}
        >
            <div className="shrink-0 relative" style={{ imageRendering: 'pixelated' }}>
                <ItemIcon item={{ sprite: activity.spriteId, classId: activity.classId }} size={collapsed ? 40 : 48} />
                {/* Collapsed chips lose the pill, so the two states that need
                    attention keep a dot in the corner instead. */}
                {collapsed && tone === 'danger' && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gi-danger border border-black/50" />
                )}
                {collapsed && tone === 'deployed' && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gi-primary border border-black/50" />
                )}
            </div>

            {!collapsed && (
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <span className="flex items-baseline gap-1 min-w-0">
                        <span className="truncate text-[12px] font-bold text-gi-text">{activity.name}</span>
                        <span className="shrink-0 text-[10px] font-mono font-bold text-gi-muted tabular-nums">
                            Lv{activity.level}
                        </span>
                    </span>

                    <span className={cn(
                        'inline-flex items-center gap-1 w-fit max-w-full px-1.5 py-0.5 rounded-full border',
                        'text-[9px] font-bold gi-caps tracking-wider',
                        PILL_TONE_CLASS[tone]
                    )}>
                        {Icon && <Icon size={9} className="shrink-0" />}
                        <span className="truncate">{label}</span>
                    </span>
                </div>
            )}
        </button>
    );
};

export default HeroDockTab;
