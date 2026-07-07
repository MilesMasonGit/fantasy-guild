import { INITIAL_STATE, GAME_VERSION } from '../../state/StateSchema.js';
import { logger } from '../../utils/Logger.js';

/**
 * Migrate state to fill in missing properties from INITIAL_STATE
 * @param {Object} state - The loaded state
 * @param {string} savedVersion - The version of the loaded state
 * @returns {Object} Migrated state
 */
export function migrateState(state, savedVersion) {
    let migrated = { ...state };

    // 1. Structural deep merge (ensure all top-level keys exist)
    for (const key of Object.keys(INITIAL_STATE)) {
        if (migrated[key] === undefined) {
            logger.debug('SaveManager', `Adding missing property: ${key}`);
            migrated[key] = structuredClone(INITIAL_STATE[key]);
        }
    }

    // 2. Versioned logic migrations
    if (savedVersion !== GAME_VERSION) {
        logger.info('SaveManager', `Migrating save from ${savedVersion} to ${GAME_VERSION}`);
        // TODO: Sequential migration functions
    }

    return migrated;
}
