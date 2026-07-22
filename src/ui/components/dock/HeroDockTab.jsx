import React from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { AREA_EVENTS } from '../../../systems/core/areaEvents.js';
import { DOCK_TAB_H, DOCK_TAB_W } from './dockConstants.js';
import { describeActivity, PILL_TONE_CLASS } from './dockActivity.js';
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
    heroId, onClick, style, className, innerRef, pinned = false, lift = true, ...rest
}) => {
    const activity = useHeroActivity(heroId);
    if (!activity) return null;

    const { label, icon, tone } = describeActivity(activity);
    const Icon = PILL_ICON[icon] || null;

    return (
        <button
            ref={innerRef}
            type="button"
            onClick={onClick}
            aria-pressed={pinned}
            title={`${activity.name} — ${label}`}
            style={{ width: DOCK_TAB_W, height: DOCK_TAB_H, ...style }}
            className={cn(
                'shrink-0 flex items-center gap-2 px-2.5 text-left select-none',
                'rounded-t-xl border border-b-0 bg-gi-surface',
                'shadow-[0_-4px_14px_rgba(0,0,0,0.45)]',
                'transition-[transform,border-color] duration-150',
                // Pinned: the header is the top of an open card, so it takes
                // the card's accent border and stops behaving like a tab.
                pinned ? 'border-gi-primary/60' : 'border-gi-border/70',
                lift && 'hover:-translate-y-1 hover:border-gi-primary/60',
                !pinned && activity.wounded && 'border-gi-danger/40',
                className
            )}
            {...rest}
        >
            <div className="shrink-0" style={{ imageRendering: 'pixelated' }}>
                <ItemIcon item={{ sprite: activity.spriteId, classId: activity.classId }} size={48} />
            </div>

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
        </button>
    );
};

export default HeroDockTab;
