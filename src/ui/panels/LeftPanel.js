// Fantasy Guild - Left Panel (Hero Roster)
// Phase 9: Hero UI

import { renderHeroList, initHeroCardEvents, toggleHeroExpansion, openHeroCustomizationModal } from '../components/HeroCardComponent.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as NotificationSystem from '../../systems/core/NotificationSystem.js';
import { LIMITS } from '../../config/uiConstants.js';

/**
 * Renders the left panel containing the hero roster
 * @param {Object} data - Panel data
 * @param {Array} data.heroes - Array of hero objects
 * @returns {HTMLElement}
 */
export function renderLeftPanel(data = {}) {
  const { heroes = [] } = data;

  const panel = document.createElement('aside');
  panel.className = 'panel panel--left';
  panel.id = 'panel-left';

  panel.innerHTML = `
    <header class="panel__header">
      <h2 class="panel__title">Hero Roster</h2>
      <div class="panel__actions">
        <span class="panel__count">${heroes.length} / ${LIMITS.MAX_HERO_ROSTER}</span>
      </div>
    </header>
    <div class="panel__content" id="hero-list">
      ${renderHeroList(heroes)}
    </div>
  `;

  return panel;
}

/**
 * Updates the hero list in the left panel
 * Preserves scroll position to avoid jarring jumps
 * @param {Array} heroes - Array of hero objects
 */
export function updateHeroList(heroes) {
  const heroList = document.getElementById('hero-list');
  if (!heroList) return;

  // Save current scroll position
  const scrollTop = heroList.scrollTop;

  // Update content
  heroList.innerHTML = renderHeroList(heroes);

  // Initialize hero card event handlers
  initHeroCardEvents();

  // Restore scroll position
  heroList.scrollTop = scrollTop;

  // Update count
  const countEl = document.querySelector('.panel__count');
  if (countEl) {
    countEl.textContent = `${heroes.length} / ${LIMITS.MAX_HERO_ROSTER}`;
  }
}

/**
 * Set up event delegation for the left panel
 */
export function setupLeftPanelEventDelegation() {
  const panel = document.getElementById('panel-left');
  if (!panel) return;

  // --- Click Handler (Retire, Expand, Customize) ---
  panel.addEventListener('click', (e) => {
    // 1. Handle Retire button
    const retireBtn = e.target.closest('[data-action="retire"]');
    if (retireBtn) {
      e.preventDefault();
      e.stopPropagation();

      const heroId = retireBtn.dataset.heroId;
      if (heroId) {
        showRetireConfirmationModal(heroId);
      }
      return;
    }

    // 2. Handle Unassign from status line
    const unassignBtn = e.target.closest('.hero-card__unassign-btn[data-unassign-hero]');
    if (unassignBtn) {
      const heroId = unassignBtn.dataset.unassignHero;
      if (heroId) {
        // Import dynamically to avoid circular dependency
        Promise.all([
          import('../../systems/hero/HeroManager.js'),
          import('../../systems/cards/CardManager.js')
        ]).then(([HeroManager, CardManager]) => {
          const hero = HeroManager.getHero(heroId);
          if (hero && hero.assignedCardId) {
            CardManager.unassignHero(hero.assignedCardId);
          }
        });
      }
      return;
    }

    // 2. Handle Expand/Collapse
    const expandBar = e.target.closest('.hero-card__expand-bar');
    if (expandBar) {
      const heroId = expandBar.dataset.expandHero;
      const expandedSection = document.querySelector(`[data-expanded-section="${heroId}"]`);
      const icon = expandBar.querySelector('.hero-card__expand-icon');

      if (expandedSection) {
        const isHidden = expandedSection.style.display === 'none';
        expandedSection.style.display = isHidden ? 'block' : 'none';
        icon.textContent = isHidden ? '▲' : '▼';
        expandBar.closest('.hero-card').classList.toggle('hero-card--expanded', isHidden);

        // Update persistent state
        toggleHeroExpansion(heroId, isHidden);
      }
      return;
    }

    // 3. Handle Customize (Portrait Click)
    const portrait = e.target.closest('.hero-card__portrait[data-edit-hero]');
    if (portrait) {
      e.stopPropagation();
      const heroId = portrait.dataset.editHero;
      openHeroCustomizationModal(heroId);
      return;
    }
  });

  // --- Context Menu Handler (Unequip) ---
  panel.addEventListener('contextmenu', (e) => {
    const slot = e.target.closest('.hero-equipment__slot--filled');
    if (slot) {
      e.preventDefault();
      const heroId = slot.dataset.heroId;
      const slotType = slot.dataset.equipmentSlot;

      // Import dynamically to avoid circular dependency
      import('../../systems/equipment/EquipmentManager.js').then(({ unequipItem }) => {
        unequipItem(heroId, slotType);
        // Trigger UI refresh
        import('../../systems/core/EventBus.js').then(({ EventBus }) => {
          EventBus.publish('heroes_updated', { source: 'unequip_contextmenu' });
        });
      });
    }
  });
}

/**
 * Show confirmation modal before retiring a hero
 * @param {string} heroId - Hero to retire
 */
function showRetireConfirmationModal(heroId) {
  const hero = HeroManager.getHero(heroId);
  if (!hero) return;

  // Dynamically import modal and calculate values
  Promise.all([
    import('../components/ModalComponent.js'),
    import('../../utils/RetirementFormula.js'),
    import('../../systems/hero/HeroGenerator.js')
  ]).then(([ModalModule, RetirementFormula, HeroGenerator]) => {
    const { renderModal, bindModal, showModal } = ModalModule;
    const { previewRetirementInfluence } = RetirementFormula;
    const { calculateHeroLevel } = HeroGenerator;

    const influenceReward = previewRetirementInfluence(hero);
    const heroLevel = calculateHeroLevel(hero.skills);

    const content = `
      <div class="retire-confirmation">
        <div class="retire-confirmation__hero">
          <span class="retire-confirmation__icon">${hero.icon || '👤'}</span>
          <div class="retire-confirmation__info">
            <div class="retire-confirmation__name">${hero.name}</div>
            <div class="retire-confirmation__details">Level ${heroLevel} ${hero.traitName} ${hero.className}</div>
          </div>
        </div>
        
        <div class="retire-confirmation__reward">
          <div class="retire-confirmation__reward-label">Retirement Reward</div>
          <div class="retire-confirmation__reward-amount">+👑 ${influenceReward} Influence</div>
        </div>
        
        <div class="retire-confirmation__warning">
          ⚠️ This action cannot be undone
        </div>
        
        <div class="retire-confirmation__actions">
          <button class="btn btn--secondary" id="btn-cancel-retire">Cancel</button>
          <button class="btn btn--danger" id="btn-confirm-retire">Retire Hero</button>
        </div>
      </div>
    `;

    const modal = renderModal(content, {
      title: 'Retire Hero?',
      className: 'modal--retire-confirmation'
    });

    // Bind cancel and close handlers
    bindModal(modal, {
      onClose: () => modal.remove()
    });

    // Cancel button
    modal.querySelector('#btn-cancel-retire').addEventListener('click', () => {
      modal.remove();
    });

    // Confirm button
    modal.querySelector('#btn-confirm-retire').addEventListener('click', () => {
      const result = HeroManager.retireHero(heroId);
      if (result.success) {
        NotificationSystem.success(`${hero.name} retired! +👑 ${result.influenceReward} Influence`);
      } else {
        NotificationSystem.error('Failed to retire hero');
      }
      modal.remove();
    });

    showModal(modal);
  });
}

