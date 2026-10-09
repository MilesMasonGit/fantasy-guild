// the Tokens the player is carrying

/**
 * Instance ids of Tokens the player is dragging right now. Runtime only, never saved: a drag does
 * not outlive the page. The drag marks a Token with {@link setInHand} as it starts and clears the
 * mark after the drop has been handled.
 *
 * A carried Token is paused: it does not work, fight, grow or turn, and a charge spent on it that
 * empties it does not remove it until it is put down. The drag is keyed by the Token's instance
 * id, so a Token that vanished or became a new instance mid-drag would leave the drop with nothing
 * to land.
 *
 * ⚠️ A leaf module: `Charges` and `TimedChanges` both read it, and `TimedChanges` already reaches
 * `Charges` through `EffectActions`, so this must import nothing from the board.
 */
const inHand = new Set();

/** `id → what to do once Token id is put down`. One entry per Token; the latest wins. */
const onPutDown = new Map();

/** Mark Token `id` as in the player's hand (`true`) or put down (`false`). */
export function setInHand(id, held) {
    if (id == null) return;
    if (held) {
        inHand.add(id);
        return;
    }
    inHand.delete(id);
    const settle = onPutDown.get(id);
    onPutDown.delete(id);
    settle?.();
}

/** Whether Token `id` is in the player's hand. */
export function isInHand(id) {
    return inHand.has(id);
}

/** Run `fn` when Token `id` is put down. Replaces anything already waiting on it. */
export function whenPutDown(id, fn) {
    if (id == null || typeof fn !== 'function') return;
    onPutDown.set(id, fn);
}
