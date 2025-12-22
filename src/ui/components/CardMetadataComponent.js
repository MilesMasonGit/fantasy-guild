// Fantasy Guild - Card Metadata Component
// Shared component for common card metadata and UI elements

import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getModifier } from '../../config/registries/modifierRegistry.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { RARITY_INFO } from '../../config/registries/cardRegistry.js';
import { TIMING } from '../../config/uiConstants.js';
import { renderIcon } from '../../utils/AssetManager.js';

/**
 * Renders card description paragraph
 * @param {Object} template - Card template
 * @param {string} defaultText - Default text if template.description is empty
 * @returns {string} HTML string
 */
export function renderDescription(template, defaultText = '') {
    return `<p class="card__description">${template.description || defaultText}</p>`;
}

/**
 * Renders skill badge with optional category (for task cards)
 * @param {Object} template - Card template
 * @param {Object} cardInstance - Card instance (for task category)
 * @param {Object} options - { showCategory: boolean, icon: string }
 * @returns {string} HTML string
 */
export function renderSkillBadge(template, cardInstance, options = {}) {
    const skillId = template.skill || cardInstance.skill || 'General';
    const skillDef = getSkill(skillId);
    const showCategory = options.showCategory ?? false;

    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    // Skill icon from AssetManager
    const iconHtml = renderIcon(skillDef || { id: skillId, icon: options.icon || '📜' }, '', { size: 16 });

    if (showCategory) {
        // Task cards: "Mining-Industry"
        const category = cardInstance.taskCategory || template.taskCategory;
        const mainText = category
            ? `${capitalize(skillId)}-${capitalize(category)}`
            : capitalize(skillId);
        return `${iconHtml} ${mainText}`;
    } else {
        // Explore/Area cards: "🧭 Exploration"
        return `${iconHtml} ${capitalize(skillId)}`;
    }
}

/**
 * Renders rarity badge
 * @param {string|null} rarity - Rarity level (e.g., 'common', 'uncommon')
 * @returns {string} HTML string
 */
export function renderRarityBadge(rarity) {
    if (!rarity) return '';

    const info = RARITY_INFO[rarity];
    if (!info) return '';

    return `<span class="card__rarity-badge card__rarity-badge--${rarity}">${info.label}</span>`;
}

/**
 * Renders energy cost badge
 * @param {Object} template - Card template
 * @returns {string} HTML string
 */
export function renderEnergyCost(template) {
    const energy = template.baseEnergyCost || 0;
    return `<span class="card__energy-cost">⚡ ${energy}</span>`;
}

/**
 * Renders rewards/outputs preview
 * @param {Array} outputs - Outputs array [{itemId, quantity, chance}]
 * @returns {string} HTML string
 */
import { renderRewardPreview } from './RewardPreviewComponent.js';

/**
 * Renders rewards/outputs preview
 * @param {Array} outputs - Outputs array [{itemId, quantity, chance}]
 * @returns {string} HTML string
 */
export function renderRewards(outputs) {
    if (!outputs || outputs.length === 0) return '';

    // Transform outputs to uniform format if needed
    // (Assuming outputs already have itemId, quantity, chance)
    // We might need to look up names/icons if they aren't fully hydrated, 
    // but CardSystem usually fully hydrates them for the template.
    // If not, we'd need getItem() here, but CardMetadata tries to be pure.
    // Let's assume the passed 'outputs' are hydration-ready or we do basic mapping.

    // Note: The caller usually passes template.outputs.
    // We might need to do a quick hydration here if they are just IDs.

    return renderRewardPreview(outputs.map(o => ({
        name: o.itemId, //Ideally would be o.name if hydrated
        icon: o.currencyId ? (o.currencyId === 'influence' ? '👑' : '💰') : '📦',
        quantity: o.quantity,
        chance: o.chance,
        currencyId: o.currencyId
    })), 'output');
}

/**
 * Renders skill badge with name, icon, and required level
 * @param {Object} template - Card template
 * @returns {string} Skill badge text (e.g., "Industry ⛏️ 1")
 */
function renderSkillRequirementBadge(template) {
    if (!template.skill) return '';

    const skillDef = getSkill(template.skill);
    const skillName = skillDef?.name || template.skill;
    const requiredLevel = template.skillRequirement || 0;

    const iconHtml = renderIcon(skillDef || { id: template.skill, icon: '📜' }, '', { size: 16 });

    return `<span class="u-flex-inline u-items-center u-gap-xs">${skillName} ${iconHtml} ${requiredLevel}</span>`;
}

/**
 * Renders task speed badge with timer icon
 * @param {number} effectiveTime - Effective tick time in ms
 * @returns {string} Speed badge HTML
 */
function renderTaskSpeed(effectiveTime) {
    if (!effectiveTime) return '';
    const seconds = (effectiveTime / 1000).toFixed(1);
    return `⏱️ ${seconds}s`;
}

/**
 * Renders complete task info row (skill + rarity + energy cost + xp)
 * @param {Object} template - Card template
 * @param {Object} cardInstance - Card instance
 * @param {Object} options - Display options { showCategory, showRarity }
 * @returns {string} HTML string
 */
export function renderTaskInfo(template, cardInstance, options = {}) {
    const { showCategory = true, showRarity = true } = options;

    const skillBadge = renderSkillRequirementBadge(template);
    const rarityBadge = showRarity ? renderRarityBadge(cardInstance.rarity) : '';
    const taskSpeed = renderTaskSpeed(cardInstance.effectiveTickTime);
    const xpAwarded = template.xpAwarded || template.baseXpAwarded || 0;
    const xpBadge = xpAwarded > 0 ? `<span class="card__xp-badge">⭐ ${xpAwarded} XP</span>` : '';

    return `
        <div class="card__task-info">
            <span class="card__skill-requirement-badge">${skillBadge}</span>
            ${rarityBadge}
            <span class="card__task-speed-badge">${taskSpeed}</span>
            ${xpBadge}
        </div>
    `;
}

/**
 * Renders speed info (base → final) if difference is significant
 * @param {number} baseTime - Base tick time in ms
 * @param {number} effectiveTime - Effective tick time in ms
 * @param {number} threshold - Minimum difference to show (default from TIMING.SPEED_DISPLAY_THRESHOLD_MS)
 * @returns {string} HTML string
 */
export function renderSpeedInfo(baseTime, effectiveTime, threshold = TIMING.SPEED_DISPLAY_THRESHOLD_MS) {
    const showSpeedInfo = Math.abs(effectiveTime - baseTime) > threshold;

    if (!showSpeedInfo) return '';

    const baseSec = baseTime / 1000;
    const effectiveSec = Math.round(effectiveTime / 100) / 10; // Round to 1 decimal

    return `<span class="card__speed-info">Base: ${baseSec}s → ${effectiveSec}s</span>`;
}

/**
 * Renders conditional hint text
 * @param {boolean} condition - Whether to show the hint
 * @param {string} message - Hint message to display
 * @returns {string} HTML string
 */
export function renderHint(condition, message) {
    if (!condition) return '';
    return `<p class="card__hint">${message}</p>`;
}

/**
 * Renders source info (biome/modifier or Guild Hall) as a rarity-styled badge
 * @param {Object} cardInstance - Card instance
 * @returns {string} HTML string
 */
export function renderSourceInfo(cardInstance) {
    // Area cards don't need source info in header
    if (cardInstance.cardType === 'area') {
        return '';
    }

    const rarity = cardInstance.rarity || 'basic';
    let sourceName;

    if (!cardInstance.biomeId) {
        // No biome = Guild Hall task
        sourceName = 'Guild Hall';
    } else {
        const biome = getBiome(cardInstance.biomeId);
        const modifier = cardInstance.modifierId ? getModifier(cardInstance.modifierId) : null;

        const modifierName = modifier?.name || '';
        const biomeName = biome?.name || 'Unknown';

        sourceName = modifier
            ? `${modifierName} ${biomeName}`
            : biomeName;
    }

    // Render as a rarity-styled badge
    return `<span class="card__rarity-badge card__rarity-badge--${rarity}">${sourceName}</span>`;
}
