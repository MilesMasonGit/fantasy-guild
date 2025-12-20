// Fantasy Guild - Reward Preview Component
// Shared component for rendering rewards, loot, and outputs

/**
 * Renders a list of rewards/loot/outputs with consistent styling
 * @param {Array} items - Array of item objects [{ name, icon, quantity, min, max, chance, isRare }]
 * @param {string} mode - Display mode: 'loot' (combat), 'output' (task), 'reward' (quest)
 * @returns {string} HTML string
 */
export function renderRewardPreview(items, mode = 'loot') {
    if (!items || items.length === 0) {
        return `<div class="reward-preview reward-preview--empty">No ${mode}</div>`;
    }

    const renderedItems = items.map(item => renderRewardItem(item, mode)).join('');

    return `
        <div class="reward-preview reward-preview--${mode}">
            ${renderedItems}
        </div>
    `;
}

/**
 * Renders a single reward item badge
 * @param {Object} item 
 * @param {string} mode 
 */
function renderRewardItem(item, mode) {
    const icon = item.icon || '📦';
    const name = item.name || 'Unknown Item';
    const chance = item.chance || 100;

    // Format Quantity
    let qtyText = '';
    if (mode === 'loot' && item.min !== undefined && item.max !== undefined) {
        // Loot ranges: "1-3"
        qtyText = item.min === item.max ? `${item.min}` : `${item.min}-${item.max}`;
    } else {
        // Standard output/reward: "+1"
        qtyText = `+${item.quantity || 1}`;
    }

    // Format Chance
    const showChance = chance < 100;
    const chanceText = showChance ? `<span class="u-text-muted">(${chance}%)</span>` : '';

    // Styling classes
    const classes = ['reward-badge'];
    if (mode === 'loot') classes.push('reward-badge--loot');
    if (item.currencyId) classes.push('reward-badge--currency');
    if (item.isRare || chance < 10) classes.push('reward-badge--rare');

    return `
        <div class="${classes.join(' ')}" title="${name}">
            <span class="reward-badge__icon">${icon}</span>
            <span class="reward-badge__text">
                ${mode === 'output' ? qtyText : ''} 
                ${name} 
                ${mode === 'loot' ? qtyText : ''}
                ${chanceText}
            </span>
        </div>
    `;
}
