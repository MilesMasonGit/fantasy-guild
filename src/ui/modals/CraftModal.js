// Fantasy Guild - Card Crafting Modal
// Modal for crafting Task Cards and Trade Up functionality

import { CardCraftingSystem } from '../../systems/cards/CardCraftingSystem.js';
import { TradeUpSystem } from '../../systems/cards/TradeUpSystem.js';
import { renderModal, bindModal, showModal, hideModal } from '../components/ModalComponent.js';
import { getCard, CARD_TYPES, CARD_RARITIES, RARITY_INFO } from '../../config/registries/cardRegistry.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { formatLocation } from '../../utils/Formatters.js';

/**
 * CraftModal - Two-tab modal for Craft Cards and Trade Up
 */

let currentModal = null;
let selectedCardId = null;  // Renamed from selectedTaskId
let currentSortBy = 'name';
let currentFilter = '';
let currentTypeFilter = null;  // null = all, 'task', 'combat'

/**
 * Show the craft modal
 */
export function showCraftModal() {
    if (currentModal) {
        hideModal(currentModal);
    }

    selectedCardId = null;
    currentSortBy = 'name';
    currentFilter = '';
    currentTypeFilter = null;

    // Initialize TradeUpSystem and clear slots
    TradeUpSystem.init();
    TradeUpSystem.clearSlots();

    const content = renderCraftModalContent();
    currentModal = renderModal(content, {
        title: '📖 Card Library',
        className: 'craft-modal'
    });

    bindModal(currentModal, {
        onClose: () => {
            hideCraftModal();
        }
    });

    // Bind internal event handlers
    bindCraftModalEvents(currentModal);

    showModal(currentModal);
}

/**
 * Hide the craft modal
 */
export function hideCraftModal() {
    if (currentModal) {
        hideModal(currentModal);
        currentModal = null;
        selectedCardId = null;
        TradeUpSystem.clearSlots();
    }
}

/**
 * Render the modal content with tabs
 * @returns {string} HTML content
 */
function renderCraftModalContent() {
    return `
        <div class="craft-modal__tabs">
            <button class="craft-modal__tab craft-modal__tab--active" data-tab="craft">
                ✨ Craft Cards
            </button>
            <button class="craft-modal__tab" data-tab="tradeup">
                ⬆️ Trade Up
            </button>
        </div>
        <div class="craft-modal__content">
            <div class="craft-modal__panel craft-modal__panel--active" id="panel-craft">
                ${renderCraftPanel()}
            </div>
            <div class="craft-modal__panel" id="panel-tradeup">
                ${renderTradeUpPanel()}
            </div>
        </div>
    `;
}

/**
 * Render the Craft Cards panel content
 * @returns {string} HTML
 */
function renderCraftPanel() {
    const craftCheck = CardCraftingSystem.canCraft();
    const cards = CardCraftingSystem.getDiscoveredCards({
        sortBy: currentSortBy,
        filter: currentFilter,
        cardType: currentTypeFilter
    });

    // Count by type for filter tabs
    const allCards = CardCraftingSystem.getDiscoveredCards({});
    const taskCount = allCards.filter(c => c.cardType === CARD_TYPES.TASK).length;
    const combatCount = allCards.filter(c => c.cardType === CARD_TYPES.COMBAT).length;

    return `
        <div class="craft-panel__controls">
            <div class="craft-panel__filters">
                <button class="craft-panel__type-btn ${currentTypeFilter === null ? 'craft-panel__type-btn--active' : ''}" 
                        data-type-filter="all">All (${allCards.length})</button>
                <button class="craft-panel__type-btn ${currentTypeFilter === CARD_TYPES.TASK ? 'craft-panel__type-btn--active' : ''}" 
                        data-type-filter="task">Tasks (${taskCount})</button>
                <button class="craft-panel__type-btn ${currentTypeFilter === CARD_TYPES.COMBAT ? 'craft-panel__type-btn--active' : ''}" 
                        data-type-filter="combat">Combat (${combatCount})</button>
            </div>
            <input type="text" 
                   class="craft-panel__search" 
                   placeholder="🔍 Search..." 
                   value="${currentFilter}"
                   id="craft-search">
            <select class="craft-panel__sort" id="craft-sort">
                <option value="name" ${currentSortBy === 'name' ? 'selected' : ''}>A-Z Name</option>
                <option value="skill" ${currentSortBy === 'skill' ? 'selected' : ''}>By Skill</option>
                <option value="type" ${currentSortBy === 'type' ? 'selected' : ''}>By Type</option>
            </select>
        </div>
        <div class="craft-panel__list" id="craft-list">
            ${cards.length === 0
            ? '<div class="craft-panel__empty">No cards discovered yet.</div>'
            : cards.map(c => renderCardItem(c)).join('')
        }
        </div>
        <div class="craft-panel__footer">
            <span class="craft-panel__count">
                ${cards.length} card${cards.length !== 1 ? 's' : ''} discovered
            </span>
            <button class="craft-panel__craft-btn" 
                    id="craft-btn"
                    ${!craftCheck.canCraft || !selectedCardId ? 'disabled' : ''}
                    title="${!craftCheck.canCraft ? craftCheck.reason : 'Select a card to craft'}">
                ✨ Craft Card
            </button>
        </div>
    `;
}

/**
 * Render a single card item in the list (Task or Combat)
 * @param {Object} card - Card template
 * @returns {string} HTML
 */
function renderCardItem(card) {
    const isSelected = selectedCardId === card.id;
    const skill = getSkill(card.skill);
    const skillName = skill?.name || card.skill || 'General';
    const isCombat = card.cardType === CARD_TYPES.COMBAT;
    const typeIcon = isCombat ? '⚔️' : '📋';
    const typeLabel = isCombat ? 'Combat' : 'Task';

    return `
        <div class="craft-item ${isSelected ? 'craft-item--selected' : ''} craft-item--${card.cardType}" 
             data-card-id="${card.id}">
            <span class="craft-item__icon">${card.icon || '📜'}</span>
            <div class="craft-item__info">
                <span class="craft-item__name">${card.name}</span>
                <span class="craft-item__meta">
                    <span class="craft-item__type">${typeIcon} ${typeLabel}</span>
                    · ${skillName}
                </span>
            </div>
        </div>
    `;
}

/**
 * @deprecated Use renderCardItem instead
 */
function renderTaskItem(task) {
    return renderCardItem(task);
}

// ========================================
// Trade Up Panel
// ========================================

/**
 * Render the Trade Up panel content
 * @returns {string} HTML
 */
function renderTradeUpPanel() {
    const eligibleCards = TradeUpSystem.getEligibleCards();
    const slots = TradeUpSystem.getSlots();
    const slotCards = TradeUpSystem.getSlotCards();
    const validation = TradeUpSystem.validateSlots();
    const probs = TradeUpSystem.calculateProbabilities();

    return `
        <div class="tradeup-panel">
            <div class="tradeup-panel__left">
                <div class="tradeup-panel__label">Available Cards</div>
                <div class="tradeup-card-list" id="tradeup-card-list">
                    ${renderTradeUpCardList(eligibleCards)}
                </div>
            </div>
            <div class="tradeup-panel__right">
                <div class="tradeup-panel__label">Trade Up Slots (5 cards)</div>
                <div class="tradeup-slots" id="tradeup-slots">
                    ${slots.map((cardId, index) => renderTradeUpSlot(cardId, index)).join('')}
                </div>
                ${renderTradeUpValidation(validation, slotCards.length)}
                ${validation.valid ? renderTradeUpPreview(probs, validation.rarity) : ''}
                <div class="tradeup-footer">
                    <button class="tradeup-btn" 
                            id="tradeup-btn"
                            ${!validation.valid ? 'disabled' : ''}>
                        ⬆️ Trade Up
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the card list for Trade Up
 * @param {Array} eligibleCards 
 * @returns {string} HTML
 */
function renderTradeUpCardList(eligibleCards) {
    // Filter to only show eligible cards (hide Basic, Legendary, non-Task cards)
    const tradableCards = eligibleCards.filter(({ eligible }) => eligible);

    if (tradableCards.length === 0) {
        return '<div class="tradeup-card-list__empty">No eligible cards available.<br><span style="font-size: 0.85em; color: var(--color-text-muted);">Need Common-Epic Task Cards</span></div>';
    }

    return tradableCards.map(({ card, inSlot }) => {
        const rarityInfo = RARITY_INFO[card.rarity] || {};
        const locationText = formatLocation(card.biomeId, card.modifierId);

        const isUsed = inSlot;

        return `
            <div class="tradeup-card ${isUsed ? 'tradeup-card--used' : ''}"
                 data-card-id="${card.id}"
                 ${!isUsed ? 'draggable="true"' : ''}
                 title="${isUsed ? 'Already in slot' : 'Click or drag to add'}">
                <span class="tradeup-card__icon">${card.icon || '📜'}</span>
                <div class="tradeup-card__info">
                    <span class="tradeup-card__name">${card.name}</span>
                    <span class="tradeup-card__meta">
                        <span class="tradeup-card__rarity" style="color: ${rarityInfo.color || '#aaa'}">
                            ${rarityInfo.label || card.rarity}
                        </span>
                        · ${locationText}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render a single trade up slot
 * @param {string|null} cardId 
 * @param {number} index 
 * @returns {string} HTML
 */
function renderTradeUpSlot(cardId, index) {
    if (!cardId) {
        return `
            <div class="tradeup-slot tradeup-slot--empty" data-slot-index="${index}">
                <span class="tradeup-slot__placeholder">Drop card here</span>
            </div>
        `;
    }

    const card = TradeUpSystem.getSlotCards().find(c => c.id === cardId);
    if (!card) {
        return `<div class="tradeup-slot tradeup-slot--empty" data-slot-index="${index}"></div>`;
    }

    const rarityInfo = RARITY_INFO[card.rarity] || {};
    const locationText = formatLocation(card.biomeId, card.modifierId);

    return `
        <div class="tradeup-slot tradeup-slot--filled" data-slot-index="${index}">
            <span class="tradeup-slot__icon">${card.icon || '📜'}</span>
            <div class="tradeup-slot__info">
                <span class="tradeup-slot__name">${card.name}</span>
                <span class="tradeup-slot__meta">
                    <span style="color: ${rarityInfo.color || '#aaa'}">${rarityInfo.label || card.rarity}</span>
                    · ${locationText}
                </span>
            </div>
            <button class="tradeup-slot__remove" data-remove-slot="${index}" title="Remove">×</button>
        </div>
    `;
}

/**
 * Render validation message
 * @param {Object} validation 
 * @param {number} cardCount 
 * @returns {string} HTML
 */
function renderTradeUpValidation(validation, cardCount) {
    if (cardCount === 0) {
        return '';
    }

    if (!validation.valid && validation.error === 'All cards must be same Rarity') {
        return `<div class="tradeup-validation tradeup-validation--error">${validation.error}</div>`;
    }

    if (!validation.valid && cardCount < 5) {
        return `<div class="tradeup-validation tradeup-validation--info">${cardCount}/5 cards selected</div>`;
    }

    return '';
}

/**
 * Render the probability preview
 * @param {Object} probs 
 * @param {string} currentRarity 
 * @returns {string} HTML
 */
function renderTradeUpPreview(probs, currentRarity) {
    const nextRarity = TradeUpSystem.getNextRarity(currentRarity);
    const nextRarityInfo = RARITY_INFO[nextRarity] || {};

    const taskPreview = probs.tasks.map(t => `${t.probability}% ${t.name}`).join(', ');
    const biomePreview = probs.biomes.map(b => `${b.probability}% ${b.name}`).join(', ');

    return `
        <div class="tradeup-preview">
            <div class="tradeup-preview__result">
                Result: <span style="color: ${nextRarityInfo.color || '#aaa'}">${nextRarityInfo.label || nextRarity}</span> card
            </div>
            <div class="tradeup-preview__task">
                <strong>Task:</strong> ${taskPreview}
            </div>
            <div class="tradeup-preview__biome">
                <strong>Location:</strong> ${biomePreview}
            </div>
        </div>
    `;
}

// ========================================
// Utility Functions
// ========================================

/**
 * Capitalize first letter
 * @param {string} str 
 * @returns {string}
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Bind event handlers for the modal
 * @param {HTMLElement} modal 
 */
function bindCraftModalEvents(modal) {
    const body = modal.querySelector('.modal__body');
    if (!body) return;

    // Tab switching
    body.addEventListener('click', (e) => {
        const tab = e.target.closest('.craft-modal__tab');
        if (tab) {
            switchTab(body, tab.dataset.tab);
        }
    });

    // Card selection (Craft panel) - works for both Task and Combat
    body.addEventListener('click', (e) => {
        const item = e.target.closest('.craft-item');
        if (item) {
            selectCard(body, item.dataset.cardId);
        }
    });

    // Craft button
    body.addEventListener('click', (e) => {
        const craftBtn = e.target.closest('#craft-btn');
        if (craftBtn && !craftBtn.disabled) {
            craftSelectedCard(body);
        }
    });

    // Type filter buttons
    body.addEventListener('click', (e) => {
        const typeBtn = e.target.closest('[data-type-filter]');
        if (typeBtn) {
            const filter = typeBtn.dataset.typeFilter;
            if (filter === 'all') {
                currentTypeFilter = null;
            } else {
                currentTypeFilter = filter;  // 'task' or 'combat'
            }
            refreshCraftPanel(body);
        }
    });

    // Search input
    body.addEventListener('input', (e) => {
        if (e.target.id === 'craft-search') {
            currentFilter = e.target.value;
            refreshCraftPanel(body);
        }
    });

    // Sort dropdown
    body.addEventListener('change', (e) => {
        if (e.target.id === 'craft-sort') {
            currentSortBy = e.target.value;
            refreshCraftPanel(body);
        }
    });

    // ========================================
    // Trade Up Event Handlers
    // ========================================

    // Click to add card to slot
    body.addEventListener('click', (e) => {
        const card = e.target.closest('.tradeup-card:not(.tradeup-card--locked):not(.tradeup-card--used)');
        if (card) {
            const cardId = card.dataset.cardId;
            TradeUpSystem.addCardToSlot(cardId);
            refreshTradeUpPanel(body);
        }
    });

    // Remove from slot
    body.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('[data-remove-slot]');
        if (removeBtn) {
            const slotIndex = parseInt(removeBtn.dataset.removeSlot, 10);
            TradeUpSystem.removeCardFromSlot(slotIndex);
            refreshTradeUpPanel(body);
        }
    });

    // Trade Up button
    body.addEventListener('click', (e) => {
        const tradeupBtn = e.target.closest('#tradeup-btn');
        if (tradeupBtn && !tradeupBtn.disabled) {
            executeTradeUp(body);
        }
    });

    // Drag and drop
    body.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.tradeup-card:not(.tradeup-card--locked):not(.tradeup-card--used)');
        if (card) {
            e.dataTransfer.setData('text/plain', card.dataset.cardId);
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    body.addEventListener('dragover', (e) => {
        const slot = e.target.closest('.tradeup-slot--empty');
        if (slot) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        }
    });

    body.addEventListener('drop', (e) => {
        const slot = e.target.closest('.tradeup-slot--empty');
        if (slot) {
            e.preventDefault();
            const cardId = e.dataTransfer.getData('text/plain');
            if (cardId) {
                TradeUpSystem.addCardToSlot(cardId);
                refreshTradeUpPanel(body);
            }
        }
    });
}

/**
 * Switch between tabs
 * @param {HTMLElement} body 
 * @param {string} tabId 
 */
function switchTab(body, tabId) {
    // Update tab buttons
    const tabs = body.querySelectorAll('.craft-modal__tab');
    tabs.forEach(t => t.classList.toggle('craft-modal__tab--active', t.dataset.tab === tabId));

    // Update panels
    const panels = body.querySelectorAll('.craft-modal__panel');
    panels.forEach(p => p.classList.toggle('craft-modal__panel--active', p.id === `panel-${tabId}`));

    // Refresh the appropriate panel
    if (tabId === 'tradeup') {
        refreshTradeUpPanel(body);
    }
}

/**
 * Select a card (Task or Combat)
 * @param {HTMLElement} body 
 * @param {string} cardId 
 */
function selectCard(body, cardId) {
    selectedCardId = cardId;

    // Update selection visual
    const items = body.querySelectorAll('.craft-item');
    items.forEach(item => {
        item.classList.toggle('craft-item--selected', item.dataset.cardId === cardId);
    });

    // Update craft button
    const craftBtn = body.querySelector('#craft-btn');
    if (craftBtn) {
        const craftCheck = CardCraftingSystem.canCraft();
        craftBtn.disabled = !craftCheck.canCraft || !selectedCardId;
        craftBtn.title = selectedCardId
            ? (craftCheck.canCraft ? 'Craft this card' : craftCheck.reason)
            : 'Select a card to craft';
    }
}

/**
 * @deprecated Use selectCard instead
 */
function selectTask(body, taskId) {
    return selectCard(body, taskId);
}

/**
 * Craft the selected card (Task or Combat)
 * @param {HTMLElement} body 
 */
function craftSelectedCard(body) {
    if (!selectedCardId) return;

    const result = CardCraftingSystem.craftCard(selectedCardId);

    if (result.success) {
        // Deselect after crafting
        selectedCardId = null;
        refreshCraftPanel(body);
    }
}

/**
 * @deprecated Use craftSelectedCard instead
 */
function craftSelectedTask(body) {
    return craftSelectedCard(body);
}

/**
 * Execute trade up
 * @param {HTMLElement} body 
 */
function executeTradeUp(body) {
    const result = TradeUpSystem.executeTradeUp();
    if (result.success) {
        refreshTradeUpPanel(body);
    }
}

/**
 * Refresh the craft panel content
 * @param {HTMLElement} body 
 */
function refreshCraftPanel(body) {
    const panel = body.querySelector('#panel-craft');
    if (panel) {
        panel.innerHTML = renderCraftPanel();
    }
}

/**
 * Refresh the trade up panel content
 * @param {HTMLElement} body 
 */
function refreshTradeUpPanel(body) {
    const panel = body.querySelector('#panel-tradeup');
    if (panel) {
        panel.innerHTML = renderTradeUpPanel();
    }
}
