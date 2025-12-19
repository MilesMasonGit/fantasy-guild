// Fantasy Guild - Slot Selection Modal
// Phase 21: Save UI

import { formatTimeAgo } from '../../utils/Formatters.js';

/**
 * SlotSelectionModal - Renders save slot selection UI
 */

const MAX_SLOTS = 3;

/**
 * Render the slot selection content for a modal
 * @param {Array} slots - Array of slot info objects from SaveManager
 * @returns {string} HTML content
 */
export function renderSlotSelection(slots) {
    const slotCards = [];

    for (let i = 0; i < MAX_SLOTS; i++) {
        const slot = slots[i] || null;
        slotCards.push(renderSlotCard(i, slot));
    }

    return `
        <div class="slot-selection">
            <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-md);">
                Select a save slot to continue:
            </p>
            ${slotCards.join('')}
        </div>
    `;
}

/**
 * Render a single slot card
 * @param {number} index - Slot index (0-2)
 * @param {Object|null} slotInfo - Slot info from SaveManager
 * @returns {string} HTML for slot card
 */
function renderSlotCard(index, slotInfo) {
    const isEmpty = !slotInfo;
    const slotNumber = index + 1;

    if (isEmpty) {
        return `
            <div class="slot-card slot-card--empty" data-slot-index="${index}">
                <div class="slot-card__info">
                    <span class="slot-card__name">Slot ${slotNumber} — Empty</span>
                    <span class="slot-card__meta">No save data</span>
                </div>
                <div class="slot-card__actions">
                    <button class="slot-card__action slot-card__action--new" data-action="new" data-slot="${index}">
                        ✨ New Game
                    </button>
                </div>
            </div>
        `;
    }

    const { heroCount, playtime, lastSavedAt } = slotInfo;
    const timeAgo = lastSavedAt ? formatTimeAgo(lastSavedAt) : 'Unknown';
    const playtimeStr = formatPlaytime(playtime);

    return `
        <div class="slot-card" data-slot-index="${index}">
            <div class="slot-card__info">
                <span class="slot-card__name">Slot ${slotNumber}</span>
                <span class="slot-card__meta">
                    <span>🦸 ${heroCount || 0} heroes</span>
                    <span>⏱️ ${playtimeStr}</span>
                    <span>💾 ${timeAgo}</span>
                </span>
            </div>
            <div class="slot-card__actions">
                <button class="slot-card__action slot-card__action--load" data-action="load" data-slot="${index}">
                    ▶️ Load
                </button>
                <button class="slot-card__action slot-card__action--delete" data-action="delete" data-slot="${index}">
                    🗑️
                </button>
            </div>
        </div>
    `;
}

/**
 * Format playtime seconds to readable string
 * @param {number} seconds 
 * @returns {string}
 */
function formatPlaytime(seconds) {
    if (!seconds || seconds < 60) return '< 1 min';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}

/**
 * Bind event handlers for slot selection
 * @param {HTMLElement} container - The modal body element containing slots
 * @param {Object} handlers - Event handlers
 * @param {Function} handlers.onLoad - Called with slotIndex
 * @param {Function} handlers.onNew - Called with slotIndex
 * @param {Function} handlers.onDelete - Called with slotIndex
 */
export function bindSlotSelection(container, handlers = {}) {
    const { onLoad, onNew, onDelete } = handlers;

    container.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const slotIndex = parseInt(button.dataset.slot, 10);

        switch (action) {
            case 'load':
                if (onLoad) onLoad(slotIndex);
                break;
            case 'new':
                if (onNew) onNew(slotIndex);
                break;
            case 'delete':
                if (onDelete) onDelete(slotIndex);
                break;
        }
    });

    // Also allow clicking the card itself to load (for non-empty slots)
    container.addEventListener('click', (e) => {
        const card = e.target.closest('.slot-card:not(.slot-card--empty)');
        if (card && !e.target.closest('[data-action]')) {
            const slotIndex = parseInt(card.dataset.slotIndex, 10);
            if (onLoad) onLoad(slotIndex);
        }
    });
}
