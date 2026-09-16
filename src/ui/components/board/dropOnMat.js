// Fantasy Guild — the one drop function for the playmat (Free Playmat slice 1.6d)

import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { MAT_W, MAT_H, TOKEN_PX } from '../../../config/matGeometry.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import * as VaultTransfer from '../../../systems/board/VaultTransfer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { DRAG_KIND } from '../../dnd/dragConstants.js';

/**
 * ⭐ **Everything dropped on the playmat lands through `dropOnMat(payload, point)`**
 * — a drag payload and a mat point (mat units). The playmat's own drop target
 * and the Tray's mini mat both call it, so no surface can drift from another
 * (CR2-160).
 *
 * ## What lands where (free placement, slice 1.6d)
 * * **A hero or a flag** — the flag stands **exactly where it was let go**,
 *   clamped to the mat (FP-94, `Placement.plantFlagAt`).
 * * **A Map** — lies loose on the mat, its box centred on the point.
 * * **Any other Token** — stands **exactly where it was let go**, or at the
 *   nearest legal point when that spot is crowded or would break a `Cannot`
 *   rule (FP-88). ⭐ Nothing snaps: the old spot-snapping stopgap and the
 *   practice outline it needed both went with this slice.
 *
 * A Token can come from six places, told apart by its payload's `from`:
 * `boardMapId` (a Map lying on the mat), `instanceId` (a Token on the mat),
 * `spriteId` (loot on the floor), `traySlot`, `vaultTypeId`, or none (a bare
 * `typeId`: make one).
 *
 * ## ⚠️ Nothing here decides whether a Token may land
 * Every rule lives in `MatPlacement.js`, `Placement.js` and `VaultTransfer.js`.
 * This function works out what the player meant, and puts the Token back exactly
 * where it came from if the answer is no (D-138) — the Tray slot, the Vault, the
 * floor it was lifted from, the spot it was moved off.
 *
 * @returns the placement result (`{ success, reason?, flyBack? }`) or null
 */

/** Report a refusal rather than swallowing it — the player needs the reason. */
export const announce = (result) => {
    if (result && result.success === false && result.reason && result.reason !== 'Already there') {
        NotificationSystem.warning(result.reason);
    }
    return result;
};

const refuse = (reason, extra = {}) => ({ success: false, reason, ...extra });

const isHeroDrop = (payload) => payload?.kind === DRAG_KIND.HERO || payload?.kind === DRAG_KIND.FLAG;

/** Where a Map's 128 u box sits when dropped at `point`: centred on it, kept on the mat. */
function mapBoxAt(point) {
    return {
        x: Math.max(0, Math.min(MAT_W - TOKEN_PX, Math.round(point.x - TOKEN_PX / 2))),
        y: Math.max(0, Math.min(MAT_H - TOKEN_PX, Math.round(point.y - TOKEN_PX / 2)))
    };
}

/**
 * A drop with nowhere to go flies back (FP-46).
 *
 * `full` is `MatPlacement`'s "no legal spot within nudge reach" — the one
 * refusal the drag system animates rather than merely reporting, because the
 * Token is still in the player's hand and has to visibly return to where it came
 * from. Every other refusal has already put the Token back itself.
 */
const flownBack = (result) => (result?.full ? { ...result, flyBack: true } : result);

export function dropOnMat(payload, point) {
    if (!payload) return null;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return announce(refuse('Nowhere to drop that'));

    if (isHeroDrop(payload)) {
        if (!payload.heroId) return null;
        if (payload.kind === DRAG_KIND.FLAG && !BoardState.flagOf(payload.heroId)) {
            return announce(refuse('That hero has no flag planted'));
        }
        return announce(Placement.plantFlagAt(payload.heroId, point));
    }

    const def = getTokenType(payload.typeId);
    const from = payload.from || {};

    // ⚠️ A Map already lying on the mat is MOVED, never re-made. Lifting it and
    // putting down a fresh one would give it a new id, and the drag that is
    // still holding it — along with its burst animation's `bornAt` — refers to
    // the old one.
    if (def?.mapId && from.boardMapId != null) {
        const box = mapBoxAt(point);
        BoardState.setBoardMapPosition(from.boardMapId, box.x, box.y);
        EventBus.publish('state_changed', {});
        return { success: true };
    }

    if (from.boardMapId != null) {
        const map = BoardState.removeBoardMap(from.boardMapId);
        if (!map) return null;
        const instance = BoardState.createTokenInstance(map.typeId, map.usesRemaining);
        const result = announce(flownBack(Placement.placeTokenAt(instance, point)));
        // Refused: back where it lay.
        if (!result.success) BoardState.addBoardMap(map.typeId, map.x, map.y, map.usesRemaining);
        return result;
    }

    if (from.spriteId != null) {
        const instance = SpriteLayer.takeTokenSprite(from.spriteId);
        if (!instance) return null;
        const result = announce(flownBack(Placement.placeTokenAt(instance, point)));
        if (!result.success) {
            // Refused: back onto the floor where it was dropped.
            SpriteLayer.addSprite('token', instance.typeId, 1, { centre: { x: point.x, y: point.y } }, instance.usesRemaining);
        } else {
            EventBus.publish('loot_token_placed', { instanceId: instance.id, typeId: instance.typeId });
        }
        return result;
    }

    if (from.traySlot != null) {
        const instance = BoardState.takeFromTray(from.traySlot);
        if (!instance) return null;
        const result = announce(flownBack(Placement.placeTokenAt(instance, point)));
        // Put it back exactly where it came from if the mat refused it.
        if (!result.success) BoardState.addToTray(instance);
        return result;
    }

    // ⚠️ No `vault_withdrawn` / `token_bank_updated` publish on this route.
    // `TokenBank.withdraw` already made both, and republishing them counted one
    // withdrawal twice on every quest that watches for it (CR2-146).
    if (from.vaultTypeId != null) {
        return announce(flownBack(VaultTransfer.withdrawTo(from.vaultTypeId, { at: point })));
    }

    // ⚠️ Checked LAST of the origins: a Tray Token's payload carries its
    // `instanceId` beside `traySlot`, so `instanceId` alone means "a Token on
    // the mat" only when no other origin is named.
    if (from.instanceId != null) {
        if (!BoardState.getTokenById(from.instanceId)) return announce(refuse('No Token there'));
        return announce(flownBack(Placement.moveTokenTo(from.instanceId, point)));
    }

    if (payload.typeId) {
        const instance = BoardState.createTokenInstance(payload.typeId, payload.usesRemaining);
        return announce(flownBack(Placement.placeTokenAt(instance, point)));
    }
    return null;
}
