import { INITIAL_STATE, GAME_VERSION } from '../../state/StateSchema.js';
import { logger } from '../../utils/Logger.js';

/**
 * Thrown when a save was created under an incompatible schema version.
 *
 * Every rework so far has intentionally broken save compatibility: older saves
 * are refused rather than migrated. The current break is the 7×7 Playmat rework
 * (schema '0.6.0', D-110) — see playmat_roadmap_v1.md Phase 0 §C.
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

    // Structural deep merge (ensure all top-level keys exist)
    for (const key of Object.keys(INITIAL_STATE)) {
        if (migrated[key] === undefined) {
            logger.debug('SaveManager', `Adding missing property: ${key}`);
            migrated[key] = structuredClone(INITIAL_STATE[key]);
        }
    }

    return migrated;
}
