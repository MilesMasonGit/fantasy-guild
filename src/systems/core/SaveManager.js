import { GameState } from '../../state/GameState.js';
import { EventBus } from './EventBus.js';
import { SettingsManager } from './SettingsManager.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from './NotificationSystem.js';
import * as Banners from '../notifications/banners.js';
import { migrateState, IncompatibleSaveError } from './SaveMigration.js';
import * as SlotHelper from './SaveSlotHelper.js';
import * as SaveFiles from './SaveFiles.js';
import { validateSaveData } from '../../state/StateSchema.js';
import { ENGINE_EVENTS } from './engineEvents.js';
import { ItemRateTracker } from '../inventory/ItemRateTracker.js';
import { XpRateTracker } from '../hero/XpRateTracker.js';
import * as MatResize from '../board/MatResize.js';
import { reconcileHeldCopies } from '../equipment/EquipmentManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { t } from '../../i18n/index.js';
import { loadSavedState } from './LoadedState.js';

const LAST_SLOT_KEY = 'fantasy_guild_last_slot';
/** sessionStorage: the slot the next page load opens by itself, without a catch-up. */
const RESUME_SLOT_KEY = 'fantasy_guild_resume_slot';
const MAX_SLOTS = SlotHelper.SLOT_COUNT;

/**
 * The rate windows belong to the game being played: the previous game's gains carry that game's
 * clock, so after a switch they would show its rates for minutes, or never age out at all.
 */
function clearRateTrackers() {
    ItemRateTracker.clearAll();
    XpRateTracker.clearAll();
}

/** A save's text as an object, or null when it is not JSON or not an object at all. */
function parseSave(json) {
    try {
        const data = JSON.parse(json);
        return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch {
        return null;
    }
}

/** The problem banner for a save that could not be written. */
function reportSaveFailed(err) {
    console.error('[SaveManager] Failed to save:', err);
    // Quota exhaustion is the realistic failure in a browser and it will keep
    // recurring — say so plainly instead of a generic error.
    const isQuota = err?.name === 'QuotaExceededError'
        || err?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        || /quota/i.test(err?.message || '');
    // The game is running: a problem banner, which stays until clicked.
    Banners.push({
        kind: 'save',
        groupKey: 'save_failed',
        parts: {
            title: 'Save Failed!',
            message: isQuota
                ? 'Browser storage is full. Free space or export your save.'
                : 'The game could not be saved.'
        }
    });
}

/** One banner for every slot an older save's load emptied for want of a copy. */
function announceGearLost(lost) {
    const losses = lost.map(l => t('equipment.sharedGearLoss', { hero: l.heroName, item: l.itemName })).join(', ');
    Banners.push({
        kind: 'save',
        groupKey: 'shared_gear',
        parts: { title: t('equipment.sharedGearTitle'), message: t('equipment.sharedGearLine', { losses }) }
    });
}

// A placeholder until `syncSettings()` reads `gameplay.autoSaveIntervalMinutes`
// at init. The real default is 10 minutes (SettingsManager's defaults).
let AUTO_SAVE_INTERVAL = 60000;

/**
 * SaveManager - Handles multi-slot persistence of game state
 */
export const SaveManager = {
    autoSaveTimer: null,
    isResetting: false,
    currentSlot: null, // Track which slot is active (0, 1, or 2)
    _beforeUnloadBound: false, // Track if beforeunload listener is registered
    _settingsUnsubscribe: null,
    /** While true (a catch-up), nothing is written: the slot keeps the save it had. */
    savingSuspended: false,
    /** When the loaded save was written (epoch ms): the catch-up on load plays from here. */
    loadedSavedAt: null,
    /** The save text the last load read, until the catch-up on load takes it (`takeLoadedJson`). */
    loadedJson: null,
    /**
     * The slot whose damaged save was loaded from its backup: its next save keeps that backup
     * instead of rolling the damaged save over it.
     */
    keepBackupSlot: null,
    _closeSaveBound: false,

    /** Refuse every save (autosave, closing the window, a button) until `resumeSaving`. */
    suspendSaving() {
        this.savingSuspended = true;
    },

    resumeSaving() {
        this.savingSuspended = false;
    },

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
        this._settingsUnsubscribe = EventBus.subscribe(ENGINE_EVENTS.SETTINGS_UPDATED, () => this.syncSettings());

        // 2. The desktop build saves when its window closes.
        this.installCloseSave();

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
     * Read the desktop build's save files for the slot screen (`SaveFiles.init`). Resolves at once
     * in a browser or a dev build; never rejects.
     */
    loadSaveFiles() {
        return SaveFiles.init(MAX_SLOTS);
    },

    /**
     * The desktop build's window waits for this before it closes (`src-tauri/src/saves.rs`): the
     * game is saved and the file written, then the window closes. ⚠️ `beforeunload` cannot wait
     * for a file write, so the browser's way does not carry over. During a catch-up nothing is
     * saved, and the file keeps the save from before it.
     */
    installCloseSave() {
        if (!SaveFiles.isActive() || this._closeSaveBound) return;
        this._closeSaveBound = true;
        let closing = false;
        window.addEventListener(SaveFiles.CLOSE_REQUESTED_EVENT, async () => {
            if (closing) return;
            closing = true;
            try {
                if (!this.isResetting && this.currentSlot !== null) this.save(false);
                await SaveFiles.flush();
            } finally {
                await SaveFiles.closeWindow();
                closing = false;
            }
        });
        SaveFiles.claimCloseSave();
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

        if (!GameState.getIsInitialized() || this.isResetting || this.savingSuspended) {
            return false;
        }

        try {
            // The same bytes as `JSON.stringify(GameState.serialize())`, without
            // deep-copying the state first.
            const stringifyStart = import.meta.env.DEV ? performance.now() : 0;
            const json = GameState.serializeJson();
            if (import.meta.env.DEV) {
                logger.info('SaveManager', `save size ${json.length} chars, serializeJson ${(performance.now() - stringifyStart).toFixed(1)} ms`);
            }
            const slot = this.currentSlot;
            const rollBackup = this.keepBackupSlot !== slot;

            if (SaveFiles.isActive()) {
                // The game is taken now; the file is written after, in order with the others.
                SaveFiles.writeSave(slot, json, { rollBackup }).then(({ ok, error }) => {
                    if (!ok) reportSaveFailed(error);
                    else if (this.keepBackupSlot === slot) this.keepBackupSlot = null;
                });
            } else {
                const slotKey = this.getSlotKey(slot);

                // Roll the previous save into the backup key first, so a
                // failed/truncated write can't leave the player with nothing.
                const previous = localStorage.getItem(slotKey);
                if (previous && rollBackup) {
                    try {
                        localStorage.setItem(SlotHelper.getBackupKey(slot), previous);
                    } catch {
                        // Backup is best-effort; never block the real save for it.
                    }
                }

                localStorage.setItem(slotKey, json);
                this.keepBackupSlot = null;
            }

            if (showNotification) {
                logger.info('SaveManager', `Game Saved to Slot ${slot + 1}`);
            }
            return true;
        } catch (err) {
            reportSaveFailed(err);
            return false;
        }
    },

    /**
     * Export the current save as a JSON string for the player to keep, to back
     * a save up or move it between machines.
     * @returns {string|null}
     */
    exportSave() {
        if (!GameState.getIsInitialized()) return null;
        return GameState.serializeJson();
    },

    /**
     * Load a save from an exported JSON string into a slot.
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

            const text = JSON.stringify({ version, savedAt: data.savedAt || Date.now(), state });
            if (SaveFiles.isActive()) {
                const { ok } = await SaveFiles.writeSave(slotIndex, text);
                return ok ? { success: true } : { success: false, error: 'The save could not be written.' };
            }
            localStorage.setItem(this.getSlotKey(slotIndex), text);
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
    async loadSlot(slotIndex, { fromBackup = false, catchUp = true } = {}) {
        const which = `Slot ${slotIndex}${fromBackup ? ' backup' : ''}`;
        try {
            let json;
            if (SaveFiles.isActive()) {
                // Read now, not from the slot screen's copy: a file copied in or edited loads as it is.
                try {
                    json = await SaveFiles.readSave(slotIndex, { backup: fromBackup });
                } catch (err) {
                    console.error(`[SaveManager] ${which} could not be read:`, err);
                    return this.loadDamaged(slotIndex, { fromBackup, catchUp });
                }
            } else {
                json = localStorage.getItem(fromBackup ? SlotHelper.getBackupKey(slotIndex) : this.getSlotKey(slotIndex));
            }
            if (!json) {
                console.warn(`[SaveManager] ${which} is empty`);
                return false;
            }

            // A truncated write or a hand-edit that is not even JSON is damaged, like one that
            // fails the check below.
            const data = parseSave(json);
            if (!data) {
                console.error(`[SaveManager] ${which} is not a save`);
                return this.loadDamaged(slotIndex, { fromBackup, catchUp });
            }
            let state = data.state || data;
            const savedVersion = data.version || state.meta?.version || '0.9.0';

            // Migrate to fill in missing properties and handle logic changes
            state = this.migrateState(state, savedVersion);

            // Structural check before anything touches the state.
            // Migration has already backfilled missing sections, so a failure
            // here means genuinely malformed data (truncated write, hand-edit)
            // — refuse it rather than half-loading into a broken game.
            const validation = validateSaveData({ version: savedVersion, state });
            if (!validation.valid) {
                console.error(`[SaveManager] ${which} failed validation:`, validation.errors);
                return this.loadDamaged(slotIndex, { fromBackup, catchUp });
            }

            loadSavedState(state);
            // Before anything plays, the catch-up included: an older save's heroes sharing one copy
            // of a tool get one each from the Bank, in roster order. The Bank's entries are put in
            // their one shape first, as the slot's start does again later.
            InventoryManager.init();
            const gearLost = reconcileHeldCopies();
            clearRateTrackers();
            this.currentSlot = slotIndex;
            this.keepBackupSlot = null;
            this.loadedSavedAt = catchUp ? (Number(data.savedAt) || null) : null;
            this.loadedJson = catchUp ? json : null;
            localStorage.setItem(LAST_SLOT_KEY, slotIndex);
            this.startAutoSave();

            // A save laid on a bigger mat than this game's: what stands past the edge comes back
            // inside before anything hears of the board, the catch-up on load included.
            MatResize.fitToMat();

            // savedAt is when this save was written: the catch-up on load plays from it.
            EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: slotIndex, savedAt: data.savedAt });
            // After GAME_LOADED, which clears the banners of the game before.
            if (gearLost.length) announceGearLost(gearLost);
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
     * A save that could not be loaded: one automatic retry from the slot's rolling backup before
     * telling the player their save is damaged. Nothing is written, so the slot's files stay as
     * they are; the backup a damaged save was loaded from is kept by the next save
     * (`keepBackupSlot`).
     */
    async loadDamaged(slotIndex, { fromBackup, catchUp }) {
        if (!fromBackup) {
            console.warn(`[SaveManager] Retrying slot ${slotIndex} from its backup`);
            const recovered = await this.loadSlot(slotIndex, { fromBackup: true, catchUp });
            if (recovered) {
                this.keepBackupSlot = slotIndex;
                Banners.push({
                    kind: 'save',
                    groupKey: 'save_restored',
                    parts: { title: 'Save Restored', message: 'Your latest save was damaged, so the one before it was loaded.' }
                });
                return true;
            }
        }
        NotificationSystem.notify('This save appears to be damaged and could not be loaded.', 'error');
        return false;
    },

    /** The save text the last load read, once; the catch-up on load keeps it for an undo. */
    takeLoadedJson() {
        const json = this.loadedJson;
        this.loadedJson = null;
        return json;
    },

    /**
     * "Load as I left it": write `json` (a whole save, as stored) back to `slotIndex`, dated now so
     * the next load does not catch the same time up again, and reload the page, which opens that
     * slot by itself without a catch-up (`takeResumeSlot`). Nothing is saved after this: the game
     * still running is the one being thrown away.
     * In the desktop build the file is written first and the page reloads once it is on the disk:
     * reloading sooner would read the save the catch-up wrote.
     * @returns {boolean} false if the save could not be read or written (the page is not reloaded)
     */
    restoreAndReload(slotIndex, json) {
        try {
            const data = JSON.parse(json);
            const now = Date.now();
            if (data.state) {
                data.savedAt = now;
                if (data.state.meta) data.state.meta.lastSavedAt = now;
            } else if (data.meta) {
                data.meta.lastSavedAt = now;
            }
            this.suspendSaving();
            if (this.autoSaveTimer) {
                clearInterval(this.autoSaveTimer);
                this.autoSaveTimer = null;
            }
            if (SaveFiles.isActive()) {
                SaveFiles.writeSave(slotIndex, JSON.stringify(data)).then(({ ok, error }) => {
                    if (!ok) {
                        this.restoreFailed(error);
                        return;
                    }
                    sessionStorage.setItem(RESUME_SLOT_KEY, String(slotIndex));
                    this.reloadPage();
                });
                return true;
            }
            const slotKey = this.getSlotKey(slotIndex);
            const previous = localStorage.getItem(slotKey);
            if (previous) {
                try {
                    localStorage.setItem(SlotHelper.getBackupKey(slotIndex), previous);
                } catch {
                    // Backup is best-effort, as in `save`.
                }
            }
            localStorage.setItem(slotKey, JSON.stringify(data));
            sessionStorage.setItem(RESUME_SLOT_KEY, String(slotIndex));
        } catch (err) {
            this.restoreFailed(err);
            return false;
        }
        this.reloadPage();
        return true;
    },

    /** "Load as I left it" could not write the save back: the game goes on, saving again. */
    restoreFailed(err) {
        console.error('[SaveManager] Could not put the save from before the catch-up back:', err);
        this.resumeSaving();
        this.startAutoSave();
        Banners.push({
            kind: 'save',
            groupKey: 'restore_failed',
            parts: { title: 'Load Failed', message: 'Could not load the game as you left it.' }
        });
    },

    /** The slot `restoreAndReload` asked this page load to open, once; null if none or empty. */
    takeResumeSlot() {
        let raw;
        try {
            raw = sessionStorage.getItem(RESUME_SLOT_KEY);
            sessionStorage.removeItem(RESUME_SLOT_KEY);
        } catch {
            return null;
        }
        const slot = raw === null ? NaN : Number(raw);
        return Number.isInteger(slot) && this.hasSlot(slot) ? slot : null;
    },

    reloadPage() {
        location.reload();
    },

    /**
     * Start a new game in a specific slot
     * @param {number} slotIndex 
     */
    newGame(slotIndex) {
        logger.info('SaveManager', `Starting new game in Slot ${slotIndex + 1}`);

        // Initialize fresh state
        GameState.initNew();
        clearRateTrackers();
        this.currentSlot = slotIndex;
        this.keepBackupSlot = null;
        this.loadedSavedAt = null;
        this.loadedJson = null;
        localStorage.setItem(LAST_SLOT_KEY, slotIndex);

        // Save immediately to claim the slot
        this.save(false);
        this.startAutoSave();

        NotificationSystem.notify(`New game started in Slot ${slotIndex + 1}`, 'success');
    },

    /**
     * Delete a save slot
     * @param {number} slotIndex 
     * @returns {boolean}
     */
    deleteSlot(slotIndex) {
        try {
            if (SaveFiles.isActive()) {
                SaveFiles.deleteSave(slotIndex).then(({ ok }) => {
                    if (!ok) NotificationSystem.notify(`Slot ${slotIndex + 1} could not be deleted`, 'error');
                });
            } else {
                localStorage.removeItem(this.getSlotKey(slotIndex));
                localStorage.removeItem(SlotHelper.getBackupKey(slotIndex));
            }
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

        if (this.currentSlot !== null && SaveFiles.isActive()) {
            SaveFiles.deleteSave(this.currentSlot).then(() => location.reload());
            return;
        }
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
