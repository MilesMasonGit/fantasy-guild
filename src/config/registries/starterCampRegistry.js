// Fantasy Guild — the Starter Camp (loader)

import { DatabaseManager } from '../DatabaseManager.js';
import { normaliseStarterCamp, isEmptyStarterCamp } from '../starterCampShape.js';

/**
 * The Starter Camp the owner laid out: `data/starterCamp.json`, written only by the CMS's Sync to
 * Game. The shape is `starterCampShape.js`'s.
 *
 * ⚠️ Never hand-edit `data/starterCamp.json`: the CMS writes it wholesale.
 */

function loadJsonCamp() {
    for (const [path, module] of Object.entries(DatabaseManager.starterCampFilesSingle || {})) {
        try {
            const camp = normaliseStarterCamp(module.default || module);
            return isEmptyStarterCamp(camp) ? null : camp;
        } catch (error) {
            console.warn(`[StarterCamp] Error loading ${path}:`, error);
        }
    }
    return null;
}

const fromFile = loadJsonCamp();
let override;

/**
 * The authored Starter Camp, or null when there is none: no file, or one with no Tokens and an empty
 * Bank (what the CMS's Clear writes). Null means the game opens on its built-in camp.
 */
export function authoredStarterCamp() {
    return override === undefined ? fromFile : override;
}

/**
 * Use `raw` as the authored camp instead of the file's (null: as if there were no file). **For test
 * fixtures and dev checks only**, like `registerTokenTypes`; nothing in `src/systems` or `src/ui` may
 * call it. {@link resetStarterCampForTests} puts the file's back.
 */
export function setStarterCampForTests(raw) {
    const camp = raw == null ? null : normaliseStarterCamp(raw);
    override = isEmptyStarterCamp(camp) ? null : camp;
}

/** Undo {@link setStarterCampForTests}. */
export function resetStarterCampForTests() {
    override = undefined;
}
