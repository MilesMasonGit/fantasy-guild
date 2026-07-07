const SLOT_KEY_PREFIX = 'fantasy_guild_slot_';
const LAST_SLOT_KEY = 'fantasy_guild_last_slot';

/**
 * Get localStorage key for a slot
 * @param {number} slotIndex 
 * @returns {string}
 */
export function getSlotKey(slotIndex) {
    return `${SLOT_KEY_PREFIX}${slotIndex} `;
}

/**
 * Check if a slot has save data
 * @param {number} slotIndex 
 * @returns {boolean}
 */
export function hasSlot(slotIndex) {
    return !!localStorage.getItem(getSlotKey(slotIndex));
}

/**
 * Get info about a specific slot for UI display
 * @param {number} slotIndex 
 * @returns {Object|null}
 */
export function getSlotInfo(slotIndex) {
    try {
        const json = localStorage.getItem(getSlotKey(slotIndex));
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
