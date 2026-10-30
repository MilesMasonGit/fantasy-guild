// what the screen does before the guild travels: put down what is carried, drop the open ceremony

import * as Atlas from '../../../systems/atlas/Atlas.js';
import * as CatchUp from '../../../systems/core/CatchUp.js';

/** Marks the Escape this file sends, so the Atlas screen's own Escape does not close on it. */
export const END_DRAG_MARK = 'atlasEndDrag';

/**
 * Cancel the drag in progress. dnd-kit's pointer sensor cancels on an Escape keydown at the
 * document; the cancel re-renders the carried Token, whose clean-up takes it out of the hand
 * (`Hand.setInHand`).
 */
export function endDrag(doc = typeof document !== 'undefined' ? document : null) {
    if (!doc) return;
    const KeyEvent = doc.defaultView?.KeyboardEvent || KeyboardEvent;
    const event = new KeyEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
    event[END_DRAG_MARK] = true;
    doc.dispatchEvent(event);
}

/** Long enough for the cancel's render and its effect clean-ups; no `requestAnimationFrame`, which a hidden tab never runs. */
const DROP_SETTLE_MS = 50;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Travel to Region `id` from the Atlas screen. ⚠️ A Token still in the hand when the board is
 * swapped would run its put-down work (`Hand.whenPutDown`) on the other Region's board, so a drag
 * is ended and let settle first. While a catch-up runs travel refuses, so that never happens
 * then.
 *
 * @returns {Promise<object>} what `Atlas.travel` returned
 */
export async function travelFromScreen(id, {
    isDragging = false, travel = Atlas.travel, end = endDrag, settle = () => wait(DROP_SETTLE_MS)
} = {}) {
    if (CatchUp.isRunning()) return travel(id);
    if (isDragging) {
        end();
        await settle();
    }
    return travel(id);
}
