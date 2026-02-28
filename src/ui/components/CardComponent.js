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
import * as HeroManager from '../../systems/hero/HeroManager.js';

/**
 * ResizeObserver to dynamically scale card backgrounds by integer multiples
 * ensuring the background covers the entire card with crisp pixels.
 */
const bgObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
        const card = entry.target;
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;

        // Find if this card has a background
        const bgEl = card.querySelector('.card__background');
        if (bgEl) {
            // Need to cover the max dimension (width or height)
            const maxDim = Math.max(width, height);

            // Calculate integer multiplier (1x, 2x, 3x...) of 256px native size
            const multiplier = Math.max(1, Math.ceil(maxDim / 256));
            const bgSize = multiplier * 256;

            bgEl.style.backgroundSize = `${bgSize}px ${bgSize}px`;
        }
    }
});

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

    // Theme colors for card types (Accents)
    const typeColorMap = {
        [CARD_TYPES.TASK]: 'border-task',
        [CARD_TYPES.CRAFTING]: 'border-recipe',
        [CARD_TYPES.EXPLORE]: 'border-explore',
        [CARD_TYPES.COMBAT]: 'border-combat',
        [CARD_TYPES.RECRUIT]: 'border-recruit',
        [CARD_TYPES.AREA]: 'border-area',
        [CARD_TYPES.INVASION]: 'border-error',
    };

    const typeColor = typeColorMap[cardData.cardType] || 'border-white/10';

    // Build class list: Enforce standard "Card shape" (w-80 / 320px)
    let classes = `card relative flex flex-col gap-3 p-4 rounded-lg border border-white/5 glass-card transition-all duration-300 overflow-hidden shadow-2xl w-80 min-w-80 max-w-full min-h-[200px] flex-shrink-0`;

    // Add resource warning (pulse effect)
    if (cardInstance.status === 'paused' && cardInstance.assignedHeroId) {
        classes += ' animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)] border-red-500/50';
    }

    if (cardInstance.showInfo) {
        classes += ' show-info';
    }

    card.className = classes;

    // Theme colors for card types (Accents) - Higher saturation for rim-lights
    const typeAccentMap = {
        [CARD_TYPES.TASK]: 'bg-task shadow-[0_0_15px_-3px_rgba(96,144,192,0.6)]',
        [CARD_TYPES.CRAFTING]: 'bg-recipe shadow-[0_0_15px_-3px_rgba(80,160,96,0.6)]',
        [CARD_TYPES.EXPLORE]: 'bg-explore shadow-[0_0_15px_-3px_rgba(192,144,64,0.6)]',
        [CARD_TYPES.COMBAT]: 'bg-combat shadow-[0_0_15px_-3px_rgba(192,80,80,0.6)]',
        [CARD_TYPES.RECRUIT]: 'bg-recruit shadow-[0_0_15px_-3px_rgba(144,96,176,0.6)]',
        [CARD_TYPES.AREA]: 'bg-area shadow-[0_0_15px_-3px_rgba(80,144,144,0.6)]',
        [CARD_TYPES.INVASION]: 'bg-error shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse',
    };

    const typeAccent = typeAccentMap[cardData.cardType] || 'bg-white/20';

    const sourceInfo = renderSourceInfo(cardInstance);
    const iconEntity = resolveCardIcon(cardData, cardInstance);
    const iconHtml = renderIcon(iconEntity, 'flex-shrink-0', { size: 32 });

    card.dataset.cardId = cardInstance.id;
    card.dataset.templateId = cardInstance.templateId;
    card.dataset.dropZone = 'card-stack';

    // Phase 9: Dynamic Layout Margin
    if (cardInstance.stack && cardInstance.stack.length > 0) {
        const stackHeight = cardInstance.stack.length * 36;
        card.style.marginTop = `${stackHeight}px`;
    }

    // Background Image Logic
    let backgroundHtml = '';
    let bgImage = null;
    let bgOpacity = 1.0;

    const relatedBiome = cardInstance.biomeId || cardInstance.selectedBiomeId || cardData.selectedBiomeId;
    const biome = relatedBiome ? getBiome(relatedBiome) : null;

    bgImage = cardData.background ||
        cardInstance.background ||
        biome?.backgroundImage ||
        (relatedBiome ? `bg_${relatedBiome}.png` : null);

    if (bgImage && !bgImage.endsWith('.png')) {
        bgImage = `${bgImage}.png`;
    }

    if (bgImage) {
        if (cardData.cardType === CARD_TYPES.AREA) {
            bgOpacity = 1.0;
        } else if (cardData.cardType === CARD_TYPES.EXPLORE) {
            bgOpacity = 0.3;
        } else if (cardData.cardType === CARD_TYPES.INVASION) {
            bgOpacity = 0.5; // Slightly deeper backgrounds for invasion
        }

        const anchor = cardInstance.bgAnchor || cardData.bgAnchor || biome?.bgAnchor || 'center center';
        const bgStyle = `background-image: url('/assets/sprites/implemented/biomes/${bgImage}'); opacity: ${bgOpacity}; background-position: ${anchor};`;
        backgroundHtml = `<div class="card__background absolute inset-0 z-0 pointer-events-none transition-opacity duration-700" style="${bgStyle}"></div>`;
    }

    card.innerHTML = `
        ${renderCardStack(cardInstance)}
        ${backgroundHtml}
        
        <!-- Premium Rim-Light Accent -->
        <div class="absolute top-0 left-0 w-full h-0.5 z-20 ${typeAccent}"></div>
        
        <!-- Premium Glass Overlay -->
        <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none z-[1] border-t border-l border-white/10 rounded-lg"></div>
        
        <header class="relative z-10 flex flex-col gap-1 mb-1">
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 overflow-hidden">
                    <div class="card__icon-wrapper w-8 h-8 flex items-center justify-center rounded bg-black/40 border border-white/5 shadow-inner">
                        ${iconHtml}
                    </div>
                    <h3 class="font-pixel text-lg font-bold text-white tracking-wide truncate">
                        ${(cardData.cardType === CARD_TYPES.AREA && cardInstance.biomeId) ? (getBiome(cardInstance.biomeId)?.name || cardData.name) : (cardInstance.name || cardData.name)}
                    </h3>
                </div>
                ${sourceInfo ? `<span class="text-[10px] text-gray-500 font-mono opacity-60 whitespace-nowrap uppercase tracking-tighter">${sourceInfo}</span>` : ''}
            </div>
        </header>

        <div class="card__body relative z-10 flex flex-col gap-2">
            ${renderCardBody(cardInstance, cardData)}
        </div>

        <!-- Info Overlay (Glassmorphism) -->
        <div class="card__info-overlay absolute inset-0 bg-black/80 backdrop-blur-xl opacity-0 pointer-events-none z-20 transition-opacity duration-300"></div>
        
        <div class="absolute bottom-2 left-0 w-full flex justify-center z-30 pointer-events-none">
            <button class="card-btn-info bg-black/60 hover:bg-accent-primary border border-white/10 w-7 h-7 rounded-full flex items-center justify-center pointer-events-auto transition-all duration-200 transform hover:scale-110 shadow-glow" title="View Details">
                <span class="text-[10px]">📋</span>
            </button>
        </div>
    `;

    // ... (rest of the listeners)

    return card;
}

/**
 * Renders the visual stack of entities (heroes/items) assigned to this card
 */
function renderCardStack(card) {
    if (!card.stack || card.stack.length === 0) return '';

    const stackItemsHtml = card.stack.map((entity, index) => {
        let contentHtml = '';

        if (entity.type === 'hero') {
            const hero = HeroManager.getHero(entity.id);
            if (!hero) return '';

            const energy = hero.energy?.current || 0;
            const maxEnergy = hero.energy?.max || 10;
            const energyPercent = Math.min(100, Math.max(0, (energy / maxEnergy) * 100));

            contentHtml = `
                <div class="card-stack__hero w-full h-full flex flex-col justify-end px-2 pb-1"
                     draggable="true" 
                     data-draggable="hero" 
                     data-hero-id="${hero.id}">
                    <div class="flex items-center justify-between mb-0.5">
                        <span class="text-[10px] font-bold text-white truncate max-w-[60%]">${hero.name}</span>
                        <span class="text-[9px] font-mono text-accent-secondary font-bold">⚡${Math.floor(energy)}/${maxEnergy}</span>
                    </div>
                    <div class="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
                        <div class="h-full bg-accent-secondary shadow-[0_0_5px_rgba(251,191,36,0.5)] transition-all duration-300" style="width: ${energyPercent}%;"></div>
                    </div>
                </div>
            `;
        } else if (entity.type === 'item') {
            const item = getItem(entity.id);
            if (!item) return '';

            const icon = item.icon || '📦';
            contentHtml = `
                <div class="card-stack__item w-full h-full flex items-center justify-center">
                    <span class="text-xl shadow-inner">${icon}</span>
                </div>
            `;
        }

        const zIndex = -(index + 1);
        const yOffset = -36 * (index + 1);
        const scale = 1 - (index * 0.03);

        return `
            <div class="card-stack__entity absolute top-0 left-0 w-full h-9 bg-black/40 backdrop-blur-md border border-white/10 rounded-t-lg transition-transform duration-300 pointer-events-auto" 
                 style="z-index: ${zIndex}; transform: translateY(${yOffset}px) scale(${scale});">
                <div class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-t-lg"></div>
                ${contentHtml}
            </div>
        `;
    }).join('');

    return `
        <div class="card-stack-container absolute inset-0 pointer-events-none">
            ${stackItemsHtml}
        </div>
    `;
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

    // Theme colors for card types (Accents)
    const typeColorMap = {
        [CARD_TYPES.TASK]: 'border-task',
        [CARD_TYPES.CRAFTING]: 'border-recipe',
        [CARD_TYPES.EXPLORE]: 'border-explore',
        [CARD_TYPES.COMBAT]: 'border-combat',
        [CARD_TYPES.RECRUIT]: 'border-recruit',
        [CARD_TYPES.AREA]: 'border-area',
        [CARD_TYPES.INVASION]: 'border-error',
    };

    const typeColor = typeColorMap[cardData.cardType] || 'border-white/10';

    // Update status class: Keep standardized sizing
    let classes = `card relative flex flex-col gap-3 p-4 rounded-lg border-t-2 ${typeColor} glass-card transition-all duration-300 card--${cardInstance.status} w-80 min-w-80 max-w-full min-h-[200px] flex-shrink-0`;

    if (cardInstance.status === 'paused' && cardInstance.assignedHeroId) {
        classes += ' animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)] border-red-500';
    }
    if (cardInstance.showInfo) {
        classes += ' show-info';
    }
    cardElement.className = classes;
}

export default {
    renderCard,
    updateCardDisplay
};
