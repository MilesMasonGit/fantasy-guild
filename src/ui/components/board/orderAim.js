import * as Flags from '../../../systems/board/Flags.js';
import * as Orders from '../../../systems/board/Orders.js';

/**
 * Where a carried hero is aimed: the Token under the pointer (`Flags.tokenAtPoint`, the very test
 * the drop uses, so the aim and the drop never disagree at a Token's edge) and what a drop there
 * would do (`Orders.aimAt`): snap the flag to its centre, or refuse with a reason.
 */

const NOWHERE = Object.freeze({ instance: null, snap: false, reason: null });

/**
 * A per-drag aim for `heroId`: `aim(point)` (a mat point, or null off the mat) answers
 * `{ instance, snap, reason }`. The hit test runs on every call; what a drop would do is worked out
 * only when the Token under the point changes, and the same answer object is handed back until
 * then, so a caller can tell a change by identity. `instance` is the live record: a Token that
 * moves mid-drag is snapped to where it stands now.
 */
export function createOrderAim(heroId, { hit = Flags.tokenAtPoint, aimAt = Orders.aimAt } = {}) {
    let last = NOWHERE;
    return function aim(point) {
        const instance = point ? hit(point) : null;
        if ((instance?.id ?? null) === (last.instance?.id ?? null)) return last;
        if (!instance) return (last = NOWHERE);
        const verdict = aimAt(heroId, instance);
        return (last = { instance, snap: !!verdict.snap, reason: verdict.snap ? null : (verdict.reason || null) });
    };
}
