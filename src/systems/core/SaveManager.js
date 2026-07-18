// Fantasy Guild - Save Manager
// Phase 21: Save System

import { GameState } from '../../state/GameState.js';
import { EventBus } from './EventBus.js';
import { SettingsManager } from './SettingsManager.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from './NotificationSystem.js';
import { migrateState, IncompatibleSaveError } from './SaveMigration.js';
import * as SlotHelper from './SaveSlotHelper.js';
import { validateSaveData } from '../../state/StateSchema.js';

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

    // Proxy SlotHelper methods for backward compatibility
    getSlotKey: SlotHelper.getSlotKey,
    hasSlot: SlotHelper.hasSlot,
    getSlotInfo: SlotHelper.getSlotInfo,
    getAllSlotInfos() {
        return SlotHelper.getAllSlotInfos(MAX_SLOTS);
    },
    migrateState,

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
            const slotKey = this.getSlotKey(this.currentSlot);

            // Roll the previous save into the backup key first (CR-054), so a
            // failed/truncated write can't leave the player with nothing.
            const previous = localStorage.getItem(slotKey);
            if (previous) {
                try {
                    localStorage.setItem(SlotHelper.getBackupKey(this.currentSlot), previous);
                } catch {
                    // Backup is best-effort; never block the real save for it.
                }
            }

            localStorage.setItem(slotKey, json);

            if (showNotification) {
                logger.info('SaveManager', `Game Saved to Slot ${this.currentSlot + 1}`);
                NotificationSystem.notify(`Saved to Slot ${this.currentSlot + 1}`, 'success');
                EventBus.publish('game_saved', { 
                    slot: this.currentSlot, 
                    timestamp: Date.now(),
                    autoSaveInterval: AUTO_SAVE_INTERVAL
                });
            }
            return true;
        } catch (err) {
            console.error('[SaveManager] Failed to save:', err);
            // Quota exhaustion is the realistic failure here and it will keep
            // recurring — say so plainly instead of a generic error (CR-054).
            const isQuota = err?.name === 'QuotaExceededError'
                || err?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
                || /quota/i.test(err?.message || '');
            NotificationSystem.notify(
                isQuota
                    ? 'Save failed — browser storage is full. Free space or export your save.'
                    : 'Save Failed!',
                'error'
            );
            return false;
        }
    },

    /**
     * Export the current save as a JSON string for the player to keep
     * (CR-054). Until the Tauri wrap gives us real files, this is the only
     * way a player can back a save up or move it between machines.
     * @returns {string|null}
     */
    exportSave() {
        if (!GameState.getIsInitialized()) return null;
        return JSON.stringify(GameState.serialize());
    },

    /**
     * Load a save from an exported JSON string into a slot (CR-054).
     * Validated exactly like a stored save; refuses anything malformed.
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async importSave(slotIndex, json) {
        try {
            const data = JSON.parse(json);
            const rawState = data.state || data;
            const version = data.version || rawState.meta?.version;
            const state = this.migrateState(rawState, version);

            const validation = validateSaveData({ version, state });
            if (!validation.valid) {
                return { success: false, error: 'That file is not a valid save.' };
            }

            localStorage.setItem(this.getSlotKey(slotIndex), JSON.stringify({
                version, savedAt: data.savedAt || Date.now(), state
            }));
            return { success: true };
        } catch (err) {
            if (err instanceof IncompatibleSaveError) {
                return { success: false, error: 'That save is from an incompatible game version.' };
            }
            return { success: false, error: 'That file could not be read as a save.' };
        }
    },

    /**
     * Load game state from a specific slot
     * @param {number} slotIndex 
     * @returns {boolean} Success
     */
    async loadSlot(slotIndex, { fromBackup = false } = {}) {
        try {
            const key = fromBackup ? SlotHelper.getBackupKey(slotIndex) : this.getSlotKey(slotIndex);
            const json = localStorage.getItem(key);
            if (!json) {
                console.warn(`[SaveManager] Slot ${slotIndex}${fromBackup ? ' backup' : ''} is empty`);
                return false;
            }

            const data = JSON.parse(json);
            let state = data.state || data;
            const savedVersion = data.version || state.meta?.version || '0.9.0';

            // Migrate to fill in missing properties and handle logic changes
            state = this.migrateState(state, savedVersion);

            // Structural check before anything touches the state (CR-008).
            // Migration has already backfilled missing sections, so a failure
            // here means genuinely malformed data (truncated write, hand-edit)
            // — refuse it rather than half-loading into a broken game.
            const validation = validateSaveData({ version: savedVersion, state });
            if (!validation.valid) {
                console.error(`[SaveManager] Slot ${slotIndex}${fromBackup ? ' backup' : ''} failed validation:`, validation.errors);
                // One automatic retry from the rolling backup (CR-054) before
                // telling the player their save is damaged.
                if (!fromBackup && localStorage.getItem(SlotHelper.getBackupKey(slotIndex))) {
                    console.warn(`[SaveManager] Retrying slot ${slotIndex} from its backup`);
                    const recovered = await this.loadSlot(slotIndex, { fromBackup: true });
                    if (recovered) {
                        NotificationSystem.notify('Your latest save was damaged — restored the previous one.', 'warning');
                        return true;
                    }
                }
                NotificationSystem.notify('This save appears to be damaged and could not be loaded.', 'error');
                return false;
            }

            await GameState.initFromSave(state);
            this.currentSlot = slotIndex;
            localStorage.setItem(LAST_SLOT_KEY, slotIndex);
            this.startAutoSave();

            NotificationSystem.notify(`Loaded Slot ${slotIndex + 1}`, 'info');
            // savedAt is when this save was written — the Time Bank (Phase 8)
            // uses it to accrue closed-only offline time on load.
            EventBus.publish('game_loaded', { slot: slotIndex, savedAt: data.savedAt });
            return true;
        } catch (err) {
            if (err instanceof IncompatibleSaveError) {
                console.warn(`[SaveManager] Refused slot ${slotIndex}: ${err.message}`);
                NotificationSystem.notify('This save is from a previous version and cannot be loaded. Please start a new game.', 'error');
            } else {
                console.error(`[SaveManager] Failed to load slot ${slotIndex}: `, err);
                NotificationSystem.notify('Load Failed - Save Corrupted', 'error');
            }
            return false;
        }
    },

    /**
     * Start a new game in a specific slot
     * @param {number} slotIndex 
     */
    newGame(slotIndex) {
        logger.info('SaveManager', `Starting new game in Slot ${slotIndex + 1}`);

        // Initialize fresh state
        GameState.initNew();
        this.currentSlot = slotIndex;
        localStorage.setItem(LAST_SLOT_KEY, slotIndex);

        // Save immediately to claim the slot
        this.save(false);
        this.startAutoSave();

        NotificationSystem.notify(`New game started in Slot ${slotIndex + 1}`, 'success');
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
            localStorage.removeItem(SlotHelper.getBackupKey(slotIndex));
            logger.info('SaveManager', `Deleted Slot ${slotIndex + 1}`);

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

export default SaveManager;
