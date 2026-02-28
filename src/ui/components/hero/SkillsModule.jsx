import React, { useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { getSkill, classHasSkill, traitHasSkill } from '../../../config/registries/index.js';
import { getXpProgress } from '../../../utils/XPCurve.js';

/**
 * SkillsModule
 * Renders the 3x4 grid of all hero skills, including class/trait boosts
 * and XP progress towards the next level.
 * 
 * @param {Object} props
 * @param {Object} props.hero - The hero containing classId, traitId, and skills array.
 */
export const SkillsModule = ({
    hero,
    className
}) => {
    if (!hero || !hero.skills) return null;

    // The legacy game defined exactly 12 skills in this order (3 columns x 4 rows)
    const skillOrder = useMemo(() => [
        ['melee', 'ranged', 'magic'],
        ['defence', 'crafting', 'culinary'],
        ['industry', 'nature', 'nautical'],
        ['crime', 'occult', 'science']
    ], []);

    return (
        <div className={cn("flex flex-col gap-1 w-full", className)}>
            {skillOrder.map((row, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-3 gap-1 w-full">
                    {row.map(skillId => {
                        const heroSkill = hero.skills[skillId];
                        const skillDef = getSkill(skillId);

                        if (!heroSkill || !skillDef) return <div key={skillId} className="w-full h-5"></div>;

                        // Calculate boost level
                        let boostLevel = 0;
                        if (classHasSkill(hero.classId, skillId)) boostLevel++;
                        if (traitHasSkill(hero.traitId, skillId)) boostLevel++;

                        // Visual styling based on boost level
                        const isGold = boostLevel === 2; // Boosted by BOTH class and trait
                        const isBlue = boostLevel === 1; // Boosted by ONE

                        // Calculate progress percent if it's not a villager
                        let progressPercent = 0;
                        if (!hero.isVillager) {
                            const progressData = getXpProgress(heroSkill.xp);
                            progressPercent = Math.floor(progressData.progress * 100);
                        }

                        // Use emoji fallback if no asset sprite is passed to the engine yet
                        const icon = skillDef.icon || '❔';

                        return (
                            <div
                                key={skillId}
                                title={`${skillDef.name}: ${Math.floor(heroSkill.xp)} XP`}
                                className={cn(
                                    "flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-pixel transition-colors",
                                    "bg-black/40 shadow-inner",
                                    isGold ? "border-yellow-500/50 text-yellow-100 bg-yellow-900/20" :
                                        isBlue ? "border-blue-500/50 text-blue-100 bg-blue-900/20" :
                                            "border-white/5 text-gray-400"
                                )}
                            >
                                <span className={cn(
                                    "text-[10px] drop-shadow-md",
                                    isGold ? "brightness-125" : isBlue ? "brightness-110" : "opacity-70 grayscale"
                                )}>
                                    {icon}
                                </span>

                                <span className="font-bold ml-0.5">{heroSkill.level}</span>

                                {!hero.isVillager && (
                                    <span className="opacity-50 tracking-tighter ml-auto">
                                        ({progressPercent}%)
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default SkillsModule;
