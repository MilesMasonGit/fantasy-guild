import { cleanGuildName } from './GuildName.js';
import * as SaveFiles from './SaveFiles.js';

const SLOT_KEY_PREFIX = 'fantasy_guild_slot_';
const LAST_SLOT_KEY = 'fantasy_guild_last_slot';

/** How many save slots the title screen offers. */
export const SLOT_COUNT = 3;

/**
 * Get localStorage key for a slot.
 * @param {number} slotIndex
 * @returns {string}
 */
export function getSlotKey(slotIndex) {
    return `${SLOT_KEY_PREFIX}${slotIndex}`;
}

/**
 * Key holding the previous save for a slot — the rolling backup written
 * before each overwrite. One generation deep: enough to survive a
 * corrupt/truncated write, cheap enough to keep in localStorage.
 */
export function getBackupKey(slotIndex) {
    return `${SLOT_KEY_PREFIX}${slotIndex}_backup`;
}

/**
 * Check if a slot has save data
 * @param {number} slotIndex 
 * @returns {boolean}
 */
export function hasSlot(slotIndex) {
    if (SaveFiles.isActive()) return SaveFiles.hasSave(slotIndex);
    return !!localStorage.getItem(getSlotKey(slotIndex));
}

/**
 * Get info about a specific slot for UI display: null for an empty slot, and
 * `{ slotIndex, damaged: true }` for one whose save can't be read at all, so the
 * slot screen shows it as damaged rather than empty (it can still be deleted).
 * @param {number} slotIndex 
 * @returns {Object|null}
 */
export function getSlotInfo(slotIndex) {
    try {
        const json = SaveFiles.isActive() ? SaveFiles.savedText(slotIndex) : localStorage.getItem(getSlotKey(slotIndex));
        if (!json) return null;

        const data = JSON.parse(json);
        const state = data.state || data;

        return {
            slotIndex,
            guildName: cleanGuildName(state.meta?.guildName),
            heroCount: state.heroes?.length || 0,
            playtime: state.meta?.totalPlaytime || 0,
            lastSavedAt: data.savedAt || state.meta?.lastSavedAt || null,
            version: data.version || state.meta?.version || '0.0.0',
            isLastActive: parseInt(localStorage.getItem(LAST_SLOT_KEY)) === slotIndex
        };
    } catch (e) {
        console.error(`[SaveManager] Failed to read slot ${slotIndex}: `, e);
        return { slotIndex, damaged: true, isLastActive: parseInt(localStorage.getItem(LAST_SLOT_KEY)) === slotIndex };
    }
}

/**
 * Get info for all slots
 * @param {number} maxSlots
 * @returns {Array}
 */
export function getAllSlotInfos(maxSlots) {
    const infos = [];
    for (let i = 0; i < maxSlots; i++) {
        infos.push(getSlotInfo(i));
    }
    return infos;
}
