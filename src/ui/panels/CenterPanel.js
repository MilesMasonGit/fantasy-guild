// Fantasy Guild - Center Panel (Card Stack)
// Phase 15: Task System

import { renderCard, updateCardDisplay } from '../components/CardComponent.js';
import { GameState } from '../../state/GameState.js';
import { EventBus } from '../../systems/core/EventBus.js';
import * as CardManager from '../../systems/cards/CardManager.js';
import ExploreSystem from '../../systems/cards/ExploreSystem.js';
import AreaSystem from '../../systems/cards/AreaSystem.js';
import { RecruitSystem } from '../../systems/cards/RecruitSystem.js';
import { showDropTableModal } from '../components/DropTableModal.js';
import { getCard } from '../../config/registries/cardRegistry.js';
import { showCraftModal } from '../modals/CraftModal.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';

/**
 * Update Explore card visual elements without re-rendering entire card
 * @param {string} cardId - ID of the explore card to update
 */
function updateExploreCardProgress(cardId) {
  console.log('[CenterPanel] updateExploreCardProgress called with cardId:', cardId);

  const card = CardManager.getCard(cardId);
  if (!card) {
    console.log('[CenterPanel] Card not found:', cardId);
    return;
  }

  const template = getCard(card.templateId);
  if (!template || template.cardType !== 'explore') {
    console.log('[CenterPanel] Not an explore card:', card.templateId);
    return;
  }

  const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
  if (!cardElement) {
    console.log('[CenterPanel] Card element not found in DOM:', cardId);
    return;
  }

  console.log('[CenterPanel] Updating explore progress:', card.explorePoints, '/', template.explorePointsRequired);

  // Update Explore progress bar width
  const exploreProgressBar = cardElement.querySelector('.card__progress-bar--explore');
  if (exploreProgressBar) {
    const explorePoints = card.explorePoints || 0;
    const pointsRequired = template.explorePointsRequired || 5;
    const progressPercent = (explorePoints / pointsRequired) * 100;
    exploreProgressBar.style.width = `${progressPercent}%`;
    console.log('[CenterPanel] Updated progress bar to:', progressPercent + '%');
  } else {
    console.log('[CenterPanel] Progress bar element not found');
  }

  // Update progress counter text
  const progressText = cardElement.querySelector('.card__progress-text');
  if (progressText) {
    const explorePoints = card.explorePoints || 0;
    const pointsRequired = template.explorePointsRequired || 5;
    progressText.textContent = `🗺️ ${explorePoints}/${pointsRequired}`;
  }

  // Update torch inventory count badges
  const inputSlots = cardElement.querySelectorAll('.card__input-count');
  inputSlots.forEach((countBadge, index) => {
    const input = template.inputs?.[index];
    if (input?.itemId) {
      const inventoryCount = InventoryManager.getItemCount(input.itemId);
      countBadge.textContent = inventoryCount;
    }
  });
}

/**
 * Update Combat card visual elements without re-rendering entire card
 * @param {string} cardId - ID of the combat card to update
 * @param {Object} heroHp - Hero HP {current, max}
 * @param {Object} heroEnergy - Hero Energy {current, max}
 * @param {Object} enemyHp - Enemy HP {current, max}
 * @param {number} heroProgress - Hero attack tick progress (ms)
 * @param {number} enemyProgress - Enemy attack tick progress (ms)
 * @param {number} heroAttackSpeed - Hero attack speed (ms)
 * @param {number} enemyAttackSpeed - Enemy attack speed (ms)
 */
function updateCombatCardProgress(cardId, heroHp, heroEnergy, enemyHp, heroProgress, enemyProgress, heroAttackSpeed = 3000, enemyAttackSpeed = 2500) {
  const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
  if (!cardElement) return;

  // Update Hero HP bar
  const heroHpFill = cardElement.querySelector('.combat-module--hero .progress-bar__fill');
  const heroHpText = cardElement.querySelector('.combat-module--hero .progress-bar__text');
  if (heroHpFill && heroHp) {
    const hpPercent = (heroHp.current / heroHp.max) * 100;
    heroHpFill.style.width = `${hpPercent}%`;
    if (heroHpText) heroHpText.textContent = `${heroHp.current}/${heroHp.max}`;
  }

  // Update Hero Energy bar (2nd progress bar in hero module)
  const heroProgressBars = cardElement.querySelectorAll('.combat-module--hero .progress-bar');
  if (heroProgressBars.length >= 2 && heroEnergy) {
    const energyBar = heroProgressBars[1];
    const energyFill = energyBar.querySelector('.progress-bar__fill');
    const energyText = energyBar.querySelector('.progress-bar__text');
    if (energyFill) {
      const energyPercent = (heroEnergy.current / heroEnergy.max) * 100;
      energyFill.style.width = `${energyPercent}%`;
    }
    if (energyText) energyText.textContent = `${heroEnergy.current}/${heroEnergy.max}`;
  }

  // Update Enemy HP bar
  const enemyHpFill = cardElement.querySelector('.combat-module--enemy .progress-bar__fill');
  const enemyHpText = cardElement.querySelector('.combat-module--enemy .progress-bar__text');
  if (enemyHpFill && enemyHp) {
    const hpPercent = (enemyHp.current / enemyHp.max) * 100;
    enemyHpFill.style.width = `${hpPercent}%`;
    if (enemyHpText) enemyHpText.textContent = `${enemyHp.current}/${enemyHp.max}`;
  }

  // Update Hero attack progress bar
  const heroAttackFill = cardElement.querySelector('.combat-module--hero .combat-module__attack-fill');
  if (heroAttackFill) {
    const progressPercent = (heroProgress / heroAttackSpeed) * 100;
    heroAttackFill.style.width = `${progressPercent}%`;
  }

  // Update Enemy attack progress bar
  const enemyAttackFill = cardElement.querySelector('.combat-module--enemy .combat-module__attack-fill');
  if (enemyAttackFill) {
    const progressPercent = Math.min(100, (enemyProgress / enemyAttackSpeed) * 100);
    enemyAttackFill.style.width = `${progressPercent}%`;
  }
}

/**
 * Update Area Project visual elements without re-rendering entire card
 * @param {string} cardId 
 * @param {Object} inputProgress 
 */
function updateAreaProjectProgress(cardId, inputProgress) {
  // Since we don't have easy selectors for specific progress bars in the current Renderer, 
  // triggering a single card re-render is the most robust way to ensure UI consistency.
  // This updates the "Current/Required" text and the progress bars.
  updateSingleCard(cardId);
}

/**
 * Show floating combat text for damage/miss
 * @param {string} cardId 
 * @param {string} attacker - 'hero' or 'enemy' (determines who dealt the damage)
 * @param {number} damage 
 * @param {boolean} hit 
 */
function showFloatingCombatText(cardId, attacker, damage, hit) {
  const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
  if (!cardElement) return;

  // If hero attacked, enemy takes damage -> show on enemy module
  // If enemy attacked, hero takes damage -> show on hero module
  const targetModuleSelector = attacker === 'hero' ? '.combat-module--enemy' : '.combat-module--hero';
  const targetModule = cardElement.querySelector(targetModuleSelector);

  if (!targetModule) return;

  // Create floating text element
  const textEl = document.createElement('span');
  textEl.className = 'combat-floating-text';

  if (hit) {
    textEl.textContent = `-${damage}`;
    textEl.classList.add('combat-floating-text--damage');
    // Critical hit styling could go here if we tracked crits
  } else {
    textEl.textContent = 'Miss';
    textEl.classList.add('combat-floating-text--miss');
  }

  // Position randomly slightly for variety
  const randomX = Math.floor(Math.random() * 40) - 20; // -20 to 20px
  const randomY = Math.floor(Math.random() * 20) - 10; // -10 to 10px
  textEl.style.setProperty('--offset-x', `${randomX}px`);
  textEl.style.setProperty('--offset-y', `${randomY}px`);

  // Append to target module (needs relative positioning)
  targetModule.appendChild(textEl);

  // Remove after animation completes (1s)
  setTimeout(() => {
    textEl.remove();
  }, 1000);
}

// Store event handlers to allow cleanup
let clickHandler = null;
let contextMenuHandler = null;
let changeHandler = null;

/**
 * Sets up event delegation for card stack interactions
 * Uses document-level capture to ensure we catch clicks before anything else
 */
export function setupEventDelegation() {
  console.log('[CenterPanel] Setting up event delegation on document');

  // Clean up existing handlers first
  cleanupEventDelegation();

  // Use document-level delegation with capture phase
  clickHandler = (e) => {
    // Handle hero removal from cards
    const heroRemoveBtn = e.target.closest('.card__hero-remove');
    if (heroRemoveBtn) {
      e.preventDefault();
      e.stopPropagation();

      const cardElement = heroRemoveBtn.closest('.card');
      if (cardElement) {
        const cardId = cardElement.dataset.cardId;
        if (cardId) {
          CardManager.unassignHero(cardId);
        }
      }
      return;
    }

    // Handle item removal from open slots
    const itemRemoveBtn = e.target.closest('.card__input-remove');
    if (itemRemoveBtn) {
      e.preventDefault();
      e.stopPropagation();

      const cardElement = itemRemoveBtn.closest('.card');
      const slotIndex = parseInt(itemRemoveBtn.dataset.slotIndex, 10);

      if (cardElement && !isNaN(slotIndex)) {
        const cardId = cardElement.dataset.cardId;
        if (cardId) {
          CardManager.unassignItemFromSlot(cardId, slotIndex);
          // Trigger UI refresh
          EventBus.publish('cards_updated');
        }
      }
      return;
    }

    // Handle explore area selection (old system - kept for backwards compatibility)
    const areaBtn = e.target.closest('[data-action="select-area"]');
    if (areaBtn) {
      e.preventDefault();
      e.stopPropagation();

      const cardId = areaBtn.dataset.cardId;
      const optionIndex = parseInt(areaBtn.dataset.optionIndex, 10);

      if (cardId && !isNaN(optionIndex)) {
        ExploreSystem.selectArea(cardId, optionIndex);
      }
      return;
    }

    // Handle biome dropdown selection (new system)
    const biomeDropdown = e.target.closest('[data-action="select-biome"]');
    if (biomeDropdown && e.type === 'change') {
      e.preventDefault();
      e.stopPropagation();

      const cardId = biomeDropdown.dataset.cardId;
      const biomeId = biomeDropdown.value;

      if (cardId && biomeId) {
        ExploreSystem.selectBiome(cardId, biomeId);
      }
      return;
    }

    // Handle card expand/collapse button
    const expandBtn = e.target.closest('[data-expand-card]');
    if (expandBtn) {
      e.preventDefault();
      e.stopPropagation();

      const cardId = expandBtn.dataset.expandCard;
      if (cardId) {
        import('../components/CardExpansionManager.js').then(module => {
          const cardStack = document.getElementById('card-stack');
          const expandedSection = cardStack.querySelector(`[data-expanded-section="${cardId}"]`);

          if (expandedSection) {
            const isHidden = expandedSection.style.display === 'none';
            expandedSection.style.display = isHidden ? 'block' : 'none';
            expandBtn.classList.toggle('card__expand-bar--expanded');

            const icon = expandBtn.querySelector('.card__expand-icon');
            if (icon) {
              icon.textContent = isHidden ? '▲' : '▼';
            }

            module.toggleCardExpansion(cardId, isHidden);
          }
        });
      }
      return;
    }

    // Handle Area Card "Claim Task" button
    const claimTaskBtn = e.target.closest('[data-action="claim-area-task"]');
    if (claimTaskBtn) {
      e.preventDefault();
      e.stopPropagation();

      const cardId = claimTaskBtn.dataset.cardId;
      if (cardId) {
        // Use AreaSystem directly
        AreaSystem.claimAreaTask(cardId);
      }
      return;
    }

    // Handle Explore Card "Discover [Biome]" button
    const discoverBtn = e.target.closest('[data-action="discover-biome"]');
    if (discoverBtn) {
      e.preventDefault();
      e.stopPropagation();

      const cardId = discoverBtn.dataset.cardId;
      if (cardId) {
        import('../../systems/cards/ExploreSystem.js').then(module => {
          module.default.discoverBiome(cardId);
        });
      }
      return;
    }

    // Handle Area Tasks button (drop table modal)
    const dropTableBtn = e.target.closest('[data-action="show-drop-table"]');
    if (dropTableBtn) {
      e.preventDefault();
      e.stopPropagation();

      const cardId = dropTableBtn.dataset.cardId;
      if (cardId) {
        const cardInstance = CardManager.getCard(cardId);
        if (cardInstance) {
          showDropTableModal(cardInstance);
        }
      }
      return;
    }



    // Handle recruit option selection
    const recruitOption = e.target.closest('.recruit-option');
    if (recruitOption) {
      e.preventDefault();
      e.stopPropagation();

      const cardElement = recruitOption.closest('.card');
      const optionIndex = parseInt(recruitOption.dataset.optionIndex, 10);

      if (cardElement && !isNaN(optionIndex)) {
        const cardId = cardElement.dataset.cardId;
        if (cardId) {
          RecruitSystem.selectOption(cardId, optionIndex);
        }
      }
      return;
    }

    // Handle recruit confirm button
    const recruitConfirmBtn = e.target.closest('.recruit-confirm');
    if (recruitConfirmBtn) {
      e.preventDefault();
      e.stopPropagation();

      const cardId = recruitConfirmBtn.dataset.cardId;
      if (cardId) {
        const result = RecruitSystem.confirmRecruit(cardId);
        if (!result.success) {
          console.error('[CenterPanel] Recruit failed:', result.error);
          // TODO: Show toast notification
        }
      }
      return;
    }

    // Handle craft button
    const craftBtn = e.target.closest('.panel__craft-btn');
    if (craftBtn) {
      e.preventDefault();
      e.stopPropagation();
      showCraftModal();
      return;
    }
  };
  document.addEventListener('click', clickHandler, true); // true = capture phase

  // Handle right-click for unassigning (Hero/Item slots)
  contextMenuHandler = (e) => {
    // 1. Handle Hero Slot
    const heroSlot = e.target.closest('.card__hero-slot--filled');
    if (heroSlot) {
      e.preventDefault();
      e.stopPropagation();

      const cardElement = heroSlot.closest('.card');
      if (cardElement) {
        const cardId = cardElement.dataset.cardId;
        if (cardId) {
          console.log(`[CenterPanel] Right-click unassign hero from card ${cardId}`);
          CardManager.unassignHero(cardId);
        }
      }
      return;
    }

    // 2. Handle Item Slot
    const itemSlot = e.target.closest('.card__input-slot[data-assigned-item]');
    if (itemSlot) {
      e.preventDefault();
      e.stopPropagation();

      const cardElement = itemSlot.closest('.card');
      const slotIndex = parseInt(itemSlot.dataset.slotIndex, 10);

      if (cardElement && !isNaN(slotIndex)) {
        const cardId = cardElement.dataset.cardId;
        if (cardId) {
          console.log(`[CenterPanel] Right-click unassign item from card ${cardId} slot ${slotIndex}`);
          CardManager.unassignItemFromSlot(cardId, slotIndex);
          EventBus.publish('cards_updated');
        }
      }
      return;
    }
  };
  document.addEventListener('contextmenu', contextMenuHandler, true);

  // Add change event listener for dropdowns (biome selection)
  changeHandler = (e) => {
    const biomeDropdown = e.target.closest('[data-action="select-biome"]');
    if (biomeDropdown) {
      e.preventDefault();
      e.stopPropagation();

      const cardId = biomeDropdown.dataset.cardId;
      const biomeId = biomeDropdown.value;

      if (cardId && biomeId) {
        ExploreSystem.selectBiome(cardId, biomeId);
      }
    }
  };
  document.addEventListener('change', changeHandler, true);
}

/**
 * Clean up event delegation handlers
 * Call this before setting up new handlers or on game reset
 */
export function cleanupEventDelegation() {
  if (clickHandler) {
    document.removeEventListener('click', clickHandler, true);
    clickHandler = null;
    console.log('[CenterPanel] Cleaned up click handler');
  }
  if (contextMenuHandler) {
    document.removeEventListener('contextmenu', contextMenuHandler, true);
    contextMenuHandler = null;
    console.log('[CenterPanel] Cleaned up contextmenu handler');
  }
  if (changeHandler) {
    document.removeEventListener('change', changeHandler, true);
    changeHandler = null;
    console.log('[CenterPanel] Cleaned up change handler');
  }
}

/**
 * Renders the center panel containing active cards
 * @param {Object} data - Panel data (optional, will use GameState if not provided)
 * @returns {HTMLElement}
 */
export function renderCenterPanel(data = {}) {
  const cards = data.cards || GameState.cards?.active || [];

  const panel = document.createElement('main');
  panel.className = 'panel panel--center';
  panel.id = 'panel-center';

  panel.innerHTML = `
    <header class="panel__header">
      <h2 class="panel__title">Card Stack</h2>
      <div class="panel__actions">
        <button class="panel__craft-btn" title="Craft Cards">
          📖
        </button>
        <span class="panel__count">${cards.length} active</span>
      </div>
    </header>
    <div class="panel__content card-stack" id="card-stack">
      ${cards.length === 0 ? renderEmptyState() : ''}
    </div>
  `;

  // Render card components if we have cards
  if (cards.length > 0) {
    const cardStack = panel.querySelector('#card-stack');
    cards.forEach(cardInstance => {
      const cardElement = renderCard(cardInstance);
      if (cardElement) {
        cardStack.appendChild(cardElement);
      }
    });
  }

  return panel;
}

/**
 * Renders the empty state for when there are no cards
 * @returns {string} HTML string
 */
function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🃏</div>
      <h3 class="empty-state__title">No Active Cards</h3>
      <p class="empty-state__description">Your card stack is empty. Cards will appear here as you receive them.</p>
    </div>
  `;
}

/**
 * Updates the card stack in the center panel using diff-based reconciliation
 * Only adds/removes cards that changed, preserving existing DOM elements
 * @param {Array} cards - Array of card objects (optional, uses GameState if not provided)
 */
export function updateCardStack(cards) {
  const cardStack = document.getElementById('card-stack');
  if (!cardStack) return;

  const cardInstances = cards || GameState.cards?.active || [];

  // Separate active cards from completed areas
  const activeCards = cardInstances.filter(card =>
    !(card.cardType === 'area' && card.status === 'completed')
  );
  const completedAreas = cardInstances.filter(card =>
    card.cardType === 'area' && card.status === 'completed'
  );

  // Use array order directly - addToStack() handles correct positioning
  // Priority order is: recruit > explore/area > tasks
  const sortedCards = activeCards;

  // Handle empty state
  if (sortedCards.length === 0 && completedAreas.length === 0) {
    // Check if empty state already displayed
    if (!cardStack.querySelector('.empty-state')) {
      cardStack.innerHTML = renderEmptyState();
    }
    updateCardCount(0);
    return;
  }

  // Remove empty state if it exists
  const emptyState = cardStack.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  // Reconcile cards using diff-based update
  reconcileCards(cardStack, sortedCards);

  // Handle completed areas section
  reconcileCompletedAreas(cardStack, completedAreas);

  // Update count
  updateCardCount(activeCards.length);
}

/**
 * Update a single card's display without affecting other cards
 * Used for targeted updates (e.g., status change) to preserve animations on other cards
 * @param {string} cardId - The card ID to update
 */
function updateSingleCard(cardId) {
  const cardStack = document.getElementById('card-stack');
  if (!cardStack) return;

  const cardElement = cardStack.querySelector(`[data-card-id="${cardId}"]`);
  if (!cardElement) return;

  const cardInstance = CardManager.getCard(cardId);
  if (!cardInstance) {
    // Card was removed, trigger full refresh
    updateCardStack();
    return;
  }

  // Replace only this specific card
  const newCardElement = renderCard(cardInstance);
  if (newCardElement) {
    cardElement.replaceWith(newCardElement);
  }
}

/**
 * Reconcile card DOM elements with desired card state
 * @param {HTMLElement} container - The card stack container
 * @param {Array} desiredCards - Cards that should be displayed (in order)
 */
function reconcileCards(container, desiredCards) {
  // Get current card IDs in DOM (excluding completed-areas section)
  const currentCardElements = container.querySelectorAll('.card[data-card-id]');
  const currentIds = new Set(
    Array.from(currentCardElements).map(el => el.dataset.cardId)
  );
  const desiredIds = new Set(desiredCards.map(c => c.id));

  // Remove cards that shouldn't be there anymore
  currentCardElements.forEach(el => {
    if (!desiredIds.has(el.dataset.cardId)) {
      el.remove();
    }
  });

  // Add or update cards
  let previousSibling = null;
  desiredCards.forEach((cardInstance, index) => {
    let cardElement = container.querySelector(`[data-card-id="${cardInstance.id}"]`);

    if (!cardElement) {
      // Card doesn't exist, create it
      cardElement = renderCard(cardInstance);
      if (!cardElement) return;

      // Insert at correct position
      if (previousSibling) {
        previousSibling.after(cardElement);
      } else {
        // Insert at beginning
        const firstChild = container.firstChild;
        if (firstChild) {
          container.insertBefore(cardElement, firstChild);
        } else {
          container.appendChild(cardElement);
        }
      }
    } else {
      // Card exists - replace with fresh render to update body content
      // This ensures hero slots and input items are always current
      const newCardElement = renderCard(cardInstance);
      if (newCardElement) {
        cardElement.replaceWith(newCardElement);
        cardElement = newCardElement;
      }
    }

    previousSibling = cardElement;
  });
}

/**
 * Reconcile completed areas section
 * @param {HTMLElement} container - The card stack container
 * @param {Array} completedAreas - Completed area cards
 */
function reconcileCompletedAreas(container, completedAreas) {
  let completedSection = container.querySelector('.completed-areas');

  if (completedAreas.length === 0) {
    // Remove section if no completed areas
    if (completedSection) {
      completedSection.remove();
    }
    return;
  }

  // Create or update completed areas section
  if (!completedSection) {
    completedSection = document.createElement('div');
    completedSection.className = 'completed-areas';
    container.appendChild(completedSection);
  }

  // Update content (this section is small enough to re-render)
  completedSection.innerHTML = renderCompletedAreasSection(completedAreas);

  // Move to end if not already there
  if (completedSection !== container.lastChild) {
    container.appendChild(completedSection);
  }

  // Re-setup toggle handler
  const toggle = completedSection.querySelector('.completed-areas__toggle');
  if (toggle && !toggle.dataset.bound) {
    toggle.addEventListener('click', () => {
      completedSection.classList.toggle('completed-areas--collapsed');
    });
    toggle.dataset.bound = 'true';
  }
}

/**
 * Update the card count display
 * @param {number} count - Number of active cards
 */
function updateCardCount(count) {
  const countEl = document.querySelector('#panel-center .panel__count');
  if (countEl) {
    countEl.textContent = `${count} active`;
  }
}

/**
 * Renders the completed areas collapsible section
 * @param {Array} completedAreas - Array of completed area card objects
 * @returns {string} HTML string
 */
function renderCompletedAreasSection(completedAreas) {
  const areaItems = completedAreas.map(area => {
    const project = area.selectedProject;
    return `
      <div class="completed-area">
        <span class="completed-area__icon">${area.icon || '🗺️'}</span>
        <div class="completed-area__info">
          <span class="completed-area__name">${area.name || 'Unknown Area'}</span>
          <span class="completed-area__project">${project?.icon || '🏗️'} ${project?.name || 'Unknown'}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="completed-areas__header">
      <button class="completed-areas__toggle">
        <span class="completed-areas__chevron">▼</span>
        Completed Areas (${completedAreas.length})
      </button>
    </div>
    <div class="completed-areas__list">
      ${areaItems}
    </div>
  `;
}

/**
 * Update only the progress bar for smooth animation (no full re-render)
 * @param {Object} card - The card instance with progress data
 */
function updateProgressBarOnly(card) {
  const cardElement = document.querySelector(`.card[data-card-id="${card.id}"]`);
  if (!cardElement) return;

  const progressBar = cardElement.querySelector('.card__progress-bar');
  if (!progressBar) return;

  // Get template for tick time calculation
  const template = getCard(card.templateId);
  if (!template) return;

  // Calculate effective tick time (same as TaskCardRenderer)
  const cardTickTime = card.baseTickTime || template.baseTickTime || 10000;
  const durationSec = cardTickTime / 1000;
  const progressPercent = durationSec > 0
    ? Math.min(100, ((card.progress || 0) / durationSec) * 100)
    : 0;

  // Check if this is a reset (progress went from high to low)
  const currentWidth = parseFloat(progressBar.style.width) || 0;
  const isReset = currentWidth > 80 && progressPercent < 20;

  if (isReset) {
    // Disable transition for instant reset
    progressBar.style.transition = 'none';
    progressBar.style.width = `${progressPercent}%`;
    // Re-enable transition after a frame
    requestAnimationFrame(() => {
      progressBar.style.transition = '';
    });
  } else {
    // Normal smooth update
    progressBar.style.width = `${progressPercent}%`;
  }
}

/**
 * Refresh a single card's display (for progress updates)
 * @param {string} cardId - The card ID to refresh
 */
export function refreshCard(cardId) {
  updateCardDisplay(cardId);
}

// ========================================
// Event Subscription Management
// ========================================

/** Track initialization state and unsubscribe handlers */
let isEventSubscribed = false;
let unsubscribeHandlers = [];

/**
 * Initialize EventBus subscriptions for CenterPanel
 * Call this once when game starts. Safe to call multiple times.
 */
export function initEventSubscriptions() {
  // Prevent duplicate subscriptions
  if (isEventSubscribed) {
    console.log('[CenterPanel] Event subscriptions already active');
    return;
  }

  console.log('[CenterPanel] Initializing event subscriptions');

  // Subscribe and store unsubscribe handlers
  unsubscribeHandlers = [
    EventBus.subscribe('cards_updated', ({ cardId }) => {
      if (cardId) {
        // Only update the specific card that changed (preserves other card animations)
        updateSingleCard(cardId);
      } else {
        // Full refresh (for add/remove operations)
        updateCardStack();
      }
    }),

    EventBus.subscribe('cards_progress_updated', ({ source, cardId }) => {
      // For Explore cards, update specific DOM elements without re-rendering
      if (source === 'ExploreSystem' && cardId) {
        updateExploreCardProgress(cardId);
      }
    }),

    EventBus.subscribe('combat_tick', ({ cardId, heroHp, heroEnergy, enemyHp, heroProgress, enemyProgress, heroAttackSpeed, enemyAttackSpeed }) => {
      // Update combat card progress bars without full re-render
      updateCombatCardProgress(cardId, heroHp, heroEnergy, enemyHp, heroProgress, enemyProgress, heroAttackSpeed, enemyAttackSpeed);
    }),

    EventBus.subscribe('area_combat_tick', ({ cardId, heroHp, heroEnergy, enemyHp, heroProgress, enemyProgress, heroAttackSpeed, enemyAttackSpeed }) => {
      updateCombatCardProgress(cardId, heroHp, heroEnergy, enemyHp, heroProgress, enemyProgress, heroAttackSpeed, enemyAttackSpeed);
    }),

    EventBus.subscribe('project_progress', ({ cardId, inputProgress }) => {
      updateAreaProjectProgress(cardId, inputProgress);
    }),

    EventBus.subscribe('quest_progress', ({ cardId, inputProgress }) => {
      updateAreaProjectProgress(cardId, inputProgress);
    }),

    EventBus.subscribe('combat_hero_attack', ({ cardId, damage, hit }) => {
      showFloatingCombatText(cardId, 'hero', damage, hit);
    }),

    EventBus.subscribe('combat_enemy_attack', ({ cardId, damage, hit }) => {
      showFloatingCombatText(cardId, 'enemy', damage, hit);
    }),

    EventBus.subscribe('combat_xp_gained', ({ cardId, amount }) => {
      showFloatingXpText(cardId, amount);
    }),

    EventBus.subscribe('card_spawned', () => {
      updateCardStack();
    }),

    EventBus.subscribe('card_discarded', () => {
      updateCardStack();
    }),

    EventBus.subscribe('hero_assigned_to_card', () => {
      updateCardStack();
    }),

    EventBus.subscribe('hero_unassigned_from_card', () => {
      updateCardStack();
    })
  ];

  isEventSubscribed = true;
}

/**
 * Show floating XP text on hero portrait
 * @param {string} cardId 
 * @param {number} amount 
 */
function showFloatingXpText(cardId, amount) {
  const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
  if (!cardElement) return;

  // Show on hero module
  const targetModule = cardElement.querySelector('.combat-module--hero');
  if (!targetModule) return;

  // Create floating text element
  const textEl = document.createElement('span');
  textEl.className = 'combat-floating-text';
  textEl.classList.add('combat-floating-text--xp');
  textEl.textContent = `+${amount} XP`;

  // Position randomly slightly
  const randomX = Math.floor(Math.random() * 40) - 20;
  const randomY = Math.floor(Math.random() * 10) - 20; // Float higher
  textEl.style.setProperty('--offset-x', `${randomX}px`);
  textEl.style.setProperty('--offset-y', `${randomY}px`);

  // Append to target module
  targetModule.appendChild(textEl);

  // Remove after animation completes
  setTimeout(() => {
    textEl.remove();
  }, 1000);
}

/**
 * Cleanup EventBus subscriptions
 * Call this before game reset or when cleaning up the UI
 */
export function cleanupEventSubscriptions() {
  if (!isEventSubscribed) return;

  console.log('[CenterPanel] Cleaning up event subscriptions');

  // Call each unsubscribe handler
  unsubscribeHandlers.forEach(unsubscribe => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  });

  unsubscribeHandlers = [];
  isEventSubscribed = false;
}

