// Fantasy Guild - Hero Slot Component
// Shared component for rendering hero assignment slots across all card types

import * as HeroManager from '../../systems/hero/HeroManager.js';

/**
 * Renders a hero assignment slot
 * @param {Object} cardInstance - Card instance with optional assignedHeroId
 * @returns {string} HTML string
 */
export function renderHeroSlot(cardInstance, template = null, slotIndex = 0) {
    // Check both new multi-slot object and legacy single property
    const heroId = cardInstance.heroSlots?.[slotIndex] || (slotIndex === 0 ? cardInstance.assignedHeroId : null);

    const assignedHero = heroId ? HeroManager.getHero(heroId) : null;

    // Phase 8: Heroes are now stacked natively via CardComponent.js renderCardStack.
    // If a hero is assigned, we do not need to render a slot in the card body at all.
    if (assignedHero) return '';

    // If no hero is assigned but one is required, render a subtle text badge instead of a huge box.
    const slotTrait = cardInstance.traits?.filter(t => t.type === 'heroslot')?.[slotIndex];
    const requirements = slotTrait?.requirements || template;
    let reqText = 'Hero Required';
    if (requirements?.skill && requirements?.skillRequirement > 0) {
        reqText += ` (${requirements.skill} Lv.${requirements.skillRequirement})`;
    }

    const energyCost = template?.baseEnergyCost || 0;
    const energyBadge = template ? `<span class="badge badge--energy" style="margin-left:8px;">⚡${energyCost} / tick</span>` : '';

    return `
        <div class="card__hero-requirement" style="font-size: 0.8rem; color: var(--color-text-muted); opacity: 0.8; text-align: center; padding: 4px; border: 1px dashed rgba(255,255,255,0.2); border-radius: 4px; margin-bottom: 8px;">
            <span style="display:inline-block; margin-right:4px;">👤</span> ${reqText} ${energyBadge}
        </div>
    `;
}

/**
 * Renders hero slot with input slots in a row (common pattern)
 * @param {Object} cardInstance - Card instance
 * @param {string} inputSlotsHtml - Pre-rendered input slots HTML
 * @returns {string} HTML string
 */
export function renderHeroSlotWithInputs(cardInstance, inputSlotsHtml = '', template = null) {
    return `
        <div class="card__slots-row">
            ${renderHeroSlot(cardInstance, template)}
            ${inputSlotsHtml}
        </div>
    `;
}
