import { INITIAL_STATE, GAME_VERSION } from '../../state/StateSchema.js';
import { logger } from '../../utils/Logger.js';

/**
 * Thrown when a save was created under an incompatible schema version.
 *
 * Every rework so far has intentionally broken save compatibility: older saves
 * are refused rather than migrated. The current break is Free Playmat slice
 * 1.6a (schema '0.8.0', FP-85): Tokens are stored by point, not by tile.
 *
 * ⚠️ The archived `playmat_rework_roadmap_v*.md` files this comment used to
 * cite document the **Area Deck Loop**, not the playmat, despite their names.
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
    // It used to fill top-level keys ONLY, which meant a save whose `board` was
    // wholly absent came back complete but a save whose `board` held a single
    // field came back still missing every other board field (CR2-042,
    // confirmed at runtime). Five separate helpers were each re-creating what
    // they needed on first read to cover that gap.
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

    // Gold is retired and its code deleted (Token Lifecycle 9.4, SP-65): the
    // `currency` section an older save still carries is dropped, not kept.
    if ('currency' in migrated) delete migrated.currency;

    // The Map bursts and the Map purchase are retired (Token Lifecycle 9.1):
    // an older save's unopened Maps lying on the mat, its purchase list and
    // its burst bookkeeping are dropped, not kept. Nothing can open a Map now,
    // so a Map box left on the mat would be a thing nothing can use.
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

    // The Token Vault and the dormant Tray are retired (Token Lifecycle 9.3,
    // goal 1: Tokens spend their whole life on the mat). An older save's Vault
    // and Tray contents, their tab and cap fields, its Token loot lying on the
    // floor and its ranks in the two Vault upgrade tracks are dropped, not
    // kept: nothing can pick them up or place them now. Item loot stays.
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

    // The station recipe backfill (Recipe & Charges P2) and the hero-tiles →
    // flags conversion (Free Playmat 1.4b) were deleted in slice 1.6a. Both
    // only carried pre-0.8.0 boards forward, and those saves are now refused
    // by the check above.

    return migrated;
}

/** Board fields of the Token Vault and the Tray (Token Lifecycle 9.3). */
export const RETIRED_BOARD_FIELDS = Object.freeze([
    'tokenBank', 'tray', 'nextTrayZ', 'tokenBankSlots', 'tokenTabsUnlocked', 'tokenGroups'
]);

/** The Guild Hall upgrade tracks that only ever served the Token Vault. */
export const RETIRED_UPGRADES = Object.freeze(['token_bank_slots', 'token_bank_tabs']);

/** A loose Token lying on the floor — the Token loot that 9.3 retired. */
function isTokenSprite(sprite) {
    return sprite?.kind === 'token';
}

/** An object we can merge field-by-field — not an array, not null. */
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
