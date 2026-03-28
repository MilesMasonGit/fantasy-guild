// Fantasy Guild - Save Manager
// Phase 21: Save System

import { GameState } from '../../state/GameState.js';
import { EventBus } from './EventBus.js';
import { SettingsManager } from './SettingsManager.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from './NotificationSystem.js';
import { INITIAL_STATE, GAME_VERSION } from '../../state/StateSchema.js';

const SLOT_KEY_PREFIX = 'fantasy_guild_slot_';
const LAST_SLOT_KEY = 'fantasy_guild_last_slot';
const MAX_SLOTS = 3;
let AUTO_SAVE_INTERVAL = 60000; // Default 1 minute

/**
 * SaveManager - Handles multi-slot persistence of game state
 */
export const SaveManager = {
    autoSaveTimer: null,
    isResetting: false,
    currentSlot: null, // Track which slot is active (0, 1, or 2)
    _beforeUnloadBound: false, // Track if beforeunload listener is registered
    _settingsUnsubscribe: null,

    /**
     * Get localStorage key for a slot
     * @param {number} slotIndex 
     * @returns {string}
     */
    getSlotKey(slotIndex) {
        return `${SLOT_KEY_PREFIX}${slotIndex} `;
    },

    /**
     * Initialize the Save Manager
     * @returns {boolean} True if a save was loaded
     */
    init() {
        logger.info('SaveManager', 'Initializing...');

        // 1. Sync with SettingsManager
        this.syncSettings();
        this._settingsUnsubscribe = EventBus.subscribe('settings_updated', () => this.syncSettings());


        // 3. Check for reset signal from previous session
        if (sessionStorage.getItem('resetting')) {
            logger.info('SaveManager', 'Reset detected from session tag.');
            sessionStorage.removeItem('resetting');
            this.currentSlot = null;
            return false;
        }

        // Don't auto-load - let the UI show slot selection
        return false;
    },

    /**
     * Synchronize auto-save settings from SettingsManager
     */
    syncSettings() {
        const intervalMins = SettingsManager.get('gameplay.autoSaveIntervalMinutes');
        
        // Convert to ms. 0 = off.
        const newInterval = intervalMins > 0 ? intervalMins * 60000 : 0;
        
        if (newInterval !== AUTO_SAVE_INTERVAL) {
            logger.info('SaveManager', `Auto-save interval updated: ${intervalMins} min(s)`);
            AUTO_SAVE_INTERVAL = newInterval;
            
            // Re-start timer if active
            if (this.currentSlot !== null) {
                this.startAutoSave();
            }
        }
    },


    /**
     * Start auto-save loop for current slot
     */
    startAutoSave() {
        if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);

        if (this.currentSlot === null || AUTO_SAVE_INTERVAL <= 0) return;

        this.autoSaveTimer = setInterval(() => {
            this.save(false); // Silent save
        }, AUTO_SAVE_INTERVAL);

        // Only add beforeunload listener once
        if (!this._beforeUnloadBound) {
            window.addEventListener('beforeunload', () => {
                if (!this.isResetting && this.currentSlot !== null) {
                    this.save(false);
                }
            });
            this._beforeUnloadBound = true;
            logger.debug('SaveManager', 'beforeunload listener registered');
        }
    },

    /**
     * Check if a slot has save data
     * @param {number} slotIndex 
     * @returns {boolean}
     */
    hasSlot(slotIndex) {
        return !!localStorage.getItem(this.getSlotKey(slotIndex));
    },

    /**
     * Get info about a specific slot for UI display
     * @param {number} slotIndex 
     * @returns {Object|null}
     */
    getSlotInfo(slotIndex) {
        try {
            const json = localStorage.getItem(this.getSlotKey(slotIndex));
            if (!json) return null;

            const data = JSON.parse(json);
            const state = data.state || data;

            return {
                slotIndex,
                heroCount: state.heroes?.length || 0,
                playtime: state.meta?.totalPlaytime || 0,
                lastSavedAt: data.savedAt || state.meta?.lastSavedAt || null,
                version: data.version || state.meta?.version || '0.0.0',
                isLastActive: parseInt(localStorage.getItem(LAST_SLOT_KEY)) === slotIndex
            };
        } catch (e) {
            console.error(`[SaveManager] Failed to read slot ${slotIndex}: `, e);
            return null;
        }
    },

    /**
     * Get info for all slots
     * @returns {Array}
     */
    getAllSlotInfos() {
        const infos = [];
        for (let i = 0; i < MAX_SLOTS; i++) {
            infos.push(this.getSlotInfo(i));
        }
        return infos;
    },

    /**
     * Save current game state to current slot
     * @param {boolean} showNotification - Whether to show notification
     */
    save(showNotification = true) {
        if (this.currentSlot === null) {
            console.warn('[SaveManager] No slot selected, cannot save');
            return false;
        }

        if (!GameState.getIsInitialized() || this.isResetting) {
            return false;
        }

        try {
            // GameState.serialize() already returns { version, savedAt, state }
            const data = GameState.serialize();
            const json = JSON.stringify(data);
            localStorage.setItem(this.getSlotKey(this.currentSlot), json);

            if (showNotification) {
                logger.info('SaveManager', `Game Saved to Slot ${this.currentSlot + 1} `);
                NotificationSystem.notify(`Saved to Slot ${this.currentSlot + 1} `, 'success');
                EventBus.publish('game_saved', { 
                    slot: this.currentSlot, 
                    timestamp: Date.now(),
                    autoSaveInterval: AUTO_SAVE_INTERVAL
                });
            }
            return true;
        } catch (err) {
            console.error('[SaveManager] Failed to save:', err);
            NotificationSystem.notify('Save Failed!', 'error');
            return false;
        }
    },

    /**
     * Migrate state to fill in missing properties from INITIAL_STATE
     * @param {Object} state - The loaded state
     * @returns {Object} Migrated state
     */
    migrateState(state, savedVersion) {
        let migrated = { ...state };

        // 1. Structural deep merge (ensure all top-level keys exist)
        for (const key of Object.keys(INITIAL_STATE)) {
            if (migrated[key] === undefined) {
                logger.debug('SaveManager', `Adding missing property: ${key} `);
                migrated[key] = structuredClone(INITIAL_STATE[key]);
            }
        }

        // 2. Versioned logic migrations
        // Currently supporting 1.0.0 as baseline. 
        // If we ever hit 1.1.0, we add logic here.
        if (savedVersion !== GAME_VERSION) {
            logger.info('SaveManager', `Migrating save from ${savedVersion} to ${GAME_VERSION}`);
            // TODO: Sequential migration functions
        }

        return migrated;
    },

    /**
     * Load game state from a specific slot
     * @param {number} slotIndex 
     * @returns {boolean} Success
     */
    loadSlot(slotIndex) {
        try {
            const json = localStorage.getItem(this.getSlotKey(slotIndex));
            if (!json) {
                console.warn(`[SaveManager] Slot ${slotIndex} is empty`);
                return false;
            }

            const data = JSON.parse(json);
            let state = data.state || data;
            const savedVersion = data.version || state.meta?.version || '0.9.0';

            // Migrate to fill in missing properties and handle logic changes
            state = this.migrateState(state, savedVersion);

            GameState.initFromSave(state);
            this.currentSlot = slotIndex;
            localStorage.setItem(LAST_SLOT_KEY, slotIndex);
            this.startAutoSave();

            NotificationSystem.notify(`Loaded Slot ${slotIndex + 1} `, 'info');
            EventBus.publish('game_loaded', { slot: slotIndex });
            return true;
        } catch (err) {
            console.error(`[SaveManager] Failed to load slot ${slotIndex}: `, err);
            NotificationSystem.notify('Load Failed - Save Corrupted', 'error');
            return false;
        }
    },

    /**
     * Start a new game in a specific slot
     * @param {number} slotIndex 
     */
    newGame(slotIndex) {
        logger.info('SaveManager', `Starting new game in Slot ${slotIndex + 1} `);

        // Initialize fresh state
        GameState.initNew();
        this.currentSlot = slotIndex;
        localStorage.setItem(LAST_SLOT_KEY, slotIndex);

        // Save immediately to claim the slot
        this.save(false);
        this.startAutoSave();

        NotificationSystem.notify(`New game started in Slot ${slotIndex + 1} `, 'success');
        EventBus.publish('game_started', { slot: slotIndex, isNew: true });
    },

    /**
     * Delete a save slot
     * @param {number} slotIndex 
     * @returns {boolean}
     */
    deleteSlot(slotIndex) {
        try {
            localStorage.removeItem(this.getSlotKey(slotIndex));
            logger.info('SaveManager', `Deleted Slot ${slotIndex + 1} `);

            // If we deleted the current slot, clear it
            if (this.currentSlot === slotIndex) {
                this.currentSlot = null;
                if (this.autoSaveTimer) {
                    clearInterval(this.autoSaveTimer);
                    this.autoSaveTimer = null;
                }
            }

            NotificationSystem.notify(`Slot ${slotIndex + 1} deleted`, 'info');
            return true;
        } catch (e) {
            console.error(`[SaveManager] Failed to delete slot ${slotIndex}: `, e);
            return false;
        }
    },

    /**
     * Reset current game (clear current slot and reload)
     */
    reset() {
        logger.info('SaveManager', 'Resetting game...');
        this.isResetting = true;
        sessionStorage.setItem('resetting', 'true');

        if (this.currentSlot !== null) {
            try {
                localStorage.removeItem(this.getSlotKey(this.currentSlot));
            } catch (e) {
                console.error('[SaveManager] Failed to clear save:', e);
            }
        }

        location.reload();
    },

    /**
     * Get current active slot index
     * @returns {number|null}
     */
    getCurrentSlot() {
        return this.currentSlot;
    }
};
