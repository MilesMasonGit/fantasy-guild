// Fantasy Guild - TopBar Component
// Phase 2: Panel Layout

import { GameState } from '../../state/GameState.js';

/**
 * Renders the top navigation bar
 * @param {Object} data - TopBar data
 * @param {string} data.title - Game title
 * @param {string} data.subtitle - Optional subtitle (e.g., save slot name)
 * @returns {HTMLElement}
 */
export function renderTopBar(data = {}) {
  const {
    title = 'Fantasy Guild',
    subtitle = '',
    influence = GameState.currency?.influence ?? 10  // Fallback to StateSchema default
  } = data;

  const topbar = document.createElement('header');
  topbar.className = 'topbar';
  topbar.innerHTML = `
    <div class="topbar__left">
      <h1 class="topbar__title">${title}</h1>
      ${subtitle ? `<span class="topbar__subtitle">${subtitle}</span>` : ''}
    </div>
    <div class="topbar__center">
      <span class="topbar__currency" id="influence-display">
        👑 <span id="influence-amount">${influence}</span> Influence
      </span>
    </div>
    <div class="topbar__right">
      <button class="btn btn--ghost btn--icon" id="btn-settings" title="Settings">
        ⚙️
      </button>
      <button class="btn btn--secondary btn--small" id="btn-save" title="Save Game">
        💾 Save
      </button>
      <button class="btn btn--ghost btn--small" id="btn-reset" title="Reset Game (Debug)">
        Start Over
      </button>
    </div>
  `;

  return topbar;
}

/**
 * Updates the Influence display in TopBar
 * @param {number} amount - New Influence amount
 */
export function updateInfluenceDisplay(amount) {
  const el = document.getElementById('influence-amount');
  if (el) {
    el.textContent = amount;
  }
}

/**
 * Binds event listeners to the TopBar
 * @param {HTMLElement} element - The TopBar element
 * @param {Object} handlers - Event handlers
 */
export function bindTopBar(element, handlers = {}) {
  const { onSettings, onSave } = handlers;

  if (onSettings) {
    const settingsBtn = element.querySelector('#btn-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', onSettings);
    }
  }

  if (onSave) {
    const saveBtn = element.querySelector('#btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', onSave);
    }
  }

  if (handlers.onReset) {
    const resetBtn = element.querySelector('#btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        handlers.onReset();
      });
    }
  }
}
