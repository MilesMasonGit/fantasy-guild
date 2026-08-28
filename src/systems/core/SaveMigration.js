import { INITIAL_STATE, GAME_VERSION } from '../../state/StateSchema.js';
import { logger } from '../../utils/Logger.js';
import * as StationRecipe from '../board/StationRecipe.js';

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

    // Backfill missing keys from INITIAL_STATE, two levels deep: the top-level
    // sections, and each section's own fields.
    //
    // It used to fill top-level keys ONLY, which meant a save whose `board` was
    // wholly absent came back complete but a save whose `board` was
    // `{ tiles: {} }` came back still missing every other board field (CR2-042,
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

    /**
     * Give every placed station the recipe selection it was saved without
     * (Recipe & Charges rework, P2).
     *
     * Saves written before P2 have stations with no `selectedRecipeId`, because
     * stations did not have one — adjacency decided what they made. They come
     * out of here holding the R-5 default, the same state a station placed today
     * would be in.
     *
     * **No schema bump.** `GAME_VERSION` names the version at which a save's
     * structure last *broke*, and this does not break one: the field is
     * optional and its absence has a defined meaning. Bumping it would refuse
     * every existing save outright — the check above is exact-match, with no
     * partial path — which is the opposite of migrating them.
     */
    StationRecipe.backfillBoardSelections(migrated);

    return migrated;
}

/** An object we can merge field-by-field — not an array, not null. */
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
