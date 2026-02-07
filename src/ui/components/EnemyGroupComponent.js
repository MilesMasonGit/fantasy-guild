// Fantasy Guild - Enemy Group Component
// Renders an Enemy Group for Combat Module with sprite on right

import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import { renderHpBar } from './ProgressBarComponent.js';

/**
 * Renders an Enemy Group component for combat display
 * @param {Object} options
 * @param {Object} options.card - Card instance
 * @param {Object} options.enemy - Enemy data (optional, will look up from card if not provided)
 * @param {number} options.enemyIndex - Enemy index for multi-enemy encounters
 * @returns {string} HTML string
 */
export function renderEnemyGroup(options) {
    const { card, enemy: providedEnemy, enemyIndex = 0 } = options;

    // Get enemy data
    const enemy = providedEnemy || getEnemy(card.enemyId);
    if (!enemy) {
        return `<div class="enemy-group enemy-group--error">Unknown enemy</div>`;
    }

    const name = enemy.name || 'Enemy';
    const icon = enemy.icon || '💀';

    // Get skill levels
    const attackSkill = enemy.skills?.attack ?? enemy.attack ?? 10;
    const defenceSkill = enemy.skills?.defence ?? enemy.defence ?? 5;

    // Get combat type icon
    const combatType = enemy.combatType || 'melee';
    const combatIcons = { melee: '⚔️', ranged: '🏹', magic: '✨' };
    const attackIcon = combatIcons[combatType] || '⚔️';

    // Attack speed
    const attackSpeed = enemy.attackSpeed || 3000;
    const attackSpeedSec = (attackSpeed / 1000).toFixed(1);

    // HP - from card state or enemy definition
    const maxHp = enemy.hp || 100;
    // card.enemyHp can be an object {current, max}, null, or undefined
    const currentHp = (card.enemyHp && typeof card.enemyHp === 'object') ? card.enemyHp.current : (card.enemyHp ?? maxHp);
    const hpPercent = (currentHp / maxHp) * 100;

    // Attack progress (enemy attacking heroes)
    const attackProgress = card.enemyTickProgress || 0;
    const attackPercent = (attackProgress / attackSpeed) * 100;

    // Sprite
    const spritePath = resolveSpritePath(enemy);
    let spriteHtml;
    if (spritePath && typeof spritePath === 'string') {
        spriteHtml = `
            <img src="${spritePath}" 
                 class="enemy-group__sprite" 
                 style="width: 64px; height: 64px; image-rendering: pixelated;"
                 onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
            <div class="enemy-group__icon-fallback" style="display:none;">
                <span>${icon}</span>
            </div>
        `;
    } else {
        spriteHtml = `
            <div class="enemy-group__icon-fallback">
                <span>${icon}</span>
            </div>
        `;
    }


    return `
        <div class="enemy-group" data-enemy-index="${enemyIndex}">
            <div class="enemy-group__title">${name}</div>
            <div class="enemy-group__content">
                <div class="enemy-group__info">
                    <div class="enemy-group__stats">
                        <span>${attackIcon} ${attackSkill}</span>
                        <span>🛡️ ${defenceSkill}</span>
                    </div>
                    <div class="enemy-group__bars">
                        ${renderHpBar(currentHp, maxHp, 'sm')}
                    </div>
                </div>
                <div class="enemy-group__sprite-container">
                    ${spriteHtml}
                </div>
            </div>
            <div class="enemy-group__attack">
                <span class="enemy-group__attack-label">⏱️ ${attackSpeedSec}s</span>
                <div class="module-progress__bar-container">
                    <div class="module-progress__bar" style="width: ${attackPercent}%;"></div>
                </div>
            </div>
        </div>
    `;
}
