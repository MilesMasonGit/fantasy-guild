// The clock the game's rules read for "now".

/**
 * `now()` is `Date.now()` in live play. During a catch-up it starts at the moment the save was
 * written and moves only as the catch-up's steps do: the wall clock moves ~22 s while 24 hours
 * play, so a rule that compares two moments (an effect's expiry, loot's age, a rate window) would
 * otherwise see no time pass at all.
 *
 * ⚠️ Only rules read this. Ids, save stamps, notifications and drawing keep `Date.now()`
 * (`RulesUseGameClock.test.js` lists who may, and why).
 */

/** The game clock during a catch-up, in epoch ms; null in live play. */
let catchUpNowMs = null;

/** The game's "now", in epoch ms. */
export function now() {
    return catchUpNowMs ?? Date.now();
}

/** Start a catch-up's clock at `startMs` (when the save was written). */
export function begin(startMs) {
    catchUpNowMs = Number(startMs) || 0;
}

/** Move a catch-up's clock on by one step. Live play has nothing to move. */
export function advance(ms) {
    if (catchUpNowMs !== null) catchUpNowMs += ms;
}

/** Back to the wall clock. */
export function end() {
    catchUpNowMs = null;
}

/** Whether a catch-up is playing. */
export function isCatchingUp() {
    return catchUpNowMs !== null;
}
