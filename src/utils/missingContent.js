// Fantasy Guild — runtime warning for content that does not resolve (CR2-108c)

import { logger } from './Logger.js';

/**
 * `warnMissingContent` — say it out loud, once, when a content id resolves to
 * nothing at runtime.
 *
 * ## Why this exists
 * The boot-time audit (`systems/core/ContentAudit.js`) walks the *authored*
 * content set and reports every reference that dangles. It cannot see the ids
 * that only appear while the game is running: a drop rolled from a table, a
 * Token dragged out of a save written before a rename, a sprite asked for by an
 * effect. Those arrive at four places that all do the same thing — look the id
 * up, get `null`, and carry on as if nothing happened.
 *
 * That is why a missing definition has never looked like a fault. A drop that
 * never arrives, a sprite that never appears, a Token that will not sit down, a
 * Vault deposit that vanishes: every one of them looks exactly like ordinary
 * gameplay. This turns each of them into a line in the console instead.
 *
 * ## It WARNS. It never blocks. (Owner ruling, 2026-08-19)
 * Nothing here changes what the game does next. The content set is deliberately
 * half-authored, so a dangling reference is a normal mid-authoring state rather
 * than a bug. The whole value is that the silence stops.
 *
 * ## Once per name, ever
 * These four sites sit on hot paths — one of them runs on every board tick. A
 * warning that fired sixty times a second would cost frames and be scrolled
 * past, which is worse than saying nothing. So each distinct name is reported
 * the first time it is seen and never again for the life of the page, the same
 * way the boot audit lists each unresolvable id once.
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
 * @param {string} [whereToLookNext]  The closing sentence, telling the reader
 *                              where the rest of the story is. Defaults to
 *                              pointing at the boot-time content audit, which
 *                              is right for the four call sites that report an
 *                              id coming out of the *authored* content set.
 *                              ⚠️ It is NOT right for an id coming out of a
 *                              **save** — the boot audit walks authored content
 *                              only and cannot see a save's ids at all, which
 *                              is the whole of CR2-120. `ContentAudit`'s
 *                              save pass passes its own sentence for that reason.
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
