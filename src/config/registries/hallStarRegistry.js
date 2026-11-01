// Fantasy Guild - the Guild Hall's authored stars (loader)

import { DatabaseManager } from '../DatabaseManager.js';
import { setHallSky } from '../guildUpgrades.js';
import { describeStarRank } from '../../systems/progression/hallStarText.js';

/**
 * The sky's authored constellations and stars, read from `data/hallStars.json` (shape:
 * `hallStars.js`) and put into the Hall's live lists (`guildUpgrades.setHallSky`) as this module
 * loads. Without the file the Hall holds only its built-in tracks.
 *
 * ⚠️ **Never hand-edit `data/hallStars.json`.** The CMS writes it wholesale on Sync.
 */
function loadAuthored() {
    const authored = { constellations: {}, stars: {} };
    for (const [path, module] of Object.entries(DatabaseManager.hallStarFilesSingle || {})) {
        try {
            const file = module.default || module;
            Object.assign(authored.constellations, file?.constellations || {});
            Object.assign(authored.stars, file?.stars || {});
        } catch (error) {
            console.warn(`[HallStarRegistry] Error loading stars from ${path}:`, error);
        }
    }
    return authored;
}

/** The sky as the file holds it, bad entries included, for the boot audit. */
const AUTHORED = loadAuthored();

/** The authored sky as the file holds it. */
export function authoredHallSky() {
    return AUTHORED;
}

/**
 * Put a sky into the Hall in place of the authored one: `{ constellations, stars }` in the file's
 * shape. **For test fixtures and the dev QA scenes only**: nothing in `src/systems` may call it.
 * `null` puts the authored sky back.
 */
export function registerHallSky(sky) {
    return setHallSky(sky ?? AUTHORED, { describeRank: describeStarRank });
}

registerHallSky(null);
