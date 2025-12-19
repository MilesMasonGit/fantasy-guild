// Fantasy Guild - Combat Card Renderer
// Phase 31: Combat System - Redesigned UI
// Follows same patterns as TaskCardRenderer for consistency

import { renderHeroModule, renderEnemyModule, renderCombatStyleModule } from '../components/CombatModuleComponent.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { LootSystem } from '../../systems/combat/LootSystem.js';
import * as CardMetadata from '../components/CardMetadataComponent.js';
import { isCardExpanded } from '../components/CardExpansionManager.js';

/**
 * Renders combat-type card body
 * @param {Object} cardInstance - The card instance from GameState
 * @param {Object} template - The card template from cardRegistry
 * @returns {string} HTML string for combat card body
 */
export function renderCombatBody(cardInstance, template) {
    const assignedHero = cardInstance.assignedHeroId
        ? HeroManager.getHero(cardInstance.assignedHeroId)
        : null;

    const enemy = getEnemy(cardInstance.enemyId);
    if (!enemy) {
        return `<p class="card__description">Unknown enemy</p>`;
    }

    // Hero attack progress bar
    const heroAttackSpeed = 3000; // Base attack speed in ms
    const heroProgress = cardInstance.heroTickProgress || 0;
    const heroProgressPercent = (heroProgress / heroAttackSpeed) * 100;

    // Enemy attack progress
    const enemyProgress = cardInstance.enemyTickProgress || 0;
    const enemyProgressPercent = (enemyProgress / enemy.attackSpeed) * 100;

    // Loot preview - use inline drops if available, otherwise fall back to dropTableId
    const possibleDrops = enemy.drops
        ? LootSystem.previewDropsFromArray(enemy.drops)
        : LootSystem.previewDrops(enemy.dropTableId);
    const lootPreviewHtml = renderLootPreview(possibleDrops);

    // Check if card is expanded
    const isExpanded = isCardExpanded(cardInstance.id);

    return `
        ${CardMetadata.renderDescription(template)}
        
        <!-- Hero Section (Top) -->
        ${renderHeroModule(cardInstance, assignedHero, heroAttackSpeed, heroProgressPercent, enemy, template.skill)}
        
        <!-- Enemy Section (Below) -->
        ${renderEnemyModule(cardInstance, enemy, enemyProgressPercent)}
        
        <!-- Combat Style Selection -->
        ${renderCombatStyleModule(cardInstance, assignedHero, enemy)}

        <!-- Loot Preview (collapsed by default) -->
        <div class="card__expanded" data-expanded-section="${cardInstance.id}" style="display: ${isExpanded ? 'block' : 'none'};">
            <div class="card__combat-loot">
                <div class="card__combat-loot-header">Possible Loot</div>
                ${lootPreviewHtml}
            </div>
        </div>
        
        <!-- Expand/Collapse Button -->
        <div class="card__expand-bar${isExpanded ? ' card__expand-bar--expanded' : ''}" data-expand-card="${cardInstance.id}" title="Click to ${isExpanded ? 'collapse' : 'expand'}">
            <span class="card__expand-icon">${isExpanded ? '▲' : '▼'}</span>
        </div>
    `;
}

/**
 * Renders the Hero combat module
 */


/**
 * Renders loot preview section
 */
function renderLootPreview(drops) {
    if (!drops || drops.length === 0) {
        return '<span class="card__combat-loot-empty">No drops</span>';
    }

    return drops.map(drop => {
        const qtyText = drop.minQty === drop.maxQty
            ? `${drop.minQty}`
            : `${drop.minQty}-${drop.maxQty}`;
        const chanceText = drop.chance < 100 ? `(${drop.chance}%)` : '';

        return `
            <div class="card__combat-loot-item">
                <span class="card__combat-loot-icon">${drop.itemIcon}</span>
                <span class="card__combat-loot-name">${drop.itemName}</span>
                <span class="card__combat-loot-qty">${qtyText} ${chanceText}</span>
            </div>
        `;
    }).join('');
}

export default {
    renderCombatBody
};
