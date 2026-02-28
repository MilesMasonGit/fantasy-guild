// Fantasy Guild - Combat Module Component
// Shared rendering logic for Hero and Enemy combat sections

import { getSkill } from '../../config/registries/skillRegistry.js';
import { renderHeroSlot } from './HeroSlotComponent.js';
import { renderHpBar, renderEnergyBar } from './ProgressBarComponent.js';

/**
 * Renders the Hero combat module
 * @param {Object} cardInstance - The card instance
 * @param {Object} hero - The hero object (can be null)
 * @param {number} attackSpeed - Hero's attack speed in ms
 * @param {number} progressPercent - Attack progress percentage (0-100)
 * @param {Object} enemy - The enemy object (for energy cost calculation)
 * @param {string} combatSkill - Optional skill ID (default: 'melee')
 * @returns {string} HTML string
 */
export function renderHeroModule(cardInstance, hero, attackSpeed, progressPercent, enemy, combatSkill = null) {
    // Determine active skill (passed arg > selected style > default)
    const activeSkill = combatSkill || cardInstance.selectedStyle || 'melee';

    // Get skill info
    const skillInfo = getSkill(activeSkill) || { icon: '⚔️' };

    // Hero stats
    const skillLevel = hero?.skills?.[activeSkill]?.level ?? 1;
    const defenceLevel = hero?.skills?.defence?.level ?? 1;
    const attackSpeedSec = (attackSpeed / 1000).toFixed(1);

    // HP and Energy
    const heroHp = hero?.hp || { current: 0, max: 0 };
    const heroEnergy = hero?.energy || { current: 0, max: 0 };

    return `
        <div class="combat-module combat-module--hero">
            <div class="combat-module__header">${hero ? hero.name : 'Hero'}</div>
            <div class="combat-module__main">
                <!-- Hero Slot -->
                <div class="combat-module__slot">
                    ${renderHeroSlot(cardInstance)}
                </div>
                
                <!-- Stats Column -->
                <div class="combat-module__stats">
                    <!-- Line 1: HP Bar -->
                    ${renderHpBar(heroHp.current, heroHp.max, 'sm')}
                    
                    <!-- Line 2: Energy Bar -->
                    ${renderEnergyBar(heroEnergy.current, heroEnergy.max, 'sm')}
                </div>
            </div>
            
            <!-- Skill Badges (Moved above Attack Bar) -->
            <div class="combat-module__badges">
                <span class="combat-badge" title="${activeSkill} skill">${skillInfo.icon || '⚔️'} ${skillLevel}</span>
                <span class="combat-badge" title="Defence skill">🛡️ ${defenceLevel}</span>
                <span class="combat-badge" title="Attack speed">⏱️ ${attackSpeedSec}s</span>
                <span class="combat-badge" title="Energy Cost">⚡ ${enemy?.energyCost ?? 2}</span>
            </div>

            <!-- Attack Progress Bar (full width) -->
            <div class="combat-module__attack-bar flex flex-col gap-1 mt-3">
                <span class="combat-module__attack-label text-[10px] text-gray-400 font-pixel uppercase tracking-wide">Attack:</span>
                <div class="progress-track w-full h-2">
                    <div class="progress-fill bg-accent-primary shadow-progress-glow" style="width: ${progressPercent}%"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders the Enemy combat module
 * @param {Object} cardInstance - The card instance containing enemyHp
 * @param {Object} enemy - The enemy template object
 * @param {number} progressPercent - Attack progress percentage (0-100)
 * @returns {string} HTML string
 */
export function renderEnemyModule(cardInstance, enemy, progressPercent) {
    // Enemy stats
    const attackSpeedSec = (enemy.attackSpeed / 1000).toFixed(1);
    const enemyType = enemy.combatType || 'melee';
    const icons = { melee: '⚔️', ranged: '🏹', magic: '✨' };
    const enemyIcon = icons[enemyType] || '⚔️';

    // Enemy HP
    const enemyHp = cardInstance.enemyHp || { current: enemy.hp, max: enemy.hp };
    const hpPercent = (enemyHp.current / enemyHp.max) * 100;

    return `
        <div class="combat-module combat-module--enemy">
            <div class="combat-module__header">${enemy.name || 'Enemy'}</div>
            <div class="combat-module__main">
                <!-- Enemy Slot (red solid border) -->
                <div class="combat-module__slot">
                    <div class="combat-module__enemy-icon">
                        <span>${enemy.icon || '👹'}</span>
                    </div>
                </div>
                
                <!-- Stats Column -->
                <div class="combat-module__stats">
                    <!-- Line 1: HP Bar -->
                        ${renderHpBar(enemyHp.current, enemyHp.max, 'sm')}
                    
                    <!-- Line 2: Empty (for symmetry with hero energy) -->
                    <div class="combat-module__empty-line"></div>
                </div>
            </div>

            <!-- Stat Badges (Moved above Attack Bar) -->
            <div class="combat-module__badges">
                <span class="combat-badge combat-badge--enemy" title="Attack skill (${enemyType})">${enemyIcon} ${enemy.attackSkill}</span>
                <span class="combat-badge combat-badge--enemy" title="Defence skill">🛡️ ${enemy.defenceSkill}</span>
                <span class="combat-badge combat-badge--enemy" title="Attack speed">⏱️ ${attackSpeedSec}s</span>
                <span class="combat-badge combat-badge--enemy" title="XP Awarded">⭐ ${enemy.xpAwarded ?? 5} XP</span>
            </div>
            
            <!-- Attack Progress Bar (full width) -->
            <div class="combat-module__attack-bar flex flex-col gap-1 mt-3">
                <span class="combat-module__attack-label text-[10px] text-gray-400 font-pixel uppercase tracking-wide">Attack:</span>
                <div class="progress-track w-full h-2 overflow-hidden">
                    <div class="progress-fill bg-error shadow-[0_0_12px_rgba(252,129,129,0.4)]" style="width: ${progressPercent}%"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders the Combat Style selection module
 * @param {Object} cardInstance 
 * @param {Object} hero 
 * @param {Object} enemy 
 * @returns {string} HTML string
 */
export function renderCombatStyleModule(cardInstance, hero, enemy) {
    const selectedStyle = cardInstance.selectedStyle || 'melee';
    const enemyType = enemy.combatType || 'melee';

    // Icons
    const icons = { melee: '⚔️', ranged: '🏹', magic: '✨' };

    // Helper to check selection
    const isSelected = (style) => style === selectedStyle ? 'selected' : '';

    return `
        <div class="combat-module combat-module--style" style="margin-top: var(--space-2); border-left: 3px solid var(--color-accent-primary);">
            <div class="combat-module__header">Combat Style</div>
            <div class="combat-module__main" style="align-items: center; justify-content: space-between;">
                <!-- Style Dropdown -->
                <select class="combat-style-select" 
                        onchange="window.dispatchEvent(new CustomEvent('combat-style-change', { detail: { cardId: '${cardInstance.id}', style: this.value } }))"
                        style="padding: 4px; border-radius: 4px; background: var(--color-bg-primary); color: var(--color-text-primary); border: 1px solid var(--color-border-default); font-size: var(--font-size-xs);">
                    <option value="melee" ${isSelected('melee')}>⚔️ Melee</option>
                    <option value="ranged" ${isSelected('ranged')}>🏹 Ranged</option>
                    <option value="magic" ${isSelected('magic')}>✨ Magic</option>
                </select>

                <!-- VS Label -->
                <span style="font-size: 0.8rem; font-weight: bold; color: var(--color-text-muted);">VS</span>

                <!-- Enemy Badge -->
                <span class="combat-badge combat-badge--enemy" title="Enemy uses ${enemyType} style">
                    ${icons[enemyType] || '❓'} ${enemyType.charAt(0).toUpperCase() + enemyType.slice(1)}
                </span>
            </div>

            <!-- Interaction Text -->
            <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 4px; font-style: italic;">
                ${getStyleInteractionText(selectedStyle, enemyType)}
            </div>
        </div>
    `;
}

/**
 * Get the descriptive text for the style interaction
 */
function getStyleInteractionText(heroStyle, enemyStyle) {
    if (!heroStyle || !enemyStyle || heroStyle === enemyStyle) return 'Neutral match.';

    const rules = {
        melee: { weak: 'ranged', strong: 'magic' },
        ranged: { weak: 'magic', strong: 'melee' },
        magic: { weak: 'melee', strong: 'ranged' }
    };

    if (rules[heroStyle]?.strong === enemyStyle) {
        return `<span style="color: var(--color-success)">Deals more damage, takes less damage.</span>`;
    }

    if (rules[heroStyle]?.weak === enemyStyle) {
        return `<span style="color: var(--color-error)">Deals less damage, takes more damage.</span>`;
    }

    return 'Neutral match.';
}
