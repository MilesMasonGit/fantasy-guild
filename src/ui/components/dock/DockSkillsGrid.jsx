import React from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getSkill, isCombatSkill } from '../../../config/registries/skillRegistry.js';

/**
 * DockSkillsGrid — the pinned card's stats section: **the skills this hero
 * actually holds**, three to a row.
 *
 * ⚠️ **This used to render a fixed 15-cell grid of every skill in the world.**
 * A hero now holds 6 of 27, and which 6 changes with their job, so the grid is
 * driven by the hero's own skill map and nothing else. It must never read the
 * registry for its cell list — a hero showing a skill they do not hold is
 * exactly the confusion possession exists to remove.
 *
 * At the card's 200px width there is no room for names, so each cell is the
 * skill's icon plus its level, with the full name in the hover tooltip. The
 * combat skill is tinted to separate it from the production skills at a glance.
 *
 * ⚠️ **Banked skills are deliberately NOT shown here.** The card is a glance
 * surface; what a hero *used* to be able to do belongs on the inspection modal
 * (D-250), which is Phase 7.
 */
export const DockSkillsGrid = ({ heroId }) => {
    // Held ids AND levels in one flat projection — the hero's own map is the
    // source of truth for both, per the useGameState selector contract.
    const signature = useGameState(
        state => {
            const hero = (state.heroes || []).find(h => h.id === heroId);
            if (!hero?.skills) return null;
            return Object.entries(hero.skills)
                .map(([id, s]) => `${id}:${s?.level ?? 1}`)
                .join(',');
        },
        ['heroes_updated'],
        null,
        { deps: [heroId] }
    );

    if (signature === null) return null;
    const held = signature ? signature.split(',').map(pair => pair.split(':')) : [];

    return (
        <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 px-2 pb-2">
            {held.map(([skillId, level]) => {
                const def = getSkill(skillId);
                const isCombat = isCombatSkill(skillId);

                return (
                    <div
                        key={skillId}
                        title={`${def?.name || skillId} — level ${level}`}
                        className={cn(
                            'flex items-center gap-1 px-1 py-0.5 rounded border',
                            isCombat
                                ? 'border-gi-primary/25 bg-gi-primary/5'
                                : 'border-gi-border/25 bg-black/20'
                        )}
                    >
                        <span className="text-[10px] leading-none shrink-0">{def?.icon}</span>
                        <span className={cn(
                            'text-[9px] font-bold tabular-nums truncate',
                            isCombat ? 'text-gi-primary' : 'text-gi-text/70'
                        )}>
                            {level}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default DockSkillsGrid;
