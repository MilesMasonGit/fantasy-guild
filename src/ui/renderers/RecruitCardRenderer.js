// Fantasy Guild - Recruit Card Renderer
// Renders recruit cards with 3 hero options

import { RecruitSystem } from '../../systems/cards/RecruitSystem.js';
import { CurrencyManager } from '../../systems/economy/CurrencyManager.js';
import { getClass } from '../../config/registries/classRegistry.js';
import { getTrait } from '../../config/registries/traitRegistry.js';
import { getSkill } from '../../config/registries/skillRegistry.js';

/**
 * Renders the body content for a recruit card
 * @param {Object} cardInstance - Card instance with heroOptions
 * @param {Object} template - Card template
 * @returns {string} HTML string for card body
 */
export function renderRecruitBody(cardInstance, template) {
    const recruitCost = RecruitSystem.getRecruitCost();
    const isFree = cardInstance.isFree || false;
    const canAfford = isFree || CurrencyManager.canAfford(recruitCost);
    const heroOptions = cardInstance.heroOptions || [];

    // Display FREE or cost
    const costDisplay = isFree
        ? '<span class="recruit-cost--free">FREE</span>'
        : `Cost: 👑 <span class="recruit-cost__value ${canAfford ? '' : 'recruit-cost__value--insufficient'}">${recruitCost}</span> Influence`;

    return `
        <div class="recruit-options">
            ${heroOptions.map((hero, index) => renderHeroOption(hero, index, cardInstance.selectedIndex)).join('')}
        </div>
        <div class="card__footer--recruit">
            <div class="recruit-cost">
                ${costDisplay}
            </div>
            <button class="btn recruit-confirm" 
                    data-card-id="${cardInstance.id}"
                    ${!canAfford || cardInstance.selectedIndex === null ? 'disabled' : ''}>
                Recruit
            </button>
        </div>
    `;
}

/**
 * Renders a single hero option
 * @param {Object} hero - Hero data
 * @param {number} index - Option index
 * @param {number|null} selectedIndex - Currently selected index
 * @returns {string} HTML string
 */
function renderHeroOption(hero, index, selectedIndex) {
    const isSelected = selectedIndex === index;
    const skillIconsHtml = renderSkillIcons(hero.classId, hero.traitId);

    return `
        <div class="recruit-option ${isSelected ? 'recruit-option--selected' : ''}" 
             data-option-index="${index}">
            <div class="recruit-option__avatar">
                <span class="recruit-option__emoji">${hero.icon || '👤'}</span>
            </div>
            <div class="recruit-option__info">
                <div class="recruit-option__name">${hero.name}</div>
                <div class="recruit-option__details">
                    <span class="recruit-option__trait">${hero.traitName}</span>
                    <span class="recruit-option__class">${hero.className}</span>
                </div>
                <div class="recruit-option__skills">
                    ${skillIconsHtml}
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders skill icons for a hero based on Class and Trait bonuses
 * @param {string} classId - Hero's class ID
 * @param {string} traitId - Hero's trait ID
 * @returns {string} HTML string of skill icons
 */
function renderSkillIcons(classId, traitId) {
    const heroClass = getClass(classId);
    const heroTrait = getTrait(traitId);

    if (!heroClass || !heroTrait) return '';

    const classSkills = new Set(heroClass.bonusSkills || []);
    const traitSkills = new Set(heroTrait.bonusSkills || []);

    // Get all unique boosted skills
    const allBoostedSkills = new Set([...classSkills, ...traitSkills]);

    // Build skill icons
    const icons = [];
    for (const skillId of allBoostedSkills) {
        const skill = getSkill(skillId);
        if (!skill) continue;

        const isDoubleBoosted = classSkills.has(skillId) && traitSkills.has(skillId);
        const iconClass = isDoubleBoosted ? 'skill-icon skill-icon--gold' : 'skill-icon';

        icons.push(`<span class="${iconClass}" title="${skill.name}">${skill.icon}</span>`);
    }

    return icons.join('');
}

