// Fantasy Guild - Card Component (Base)
// Renders all card types: task, explore, area, recruit, combat

import { getCard, CARD_TYPES } from '../../config/registries/index.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import { renderIcon } from '../../utils/AssetManager.js';
import { renderSourceInfo } from '../components/CardMetadataComponent.js';
import { renderExploreBody } from '../renderers/ExploreCardRenderer.js';
import { renderAreaBody } from '../renderers/AreaCardRenderer.js';
import { renderRecruitBody } from '../renderers/RecruitCardRenderer.js';
import { getInvasion } from '../../config/registries/invasionRegistry.js';
import { assembleCardModules, isModular, ensureModular } from '../../systems/cards/CardAssembler.js';
import { renderTraitModule } from '../renderers/ModuleRenderers.js';
import { getActionStatusLabel, formatSpeedVisual } from '../../systems/cards/ModuleHelpers.js';
import * as CardManager from '../../systems/cards/CardManager.js';

/**
 * Type-specific default icons
 * Each entry has: id (sprite filename without extension) and icon (emoji fallback)
 */
const TYPE_DEFAULT_ICONS = {
    [CARD_TYPES.EXPLORE]: { id: 'icon_explore', icon: '🧭' },
    [CARD_TYPES.AREA]: { id: 'icon_area', icon: '🗺️' },
    [CARD_TYPES.COMBAT]: { id: 'icon_combat', icon: '⚔️' },
    [CARD_TYPES.CRAFTING]: { id: 'icon_crafting', icon: '🛠️' },
    [CARD_TYPES.INVASION]: { id: 'icon_invasion', icon: '⚠️' },
    [CARD_TYPES.TREASURE]: { id: 'icon_treasure', icon: '💎' },
    [CARD_TYPES.RECRUIT]: { id: 'icon_recruit', icon: '👤' },
};

/**
 * Check if a string is an emoji (not a sprite ID)
 */
function isEmoji(str) {
    if (!str || typeof str !== 'string') return false;
    // Emoji regex: matches common emoji patterns
    const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
    return emojiRegex.test(str);
}

/**
 * Resolve the icon entity for a card
 * Priority: explicit emoji → output item (tasks) → type default → fallback
 */
function resolveCardIcon(cardData, cardInstance) {
    // 1. Explicit emoji override (if card.icon is an emoji, not a sprite ID)
    if (cardData.icon && isEmoji(cardData.icon)) {
        return { icon: cardData.icon };
    }

    // 2. Task cards: use first output item's icon
    if (cardData.cardType === CARD_TYPES.TASK) {
        const outputs = cardData.outputs || cardData.config?.outputs ||
            cardInstance.outputs || cardInstance.config?.outputs;
        if (outputs && outputs.length > 0) {
            const firstOutput = outputs[0];
            const itemId = firstOutput.itemId || firstOutput.id;
            if (itemId) {
                const item = getItem(itemId);
                if (item) return item;
            }
        }
    }

    // 3. Type default icon
    if (TYPE_DEFAULT_ICONS[cardData.cardType]) {
        return TYPE_DEFAULT_ICONS[cardData.cardType];
    }

    // 4. Final fallback
    return { icon: '📜' };
}

/**
 * Base Card Component - Creates the wrapper structure for all card types
 * Specific card type renderers (TaskCardRenderer, etc.) handle the body content
 */

/**
 * Renders a complete card element
 * @param {Object} cardInstance - The card instance from GameState
 * @returns {HTMLElement} The card DOM element
 */
export function renderCard(cardInstance) {
    if (!cardInstance) return null;

    // Try to get template, but fallback to cardInstance for dynamic cards
    const template = getCard(cardInstance.templateId);

    // Use template if found, otherwise use cardInstance directly (for dynamic cards like area)
    const cardData = template || cardInstance;

    if (!template) {
        logger.debug('CardComponent', `Using dynamic card data for: ${cardInstance.templateId}`);
    }

    const card = document.createElement('article');

    // Build class list - add resource-warning for paused cards with assigned hero
    let classes = `card card--${cardData.cardType} card--${cardInstance.status}`;
    if (cardInstance.status === 'paused' && cardInstance.assignedHeroId) {
        classes += ' card--resource-warning';
    }

    card.className = classes;
    card.dataset.cardId = cardInstance.id;
    card.dataset.templateId = cardInstance.templateId;
    card.dataset.dropZone = 'card';

    // Get source info using shared component
    const sourceInfo = renderSourceInfo(cardInstance);

    // Get biome name for subtitle (or empty subtitle for consistent spacing)
    let subtitleHtml = '<span class="card__subtitle">&nbsp;</span>';
    if (cardInstance.biomeId) {
        const biome = getBiome(cardInstance.biomeId);
        if (biome) {
            subtitleHtml = `<span class="card__subtitle">Discovered in ${biome.name}</span>`;
        }
    }

    // Resolve icon using new priority system
    const iconEntity = resolveCardIcon(cardData, cardInstance);
    const iconHtml = renderIcon(iconEntity, 'card__icon-container', { size: 32 });

    // Background Image Logic
    let backgroundHtml = '';
    let bgImage = null;
    let bgOpacity = 0.15; // Default

    // Priority chain for background resolution:
    // 1. Card's explicit background field
    // 2. Biome's backgroundImage field
    // 3. Derive from biome ID (convention: bg_{biomeId}.png)
    // For explore cards: use selectedBiomeId (dynamic) over static template value
    const relatedBiome = cardInstance.biomeId || cardInstance.selectedBiomeId || cardData.selectedBiomeId;
    const biome = relatedBiome ? getBiome(relatedBiome) : null;

    bgImage = cardData.background ||
        cardInstance.background ||
        biome?.backgroundImage ||
        (relatedBiome ? `bg_${relatedBiome}.png` : null);

    // Normalize: ensure .png extension
    if (bgImage && !bgImage.endsWith('.png')) {
        bgImage = `${bgImage}.png`;
    }

    if (bgImage) {
        // Opacity logic by card type
        if (cardData.cardType === CARD_TYPES.AREA) {
            bgOpacity = 1.0;
        } else if (cardData.cardType === CARD_TYPES.EXPLORE) {
            bgOpacity = 0.3;
        }

        const bgStyle = `background-image: url('/assets/sprites/implemented/biomes/${bgImage}'); opacity: ${bgOpacity};`;
        backgroundHtml = `<div class="card__background" style="${bgStyle}"></div>`;
        classes += ' card--has-background';
    }

    card.className = classes;
    card.innerHTML = `
        ${backgroundHtml}
        <header class="card__header">
            <div class="card__title-row">
                <div class="card__title-group">
                    ${iconHtml}
                    <span class="card__name">${(cardData.cardType === CARD_TYPES.AREA && cardInstance.biomeId) ? (getBiome(cardInstance.biomeId)?.name || cardData.name) : (cardInstance.name || cardData.name)}</span>
                </div>
                ${sourceInfo ? `<span class="card__source">${sourceInfo}</span>` : ''}
            </div>
            ${subtitleHtml}
        </header>
        <div class="card__body">
            ${renderCardBody(cardInstance, cardData)}
        </div>
    `;

    // Add event listeners for hero removal
    const removeBtn = card.querySelector('.card__hero-remove');
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            logger.debug('CardComponent', 'Remove button clicked for card:', cardInstance.id);
            CardManager.unassignHero(cardInstance.id);
        });
    }

    return card;
}



/**
 * Renders the card body based on card type
 * @param {Object} cardInstance - The card instance
 * @param {Object} template - The card template
 * @returns {string} HTML string for card body
 */
function renderCardBody(cardInstance, template) {
    // Try to auto-generate traits for card types that support it
    ensureModular(cardInstance, template);

    // If card now has traits, use modular renderer
    if (isModular(cardInstance)) {
        return renderModularBody(cardInstance);
    }

    // Legacy renderers for non-modular card types
    switch (template.cardType) {
        case CARD_TYPES.AREA:
            return renderAreaBody(cardInstance, template);
        case CARD_TYPES.EXPLORE:
            return renderExploreBody(cardInstance, template);
        case CARD_TYPES.RECRUIT:
            return renderRecruitBody(cardInstance, template);
        default:
            return renderDefaultBody(cardInstance, template);
    }
}

/**
 * Standard modular body renderer
 * Groups consecutive heroslot/inputslot modules into horizontal rows
 */
function renderModularBody(card) {
    const traits = assembleCardModules(card, card.traits);

    // Group consecutive slot modules together
    const renderedGroups = [];
    let currentSlotGroup = [];

    traits.forEach((trait, index) => {
        const type = trait.type.toLowerCase();
        const isSlotType = type === 'heroslot' || type === 'inputslot';

        if (isSlotType) {
            currentSlotGroup.push(trait);
        } else {
            // Flush any pending slot group before this non-slot trait
            if (currentSlotGroup.length > 0) {
                const slotRowHtml = `
                    <div class="slot-module-row">
                        ${currentSlotGroup.map(t => renderTraitModule(t, card)).join('')}
                    </div>
                `;
                renderedGroups.push(slotRowHtml);
                currentSlotGroup = [];
            }
            renderedGroups.push(renderTraitModule(trait, card));
        }
    });

    // Flush any remaining slot group at the end
    if (currentSlotGroup.length > 0) {
        const slotRowHtml = `
            <div class="slot-module-row">
                ${currentSlotGroup.map(t => renderTraitModule(t, card)).join('')}
            </div>
        `;
        renderedGroups.push(slotRowHtml);
    }

    return `
        <div class="card__modular-body module-flex-col module-gap-2">
            ${renderedGroups.join('')}
        </div>
    `;
}

// Note: renderTaskBody is now imported from ../renderers/TaskCardRenderer.js

/**
 * Renders recipe-type card body (placeholder for future)
 */
function renderRecipeBody(cardInstance, template) {
    return `
        <p class="card__description">${template.description || 'Craft an item'}</p>
        <div class="card__hero-slot card__hero-slot--empty">
            <span>Recipe system coming soon</span>
        </div>
    `;
}

// Note: renderExploreBody is now imported from ../renderers/ExploreCardRenderer.js

// Note: renderRecruitBody is now imported from ../renderers/RecruitCardRenderer.js

/**
 * Renders default card body for unknown types
 */
function renderDefaultBody(cardInstance, template) {
    return `
        <p class="card__description">${template.description || 'Unknown card type'}</p>
    `;
}

// Note: renderOutputs is now in TaskCardRenderer.js

/**
 * Updates a card element in place (for progress updates)
 * @param {string} cardId - The card instance ID
 */
export function updateCardDisplay(cardId) {
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
    if (!cardElement) return;

    const cardInstance = CardManager.getCard(cardId);
    if (!cardInstance) return;

    // Use template if available, fallback to cardInstance for dynamic cards
    const template = cardInstance.cardType === CARD_TYPES.INVASION
        ? getInvasion(cardInstance.invasionId)
        : getCard(cardInstance.templateId);

    const cardData = template || cardInstance;

    // Update progress bar and text
    const durationMs = cardData.baseTickTime || 10000;
    const progressPercent = durationMs > 0
        ? Math.min(100, ((cardInstance.progress || 0) / durationMs) * 100)
        : 0;

    const progressBar = cardElement.querySelector('.card__progress-bar');
    const progressText = cardElement.querySelector('.card__progress-text');

    if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
    }
    if (progressText) {
        const currentSec = Math.floor((cardInstance.progress || 0) / 1000);
        const totalSec = Math.floor(durationMs / 1000);

        // Format progress text based on card type
        if (cardData.cardType === CARD_TYPES.EXPLORE) {
            // Explore cards show cycle time + explore points
            const explorePoints = cardInstance.explorePoints || 0;
            const pointsRequired = cardData.explorePointsRequired || 5;
            progressText.textContent = `${currentSec}s / ${totalSec}s | 🗺️ ${explorePoints}/${pointsRequired}`;
        } else if (cardData.cardType === CARD_TYPES.AREA) {
            // Area cards show cycle time + quest points
            const questPoints = cardInstance.questPoints || 0;
            const questPointsRequired = 5; // From AreaSystem.QUEST_POINTS_REQUIRED
            progressText.textContent = `${currentSec}s / ${totalSec}s | Quest: ${questPoints}/${questPointsRequired}`;
        } else {
            // Task cards show simple time
            progressText.textContent = `${currentSec}s / ${totalSec}s`;
        }
    }

    // Invasion-specific updates
    if (cardData.cardType === CARD_TYPES.INVASION) {
        const threatFill = cardElement.querySelector('.invasion-meter__fill');
        const threatLabel = cardElement.querySelector('.invasion-meter__label span:last-child');
        if (threatFill) {
            threatFill.style.width = `${cardInstance.threat || 0}%`;
        }
        if (threatLabel) {
            threatLabel.textContent = `${Math.floor(cardInstance.threat || 0)}%`;
        }

        const hordeFill = cardElement.querySelector('.invasion-horde__fill');
        const hordeLabel = cardElement.querySelector('.invasion-horde__label span:last-child');
        if (hordeFill) {
            const hordePercent = (cardInstance.hordeCount / cardInstance.hordeTotal) * 100;
            hordeFill.style.width = `${hordePercent}%`;
        }
        if (hordeLabel) {
            hordeLabel.textContent = `${cardInstance.hordeCount} / ${cardInstance.hordeTotal}`;
        }
    }

    // Also update the quest progress bar if it exists (area cards have two progress bars)
    const questProgressBar = cardElement.querySelector('.card__progress-bar--quest');
    if (questProgressBar && cardData.cardType === CARD_TYPES.AREA) {
        const questPoints = cardInstance.questPoints || 0;
        const questProgressPercent = (questPoints / 5) * 100;
        questProgressBar.style.width = `${questProgressPercent}%`;
    }

    // 4. Update modular progress bars (Trait-based)
    if (isModular(cardInstance)) {
        const progressBars = cardElement.querySelectorAll('.module-progress');
        progressBars.forEach(barContainer => {
            const moduleId = barContainer.dataset.moduleId;
            const trait = cardInstance.traits.find(t => t.id === moduleId);
            if (!trait) return;

            const bar = barContainer.querySelector('.module-progress__bar');
            const actionLabel = barContainer.querySelector('.module-progress__action-label');
            const speedInfo = barContainer.querySelector('.module-progress__speed-info');
            const counterText = barContainer.querySelector('.module-progress__counter');

            // Time-based updates
            if (trait.type === 'workcycle' || trait.type === 'combat') {
                const durationMs = cardInstance.baseTickTime || 10000;
                const percent = Math.min(100, ((cardInstance.progress || 0) / durationMs) * 100);

                if (bar) {
                    // Detect "Loop Completion" (progress reset to near 0 while bar was full)
                    const currentVisualWidth = parseFloat(bar.style.width) || 0;
                    if (currentVisualWidth > 90 && percent < 10) {
                        bar.classList.add('module-progress__bar--snap');
                        bar.style.width = '0%';
                        // Force reflow to ensure the snap happens before removing the class
                        void bar.offsetWidth;
                        bar.classList.remove('module-progress__bar--snap');
                    }

                    // On pause: snap to current position (prevents moving forward after stall)
                    if (cardInstance.status === 'paused') {
                        bar.classList.add('module-progress__bar--snap');
                    } else {
                        bar.classList.remove('module-progress__bar--snap');
                    }

                    bar.style.width = `${percent}%`;
                }

                // Update labels
                if (actionLabel) {
                    actionLabel.textContent = getActionStatusLabel({
                        status: cardInstance.status,
                        assignedHeroId: cardInstance.assignedHeroId,
                        missingItems: cardInstance.missingItems || [],
                        missingRequirements: cardInstance.missingRequirements || [],
                        defaultAction: trait.actionLabel || 'Working...'
                    });
                }
                if (speedInfo) {
                    speedInfo.textContent = formatSpeedVisual(durationMs / 1000, cardInstance.currentTickTime / 1000);
                }

                // Stall visual state (flashing red)
                if (bar) {
                    if (cardInstance.status === 'paused') {
                        bar.classList.add('module-progress__bar--stalled');
                    } else {
                        bar.classList.remove('module-progress__bar--stalled');
                    }
                }
            }
        });
    }

    // Update status class - add resource-warning for paused cards with assigned hero
    let classes = `card card--${cardData.cardType} card--${cardInstance.status}`;
    if (cardInstance.status === 'paused' && cardInstance.assignedHeroId) {
        classes += ' card--resource-warning';
    }
    cardElement.className = classes;
}

export default {
    renderCard,
    updateCardDisplay
};
