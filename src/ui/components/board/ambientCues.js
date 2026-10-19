// the dev panel's "now" buttons for the ambient life: a gust now, a bird visit now

/**
 * The ambient life is slow on purpose: a gust comes about once in 45 seconds, a bird about once in
 * 30. For the eye-check the QA panel can ask for one at once; `AmbientLife` listens.
 */

const listeners = new Set();

/** Ask the mat's ambient life for `what` now: `'gust'` or `'birds'`. */
export function cueAmbient(what) {
    for (const fn of [...listeners]) fn(what);
}

/** Hear the cues; returns an unsubscribe. */
export function onAmbientCue(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
