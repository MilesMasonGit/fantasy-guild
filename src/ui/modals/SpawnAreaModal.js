/**
 * @deprecated THIS MODAL IS DEPRECATED.
 * Area discovery is now handled via Map Fragments and the World Map UI.
 */
// Fantasy Guild - Spawn Area Modal (Dev Tool)
// Phase 25: Area Decks

import { renderModal, bindModal, showModal } from '../components/ModalComponent.js';
import { BIOMES as BiomeRegistry, BIOME_CATEGORIES } from '../../config/registries/biomeRegistry.js';
import * as NotificationSystem from '../../systems/core/NotificationSystem.js';
import { EventBus } from '../../systems/core/EventBus.js';

let modalInstance = null;
let filteredBiomes = [];
let allBiomes = [];

/**
 * Show the Spawn Area modal
 */
export function showSpawnAreaModal() {
    if (modalInstance) {
        modalInstance.remove();
        modalInstance = null;
    }

    // Prepare biomes list
    allBiomes = Object.values(BiomeRegistry)
        .filter(biome => biome && biome.id) // Ensure valid biome
        .map(biome => ({
            id: biome.id,
            name: biome.name,
            icon: biome.icon || '🗺️',
            category: biome.category || 'unknown'
        }))
        .sort((a, b) => {
            // Sort by category first, then name
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.name.localeCompare(b.name);
        });

    filteredBiomes = [...allBiomes];

    const content = renderSpawnAreaContent();

    modalInstance = renderModal(content, {
        title: '🧪 Dev Tools: Spawn Area Deck',
        className: 'modal--spawn-area',
        width: '400px'
    });

    bindModal(modalInstance, {
        onClose: () => {
            modalInstance.remove();
            modalInstance = null;
        }
    });

    setupSpawnAreaEventDelegation(modalInstance);
    renderBiomeList(modalInstance);

    showModal(modalInstance);
}

function renderSpawnAreaContent() {
    return `
        <div class="spawn-item-container">
            <div class="spawn-item__search-bar">
                <input type="text" id="spawn-area-search" placeholder="Search areas by name or category..." class="input--text" style="width: 100%; margin-bottom: 12px; padding: 8px;">
            </div>
            
            <div class="spawn-item__list" id="spawn-area-list" style="max-height: 300px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 8px; margin-bottom: 12px; background: rgba(0,0,0,0.2);">
                <!-- Biomes populated here via JS -->
            </div>
            
            <div class="spawn-item__controls" style="display: flex; gap: 8px; align-items: center;">
                <button class="btn btn--primary" id="btn-spawn-area" style="flex: 1;" disabled>Spawn Area Deck</button>
            </div>
        </div>
    `;
}

function renderBiomeList(modal) {
    const listContainer = modal.querySelector('#spawn-area-list');

    if (filteredBiomes.length === 0) {
        listContainer.innerHTML = '<div style="color: var(--color-text-muted); text-align: center; padding: 20px;">No areas found.</div>';
        return;
    }

    listContainer.innerHTML = filteredBiomes.map(biome => `
        <div class="spawn-item-row" data-biome-id="${biome.id}" style="display: flex; align-items: center; padding: 8px; cursor: pointer; border-radius: 4px; margin-bottom: 2px;">
            <div class="spawn-item-row__icon" style="width: 24px; text-align: center; margin-right: 8px;">${biome.icon}</div>
            <div class="spawn-item-row__info" style="flex: 1;">
                <div class="spawn-item-row__name" style="font-weight: 500; font-size: 14px;">${biome.name}</div>
                <div class="spawn-item-row__type" style="font-size: 11px; color: var(--color-text-muted); text-transform: uppercase;">${biome.category}</div>
            </div>
        </div>
    `).join('');
}

function setupSpawnAreaEventDelegation(modal) {
    const searchInput = modal.querySelector('#spawn-area-search');
    const spawnBtn = modal.querySelector('#btn-spawn-area');
    const listContainer = modal.querySelector('#spawn-area-list');

    let selectedBiomeId = null;

    // Search filter
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        filteredBiomes = allBiomes.filter(biome =>
            biome.name.toLowerCase().includes(term) ||
            biome.category.toLowerCase().includes(term)
        );
        selectedBiomeId = null; // Clear selection on search
        spawnBtn.disabled = true;
        renderBiomeList(modal);
    });

    // Biome selection
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

            selectedBiomeId = row.dataset.biomeId;
            spawnBtn.disabled = false;
        }
    });

    // Spawn Trigger
    spawnBtn.addEventListener('click', () => {
        if (!selectedBiomeId) return;
        NotificationSystem.warning('SpawnAreaModal is deprecated. Use the World Map.');
        if (modalInstance) {
            modalInstance.remove();
            modalInstance = null;
        }
    });
}
