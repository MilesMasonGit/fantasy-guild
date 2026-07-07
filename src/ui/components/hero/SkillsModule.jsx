import React, { useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { getSkill, classHasSkill, traitHasSkill, getClass } from '../../../config/registries/index.js';
import { getXpProgress } from '../../../utils/XPCurve.js';

const SKILL_ICON_MAP = {
    industry: '/assets/sprites/implemented/skills/skill_industry.png',
    nature: '/assets/sprites/implemented/skills/skill_nature.png',
    nautical: '/assets/sprites/implemented/skills/skill_nautical.png',
    culinary: '/assets/sprites/implemented/skills/skill_culinary.png',
    social: '/assets/sprites/implemented/skills/skill_social.png',
    crime: '/assets/sprites/implemented/skills/skill_crime.png',
    occult: '/assets/sprites/implemented/skills/skill_occult.png',
    science: '/assets/sprites/implemented/skills/skill_flask.png',
};

/**
 * SkillsModule
 * Renders a vertical list of skills with XP progress bars.
 */
export const SkillsModule = ({
    hero,
    className
}) => {
    if (!hero || !hero.skills) return null;

    // Rule of 9: 1 combat specialty + 8 non-combat
    const activeSkills = useMemo(() => {
        const combatType = hero.isVillager ? null : (getClass(hero.classId)?.combatStyle || 'melee');
        const list = [combatType, 'industry', 'nature', 'nautical', 'culinary', 'social', 'crime', 'occult', 'science'];
        return list.filter(Boolean);
    }, [hero.classId, hero.isVillager]);

    return (
        <div className={cn("flex flex-col gap-1.5 w-full p-2 bg-gi-surface/10", className)}>
            {activeSkills.map(skillId => {
                const heroSkill = hero.skills[skillId];
                const skillDef = getSkill(skillId);

                if (!heroSkill || !skillDef) return null;

                // Calculate progress
                const progressData = getXpProgress(heroSkill.xp);
                const progressPercent = Math.floor(progressData.progress * 100);

                // Icons
                const pngIcon = SKILL_ICON_MAP[skillId];
                
                // Calculate boost level for highlights
                let boostLevel = 0;
                if (classHasSkill(hero.classId, skillId)) boostLevel++;
                if (traitHasSkill(hero.traitId, skillId)) boostLevel++;
                const isBoosted = boostLevel > 0;

                return (
                    <div 
                        key={skillId} 
                        className="flex items-center gap-3 group/skill p-1 rounded"
                        title={`${skillDef.name}: ${Math.floor(heroSkill.xp)} XP`}
                    >
                        {/* 1. Large Skill Icon (32px Standard) */}
                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded bg-gi-base border border-gi-border/20 shadow-inner overflow-hidden">
                            {pngIcon ? (
                                <img src={pngIcon} alt={skillDef.name} className="w-6 h-6 object-contain render-pixelated" />
                            ) : (
                                <span className="text-lg leading-none opacity-50">{skillDef.icon}</span>
                            )}
                        </div>

                        {/* 2. Content Column (Name/Level + Progress) */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className={cn(
                                        "gi-text-14 font-bold tracking-tight truncate transition-colors uppercase gi-outline-2",
                                        isBoosted ? "text-gi-primary" : "text-gi-text/80"
                                    )}>
                                        {skillDef.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[10px] font-mono font-bold text-gi-muted">
                                        LV {heroSkill.level}
                                    </span>
                                    <span className="text-[9px] font-mono font-bold text-gi-accent/70 min-w-[24px] text-right">
                                        {progressPercent}%
                                    </span>
                                </div>
                            </div>

                            {/* Standardized Progress Bar (To the right of the icon) */}
                            <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-gi-border/10 shadow-inner">
                                <div 
                                    className={cn(
                                        "h-full transition-all duration-500 rounded-full",
                                        isBoosted ? "bg-gi-primary shadow-[0_0_8px_rgba(var(--color-gi-primary),0.4)]" : "bg-gi-accent/50"
                                    )}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default SkillsModule;
