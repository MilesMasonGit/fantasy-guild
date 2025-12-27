// Fantasy Guild - Explore Card Renderer (Reworked)
// Phase 24b: Region-based exploration with gradual resource consumption
// Refactored to use shared UI components

import { renderHeroSlotWithInputs, renderHeroSlot } from '../components/HeroSlotComponent.js';
import { renderInputSlots } from '../components/InputSlotComponent.js';
import { renderGradualProgress } from '../components/GradualProgressComponent.js';
import { renderWorkCycleBar } from '../components/WorkCycleBarComponent.js';
import * as CardMetadata from '../components/CardMetadataComponent.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getRegion, getUnexploredBiomes } from '../../config/registries/regionRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import ExploreSystem from '../../systems/cards/ExploreSystem.js';
import { WORK_CYCLE_DURATION } from '../../config/constants.js';

/**
 * Renders explore-type card body (Reworked)
 * @param {Object} cardInstance - The card instance from GameState
 * @param {Object} template - The card template (may be null for dynamic cards)
 * @returns {string} HTML string for explore card body
 */
export function renderExploreBody(cardInstance, template) {
    try {
        const assignedHero = cardInstance.assignedHeroId
            ? HeroManager.getHero(cardInstance.assignedHeroId)
            : null;

        // Check if awaiting discovery (exploration complete, waiting for button click)
        if (cardInstance.awaitingDiscovery) {
            return renderDiscoveryState(cardInstance);
        }

        // Check if region is fully explored
        if (cardInstance.status === 'complete') {
            return renderCompleteState(cardInstance);
        }

        // Normal exploration view
        return renderExplorationProgress(cardInstance, template, assignedHero);
    } catch (err) {
        console.error('CRITICAL: renderExploreBody crash', err);
        return `<div class="card__error">RENDER ERROR: ${err.message}</div>`;
    }
}

/**
 * Render the discovery state with "Discover [Biome]" button
 */
function renderDiscoveryState(cardInstance) {
    const discovery = cardInstance.pendingDiscovery || {};
    const biomeName = discovery.biomeName || 'Unknown';

    // Get remaining biomes count
    const exploredBiomes = cardInstance.exploredBiomes || [];
    const unexplored = getUnexploredBiomes(cardInstance.regionId, exploredBiomes);
    const remainingCount = unexplored.length; // This is BEFORE the current one is marked as explored

    return `
        <div class="card__explore-body explore__discovery-state">
            <div class="explore__discovery-header">
                ✨ Exploration Complete!
            </div>
            
            <div class="explore__discovery-biome">
                <div class="explore__discovery-info">
                    <span class="explore__discovery-label">Ready to Discover:</span>
                    <span class="explore__discovery-name">${biomeName}</span>
                </div>
            </div>
            
            <button class="explore__discovery-btn" 
                    data-action="discover-biome" 
                    data-card-id="${cardInstance.id}">
                🗺️ Discover ${biomeName}
            </button>
            
            <div class="explore__discovery-progress">
                ${remainingCount > 0
            ? `${remainingCount} more biome(s) to explore after this`
            : 'This is the final biome in the region!'}
            </div>
        </div>
    `;
}

/**
 * Render the exploration progress view with biome selector
 */
function renderExplorationProgress(cardInstance, template, assignedHero) {
    const regionId = cardInstance.regionId;
    const region = getRegion(regionId);

    // Get unexplored biomes for dropdown
    const exploredBiomes = cardInstance.exploredBiomes || [];
    const unexploredBiomes = getUnexploredBiomes(regionId, exploredBiomes);

    // Render biome dropdown
    const biomeDropdownHtml = renderBiomeDropdown(cardInstance, unexploredBiomes);

    // Get current biome progress
    const selectedBiomeId = cardInstance.selectedBiomeId;
    const progressData = ExploreSystem.getExplorationProgress(cardInstance);

    // Render progress section - always show if biome is selected
    let progressHtml;
    if (!selectedBiomeId) {
        progressHtml = '<p class="card__hint">Select a biome to begin exploration</p>';
    } else if (progressData) {
        progressHtml = renderGradualProgress({
            progressData,
            cardInstance,
            showTitle: true
        });
    } else {
        // Biome selected but no progress yet - show initial requirements at 0
        const selectedBiome = getBiome(selectedBiomeId);
        const initialRequirements = ExploreSystem.getExplorationRequirements(cardInstance, selectedBiome);

        progressHtml = renderGradualProgress({
            progressData: {
                requirements: initialRequirements,
                inputProgress: {},
                percentComplete: 0
            },
            cardInstance,
            showTitle: true
        });
    }


    // Status indicator
    const statusClass = cardInstance.status === 'paused' ? 'card--paused' : '';

    // Work cycle timing (must match ExploreSystem.getCycleDuration)
    const cycleDurationMs = progressData
        ? ExploreSystem.getCycleDuration(cardInstance, progressData.requirements)
        : WORK_CYCLE_DURATION;
    const cycleProgress = cardInstance.cycleProgress || 0;
    const cyclePercent = Math.min(100, (cycleProgress / cycleDurationMs) * 100);

    return `
        <div class="card__explore-body ${statusClass}">
            ${CardMetadata.renderDescription(cardInstance.description ? cardInstance : (template || cardInstance), 'Explore the region to discover new areas.')}
            
            <div class="card__slots-row card__slots-row--spaced">
                ${renderHeroSlot(cardInstance)}
                ${renderExplorationInputs(cardInstance, selectedBiomeId)}
            </div>
            
            ${renderWorkCycleBar({
        cardId: cardInstance.id,
        durationSec: cycleDurationMs / 1000,
        progressPercent: cyclePercent,
        isWorking: !cardInstance.status || cardInstance.status === 'active',
        isPaused: cardInstance.status === 'paused'
    })}
            
            <div class="card__biome-selector">
                <label class="card__biome-label">Exploring:</label>
                ${biomeDropdownHtml}
            </div>
            
            ${progressHtml}
            
            ${CardMetadata.renderHint(!assignedHero, 'Assign a hero to begin exploring')}
            ${CardMetadata.renderHint(cardInstance.status === 'paused', '⚠️ No resources available!')}
        </div>
    `;
}

/**
 * Render item slots for exploration requirements
 */
function renderExplorationInputs(cardInstance, selectedBiomeId) {
    if (!selectedBiomeId) {
        return '';
    }

    const biome = getBiome(selectedBiomeId);
    if (!biome) return '';

    const requirements = ExploreSystem.getExplorationRequirements(cardInstance, biome);
    if (!requirements || Object.keys(requirements).length === 0) {
        return '';
    }

    // Convert requirements object to inputs array for InputSlotComponent
    // We set quantity to 1 for the slot validation so it appears "green/available" 
    // as long as the player has at least 1 item to make progress.
    // The total required amount is shown in the progress bar section.
    const inputs = Object.entries(requirements).map(([key, required]) => {
        if (key.startsWith('tag:')) {
            const tag = key.substring(4);
            return {
                acceptTag: tag,
                quantity: 1, // Validation quantity (need at least 1 to work)
                slotLabel: `Any ${tag.charAt(0).toUpperCase() + tag.slice(1)}`
            };
        } else {
            return {
                itemId: key,
                quantity: 1 // Validation quantity
            };
        }
    });

    return renderInputSlots(inputs, cardInstance);
}

/**
 * Render biome dropdown selector
 */
function renderBiomeDropdown(cardInstance, unexploredBiomes) {
    if (unexploredBiomes.length === 0) {
        return '<span class="card__biome-complete">All biomes explored!</span>';
    }

    const options = unexploredBiomes.map(biomeId => {
        const biome = getBiome(biomeId);
        const selected = biomeId === cardInstance.selectedBiomeId ? 'selected' : '';
        return `<option value="${biomeId}" ${selected}>${biome?.icon || '🌍'} ${biome?.name || biomeId}</option>`;
    }).join('');

    return `
        <select class="card__biome-dropdown" 
                data-action="select-biome" 
                data-card-id="${cardInstance.id}">
            ${options}
        </select>
    `;
}



/**
 * Render complete state (all biomes explored)
 */
function renderCompleteState(cardInstance) {
    const region = getRegion(cardInstance.regionId);
    const exploredCount = cardInstance.exploredBiomes?.length || 0;

    return `
        <div class="card__explore-complete">
            <p class="card__description card__description--complete">
                ✨ Region Fully Explored!
            </p>
            <p class="card__explore-stats">
                ${region?.icon || '🗺️'} ${region?.name || 'Unknown Region'}<br>
                Discovered ${exploredCount} area${exploredCount !== 1 ? 's' : ''}
            </p>
        </div>
    `;
}

export default { renderExploreBody };
