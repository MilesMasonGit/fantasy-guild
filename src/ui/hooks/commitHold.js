/**
 * Holding the stores' commits while the desktop app is minimised: nobody sees the page, so the
 * stores (`useGameState`, `useTokenState`) stop re-reading the game and asking React to draw on
 * every tick. A store that heard an event while held waits here; on release every waiting store
 * reads once, together, so the restored window is current at once.
 * ⚠️ Only what React draws: the engine's tick and the saves are timers of their own.
 */

let held = false;
const waiting = new Set();

/** Whether the stores' commits are held ({@link setCommitsHeld}). */
export function areCommitsHeld() {
    return held;
}

/**
 * Hold (`true`) or release (`false`). Released, every store waiting is called once, in the order
 * it started waiting.
 * @param {boolean} on
 */
export function setCommitsHeld(on) {
    on = !!on;
    if (on === held) return;
    held = on;
    if (held) return;
    const due = [...waiting];
    waiting.clear();
    for (const fn of due) {
        try {
            fn();
        } catch (err) {
            // One store that throws must not leave the others stale.
            console.error('[commitHold] a store threw on release', err);
        }
    }
}

/**
 * Call `fn` once when the hold is released. Waiting twice with the same function is one wait.
 * @param {() => void} fn
 * @returns {() => void} stop waiting (an unmounting store)
 */
export function whenCommitsReleased(fn) {
    waiting.add(fn);
    return () => { waiting.delete(fn); };
}
