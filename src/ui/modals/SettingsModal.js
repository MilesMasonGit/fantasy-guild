// Fantasy Guild - Settings Modal
// Phase 22: Settings UI

import { renderModal, bindModal, showModal } from '../components/ModalComponent.js';
import { SettingsManager } from '../../systems/core/SettingsManager.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { TimeManager } from '../../systems/core/TimeManager.js';
import { GameState } from '../../state/GameState.js';
import * as SkillSystem from '../../systems/hero/SkillSystem.js';
import { SaveManager } from '../../systems/core/SaveManager.js';
import * as NotificationSystem from '../../systems/core/NotificationSystem.js';

let modalInstance = null;
let currentTab = 'notifications';

/**
 * Show the Settings modal
 */
export function showSettingsModal() {
    if (modalInstance) {
        modalInstance.remove();
        modalInstance = null;
    }

    const content = renderSettingsContent();

    modalInstance = renderModal(content, {
        title: 'Settings',
        className: 'modal--settings',
        width: '600px'
    });

    bindModal(modalInstance, {
        onClose: () => {
            modalInstance.remove();
            modalInstance = null;
        }
    });

    setupSettingsEventDelegation(modalInstance);
    // Initialize active tab
    switchTab(modalInstance, currentTab);

    showModal(modalInstance);
}

/**
 * Render the full content of the settings modal
 */
function renderSettingsContent() {
    return `
        <div class="settings-container">
            <div class="settings-tabs">
                <button class="settings-tab" data-tab="notifications">Notifications</button>
                <button class="settings-tab" data-tab="gameplay">Gameplay & UI</button>
                <button class="settings-tab" data-tab="audio">Audio</button>
                <button class="settings-tab" data-tab="dev">Dev Tools</button>
            </div>
            
            <div class="settings-content">
                ${renderNotificationsTab()}
                ${renderGameplayTab()}
                ${renderAudioTab()}
                ${renderDevTab()}
            </div>
            
            <div class="settings-footer">
                <button class="btn btn--secondary" id="btn-settings-reset">Reset to Default</button>
                <button class="btn btn--primary" id="btn-settings-close">Done</button>
            </div>
        </div>
    `;
}

/**
 * Switch active tab
 */
function switchTab(modal, tabId) {
    currentTab = tabId;

    // Update tab buttons
    const tabs = modal.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
        tab.classList.toggle('settings-tab--active', tab.dataset.tab === tabId);
    });

    // Update tab panels
    const panels = modal.querySelectorAll('.settings-panel');
    panels.forEach(panel => {
        panel.classList.toggle('settings-panel--active', panel.id === `tab-${tabId}`);
    });
}

/**
 * Set up event delegation for Settings
 */
function setupSettingsEventDelegation(modal) {
    // Tab switching
    modal.querySelector('.settings-tabs').addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.settings-tab');
        if (tabBtn) {
            switchTab(modal, tabBtn.dataset.tab);
        }
    });

    // Footer buttons
    modal.querySelector('#btn-settings-close').addEventListener('click', () => {
        modal.remove();
        modalInstance = null;
    });

    modal.querySelector('#btn-settings-reset').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all settings to their default values?')) {
            SettingsManager.reset();
            // Re-open the modal to easily re-render the whole DOM tree cleanly
            showSettingsModal();
        }
    });

    // Delegate change events for our toggles on the modal body
    modal.addEventListener('change', (e) => {
        const toggle = e.target.closest('.settings-toggle__input');
        if (toggle) {
            const settingPath = toggle.dataset.setting;
            SettingsManager.set(settingPath, toggle.checked);
        }
    });

    // Dev Tools Handlers
    modal.addEventListener('click', (e) => {
        const timeBtn = e.target.closest('[data-action="time"]');
        if (timeBtn) {
            const scale = parseInt(timeBtn.dataset.value, 10);
            TimeManager.setTimeScale(scale);
            NotificationSystem.info(`Time speed set to x${scale}`);
            return;
        }

        const levelBtn = e.target.closest('[data-action="level-heroes"]');
        if (levelBtn) {
            if (GameState.heroes) {
                let xpAdded = false;
                GameState.heroes.forEach(hero => {
                    if (hero.skills) {
                        for (const skillKey in hero.skills) {
                            SkillSystem.gainXP(hero.id, skillKey, 1000);
                            xpAdded = true;
                        }
                    }
                });
                if (xpAdded) {
                    NotificationSystem.success('+1000 XP to all heroes!');
                } else {
                    NotificationSystem.warning('No heroes available.');
                }
            }
            return;
        }

        const spawnBtn = e.target.closest('[data-action="spawn-item"]');
        if (spawnBtn) {
            import('./SpawnItemModal.js').then(module => {
                module.showSpawnItemModal();
            }).catch(e => {
                NotificationSystem.error('Spawn Item Modal not yet implemented.');
            });
            return;
        }

        const spawnRecruitBtn = e.target.closest('[data-action="spawn-recruit"]');
        if (spawnRecruitBtn) {
            import('../../systems/cards/RecruitSystem.js').then(module => {
                module.RecruitSystem.createRecruitCard(true); // true = free
                NotificationSystem.success('Recruit card spawned!');
            }).catch(e => {
                NotificationSystem.error('Failed to spawn recruit card: ' + e.message);
            });
            return;
        }

        const spawnVillagerBtn = e.target.closest('[data-action="spawn-villager-recruit"]');
        if (spawnVillagerBtn) {
            import('../../systems/cards/RecruitSystem.js').then(module => {
                module.RecruitSystem.createVillagerRecruitCard();
                NotificationSystem.success('Villager recruit card spawned!');
            }).catch(e => {
                NotificationSystem.error('Failed to spawn villager recruit card: ' + e.message);
            });
            return;
        }

        const spawnGoldBtn = e.target.closest('[data-action="spawn-gold"]');
        if (spawnGoldBtn) {
            import('../../systems/economy/CurrencyManager.js').then(module => {
                module.CurrencyManager.addCurrency('gold', 1000000, 'cheat');
                NotificationSystem.success('+1,000,000 Gold!');
            }).catch(e => {
                NotificationSystem.error('Failed to add gold: ' + e.message);
            });
            return;
        }

        const spawnAreaBtn = e.target.closest('[data-action="spawn-area-hub"]');
        if (spawnAreaBtn) {
            import('./SpawnAreaModal.js').then(module => {
                module.showSpawnAreaModal();
            }).catch(e => {
                NotificationSystem.error('Spawn Area Modal not yet implemented.');
            });
            return;
        }

        const togglePaletteBtn = e.target.closest('[data-action="toggle-palette-preview"]');
        if (togglePaletteBtn) {
            EventBus.publish('toggle-palette-preview');
            return;
        }

        const resetBtn = e.target.closest('[data-action="reset-game"]');
        if (resetBtn) {
            if (confirm('Are you sure you want to completely clear your save and restart? This cannot be undone.')) {
                SaveManager.reset();
            }
            return;
        }
    });
}

// === TABS RENDERING ===

function renderNotificationsTab() {
    return `
        <div class="settings-panel" id="tab-notifications">
            <h3 class="settings-panel__title">Notification Settings</h3>
            
            <div class="settings-group settings-group--master">
                ${renderToggle('Master Notifications', 'Enable or disable all toast notifications globaby', 'notifications.masterToggle')}
            </div>
            
            <div class="settings-group">
                <h4 class="settings-group__title">Event Types</h4>
                <div class="settings-list">
                    ${renderToggle('Hero Events', 'Recruiting, leveling, and retiring heroes', 'notifications.heroEvents')}
                    ${renderToggle('Inventory Events', 'Gaining items and full inventory warnings', 'notifications.inventoryEvents')}
                    ${renderToggle('Quest & Card Events', 'New cards spawned or quests completed', 'notifications.questEvents')}
                    ${renderToggle('Influence Events', 'Gaining influence globally', 'notifications.influenceEvents')}
                </div>
            </div>
        </div>
    `;
}

function renderGameplayTab() {
    return `
        <div class="settings-panel" id="tab-gameplay">
            <h3 class="settings-panel__title">Gameplay & UI</h3>
            <div class="settings-list">
                ${renderToggle('Tooltips Enabled', 'Show helpful information when hovering over elements', 'ui.tooltipsEnabled')}
                ${renderToggle('Retro Font', 'Use the pixel-art font instead of the modern font', 'ui.usePixelFont')}
                ${renderToggle('Compact Mode', 'Condense the UI to fit more information on screen (Coming Soon)', 'ui.compactMode')}
            </div>
        </div>
    `;
}

function renderAudioTab() {
    return `
        <div class="settings-panel" id="tab-audio">
            <h3 class="settings-panel__title">Audio Settings</h3>
            <p style="color: var(--color-text-muted); font-style: italic;">Audio systems are not yet implemented.</p>
        </div>
    `;
}

function renderDevTab() {
    return `
        <div class="settings-panel" id="tab-dev">
            <h3 class="settings-panel__title">Developer Tools</h3>
            
            <div class="settings-group">
                <h4 class="settings-group__title">Time Controls</h4>
                <div class="settings-dev-grid" style="grid-template-columns: repeat(4, 1fr);">
                    <button class="btn btn--secondary" data-action="time" data-value="1">x1</button>
                    <button class="btn btn--secondary" data-action="time" data-value="2">x2</button>
                    <button class="btn btn--secondary" data-action="time" data-value="10">x10</button>
                    <button class="btn btn--danger" data-action="time" data-value="100">x100</button>
                </div>
            </div>
            
            <div class="settings-group">
                <h4 class="settings-group__title">Hero & Item Actions</h4>
                <div class="settings-dev-grid">
                    <button class="btn btn--secondary" data-action="level-heroes">+1000 XP (All Heroes)</button>
                    <button class="btn btn--secondary" data-action="spawn-gold">+1,000,000 Gold</button>
                    <button class="btn btn--secondary" data-action="spawn-area-hub">Spawn Area Deck...</button>
                    <button class="btn btn--secondary" data-action="spawn-item">Spawn Item...</button>
                    <button class="btn btn--secondary" data-action="spawn-recruit">Spawn Hero Recruit Card</button>
                    <button class="btn btn--secondary" data-action="spawn-villager-recruit">Spawn Villager Recruit Card</button>
                </div>
            </div>
            
            <div class="settings-group">
                <h4 class="settings-group__title">System Actions</h4>
                <div class="settings-dev-grid">
                    <button class="btn btn--secondary" data-action="toggle-palette-preview">Show Palette Preview</button>
                    <button class="btn btn--danger" style="grid-column: 1 / -1" data-action="reset-game">Reset Game State</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render a standardized toggle UI component
 */
function renderToggle(label, description, settingPath) {
    const isChecked = SettingsManager.get(settingPath) !== false; // Default true

    return `
        <div class="settings-toggle">
            <div class="settings-toggle__info">
                <div class="settings-toggle__label">${label}</div>
                <div class="settings-toggle__description">${description}</div>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" class="settings-toggle__input" data-setting="${settingPath}" ${isChecked ? 'checked' : ''}>
                <span class="toggle-switch__slider"></span>
            </label>
        </div>
    `;
}
