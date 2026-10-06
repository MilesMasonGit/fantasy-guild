// Fantasy Guild — runtime warning for content that does not resolve

import { logger } from './Logger.js';

/**
 * `warnMissingContent` — say it out loud, once, when a content id resolves to
 * nothing at runtime.
 *
 * The boot-time audit (`systems/core/ContentAudit.js`) walks the *authored*
 * content set, so it cannot see ids that only appear while the game runs: a
 * drop rolled from a table, a Token from a save written before a rename, a
 * sprite asked for by an effect. Those lookups return `null` and carry on, so a
 * missing definition looks like ordinary gameplay; this makes it a console line.
 *
 * It WARNS and never blocks: the content set is deliberately half-authored, so
 * a dangling reference is a normal mid-authoring state.
 *
 * Once per name for the life of the page: the call sites sit on hot paths, and a
 * warning fired every tick would cost frames and be scrolled past.
 */

/** Every `place|kind|id` already reported, so nothing is said twice. */
const alreadyWarned = new Set();

/**
 * Report one unresolvable id, unless this exact one has been reported already.
 *
 * @param {string} where     Module name, as the console prefix — e.g. 'SpriteLayer'.
 * @param {string} kind      What sort of thing was looked for — 'item', 'Token'.
 * @param {string} id        The name that resolved to nothing.
 * @param {string} consequence  What happens instead, in plain words, finishing
 *                              the sentence "…so <consequence>".
 * @param {string} [whereToLookNext]  The closing sentence. Defaults to pointing
 *                              at the boot-time content audit.
 *                              ⚠️ Not right for an id coming out of a **save**: the
 *                              boot audit walks authored content only and cannot see
 *                              a save's ids, so `ContentAudit`'s save pass passes its own.
 * @returns {boolean} Whether this call actually printed anything.
 */
export function warnMissingContent(where, kind, id, consequence, whereToLookNext) {
    const key = `${where}|${kind}|${id}`;
    if (alreadyWarned.has(key)) return false;
    alreadyWarned.add(key);

    logger.warn(where,
        `The ${kind} "${id}" does not exist, so ${consequence}. ` +
        'Nothing is broken in the code — something is pointing at a name that was ' +
        'renamed or removed. ' +
        (whereToLookNext || 'The content check at start-up lists them all.') + ' ' +
        `(Said once; "${id}" will not be mentioned again.)`);
    return true;
}

/**
 * Forget everything reported so far.
 *
 * Only for tests, which need each case to start from silence. The game never
 * calls this: the point of remembering is that it lasts the whole session.
 */
export function resetMissingContentWarnings() {
    alreadyWarned.clear();
}
