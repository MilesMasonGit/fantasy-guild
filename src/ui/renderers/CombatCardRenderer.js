// Fantasy Guild - Combat Card Renderer
// Phase 31: Combat System - Redesigned UI
// Follows same patterns as TaskCardRenderer for consistency

import { renderHeroModule, renderEnemyModule, renderCombatStyleModule } from '../components/CombatModuleComponent.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { LootSystem } from '../../systems/combat/LootSystem.js';
import * as CardMetadata from '../components/CardMetadataComponent.js';
import { isCardExpanded } from '../components/CardExpansionManager.js';
import { renderRewardPreview } from '../components/RewardPreviewComponent.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import * as HeroManager from '../../systems/hero/HeroManager.js'; // Ensure we can access hero methods is not directly imported generally, but used in renderers via global instance usually. Check imports.
// Actually renderers usually get "cardInstance" which has IDs. 
// We need to access hero skills. Assuming HeroManager is available or GameState.
// Just accessing via global for renderers is common pattern here (see TaskCardRenderer).
import { GameState } from '../../state/GameState.js';

/**
 * Renders combat-type card body
 * @param {Object} cardInstance - The card instance from GameState
 * @param {Object} template - The card template from cardRegistry
 * @returns {string} HTML string for combat card body
 */
export function renderCombatBody(cardInstance, template) {
    const assignedHero = cardInstance.assignedHeroId
        ? GameState.heroes[cardInstance.assignedHeroId] // Direct access or via manager
        : null;

    const enemy = getEnemy(cardInstance.enemyId);
    if (!enemy) {
        return `<p class="card__description">Unknown enemy</p>`;
    }

    // Hero attack progress bar
    // Calculate REAL attack speed based on skills
    const selectedStyle = cardInstance.selectedStyle || 'melee';
    const heroSkillLevel = assignedHero?.skills?.[selectedStyle]?.level ?? 1;
    // We don't have easy access to equipment bonuses here without heavy coupling, 
    // but for UI preview 3000 / efficiency is "good enough" estimation.
    // The system calculates exacts.
    const heroAttackSpeed = CombatFormulas.getHeroAttackSpeed(heroSkillLevel, 0);

    const heroProgress = cardInstance.heroTickProgress || 0;
    const heroProgressPercent = (heroProgress / heroAttackSpeed) * 100;

    // Enemy attack progress
    const enemyProgress = cardInstance.enemyTickProgress || 0;
    const enemyProgressPercent = (enemyProgress / enemy.attackSpeed) * 100;

    // Loot preview - use inline drops if available, otherwise fall back to dropTableId
    const possibleDrops = enemy.drops
        ? LootSystem.previewDropsFromArray(enemy.drops)
        : LootSystem.previewDrops(enemy.dropTableId);

    // Transform drops for unified component
    const unifiedDrops = possibleDrops.map(d => ({
        name: d.itemName,
        icon: d.itemIcon,
        min: d.minQty,
        max: d.maxQty,
        chance: d.chance,
        isRare: d.chance < 10
    }));

    const lootPreviewHtml = renderRewardPreview(unifiedDrops, 'loot');

    // Check if card is expanded
    const isExpanded = isCardExpanded(cardInstance.id);

    return `
        ${CardMetadata.renderDescription(template)}
        
        <!-- Hero Section (Top) -->
        ${renderHeroModule(cardInstance, assignedHero, heroAttackSpeed, heroProgressPercent, enemy, template.skill)}
        
        <!-- Enemy Section (Below) -->
        ${renderEnemyModule(cardInstance, enemy, enemyProgressPercent)}
        
        <!-- Expanded Section -->
        <div class="card__expanded" data-expanded-section="${cardInstance.id}" style="display: ${isExpanded ? 'block' : 'none'};">
            <!-- Combat Style Selection -->
            ${renderCombatStyleModule(cardInstance, assignedHero, enemy)}

            <!-- Loot Preview -->
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

export default {
    renderCombatBody
};
