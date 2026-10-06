import { INITIAL_STATE, GAME_VERSION } from '../../state/StateSchema.js';
import { logger } from '../../utils/Logger.js';

/**
 * Thrown when a save was created under an incompatible schema version. Reworks
 * intentionally break save compatibility: older saves are refused, not migrated.
 */
export class IncompatibleSaveError extends Error {
    constructor(savedVersion) {
        super(`Save version ${savedVersion} is incompatible with game version ${GAME_VERSION}`);
        this.name = 'IncompatibleSaveError';
        this.savedVersion = savedVersion;
    }
}

/**
 * Migrate state to fill in missing properties from INITIAL_STATE
 * @param {Object} state - The loaded state
 * @param {string} savedVersion - The version of the loaded state
 * @returns {Object} Migrated state
 * @throws {IncompatibleSaveError} If the save predates the current schema version
 */
export function migrateState(state, savedVersion) {
    // Saves from any other version (e.g. the pre-rework '1.0.0' schema) use
    // structures the current code no longer reads — refuse to load them
    // rather than attempting a structural merge over stale nested shapes.
    if (savedVersion !== GAME_VERSION) {
        throw new IncompatibleSaveError(savedVersion);
    }

    let migrated = { ...state };

    // Backfill missing keys from INITIAL_STATE, two levels deep: the top-level
    // sections, and each section's own fields.
    //
    // ⚠️ It stops at two levels on purpose. Going deeper would reach inside
    // things like `inventory.groupDefs` and resurrect entries a save has
    // deliberately dropped. Existing values are never overwritten — only keys
    // that are `undefined` are filled, so a field a save stores as null or 0
    // keeps that value.
    for (const key of Object.keys(INITIAL_STATE)) {
        const template = INITIAL_STATE[key];

        if (migrated[key] === undefined) {
            logger.debug('SaveManager', `Adding missing property: ${key}`);
            migrated[key] = structuredClone(template);
            continue;
        }

        if (!isPlainObject(template) || !isPlainObject(migrated[key])) continue;

        let section = migrated[key];
        for (const field of Object.keys(template)) {
            if (section[field] !== undefined) continue;
            if (section === migrated[key]) section = { ...migrated[key] };
            logger.debug('SaveManager', `Adding missing property: ${key}.${field}`);
            section[field] = structuredClone(template[field]);
        }
        migrated[key] = section;
    }

    // Retired: the `currency` section an older save still carries is dropped, not kept.
    if ('currency' in migrated) delete migrated.currency;

    // Retired Map bursts and Map purchase: an older save's unopened Maps on the
    // mat, its purchase list and its burst bookkeeping are dropped, not kept.
    if ('cartographer' in migrated) delete migrated.cartographer;
    if (isPlainObject(migrated.board) && 'maps' in migrated.board) {
        migrated.board = { ...migrated.board };
        delete migrated.board.maps;
    }
    if (isPlainObject(migrated.progress) && ('mapDiscoveries' in migrated.progress || 'guildHallMapOpens' in migrated.progress)) {
        migrated.progress = { ...migrated.progress };
        delete migrated.progress.mapDiscoveries;
        delete migrated.progress.guildHallMapOpens;
    }

    // Retired Token Vault and Tray: an older save's Vault and Tray contents, tab
    // and cap fields, Token loot on the floor and ranks in the two Vault upgrade
    // tracks are dropped, not kept. Item loot stays.
    if (isPlainObject(migrated.board)) {
        const board = { ...migrated.board };
        let changed = false;
        for (const field of RETIRED_BOARD_FIELDS) {
            if (field in board) { delete board[field]; changed = true; }
        }
        if (Array.isArray(board.sprites) && board.sprites.some(isTokenSprite)) {
            board.sprites = board.sprites.filter(s => !isTokenSprite(s));
            changed = true;
        }
        if (changed) migrated.board = board;
    }
    const ranks = migrated.progress?.guildUpgrades;
    if (isPlainObject(ranks) && RETIRED_UPGRADES.some(id => id in ranks)) {
        const kept = { ...ranks };
        for (const id of RETIRED_UPGRADES) delete kept[id];
        migrated.progress = { ...migrated.progress, guildUpgrades: kept };
    }

    return migrated;
}

/** Board fields of the Token Vault and the Tray. */
export const RETIRED_BOARD_FIELDS = Object.freeze([
    'tokenBank', 'tray', 'nextTrayZ', 'tokenBankSlots', 'tokenTabsUnlocked', 'tokenGroups'
]);

/** The Guild Hall upgrade tracks that only ever served the Token Vault. */
export const RETIRED_UPGRADES = Object.freeze(['token_bank_slots', 'token_bank_tabs']);

/** A loose Token lying on the floor — the retired Token loot. */
function isTokenSprite(sprite) {
    return sprite?.kind === 'token';
}

/** An object we can merge field-by-field — not an array, not null. */
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
