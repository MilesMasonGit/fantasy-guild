// Fantasy Guild - Spawn Item Modal (Dev Tool)
// Phase 22: Settings UI - Dev Tools

import { renderModal, bindModal, showModal } from '../components/ModalComponent.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { ITEMS as ItemRegistry } from '../../config/registries/itemRegistry.js';
import * as NotificationSystem from '../../systems/core/NotificationSystem.js';

let modalInstance = null;
let filteredItems = [];
let allItems = [];

/**
 * Show the Spawn Item modal
 */
export function showSpawnItemModal() {
    if (modalInstance) {
        modalInstance.remove();
        modalInstance = null;
    }

    // Prepare items list
    allItems = Object.values(ItemRegistry)
        .filter(item => item && item.id) // Ensure valid item
        .map(item => ({
            id: item.id,
            name: item.name,
            icon: item.icon || '📦',
            type: item.type
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    filteredItems = [...allItems];

    const content = renderSpawnItemContent();

    modalInstance = renderModal(content, {
        title: '🧪 Dev Tools: Spawn Item',
        className: 'modal--spawn-item',
        width: '400px'
    });

    bindModal(modalInstance, {
        onClose: () => {
            modalInstance.remove();
            modalInstance = null;
        }
    });

    setupSpawnItemEventDelegation(modalInstance);
    renderItemList(modalInstance);

    showModal(modalInstance);
}

function renderSpawnItemContent() {
    return `
        <div class="spawn-item-container">
            <div class="spawn-item__search-bar">
                <input type="text" id="spawn-item-search" placeholder="Search items by name or type..." class="input--text" style="width: 100%; margin-bottom: 12px; padding: 8px;">
            </div>
            
            <div class="spawn-item__list" id="spawn-item-list" style="max-height: 300px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 8px; margin-bottom: 12px; background: rgba(0,0,0,0.2);">
                <!-- Items populated here via JS -->
            </div>
            
            <div class="spawn-item__controls" style="display: flex; gap: 8px; align-items: center;">
                <label for="spawn-item-qty" style="font-size: 14px; color: var(--color-text-secondary);">Quantity:</label>
                <input type="number" id="spawn-item-qty" value="1" min="1" max="999" class="input--text" style="width: 80px; padding: 6px;">
                <button class="btn btn--primary" id="btn-spawn-item" style="flex: 1;" disabled>Spawn Item</button>
            </div>
        </div>
    `;
}

function renderItemList(modal) {
    const listContainer = modal.querySelector('#spawn-item-list');

    if (filteredItems.length === 0) {
        listContainer.innerHTML = '<div style="color: var(--color-text-muted); text-align: center; padding: 20px;">No items found.</div>';
        return;
    }

    listContainer.innerHTML = filteredItems.map(item => `
        <div class="spawn-item-row" data-item-id="${item.id}" style="display: flex; align-items: center; padding: 8px; cursor: pointer; border-radius: 4px; margin-bottom: 2px;">
            <div class="spawn-item-row__icon" style="width: 24px; text-align: center; margin-right: 8px;">${item.icon}</div>
            <div class="spawn-item-row__info" style="flex: 1;">
                <div class="spawn-item-row__name" style="font-weight: 500; font-size: 14px;">${item.name}</div>
                <div class="spawn-item-row__type" style="font-size: 11px; color: var(--color-text-muted); text-transform: uppercase;">${item.type}</div>
            </div>
        </div>
    `).join('');
}

function setupSpawnItemEventDelegation(modal) {
    const searchInput = modal.querySelector('#spawn-item-search');
    const spawnBtn = modal.querySelector('#btn-spawn-item');
    const qtyInput = modal.querySelector('#spawn-item-qty');
    const listContainer = modal.querySelector('#spawn-item-list');

    let selectedItemId = null;

    // Search filter
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        filteredItems = allItems.filter(item =>
            item.name.toLowerCase().includes(term) ||
            item.type.toLowerCase().includes(term)
        );
        selectedItemId = null; // Clear selection on search
        spawnBtn.disabled = true;
        renderItemList(modal);
    });

    // Item selection
    listContainer.addEventListener('click', (e) => {
        const row = e.target.closest('.spawn-item-row');
        if (row) {
            // Remove previous active state
            const previous = listContainer.querySelector('.spawn-item-row--active');
            if (previous) {
                previous.style.background = 'transparent';
                previous.classList.remove('spawn-item-row--active');
            }

            // Set new active state
            row.style.background = 'rgba(100, 200, 150, 0.2)';
            row.classList.add('spawn-item-row--active');

            selectedItemId = row.dataset.itemId;
            spawnBtn.disabled = false;
        }
    });

    // Spawn Trigger
    spawnBtn.addEventListener('click', () => {
        if (!selectedItemId) return;

        let qty = parseInt(qtyInput.value, 10);
        if (isNaN(qty) || qty < 1) qty = 1;

        const addedCount = InventoryManager.addItem(selectedItemId, qty);
        if (addedCount > 0) {
            const itemDef = ItemRegistry[selectedItemId];
            NotificationSystem.success(`Spawned ${qty}x ${itemDef.name}`);

            // Optionally auto-close after a successful spawn
            // modal.remove();
            // modalInstance = null;
        } else {
            NotificationSystem.error('Failed to spawn item.');
        }
    });
}
