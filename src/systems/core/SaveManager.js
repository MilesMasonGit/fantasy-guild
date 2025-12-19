// Fantasy Guild - Save Manager
// Phase 21: Save System

import { GameState } from '../../state/GameState.js';
import { EventBus } from './EventBus.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from './NotificationSystem.js';
import { INITIAL_STATE } from '../../state/StateSchema.js';

const SLOT_KEY_PREFIX = 'fantasy_guild_slot_';
const LEGACY_KEY = 'fantasy_guild_save_v2';
const MAX_SLOTS = 3;
const AUTO_SAVE_INTERVAL = 60000; // 1 minute auto-save

/**
 * SaveManager - Handles multi-slot persistence of game state
 */
export const SaveManager = {
    autoSaveTimer: null,
    isResetting: false,
    currentSlot: null, // Track which slot is active (0, 1, or 2)
    _beforeUnloadBound: false, // Track if beforeunload listener is registered

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

        // Migrate legacy save to slot 0 if exists
        this.migrateLegacySave();

        // Check for reset signal from previous session
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
     * Migrate legacy single-slot save to slot 0
     */
    migrateLegacySave() {
        try {
            const legacyData = localStorage.getItem(LEGACY_KEY);
            if (legacyData && !localStorage.getItem(this.getSlotKey(0))) {
                logger.info('SaveManager', 'Migrating legacy save to Slot 0');
                localStorage.setItem(this.getSlotKey(0), legacyData);
                localStorage.removeItem(LEGACY_KEY);
            }
        } catch (e) {
            console.warn('[SaveManager] Legacy migration failed:', e);
        }
    },

    /**
     * Start auto-save loop for current slot
     */
    startAutoSave() {
        if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);

        if (this.currentSlot === null) return;

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
                version: state.meta?.version || 'unknown'
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
                EventBus.publish('game_saved', { slot: this.currentSlot, timestamp: Date.now() });
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
    migrateState(state) {
        // Deep merge: fill in missing top-level properties from INITIAL_STATE
        const migrated = { ...state };

        for (const key of Object.keys(INITIAL_STATE)) {
            if (migrated[key] === undefined) {
                logger.debug('SaveManager', `Migrating missing property: ${key} `);
                migrated[key] = structuredClone(INITIAL_STATE[key]);
            }
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
            let state = data.state || data; // Handle both formats

            // Migrate to fill in missing properties
            state = this.migrateState(state);

            GameState.initFromSave(state);
            this.currentSlot = slotIndex;
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
