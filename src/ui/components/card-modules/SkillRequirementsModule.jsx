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

    // Support both direct props and registry-injected props
    const skillRequirements = props.skillRequirements || trait?.skillRequirements || trait?.requirements || {};

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
        <div className="flex flex-wrap gap-2 py-1">
            {Object.entries(skillRequirements).map(([skillId, requiredLevel]) => {
                const skillDef = getSkill(skillId);
                if (!skillDef) return null;

                const name = skillDef.name || skillId;
                const emojiIcon = skillDef.icon || '❓';

                // Determine completion status
                let statusClass = 'text-[var(--color-text-primary)] border-[var(--color-bg-panel-inset)] bg-black/30';
                let hasStatus = false;

                if (currentSkills) {
                    hasStatus = true;
                    // Support currentSkills as either a flat mapping { [skillId]: level } 
                    // or deep mapping { [skillId]: { level: level } } based on hero schema
                    const currentSkillData = currentSkills[skillId];
                    const currentLevel = typeof currentSkillData === 'number'
                        ? currentSkillData
                        : (currentSkillData?.level ?? 0);

                    if (currentLevel >= requiredLevel) {
                        statusClass = 'text-[var(--color-success)] border-[var(--color-success)]/30 bg-[var(--color-success)]/10';
                    } else {
                        statusClass = 'text-[var(--color-danger)] border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10';
                    }
                }

                // Sprite/Icon resolution
                const assetPath = resolveSpritePath(skillDef);
                let isSprite = assetPath && typeof assetPath === 'string';

                return (
                    <div
                        key={skillId}
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-pixel-base font-bold ${statusClass}`}
                        title={`${name}: Requires Level ${requiredLevel}`}
                    >
                        {isSprite ? (
                            <img
                                src={assetPath}
                                alt={name}
                                className="w-4 h-4 object-contain render-pixelated"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextElementSibling) {
                                        e.target.nextElementSibling.style.display = 'inline';
                                    }
                                }}
                            />
                        ) : null}

                        <span className="text-[1.1em] leading-none" style={{ display: isSprite ? 'none' : 'inline' }}>
                            {emojiIcon}
                        </span>

                        <span>{requiredLevel}</span>
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
