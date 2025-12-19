// Fantasy Guild - Task Card Renderer
// Phase 15: Task System
// Extracted per architecture specification

import * as HeroManager from '../../systems/hero/HeroManager.js';
import { TIMING } from '../../config/uiConstants.js';
import { renderInputSlots } from '../components/InputSlotComponent.js';
import { renderHeroSlotWithInputs } from '../components/HeroSlotComponent.js';
import * as CardMetadata from '../components/CardMetadataComponent.js';
import { isCardExpanded } from '../components/CardExpansionManager.js';
import { renderTaskDetails } from '../components/TaskDetailComponent.js';

/**
 * Renders task-type card body
 * @param {Object} cardInstance - The card instance from GameState
 * @param {Object} template - The card template from cardRegistry
 * @returns {string} HTML string for task card body
 */
export function renderTaskBody(cardInstance, template) {
    const assignedHero = cardInstance.assignedHeroId
        ? HeroManager.getHero(cardInstance.assignedHeroId)
        : null;

    // Use cardInstance.baseTickTime (includes biome effects), fallback to template
    const cardTickTime = cardInstance.baseTickTime || template.baseTickTime || 10000;
    const baseTickTime = template.baseTickTime || 10000;

    // Calculate hero speed modifier (0.5% per skill level)
    let heroSpeedMultiplier = 1.0;
    if (assignedHero && template.skill) {
        const skillData = assignedHero.skills?.[template.skill];
        const skillLevel = typeof skillData === 'number'
            ? skillData
            : (skillData?.level ?? 0);
        heroSpeedMultiplier = 1 / (1 + skillLevel * 0.005); // Convert progress boost to time reduction
    }

    // Final effective time = card time * hero modifier
    const effectiveTickTime = cardTickTime * heroSpeedMultiplier;
    const durationSec = Math.round(effectiveTickTime / 100) / 10; // Round to 1 decimal
    const baseDurationSec = baseTickTime / 1000;
    const progressPercent = effectiveTickTime > 0
        ? Math.min(100, ((cardInstance.progress || 0) / effectiveTickTime) * 100)
        : 0;

    // Calculate speed difference for display (show if different from base)
    const showSpeedInfo = Math.abs(effectiveTickTime - baseTickTime) > TIMING.SPEED_DISPLAY_THRESHOLD_MS;
    const speedText = showSpeedInfo
        ? `<span class="card__speed-info">Base: ${baseDurationSec}s → ${durationSec}s</span>`
        : '';

    const heroSlotContent = assignedHero
        ? `<span class="card__hero-icon">${assignedHero.icon || '👤'}</span>`
        : `<span class="card__hero-empty-icon">👤</span>`;

    const heroSlotClass = assignedHero ? 'card__hero-slot--filled' : 'card__hero-slot--empty';

    // Render UI components using shared components
    const inputsHtml = renderInputSlots(template.inputs, cardInstance);

    // Store effective tick time for detail component (baseTickTime already exists on card)
    cardInstance.effectiveTickTime = effectiveTickTime;

    // Check if card is expanded
    const isExpanded = isCardExpanded(cardInstance.id);

    return `
        ${CardMetadata.renderDescription(template)}
        
        ${renderHeroSlotWithInputs(cardInstance, inputsHtml, template)}
        
        ${CardMetadata.renderTaskInfo(template, cardInstance, { showCategory: true, showRarity: false })}
        
        <div class="card__progress">
            <div class="card__progress-bar" style="--duration: ${durationSec}s"></div>
        </div>
        
        <!-- Expanded Section -->
        <div class="card__expanded" data-expanded-section="${cardInstance.id}" style="display: ${isExpanded ? 'block' : 'none'};">
            ${renderTaskDetails(cardInstance, template, assignedHero)}
        </div>
        
        <!-- Expand/Collapse Button -->
        <div class="card__expand-bar${isExpanded ? ' card__expand-bar--expanded' : ''}" data-expand-card="${cardInstance.id}" title="Click to ${isExpanded ? 'collapse' : 'expand'}">
            <span class="card__expand-icon">${isExpanded ? '▲' : '▼'}</span>
        </div>
    `;
}

// All rendering functions moved to shared components:
// - InputSlotComponent: renderInputSlots, renderFixedSlot, renderOpenSlot, getTagIcon
// - CardMetadataComponent: renderRarityBadge, renderRewards, renderSkillBadge, renderSourceInfo

export default {
    renderTaskBody
};
