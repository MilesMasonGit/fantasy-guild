import React from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { getSkill } from '../../../config/registries/index.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';

/**
 * SkillRequirementsModule
 * Displays the required skills to begin a task.
 * Dynamically highlights requirements in green (met) or red (unmet) if currentSkills are provided.
 */
const SkillRequirementsModule = React.memo(({ trait, card, isFirst, globalIndex, ...props }) => {
    const engine = useEngine();

    // Robustly resolve skill requirements from all possible data locations
    const skillRequirements = React.useMemo(() => {
        const reqs = props.skillRequirements || trait?.skillRequirements || trait?.requirements || {};
        
        // Handle flat trait structure: { skill: 'mining', level: 1 }
        if (trait?.skill && (trait?.level || trait?.skillRequirement)) {
            reqs[trait.skill] = trait.level || trait.skillRequirement;
        }

        // Handle card/template level legacy requirements
        const baseSkill = card?.skill || trait?.skill || props.template?.skill;
        const baseLevel = card?.skillRequirement || trait?.level || props.template?.skillRequirement;
        
        if (baseSkill && baseLevel > 0 && !reqs[baseSkill]) {
            reqs[baseSkill] = baseLevel;
        }

        return reqs;
    }, [props.skillRequirements, trait, card?.skill, card?.skillRequirement, props.template]);

    // Resolve current skills from assigned hero if available
    let currentSkills = props.currentSkills;
    if (!currentSkills && card?.assignedHeroId) {
        const hero = engine.HeroManager.getHero(card.assignedHeroId);
        currentSkills = hero?.skills;
    }

    if (!skillRequirements || Object.keys(skillRequirements).length === 0) {
        return null; // Don't render if there are no requirements
    }

    return (
        <div className="flex flex-wrap justify-center gap-4">
            {Object.entries(skillRequirements).map(([skillId, requiredLevel]) => {
                const skillDef = getSkill(skillId);
                if (!skillDef) return null;

                const name = skillDef.name || skillId;
                
                // Resolve Parent Skill for Sub-Skills (e.g., "Nature" - "Harvesting")
                let displayLabel = `${requiredLevel} ${name}`;
                if (skillDef.isSubSkill && skillDef.parentSkillId) {
                    const parentDef = getSkill(skillDef.parentSkillId);
                    if (parentDef) {
                        displayLabel = `${requiredLevel} ${parentDef.name} - ${name}`;
                    }
                }

                // Determine completion status (Text-only)
                let statusClass = 'text-white';
                if (currentSkills) {
                    const currentSkillId = skillDef.parentSkillId || skillId;
                    const currentSkillData = currentSkills[currentSkillId];
                    const currentLevel = typeof currentSkillData === 'number'
                        ? currentSkillData
                        : (currentSkillData?.level ?? 0);

                    if (currentLevel >= requiredLevel) {
                        statusClass = 'text-gi-success';
                    } else {
                        statusClass = 'text-gi-danger';
                    }
                }

                return (
                    <div
                        key={skillId}
                        className={`flex items-center gap-1.5 text-pixel-base font-bold uppercase tracking-tighter ${statusClass}`}
                        style={{ textShadow: 'var(--text-shadow-base)' }}
                        title={`Requires ${displayLabel}`}
                    >
                        <span>{displayLabel}</span>
                    </div>
                );
            })}
        </div>
    );
}, (prev, next) => {
    if (prev.card && next.card) {
        return prev.card._rev === next.card._rev && prev.trait === next.trait;
    }
    return false;
});

export default SkillRequirementsModule;
