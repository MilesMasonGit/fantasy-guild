/**
 * A "While you were away" summary the player has not answered yet, kept in the slot's own save so
 * that closing the window, a reload or a crash does not answer it (`CatchUp.js`, `SaveManager.js`).
 *
 * The mark is a field of the save's envelope, beside `version`, `savedAt` and `state`:
 * `{ since, check, result, earlier }`.
 * - `since`: when the game "Load as I left it" goes back to was left (epoch ms).
 * - `check`: the fingerprint of that save's text (`fingerprint`), or null when there is no copy.
 *   The copy is the slot's backup: after the catch-up's end save it is that save byte for byte,
 *   and while the mark is held no save rolls it away. The next load reads the backup and offers
 *   the undo only if the fingerprint matches.
 * - `result`: the catch-up's result as the summary showed it (`CatchUp.run`).
 * - `earlier`: the news (`summary.news`) of summaries this one replaced on screen, for the banners
 *   once it is answered.
 *
 * The mark sits outside `state`, so the game never sees it, and it travels with the save file it
 * belongs to.
 */

/** The envelope's field. */
export const MARK_KEY = 'unanswered';

/**
 * A save's text, fingerprinted: its length and a 32-bit FNV-1a hash of its UTF-16 code units, so a
 * backup can be told to be the copy without keeping a second copy.
 * @param {string} text
 * @returns {string}
 */
export function fingerprint(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return `${text.length}:${(hash >>> 0).toString(16)}`;
}

/**
 * `json` (a whole save, as `GameState.serializeJson` writes it) with the mark's text added to its
 * envelope, without parsing the save again.
 * @param {string} json
 * @param {string} markText  `JSON.stringify` of the mark
 * @returns {string}
 */
export function attachMark(json, markText) {
    const end = json.lastIndexOf('}');
    if (end < 0 || json.slice(end + 1).trim()) return json;
    return `${json.slice(0, end)},${JSON.stringify(MARK_KEY)}:${markText}}`;
}

/**
 * The mark of a parsed save (`{ version, savedAt, state, unanswered }`), or null when it has none
 * or it is not one.
 * @returns {{ since: number, check: string|null, result: object, earlier: object[] }|null}
 */
export function readMark(data) {
    const mark = data?.[MARK_KEY];
    if (!mark || typeof mark !== 'object') return null;
    if (!Number.isFinite(mark.since) || !mark.result || typeof mark.result !== 'object') return null;
    return {
        since: mark.since,
        check: typeof mark.check === 'string' ? mark.check : null,
        result: mark.result,
        earlier: Array.isArray(mark.earlier) ? mark.earlier.filter(n => n && typeof n === 'object') : []
    };
}
