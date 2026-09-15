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

    // The station recipe backfill (Recipe & Charges P2) and the hero-tiles →
    // flags conversion (Free Playmat 1.4b) were deleted in slice 1.6a. Both
    // only carried pre-0.8.0 boards forward, and those saves are now refused
    // by the check above.

    return migrated;
}

/** An object we can merge field-by-field — not an array, not null. */
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
