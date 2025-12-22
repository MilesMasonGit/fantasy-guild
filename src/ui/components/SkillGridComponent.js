// Fantasy Guild - Skill Grid Component
// Phase 9: Hero UI

import { getSkill, classHasSkill, traitHasSkill } from '../../config/registries/index.js';
import { getXpProgress } from '../../utils/XPCurve.js';
import { renderIcon } from '../../utils/AssetManager.js';

/**
 * Render a compact skill grid with boost highlighting
 * @param {Object} hero - Hero object (needs classId, traitId, skills)
 * @returns {string} HTML string
 */
export function renderSkillGrid(hero) {
    const skills = hero.skills;
    const { classId, traitId } = hero;

    // Skill order: 3 columns x 4 rows
    const skillOrder = [
        ['melee', 'ranged', 'magic'],
        ['defence', 'crafting', 'culinary'],
        ['industry', 'nature', 'nautical'],
        ['crime', 'occult', 'science']
    ];

    return skillOrder.map(row => {
        const cells = row.map(skillId => {
            const skill = skills[skillId];
            const skillDef = getSkill(skillId);
            if (!skill || !skillDef) return '';

            // Calculate boost level (0, 1, or 2)
            let boostLevel = 0;
            if (classHasSkill(classId, skillId)) boostLevel++;
            if (traitHasSkill(traitId, skillId)) boostLevel++;

            const boostClass = boostLevel === 2 ? 'skill-cell--gold' : boostLevel === 1 ? 'skill-cell--blue' : '';

            // Calculate progress to next level
            const progress = getXpProgress(skill.xp);
            const progressPercent = Math.floor(progress.progress * 100);

            const iconHtml = renderIcon(skillDef, 'skill-cell__icon', { size: 16 });

            return `<span class="skill-cell ${boostClass}" title="${skillDef.name}: ${skill.xp} XP">${iconHtml} ${skill.level}<span class="skill-progress">(${progressPercent}%)</span></span>`;
        }).join('');
        return `<div class="skill-row">${cells}</div>`;
    }).join('');
}
