// Fantasy Guild - Card Component (Base)
// Renders all card types: task, explore, area, recruit, combat

import { getCard, CARD_TYPES } from '../../config/registries/index.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { logger } from '../../utils/Logger.js';
import { renderSourceInfo } from '../components/CardMetadataComponent.js';
import { renderTaskBody } from '../renderers/TaskCardRenderer.js';
import { renderExploreBody } from '../renderers/ExploreCardRenderer.js';
import { renderAreaBody } from '../renderers/AreaCardRenderer.js';
import { renderRecruitBody } from '../renderers/RecruitCardRenderer.js';
import { renderCombatBody } from '../renderers/CombatCardRenderer.js';

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

    card.innerHTML = `
        <header class="card__header">
            <div class="card__title-row">
                <div class="card__title-group">
                    <span class="card__icon">${(cardData.cardType === CARD_TYPES.AREA && cardInstance.biomeId) ? (getBiome(cardInstance.biomeId)?.icon || cardData.icon || '📋') : (cardInstance.icon || cardData.icon || '📋')}</span>
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
    switch (template.cardType) {
        case CARD_TYPES.TASK:
            return renderTaskBody(cardInstance, template);
        case CARD_TYPES.RECIPE:
            return renderRecipeBody(cardInstance, template);
        case CARD_TYPES.EXPLORE:
            return renderExploreBody(cardInstance, template);
        case CARD_TYPES.AREA:
            return renderAreaBody(cardInstance, template);
        case CARD_TYPES.RECRUIT:
            return renderRecruitBody(cardInstance, template);
        case CARD_TYPES.COMBAT:
            return renderCombatBody(cardInstance, template);
        default:
            return renderDefaultBody(cardInstance, template);
    }
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
    const template = getCard(cardInstance.templateId);
    const cardData = template || cardInstance;

    // Update progress bar and text
    const durationSec = (cardData.baseTickTime || 10000) / 1000;
    const progressPercent = durationSec > 0
        ? Math.min(100, ((cardInstance.progress || 0) / durationSec) * 100)
        : 0;

    const progressBar = cardElement.querySelector('.card__progress-bar');
    const progressText = cardElement.querySelector('.card__progress-text');

    if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
    }
    if (progressText) {
        // Format progress text based on card type
        if (cardData.cardType === CARD_TYPES.EXPLORE) {
            // Explore cards show cycle time + explore points
            const explorePoints = cardInstance.explorePoints || 0;
            const pointsRequired = cardData.explorePointsRequired || 5;
            progressText.textContent = `${Math.floor(cardInstance.progress || 0)}s / ${durationSec}s | 🗺️ ${explorePoints}/${pointsRequired}`;
        } else if (cardData.cardType === CARD_TYPES.AREA) {
            // Area cards show cycle time + quest points
            const questPoints = cardInstance.questPoints || 0;
            const questPointsRequired = 5; // From AreaSystem.QUEST_POINTS_REQUIRED
            progressText.textContent = `${Math.floor(cardInstance.progress || 0)}s / ${durationSec}s | Quest: ${questPoints}/${questPointsRequired}`;
        } else {
            // Task cards show simple time
            progressText.textContent = `${Math.floor(cardInstance.progress || 0)}s / ${durationSec}s`;
        }
    }

    // Also update the quest progress bar if it exists (area cards have two progress bars)
    const questProgressBar = cardElement.querySelector('.card__progress-bar--quest');
    if (questProgressBar && cardData.cardType === CARD_TYPES.AREA) {
        const questPoints = cardInstance.questPoints || 0;
        const questProgressPercent = (questPoints / 5) * 100;
        questProgressBar.style.width = `${questProgressPercent}%`;
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
