
import * as Placement from '../../../systems/board/Placement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Shop from '../../../systems/board/Shop.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { DRAG_KIND } from '../../dnd/dragConstants.js';

/**
 * Everything dropped on the playmat lands through `dropOnMat(payload, point)`: a drag payload
 * and a mat point (mat units). Every surface that places on the mat calls it, so no surface
 * can drift from another.
 * What lands where (free placement):
 * * **A hero or a flag**: the flag stands exactly where it was let go, clamped to the mat
 * (`Placement.plantFlagAt`), or, let go on a Token its hero can work, is pinned to that Token.
 * * **Any Token** stands exactly where it was let go, or at the nearest legal point when that
 * spot is crowded or would break a `Cannot` rule. Nothing snaps.
 * A Token can come from three places, told apart by its payload's `from`: `instanceId` (a Token
 * on the mat), `shop` (a Shop row: bought at the drop point, `Shop.buyAt`), or none (a bare
 * `typeId`: make one).
 * ⚠️ Nothing here decides whether a Token may land. Every rule lives in `MatPlacement.js` and
 * `Placement.js`. This function works out what the player meant, and a refused move leaves the
 * Token on the spot it was moved off.
 * @returns the placement result (`{ success, reason?, flyBack? }`) or null
 */

/**
 * Report a refusal rather than swallowing it: the player needs the reason. It is said as a callout
 * on the mat over what was involved, never as a notification: over the Token (`at.instanceId`), or
 * at the mat point it was aimed at (`at.x`, `at.y`). A refusal the mat has already said
 * (`alerted`) is not said twice, and one with nowhere on the mat to say it is a plain cancel.
 */
export const announce = (result, at = null) => {
    if (result && result.success === false && result.reason && result.reason !== 'Already there' && !result.alerted) {
        const hasPoint = Number.isFinite(at?.x) && Number.isFinite(at?.y);
        if (at?.instanceId || hasPoint) {
            EventBus.publish(UI_EVENTS.UI_TOKEN_ALERT, {
                instanceId: at.instanceId || null,
                x: at.x,
                y: at.y,
                severity: 'disallow',
                type: 'drop_rejected',
                title: result.reason,
                message: result.reason
            });
        }
    }
    return result;
};

const refuse = (reason, extra = {}) => ({ success: false, reason, ...extra });

const isHeroDrop = (payload) => payload?.kind === DRAG_KIND.HERO || payload?.kind === DRAG_KIND.FLAG;

/**
 * A drop with nowhere to go flies back.
 *
 * `full` is `MatPlacement`'s "no legal spot within nudge reach" — the one
 * refusal the drag system animates rather than merely reporting, because the
 * Token is still in the player's hand and has to visibly return to where it came
 * from. Every other refusal has already put the Token back itself.
 */
const flownBack = (result) => (result?.full ? { ...result, flyBack: true } : result);

export function dropOnMat(payload, point) {
    if (!payload) return null;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return refuse('Nowhere to drop that');

    if (isHeroDrop(payload)) {
        if (!payload.heroId) return null;
        if (payload.kind === DRAG_KIND.FLAG && !BoardState.flagOf(payload.heroId)) {
            return announce(refuse('That hero has no flag planted'), point);
        }
        // A drop on a Token the hero can work pins the flag to it.
        return announce(Placement.plantFlagAt(payload.heroId, point, { pin: true }), point);
    }

    const from = payload.from || {};

    if (from.instanceId != null) {
        if (!BoardState.getTokenById(from.instanceId)) return announce(refuse('No Token there'), point);
        // A refused move leaves the Token where it was: said over it.
        return announce(flownBack(Placement.moveTokenTo(from.instanceId, point)), { instanceId: from.instanceId, ...point });
    }

    // A Shop row dragged onto the mat, paid on drop and placed at the drop point. A point off
    // the mat (the proximity fallback can hand the mat a drop just outside it) is a plain
    // cancel: flown back, not announced. Must come before the bare-typeId route, which makes a
    // Token for nothing.
    if (from.shop) {
        const res = Shop.buyAt(payload.typeId || from.shop, point);
        if (res?.offMat) return { ...res, flyBack: true };
        return announce(res?.success ? res : { ...res, flyBack: true }, point);
    }

    if (payload.typeId) {
        const instance = BoardState.createTokenInstance(payload.typeId, payload.usesRemaining);
        return announce(flownBack(Placement.placeTokenAt(instance, point)), point);
    }
    return null;
}
