// Fantasy Guild - Hero Card Component
// Phase 9: Hero UI + Equipment System

import { getClass, getTrait, getSkill, SKILL_CATEGORIES, classHasSkill, traitHasSkill } from '../../config/registries/index.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { calculateHeroLevel } from '../../systems/hero/HeroGenerator.js';
import { renderHpBar, renderEnergyBar } from './ProgressBarComponent.js';
import { getXpProgress } from '../../utils/XPCurve.js';
import { previewRetirementInfluence } from '../../utils/RetirementFormula.js';
import { calculateRecruitCost } from '../../utils/RecruitCostCalculator.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { SLOT_INFO } from '../../systems/equipment/EquipmentManager.js';
import * as CardManager from '../../systems/cards/CardManager.js';
import { renderSkillGrid } from './SkillGridComponent.js';
import { renderEquipmentGrid } from './EquipmentGridComponent.js';
import { renderIcon } from '../../utils/AssetManager.js';

/**
 * HeroCardComponent - Renders a hero card for the left panel
 * 
 * Displays:
 * - Hero name, class, trait
 * - HP and Energy bars
 * - Status badge
 * - Expandable section with: Equipment → Skills → Retire
 */

// Track which heroes have expanded sections (persists across re-renders)
export const expandedHeroes = new Set();

/**
 * Toggle hero expansion state
 * @param {string} heroId 
 * @param {boolean} isHidden 
 */
export function toggleHeroExpansion(heroId, isHidden) {
  if (isHidden) {
    expandedHeroes.add(heroId);
  } else {
    expandedHeroes.delete(heroId);
  }
}

/**
 * Render a hero card
 * @param {Object} hero - Hero object from GameState
 * @returns {string} HTML string
 */
export function renderHeroCard(hero) {
  const heroClass = getClass(hero.classId);
  const heroTrait = getTrait(hero.traitId);
  const heroLevel = calculateHeroLevel(hero.skills);

  // Get status info with new 4-state logic
  const statusInfo = getStatusInfo(hero);

  const portraitHtml = renderIcon(hero, 'hero-card__portrait-img', { size: 64 });

  return `
      <div class="hero-card" data-hero-id="${hero.id}" data-draggable="hero" data-drop-zone="hero-equip" draggable="true">
        <div class="hero-card__top">
          <div class="hero-card__portrait" data-edit-hero="${hero.id}" title="Click to customize">
            ${portraitHtml}
          </div>
          <div class="hero-card__info">
          <div class="hero-card__header">
            <span class="hero-card__name">${hero.name}</span>
          </div>
          <div class="hero-card__archetype">
            <span class="hero-card__level">Lv.${heroLevel}</span>
            ${heroTrait?.name || hero.traitId} ${heroClass?.name || hero.classId}
          </div>
        </div>
      </div>
      
      <div class="hero-card__status-line">
        <span class="hero-card__status-dot hero-card__status-dot--${statusInfo.colorClass}"></span>
        <span class="hero-card__status-text">${statusInfo.text}</span>
        ${hero.assignedCardId ? `<button class="hero-card__unassign-btn" data-unassign-hero="${hero.id}" title="Unassign from task">✕</button>` : ''}
      </div>
      
      <div class="hero-card__stats">
        ${renderHpBar(hero.hp.current, hero.hp.max)}
        ${renderEnergyBar(hero.energy.current, hero.energy.max)}
      </div>
      
      <!-- Expanded Section (before toggle bar so bar is always at bottom) -->
      <div class="hero-card__expanded" data-expanded-section="${hero.id}" style="display: ${expandedHeroes.has(hero.id) ? 'block' : 'none'};">
        <!-- Equipment Grid -->
        <div class="hero-card__section-label">Equipment</div>
        ${renderEquipmentGrid(hero)}
        
        <!-- Skills Grid -->
        <div class="hero-card__section-label">Skills</div>
        <div class="hero-card__skills">
          ${renderSkillGrid(hero)}
        </div>
        
        <!-- Retire Button -->
        ${renderRetireButton(hero)}
      </div>
      
      <!-- Expand/Collapse Toggle (always at bottom) -->
      <div class="hero-card__expand-bar${expandedHeroes.has(hero.id) ? ' hero-card__expand-bar--expanded' : ''}" data-expand-hero="${hero.id}" title="Click to expand">
        <span class="hero-card__expand-icon">${expandedHeroes.has(hero.id) ? '▲' : '▼'}</span>
      </div>
    </div>
  `;
}

// Equipment Grid rendering moved to EquipmentGridComponent.js

/**
 * Renders the Retire button or locked message
 * @param {Object} hero - Hero object
 * @returns {string} HTML string
 */
function renderRetireButton(hero) {
  const payout = previewRetirementInfluence(hero);
  const recruitCost = calculateRecruitCost();
  const isLocked = payout <= recruitCost;

  if (isLocked) {
    return `
      <div class="hero-card__actions">
        <span class="retire-locked" title="Payout (${payout}) must exceed recruit cost (${recruitCost})">
          🔒 Level up to retire
        </span>
      </div>
    `;
  }

  return `
    <div class="hero-card__actions">
      <button class="btn btn--retire" data-action="retire" data-hero-id="${hero.id}">
        Retire (+👑 ${payout} Influence)
      </button>
    </div>
  `;
}

/**
 * Get status info for hero (color class and text)
 * 4 states:
 * - idle (blue): Not assigned to any task
 * - working (green): Actively working on a task
 * - working-idle (yellow): Assigned but task not progressing (e.g., out of resources)
 * - wounded (red): HP is critical
 * @param {Object} hero 
 * @returns {{ colorClass: string, text: string }}
 */
function getStatusInfo(hero) {
  // Check for wounded first (HP below 25%)
  if (hero.hp.current < hero.hp.max * 0.25) {
    return { colorClass: 'wounded', text: 'Wounded' };
  }

  // If not assigned to a card, hero is idle
  if (!hero.assignedCardId) {
    return { colorClass: 'idle', text: 'Idle' };
  }

  // Hero is assigned to a card - check card status
  const card = CardManager.getCard(hero.assignedCardId);
  if (!card) {
    return { colorClass: 'idle', text: 'Idle' };
  }

  const taskName = card.name || 'Task';

  // If card status is 'active', hero is working
  if (card.status === 'active') {
    return { colorClass: 'working', text: taskName };
  }

  // Hero is assigned but card is not active (paused, waiting for resources, etc.)
  return { colorClass: 'working-idle', text: `Idle - ${taskName}` };
}

// Skill Grid rendering moved to SkillGridComponent.js

/**
 * Render multiple hero cards
 * @param {Array} heroes - Array of hero objects
 * @returns {string} HTML string
 */
export function renderHeroList(heroes) {
  if (!heroes || heroes.length === 0) {
    return `
      <div class="empty-state">
        <span class="empty-state__icon">👥</span>
        <span class="empty-state__text">No heroes yet</span>
        <span class="empty-state__hint">Complete a Recruit card to add heroes</span>
      </div>
    `;
  }

  return `
    <div class="hero-list">
      ${heroes.map(hero => renderHeroCard(hero)).join('')}
    </div>
  `;
}

/**
 * Initialize hero card event handlers
 * DEPRECATED: Events are now handled via delegation in LeftPanel.js
 */
export function initHeroCardEvents() {
  // Logic moved to LeftPanel.js setupLeftPanelEventDelegation
}

/**
 * Opens a modal to customize hero name and icon
 * @param {string} heroId 
 */
export function openHeroCustomizationModal(heroId) {
  Promise.all([
    import('../../systems/hero/HeroManager.js'),
    import('../../systems/hero/HeroGenerator.js'),
    import('./ModalComponent.js'),
    import('../../systems/core/EventBus.js')
  ]).then(([HeroManager, HeroGenerator, ModalComponent, EventBusModule]) => {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return;

    const HERO_ICONS = HeroGenerator.HERO_ICONS;
    const iconGrid = HERO_ICONS.map(icon => {
      const iconHtml = renderIcon({ icon }, 'icon-option__img', { size: 32 });
      return `<div class="icon-option${icon === hero.icon ? ' icon-option--selected' : ''}" data-icon="${icon}">${iconHtml}</div>`;
    }).join('');

    const content = `
      <div class="hero-customize">
        <div class="hero-customize__field">
          <label>Name</label>
          <input type="text" class="hero-customize__name" value="${hero.name}" maxlength="20" />
        </div>
        <div class="hero-customize__field">
          <label>Icon</label>
          <div class="hero-customize__icons">${iconGrid}</div>
        </div>
        <div class="hero-customize__actions">
          <button class="btn btn--primary" id="btn-save-hero">Save</button>
        </div>
      </div>
    `;

    const modal = ModalComponent.renderModal(content, { title: `Customize ${hero.name}` });
    ModalComponent.bindModal(modal, { onClose: () => modal.remove() });
    ModalComponent.showModal(modal);

    // Handle icon selection
    let selectedIcon = hero.icon || '👤';
    modal.querySelectorAll('.icon-option').forEach(opt => {
      opt.addEventListener('click', () => {
        modal.querySelectorAll('.icon-option').forEach(o => o.classList.remove('icon-option--selected'));
        opt.classList.add('icon-option--selected');
        selectedIcon = opt.dataset.icon;
      });
    });

    // Handle save
    modal.querySelector('#btn-save-hero').addEventListener('click', () => {
      const nameInput = modal.querySelector('.hero-customize__name');
      const newName = nameInput.value.trim();

      HeroManager.updateHeroProfile(heroId, {
        name: newName || hero.name,
        icon: selectedIcon
      });

      modal.remove();
    });
  });
}
