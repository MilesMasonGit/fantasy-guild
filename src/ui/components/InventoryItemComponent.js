import { renderIcon } from '../../utils/AssetManager.js';

/**
 * Render a single inventory item
 * @param {Object} item - Item object with template data + count
 * @returns {string} HTML string
 */
export function renderInventoryItem(item) {
    const iconHtml = renderIcon(item, 'inventory-item__icon', { size: 32 }); // Use 32 for list, can scale up elsewhere

    return `
        <div class="inventory-item flex items-center gap-3 p-2 bg-white/5 border border-white/5 rounded-md hover:bg-white/10 hover:border-white/10 hover:translate-x-1 cursor-grab active:cursor-grabbing transition-all group" title="${item.name}: ${item.description}" data-item-id="${item.id}" data-draggable="item" draggable="true">
            <div class="flex-shrink-0 grayscale group-hover:grayscale-0 transition-all">
                ${iconHtml}
            </div>
            <div class="inventory-item__content flex-1 flex flex-col gap-0.5 overflow-hidden">
                <div class="inventory-item__details flex items-center justify-between">
                    <span class="inventory-item__name text-xs font-medium text-gray-200 truncate pr-2">${item.name}</span>
                    <span class="inventory-item__count text-[16px] font-bold text-white bg-black/40 px-1.5 py-0.5 rounded border border-white/5">${item.count}</span>
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
        <div class="inventory-item__durability w-full h-1 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
            <div class="h-full transition-all duration-300 ${statusClass === 'critical' ? 'bg-error shadow-[0_0_8px_rgba(252,129,129,0.4)]' : (statusClass === 'low' ? 'bg-warning shadow-[0_0_8px_rgba(236,201,75,0.4)]' : 'bg-success shadow-[0_0_8px_rgba(72,187,120,0.4)]')}" style="width: ${percent}%;"></div>
        </div>
    `;
}
