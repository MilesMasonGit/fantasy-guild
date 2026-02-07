// Fantasy Guild - Hero Group Component
// Renders a Hero Group for Combat Module with integrated slot, stats, and progress bars

import * as HeroManager from '../../systems/hero/HeroManager.js';
import { renderHeroSlot } from './HeroSlotComponent.js';
import { renderHpBar, renderEnergyBar } from './ProgressBarComponent.js';

/**
 * Renders a Hero Group component for combat display
 * Uses the actual renderHeroSlot for the slot to maintain drag/drop functionality
 * @param {Object} options
 * @param {Object} options.card - Card instance
 * @param {number} options.slotIndex - Hero slot index
 * @param {string} options.selectedStyle - Combat style (melee/ranged/magic)
 * @returns {string} HTML string
 */
export function renderHeroGroup(options) {
    const { card, slotIndex = 0, selectedStyle = 'melee' } = options;

    // Get hero from slot
    const heroId = card.heroSlots?.[slotIndex] || (slotIndex === 0 ? card.assignedHeroId : null);
    const hero = heroId ? HeroManager.getHero(heroId) : null;

    // Use the actual hero slot component for the slot
    const heroSlotHtml = renderHeroSlot(card, null, slotIndex);

    if (hero) {
        return renderFilledHeroGroup(card, hero, slotIndex, selectedStyle, heroSlotHtml);
    } else {
        return renderEmptyHeroGroup(card, slotIndex, heroSlotHtml);
    }
}

/**
 * Render a filled hero group with all stats
 */
function renderFilledHeroGroup(card, hero, slotIndex, selectedStyle, heroSlotHtml) {
    const name = hero.name || 'Hero';

    // Get skill levels
    const attackSkill = hero.skills?.[selectedStyle]?.level ?? hero.skills?.[selectedStyle] ?? 1;
    const defenceSkill = hero.skills?.defence?.level ?? hero.skills?.defence ?? 1;

    // Calculate attack speed (from card or default)
    const attackSpeed = card.heroAttackSpeeds?.[hero.id] || 2500;
    const attackSpeedSec = (attackSpeed / 1000).toFixed(1);

    // HP and Energy
    const hp = hero.hp || { current: 100, max: 100 };
    const energy = hero.energy || { current: 50, max: 50 };
    const hpPercent = (hp.current / hp.max) * 100;
    const energyPercent = (energy.current / energy.max) * 100;

    // Attack progress
    const attackProgress = card.heroTickProcesses?.[hero.id] || 0;
    const attackPercent = (attackProgress / attackSpeed) * 100;

    // Energy cost per attack (from enemy or default)
    const enemyEnergyCost = card.enemyEnergyCost ?? 2;

    // Icon for selected combat style
    const styleIcons = { melee: '⚔️', ranged: '🏹', magic: '✨' };
    const attackIcon = styleIcons[selectedStyle] || '⚔️';

    return `
        <div class="hero-group" data-slot-index="${slotIndex}">
            <div class="hero-group__title">${name}</div>
            <div class="hero-group__content">
                <div class="hero-group__slot-container">
                    ${heroSlotHtml}
                </div>
                <div class="hero-group__info">
                    <div class="hero-group__stats">
                        <span>${attackIcon} ${attackSkill}</span>
                        <span>🛡️ ${defenceSkill}</span>
                        <span>⚡-${enemyEnergyCost}</span>
                    </div>
                    <div class="hero-group__bars">
                        ${renderHpBar(hp.current, hp.max, 'sm')}
                        ${renderEnergyBar(energy.current, energy.max, 'sm')}
                    </div>
                </div>
            </div>
            <div class="hero-group__attack">
                <span class="hero-group__attack-label">⏱️ ${attackSpeedSec}s</span>
                <div class="module-progress__bar-container">
                <div class="module-progress__bar" style="width: ${attackPercent}%;"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render an empty hero group with placeholder
 */
function renderEmptyHeroGroup(card, slotIndex, heroSlotHtml) {
    return `
        <div class="hero-group hero-group--empty" data-slot-index="${slotIndex}">
            <div class="hero-group__title">Drop Hero</div>
            <div class="hero-group__content">
                <div class="hero-group__slot-container">
                    ${heroSlotHtml}
                </div>
                <div class="hero-group__info">
                    <div class="hero-group__stats hero-group__stats--empty">
                        <span>⚔️ --</span>
                        <span>🛡️ --</span>
                        <span>⚡--</span>
                    </div>
                    <div class="hero-group__bars">
                        ${renderHpBar(0, 100, 'sm')}
                        ${renderEnergyBar(0, 100, 'sm')}
                    </div>
                </div>
            </div>
            <div class="hero-group__attack hero-group__attack--empty">
                <span class="hero-group__attack-label">⏱️ --</span>
                <div class="module-progress__bar-container">
                    <div class="module-progress__bar" style="width: 0%;"></div>
                </div>
            </div>
        </div>
    `;
}
