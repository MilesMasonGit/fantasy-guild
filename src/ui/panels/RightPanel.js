// Fantasy Guild - Right Panel (Inventory)
// Phase 18: Inventory UI

import { EventBus } from '../../systems/core/EventBus.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { InventoryGroupManager } from '../../systems/economy/InventoryGroupManager.js';
import { renderInventoryGroup } from '../components/InventoryGroupComponent.js';

/**
 * Renders the right panel containing the inventory
 * @param {Object} data - Panel data
 * @returns {HTMLElement}
 */
export function renderRightPanel(data = {}) {
  // Count unique item types, not total quantity
  const itemCount = Object.keys(InventoryManager.getAllItems()).length;

  const panel = document.createElement('aside');
  panel.className = 'panel panel--right';
  panel.id = 'panel-right';

  panel.innerHTML = `
    <header class="panel__header">
      <h2 class="panel__title">Inventory</h2>
      <div class="panel__actions">
        <span class="panel__count">${itemCount} items</span>
      </div>
    </header>
    <div class="panel__content" id="inventory-list">
      ${renderInventoryContent()}
    </div>
  `;

  // Subscriptions managed by UISubscriptionManager

  return panel;
}

/**
 * Renders the content of the inventory list
 * @returns {string} HTML string
 */
function renderInventoryContent() {
  const groupedInventory = InventoryGroupManager.getGroupedInventory();

  if (groupedInventory.length === 0) {
    return renderEmptyState();
  }

  return groupedInventory.map(group => renderInventoryGroup(group)).join('');
}

/**
 * Renders the empty state for when inventory is empty
 * @returns {string} HTML string
 */
function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">📦</div>
      <h3 class="empty-state__title">Inventory Empty</h3>
      <p class="empty-state__description">Complete tasks to gather resources.</p>
    </div>
  `;
}

/**
 * Updates the inventory display in the right panel
 * Preserves scroll position to avoid jarring jumps
 */
export function updateInventoryDisplay() {
  const inventoryList = document.getElementById('inventory-list');
  if (!inventoryList) return;

  // Save current scroll position
  const scrollTop = inventoryList.scrollTop;

  // Update content
  inventoryList.innerHTML = renderInventoryContent();

  // Restore scroll position
  inventoryList.scrollTop = scrollTop;

  // Count unique item types, not total quantity
  const itemCount = Object.keys(InventoryManager.getAllItems()).length;
  const countEl = document.querySelector('#panel-right .panel__count');
  if (countEl) {
    countEl.textContent = `${itemCount} items`;
  }
}

export const updateInventory = updateInventoryDisplay;

