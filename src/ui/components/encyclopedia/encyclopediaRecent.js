// the entries looked at lately in the Encyclopedia, newest first, for its opening page

/** How many recent entries the opening page lists, of each kind. */
export const RECENT_COUNT = 8;

let viewed = [];

/**
 * Note that `key` was looked at: it moves to the front, each entry once. Kept for the session in
 * memory only (a reload starts the list again): nothing in the save or the run changes.
 */
export function noteViewed(key) {
    if (typeof key !== 'string' || !key) return;
    viewed = [key, ...viewed.filter(k => k !== key)].slice(0, RECENT_COUNT);
}

/** The entries looked at lately, newest first. */
export const recentlyViewed = () => viewed;

/** Forget them all (tests). */
export function clearViewed() {
    viewed = [];
}
