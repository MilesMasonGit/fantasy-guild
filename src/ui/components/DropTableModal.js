// Fantasy Guild - Drop Table Modal
// Phase 25: Area Cards

import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getCard } from '../../config/registries/cardRegistry.js';
import { logger } from '../../utils/Logger.js';

/**
 * DropTableModal - Displays the task drop table for an area
 */

let modalElement = null;

/**
 * Show the drop table modal for a specific area card
 * @param {Object} cardInstance - The area card instance
 */
export function showDropTableModal(cardInstance) {
    if (!cardInstance || !cardInstance.biomeId) {
        console.warn('[DropTableModal] Invalid card instance');
        return;
    }

    const biome = getBiome(cardInstance.biomeId);
    if (!biome || !biome.taskPool) {
        console.warn('[DropTableModal] No task pool for biome:', cardInstance.biomeId);
        return;
    }

    // Calculate total weight for percentages
    const totalWeight = biome.taskPool.reduce((sum, entry) => sum + entry.weight, 0);

    // Build task rows
    const taskRows = biome.taskPool.map(entry => {
        const task = getCard(entry.taskId);
        const chance = ((entry.weight / totalWeight) * 100).toFixed(0);

        if (!task) {
            return `
                <div class="drop-table__row">
                    <span class="drop-table__icon">❓</span>
                    <span class="drop-table__name">${entry.taskId}</span>
                    <span class="drop-table__chance">${chance}%</span>
                </div>
            `;
        }

        // Build outputs preview
        const outputsPreview = task.outputs && task.outputs.length > 0
            ? task.outputs.map(o => `${o.quantity}x ${o.itemId}`).join(', ')
            : 'None';

        return `
            <div class="drop-table__row">
                <span class="drop-table__icon">${task.icon || '📋'}</span>
                <div class="drop-table__info">
                    <span class="drop-table__name">${task.name}</span>
                    <span class="drop-table__skill">🧭 ${task.skill || 'General'}</span>
                </div>
                <span class="drop-table__outputs">→ ${outputsPreview}</span>
                <span class="drop-table__chance">${chance}%</span>
            </div>
        `;
    }).join('');

    const areaName = `${cardInstance.modifierName || ''} ${biome.name}`.trim();

    // Create modal HTML
    const modalHtml = `
        <div class="modal-overlay" data-action="close-modal">
            <div class="modal drop-table-modal" role="dialog" aria-labelledby="drop-table-title">
                <header class="modal__header">
                    <h2 id="drop-table-title" class="modal__title">
                        ${cardInstance.modifierIcon || ''}${biome.icon} ${areaName} - Area Tasks
                    </h2>
                    <button class="modal__close" data-action="close-modal" aria-label="Close">✕</button>
                </header>
                <div class="modal__body">
                    <div class="drop-table">
                        <div class="drop-table__header">
                            <span>Task</span>
                            <span>Skill</span>
                            <span>Outputs</span>
                            <span>Chance</span>
                        </div>
                        ${taskRows}
                    </div>
                </div>
                <footer class="modal__footer">
                    <button class="modal__btn modal__btn--primary" data-action="close-modal">Close</button>
                </footer>
            </div>
        </div>
    `;

    // Remove existing modal if any
    hideDropTableModal();

    // Create and append modal
    modalElement = document.createElement('div');
    modalElement.innerHTML = modalHtml;
    document.body.appendChild(modalElement);

    // Add event listeners
    modalElement.querySelectorAll('[data-action="close-modal"]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target === el || e.target.closest('.modal__close') || e.target.closest('.modal__btn')) {
                hideDropTableModal();
            }
        });
    });

    // Prevent modal content clicks from closing
    const modalContent = modalElement.querySelector('.modal');
    if (modalContent) {
        modalContent.addEventListener('click', (e) => e.stopPropagation());
    }

    logger.debug('DropTableModal', 'Showing drop table for:', areaName);
}

/**
 * Hide and remove the drop table modal
 */
export function hideDropTableModal() {
    if (modalElement) {
        modalElement.remove();
        modalElement = null;
    }
}

export default {
    showDropTableModal,
    hideDropTableModal
};
