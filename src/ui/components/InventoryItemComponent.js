// Fantasy Guild - Inventory Item Component
// Phase 18: Inventory UI

/**
 * Render a single inventory item
 * @param {Object} item - Item object with template data + count
 * @returns {string} HTML string
 */
export function renderInventoryItem(item) {
    return `
        <div class="inventory-item" title="${item.name}: ${item.description}" data-item-id="${item.id}" data-draggable="item" draggable="true">
            <div class="inventory-item__icon">${item.icon || '📦'}</div>
            <div class="inventory-item__content">
                <div class="inventory-item__details">
                    <span class="inventory-item__name">${item.name}</span>
                    <span class="inventory-item__count">x${item.count}</span>
                </div>
                ${renderDurabilityBar(item)}
            </div>
        </div>
    `;
}

function renderDurabilityBar(item) {
    if (!item.maxDurability || item.durability === undefined || item.durability === null) return '';

    // Calculate percent
    const percent = Math.max(0, Math.min(100, (item.durability / item.maxDurability) * 100));

    // Status color
    let statusClass = '';
    if (percent < 20) statusClass = 'critical';
    else if (percent < 50) statusClass = 'low';

    return `
        <div class="inventory-item__durability">
            <div class="inventory-item__durability-bar ${statusClass}" style="width: ${percent}%;"></div>
        </div>
    `;
}
