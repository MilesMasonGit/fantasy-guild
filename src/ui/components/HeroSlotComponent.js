// Fantasy Guild - Hero Slot Component
// Shared component for rendering hero assignment slots across all card types

import * as HeroManager from '../../systems/hero/HeroManager.js';

/**
 * Renders a hero assignment slot
 * @param {Object} cardInstance - Card instance with optional assignedHeroId
 * @returns {string} HTML string
 */
export function renderHeroSlot(cardInstance, template = null) {
    const assignedHero = cardInstance.assignedHeroId
        ? HeroManager.getHero(cardInstance.assignedHeroId)
        : null;

    const heroSlotContent = assignedHero
        ? `<span class="card__hero-icon">${assignedHero.icon || '👤'}</span>`
        : `<span class="card__hero-empty-icon">👤</span>`;

    const heroSlotClass = assignedHero ? 'card__hero-slot--filled' : 'card__hero-slot--empty';

    const tooltip = assignedHero
        ? `${assignedHero.name} - Drag to move, right-click to remove`
        : 'Drag hero here';

    const energyCost = template?.baseEnergyCost || 0;
    const energyBadge = template ? `<span class="card__hero-energy">⚡${energyCost}</span>` : '';

    // Make filled slots draggable so heroes can be moved to other cards
    const draggableAttrs = assignedHero
        ? `draggable="true" data-draggable="hero" data-hero-id="${assignedHero.id}"`
        : '';

    return `
        <div class="card__hero-slot-container">
            <div class="card__hero-slot ${heroSlotClass}" data-drop-zone="card" data-card-id="${cardInstance.id}" title="${tooltip}" ${draggableAttrs}>
                ${heroSlotContent}
            </div>
            ${energyBadge}
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
