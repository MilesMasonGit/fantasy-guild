// Fantasy Guild - Task Detail Component
// Renders detailed information for expanded task cards

import { getItem } from '../../config/registries/itemRegistry.js';

/**
 * Renders the complete expanded section for a task card
 * @param {Object} cardInstance - Card instance
 * @param {Object} template - Card template
 * @param {Object} hero - Assigned hero (or null)
 * @returns {string} HTML string
 */
export function renderTaskDetails(cardInstance, template, hero = null) {
    const categoryHtml = renderTaskCategory(cardInstance.taskCategory || template.taskCategory);
    const dropsHtml = renderDropTable(template.outputs);
    const breakdownHtml = renderEffectBreakdown(cardInstance, hero, template);

    return `
        ${categoryHtml}
        ${dropsHtml}
        ${breakdownHtml}
    `;
}

/**
 * Renders task category section
 * @param {string} category - Task category (e.g., 'mining', 'logging')
 * @returns {string} HTML string
 */
export function renderTaskCategory(category) {
    if (!category) return '';

    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    return `
        <div class="card__detail-section">
            <div class="card__detail-label">Task Category</div>
            <div class="card__detail-value">${capitalize(category)}</div>
        </div>
    `;
}

/**
 * Renders drop table showing all potential outputs
 * @param {Array} outputs - Outputs array [{itemId, quantity, chance}]
 * @returns {string} HTML string
 */
export function renderDropTable(outputs) {
    if (!outputs || outputs.length === 0) return '';

    const dropItems = outputs.map(output => {
        const itemDef = getItem(output.itemId);
        const itemName = itemDef?.name || output.itemId;
        const itemIcon = itemDef?.icon || '📦';
        const chance = output.chance !== undefined ? output.chance : 100;
        const chanceText = chance < 100 ? ` (${chance}%)` : '';

        return `
            <div class="card__drop-item">
                <span class="card__drop-icon">${itemIcon}</span>
                <span class="card__drop-text">${output.quantity}× ${itemName}${chanceText}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="card__detail-section">
            <div class="card__detail-label">Potential Drops</div>
            <div class="card__drop-list">
                ${dropItems}
            </div>
        </div>
    `;
}

/**
 * Renders speed information (base vs effective)
 * @param {number} baseTime - Base tick time in ms
 * @param {number} effectiveTime - Effective tick time in ms
 * @returns {string} HTML string
 */
export function renderSpeedInfo(baseTime, effectiveTime) {
    if (!baseTime || !effectiveTime) return '';

    const baseSec = (baseTime / 1000).toFixed(1);
    const effectiveSec = (effectiveTime / 1000).toFixed(1);
    const isDifferent = Math.abs(baseTime - effectiveTime) > 100; // More than 100ms difference

    if (!isDifferent) {
        return `
            <div class="card__detail-section">
                <div class="card__detail-label">Task Speed</div>
                <div class="card__detail-value">${baseSec}s per cycle</div>
            </div>
        `;
    }

    const isFaster = effectiveTime < baseTime;
    const arrow = isFaster ? '→' : '→';
    const modifierClass = isFaster ? 'card__speed-faster' : 'card__speed-slower';

    return `
        <div class="card__detail-section">
            <div class="card__detail-label">Task Speed</div>
            <div class="card__detail-value ${modifierClass}">
                Base: ${baseSec}s ${arrow} ${effectiveSec}s
            </div>
        </div>
    `;
}

/**
 * Calculate speed breakdown from all sources
 * @param {Object} cardInstance - Card instance
 * @param {Object} hero - Assigned hero (or null)
 * @param {Object} template - Card template
 * @returns {Array} Array of effect objects
 */
export function calculateSpeedBreakdown(cardInstance, hero, template) {
    const breakdown = [];

    // Get metadata or create default for Guild Hall tasks
    const metadata = cardInstance.speedMetadata || {
        templateBaseTime: template.baseTickTime || 10000,
        biomeEffects: []
    };

    const baseTime = metadata.templateBaseTime;

    // Track running total for cumulative display
    let currentTotal = baseTime;

    // 1. Base speed
    breakdown.push({
        source: 'Base',
        value: 0,
        timeMs: currentTotal,
        percent: 0
    });

    // 2. Biome/Modifier effects (from metadata)
    if (metadata.biomeEffects && metadata.biomeEffects.length > 0) {
        metadata.biomeEffects.forEach(effect => {
            // effect.value is the bonus (e.g., 0.05 for 5% faster, -0.20 for 20% slower)
            // Negate because: positive bonus = faster (reduce time), negative bonus = slower (add time)
            // We want: faster = negative deltaMs (green), slower = positive deltaMs (red)
            const deltaMs = baseTime * (-effect.value);
            currentTotal += deltaMs; // Accumulate
            breakdown.push({
                source: effect.source,
                value: deltaMs,
                timeMs: currentTotal,
                percent: -effect.value * 100
            });
        });
    }

    // 3. Hero skill bonus (if hero assigned)
    if (hero && template.skill) {
        const skillData = hero.skills?.[template.skill];
        const skillLevel = typeof skillData === 'number'
            ? skillData
            : (skillData?.level ?? 0);

        if (skillLevel > 0) {
            // Hero formula: 0.5% faster per level
            // heroSpeedMultiplier = 1 / (1 + skillLevel * 0.005)
            const speedBonus = skillLevel * 0.005;
            const multiplier = 1 / (1 + speedBonus);

            // Apply to current total
            const newTotal = currentTotal * multiplier;
            const deltaMs = newTotal - currentTotal;
            currentTotal = newTotal;

            breakdown.push({
                source: `${hero.name} (${template.skill} Lv ${skillLevel})`,
                value: deltaMs,
                timeMs: currentTotal,
                percent: (multiplier - 1) * 100
            });
        }
    }

    return breakdown;
}

/**
 * Renders speed breakdown showing all modifiers
 * @param {Object} cardInstance - Card instance  
 * @param {Object} hero - Assigned hero (or null)
 * @param {Object} template - Card template
 * @returns {string} HTML string
 */
export function renderEffectBreakdown(cardInstance, hero, template) {
    const breakdown = calculateSpeedBreakdown(cardInstance, hero, template);

    // Only show breakdown if there are effects beyond base
    if (breakdown.length <= 1) {
        return '';
    }

    const effectItems = breakdown.map((effect, index) => {
        if (index === 0) {
            // Base entry
            return `
                <div class="card__effect-item card__effect-item--base">
                    <span class="card__effect-source">${effect.source}</span>
                    <span class="card__effect-value">${(effect.timeMs / 1000).toFixed(1)}s</span>
                </div>
            `;
        }

        const isFaster = effect.value < 0;
        const sign = effect.value > 0 ? '+' : '';

        return `
            <div class="card__effect-item">
                <span class="card__effect-source">${effect.source}</span>
                <span class="card__effect-value ${isFaster ? 'faster' : 'slower'}">
                    ${sign}${effect.percent.toFixed(1)}% (${sign}${(effect.value / 1000).toFixed(1)}s)
                </span>
            </div>
        `;
    }).join('');

    // Add final speed line (last item in breakdown has cumulative timeMs)
    const finalSpeed = breakdown[breakdown.length - 1].timeMs;
    const finalLine = `
        <div class="card__effect-item card__effect-item--base">
            <span class="card__effect-source">Final</span>
            <span class="card__effect-value">${(finalSpeed / 1000).toFixed(1)}s</span>
        </div>
    `;

    return `
        <div class="card__detail-section">
            <div class="card__detail-label">Speed Modifiers</div>
            <div class="card__effect-list">
                ${effectItems}
                ${finalLine}
            </div>
        </div>
    `;
}