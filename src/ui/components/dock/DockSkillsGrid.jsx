import React from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getSkill, getAllSkillIds } from '../../../config/registries/skillRegistry.js';

/**
 * DockSkillsGrid — the pinned card's stats section (concept §3 §3): the 15
 * skills in 5 rows of 3.
 *
 * "15 attribute slots" is the 15 skills, not the 7-stat combat model
 * (roadmap D4). At the card's 200px width there is no room for skill names, so
 * each cell is the skill's icon plus its level, with the full name and XP in
 * the hover tooltip. Combat skills are tinted to separate them from the eleven
 * loop skills at a glance.
 */
export const DockSkillsGrid = ({ heroId }) => {
    const skillIds = getAllSkillIds();

    // Levels as a delimited signature — a flat projection, per the
    // useGameState selector contract.
    const levels = useGameState(
        state => {
            const hero = (state.heroes || []).find(h => h.id === heroId);
            if (!hero) return null;
            return skillIds.map(id => hero.skills?.[id]?.level ?? 1).join(',');
        },
        ['heroes_updated'],
        null,
        { deps: [heroId] }
    );

    if (levels === null) return null;
    const levelList = levels.split(',');

    return (
        <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 px-2 pb-2">
            {skillIds.map((skillId, i) => {
                const def = getSkill(skillId);
                const level = levelList[i];
                const isCombat = def?.category === 'combat';

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
