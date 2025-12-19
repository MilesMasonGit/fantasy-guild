// Fantasy Guild - ViewManager
// Phase 21: Save UI

import { renderTopBar, bindTopBar, updateInfluenceDisplay } from './panels/TopBar.js';
import { renderLeftPanel, updateHeroList } from './panels/LeftPanel.js';
import { renderCenterPanel, updateCardStack } from './panels/CenterPanel.js';
import { renderRightPanel, updateInventory } from './panels/RightPanel.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { renderModal, bindModal, showModal as showModalFn, hideModal as hideModalFn } from './components/ModalComponent.js';
import { renderSlotSelection, bindSlotSelection } from './modals/SlotSelectionModal.js';
import { setupSubscriptions, cleanupSubscriptions } from './UISubscriptionManager.js';
import { logger } from '../utils/Logger.js';

/**
 * ViewManager - Central UI coordinator
 * Responsible for:
 * - Initial render of all panels
 * - Subscribing to events and updating relevant panels
 * - Coordinating UI state
 * - Managing modals
 */
class ViewManager {
    constructor() {
        this.app = null;
        this.isInitialized = false;
        this.currentModal = null;
    }

    /**
     * Initialize the ViewManager and render the initial UI
     * @param {HTMLElement} appElement - The root app element
     */
    init(appElement) {
        if (this.isInitialized) {
            logger.warn('ViewManager', 'Already initialized');
            return;
        }

        this.app = appElement;
        this.renderTopBarOnly();  // Only render TopBar initially
        this.subscribeToEvents();
        this.isInitialized = true;
        logger.info('ViewManager', 'Initialized (TopBar only, awaiting slot selection)');
    }

    /**
     * Subscribe to game events for UI updates
     */
    subscribeToEvents() {
        // Set up centralized UI panel subscriptions (inventory, heroes)
        setupSubscriptions();

        // Update Influence display when currency changes
        EventBus.subscribe('influence_changed', (data) => {
            updateInfluenceDisplay(data.amount);
        });
    }

    /**
     * Render only the TopBar (before slot selection)
     */
    renderTopBarOnly() {
        // Clear existing content
        this.app.innerHTML = '';

        // Render TopBar
        const topbar = renderTopBar({
            title: 'Fantasy Guild',
            subtitle: ''
        });
        this.app.appendChild(topbar);

        // Bind TopBar handlers
        bindTopBar(topbar, {
            onSettings: () => this.handleSettings(),
            onSave: () => this.handleSave(),
            onReset: () => this.handleReset(),
            onTestModal: () => this.handleTestModal()
        });
    }

    /**
     * Render the full 3-column layout (after slot is selected)
     */
    renderFullLayout() {
        logger.debug('ViewManager', 'Rendering full layout...');

        // Create main layout container
        const mainLayout = document.createElement('div');
        mainLayout.className = 'main-layout';

        // Render panels with real data from GameState (now initialized)
        const heroes = GameState.heroes || [];
        const leftPanel = renderLeftPanel({ heroes });
        const centerPanel = renderCenterPanel({ cards: [] });
        const rightPanel = renderRightPanel({ inventory: { groups: [], items: {} } });

        mainLayout.appendChild(leftPanel);
        mainLayout.appendChild(centerPanel);
        mainLayout.appendChild(rightPanel);

        this.app.appendChild(mainLayout);
        logger.debug('ViewManager', 'Full layout rendered');
    }

    /**
     * Render the complete UI structure (legacy method, calls both)
     */
    render() {
        this.renderTopBarOnly();
        this.renderFullLayout();
    }

    /**
     * Handle settings button click
     */
    handleSettings() {
        logger.debug('ViewManager', 'Settings clicked');
        // Will be implemented in Phase 43: Settings & Options
    }

    /**
     * Handle save button click
     */
    handleSave() {
        logger.debug('ViewManager', 'Save clicked');
        SaveManager.save();
    }

    /**
     * Handle reset button click
     */
    handleReset() {
        logger.debug('ViewManager', 'Reset clicked');
        SaveManager.reset();
    }

    /**
     * Handle test modal button click (DEBUG)
     */
    handleTestModal() {
        logger.debug('ViewManager', 'Test Modal clicked');
        const testContent = `
            <p style="margin-bottom: 16px;">This is a test modal to verify the modal system is working.</p>
            <button class="btn btn--primary" id="btn-close-test">Close This Modal</button>
        `;
        const modal = this.showModal(testContent, { title: '🧪 Modal Test' });

        // Bind close button
        const closeBtn = modal.querySelector('#btn-close-test');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideModal());
        }
    }

    /**
     * Update the hero list display
     * @param {Array} heroes - Array of hero objects
     */
    updateHeroes(heroes) {
        updateHeroList(heroes);
    }

    /**
     * Update the card stack display
     * @param {Array} cards - Array of card objects
     */
    updateCards(cards) {
        updateCardStack(cards);
    }

    /**
     * Update the inventory display
     * @param {Object} inventory - Inventory data
     */
    updateInventory(inventory) {
        updateInventory(inventory);
    }

    // ========================================
    // === Modal Management ===
    // ========================================

    /**
     * Show a modal with custom content
     * @param {string} content - HTML content for modal body
     * @param {Object} options - Modal options
     * @param {Function} options.onClose - Called when modal closes
     * @returns {HTMLElement} The modal element
     */
    showModal(content, options = {}) {
        // Close any existing modal
        if (this.currentModal) {
            this.hideModal();
        }

        const modal = renderModal(content, options);
        bindModal(modal, {
            onClose: () => {
                this.hideModal();
                if (options.onClose) options.onClose();
            }
        });

        showModalFn(modal);
        this.currentModal = modal;
        return modal;
    }

    /**
     * Hide the current modal
     */
    hideModal() {
        if (this.currentModal) {
            hideModalFn(this.currentModal);
            this.currentModal = null;
        }
    }

    /**
     * Show the save slot selection modal
     * @param {Function} onSlotSelected - Called when a slot is selected/created
     */
    showSlotSelectionModal(onSlotSelected) {
        const slots = SaveManager.getAllSlotInfos();
        const content = renderSlotSelection(slots);

        const modal = this.showModal(content, {
            title: '💾 Select Save Slot',
            hideClose: true  // Don't allow closing without selecting
        });

        // Bind slot selection handlers
        const modalBody = modal.querySelector('.modal__body');
        bindSlotSelection(modalBody, {
            onLoad: (slotIndex) => {
                const success = SaveManager.loadSlot(slotIndex);
                if (success) {
                    this.hideModal();
                    if (onSlotSelected) onSlotSelected(slotIndex, false);
                }
            },
            onNew: (slotIndex) => {
                SaveManager.newGame(slotIndex);
                this.hideModal();
                if (onSlotSelected) onSlotSelected(slotIndex, true);
            },
            onDelete: (slotIndex) => {
                if (confirm(`Delete Slot ${slotIndex + 1}? This cannot be undone.`)) {
                    SaveManager.deleteSlot(slotIndex);
                    // Refresh the modal content
                    const newSlots = SaveManager.getAllSlotInfos();
                    modalBody.innerHTML = renderSlotSelection(newSlots);
                    bindSlotSelection(modalBody, {
                        onLoad: (idx) => {
                            const success = SaveManager.loadSlot(idx);
                            if (success) {
                                this.hideModal();
                                if (onSlotSelected) onSlotSelected(idx, false);
                            }
                        },
                        onNew: (idx) => {
                            SaveManager.newGame(idx);
                            this.hideModal();
                            if (onSlotSelected) onSlotSelected(idx, true);
                        },
                        onDelete: (idx) => {
                            // Recursively handle delete (simplified - could be improved)
                            SaveManager.deleteSlot(idx);
                            location.reload();
                        }
                    });
                }
            }
        });

        return modal;
    }
}

// Export singleton instance
export const viewManager = new ViewManager();
