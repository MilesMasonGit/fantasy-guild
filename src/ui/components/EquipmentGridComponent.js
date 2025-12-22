// Fantasy Guild - Equipment Grid Component
// Phase 9: Hero UI

import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { SLOT_INFO } from '../../systems/equipment/EquipmentManager.js';
import { renderIcon } from '../../utils/AssetManager.js';

/**
 * Render the 2x2 equipment grid
 * @param {Object} hero - Hero object
 * @returns {string} HTML string
 */
export function renderEquipmentGrid(hero) {
  const slots = ['weapon', 'armor', 'food', 'drink'];

  const slotHtml = slots.map(slot => {
    const itemId = hero.equipment?.[slot];
    const slotInfo = SLOT_INFO[slot];

    if (itemId) {
      const template = getItem(itemId);
      const qty = InventoryManager.getItemCount(itemId);
      const dur = InventoryManager.getDurability(itemId);

      const iconHtml = renderIcon(template || { id: itemId, icon: '?' }, 'hero-equipment__icon', { size: 24 });

      return `
        <div class="hero-equipment__slot hero-equipment__slot--filled" 
             data-equipment-slot="${slot}" 
             data-hero-id="${hero.id}"
             data-item-id="${itemId}"
             title="${template?.name || itemId}${dur !== null ? ` (${dur}/${template?.maxDurability})` : ''} - Right-click to unequip">
          ${iconHtml}
          <span class="hero-equipment__badge">${qty}</span>
        </div>
      `;
    } else {
      const iconHtml = renderIcon({ icon: slotInfo.icon }, 'hero-equipment__icon hero-equipment__icon--empty', { size: 24, isTag: true });

      return `
        <div class="hero-equipment__slot hero-equipment__slot--empty" 
             data-equipment-slot="${slot}" 
             data-hero-id="${hero.id}"
             data-drop-zone="equipment"
             title="${slotInfo.label} slot (empty)">
          ${iconHtml}
        </div>
      `;
    }
  }).join('');

  return `<div class="hero-equipment__grid">${slotHtml}</div>`;
}
