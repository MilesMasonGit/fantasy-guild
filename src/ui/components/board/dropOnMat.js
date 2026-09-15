// Fantasy Guild — the one drop function for the playmat (Free Playmat slice 1.6c)

import { TILE_PX } from '../../../config/boardGeometry.js';
import { MAT_W, MAT_H } from '../../../config/matGeometry.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import * as VaultTransfer from '../../../systems/board/VaultTransfer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import { oldSpotAt, isFarOutsideArea } from './oldSpotStopgap.js';

/**
 * ⭐ **Everything dropped on the playmat lands through `dropOnMat(payload, point)`**
 * — a drag payload and a mat point (mat units). It replaced
 * `placeTokenFromDrag(index, …)` in slice 1.6c: there are no tiles, so a drop
 * is a point. The playmat's own drop target, today's grid tiles and the Tray's
 * mini-board all call it, so no surface can drift from another (CR2-160).
 *
 * ## What lands where
 * * **A hero or a flag** (`DRAG_KIND.HERO` from the Dock, `DRAG_KIND.FLAG` for
 *   the flag or a hero picked up on the board, FP-76) — the flag stands
 *   **exactly where it was let go**, clamped to the mat (FP-94,
 *   `Placement.plantFlagAt`).
 * * **A Map** — lies loose on the mat, its box centred on the point (clamped).
 * * **Any other Token** — ⚠️ STOPGAP (deleted in 1.6d): snaps to the nearest of
 *   today's old spots (`oldSpotStopgap.js`), occupied or not, then goes through
 *   the tile placement rules exactly as before. A drop **well outside** the old
 *   landing area flies back with a note (FP-93) instead.
 *
 * A Token can come from six places, told apart by its payload's `from`:
 * `boardMapId` (a Map lying on the mat), `instanceId` (a Token on the mat),
 * `spriteId` (loot on the floor), `traySlot`, `vaultTypeId`, or none (a bare
 * `typeId`: make one).
 *
 * ⚠️ **Nothing here decides whether a spot will take the Token.** Every rule
 * lives in `Placement.js` and `VaultTransfer.js`. This function works out what
 * the player meant and puts the Token back where it came from if the answer is
 * no (D-138).
 *
 * @returns the placement result (`{ success, reason?, flyBack? }`) or null
 */

/** The note for a Token dropped well outside today's landing area (FP-93). STOPGAP wording until 1.10. */
export const PLAY_AREA_NOTE = 'Place inside the play area for now.';

/** Report a refusal rather than swallowing it — the player needs the reason. */
export const announce = (result) => {
    if (result && result.success === false && result.reason && result.reason !== 'Already there') {
        NotificationSystem.warning(result.reason);
    }
    return result;
};

const refuse = (reason, extra = {}) => ({ success: false, reason, ...extra });

const isHeroDrop = (payload) => payload?.kind === DRAG_KIND.HERO || payload?.kind === DRAG_KIND.FLAG;

/** Where a Map box (128 u) sits when dropped at `point`: centred on it, kept on the mat. */
function mapBoxAt(point) {
    return {
        x: Math.max(0, Math.min(MAT_W - TILE_PX, Math.round(point.x - TILE_PX / 2))),
        y: Math.max(0, Math.min(MAT_H - TILE_PX, Math.round(point.y - TILE_PX / 2)))
    };
}

/**
 * STOPGAP (deleted in 1.6d): the old spot a Token drop at `point` would use, or
 * null for a drop that lands freely (a Map, a hero, a flag) or flies back. For
 * the grid renderer's footprint preview.
 */
export function spotForDrop(payload, point) {
    if (!payload?.typeId || isHeroDrop(payload) || !point) return null;
    const def = getTokenType(payload.typeId);
    if (def?.mapId || isFarOutsideArea(point)) return null;
    return oldSpotAt(point, def?.size || 1);
}

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

    // A Map lies freely on the mat.
    if (def?.mapId) {
        const { x, y } = mapBoxAt(point);
        if (from.boardMapId != null) {
            BoardState.setBoardMapPosition(from.boardMapId, x, y);
            EventBus.publish('state_changed', {});
            return { success: true };
        }
        let instance;
        if (from.traySlot != null) instance = BoardState.takeFromTray(from.traySlot);
        else if (from.instanceId != null) {
            // STOPGAP (deleted in 1.6d): lifted off the mat by its old spot.
            const found = BoardState.findTokenById(from.instanceId);
            instance = found?.anchor != null ? BoardState.takeToken(found.anchor) : null;
        } else instance = { typeId: payload.typeId, usesRemaining: payload.usesRemaining || 1 };
        if (!instance) return null;
        BoardState.addBoardMap(instance.typeId, x, y, instance.usesRemaining);
        EventBus.publish('state_changed', {});
        return { success: true };
    }

    // STOPGAP (FP-93, deleted in 1.6d): well outside today's landing area, a Token
    // flies back. Checked before anything is lifted, so nothing is ever lost.
    if (isFarOutsideArea(point)) {
        return announce(refuse(PLAY_AREA_NOTE, { flyBack: true }));
    }

    // STOPGAP (deleted in 1.6d): the nearest old spot, occupied or not.
    const index = oldSpotAt(point, def?.size || 1);

    if (from.boardMapId != null) {
        const instance = BoardState.removeBoardMap(from.boardMapId);
        if (!instance) return null;
        const result = announce(Placement.placeToken(index, instance));
        // Refused: back where it lay.
        if (!result.success) BoardState.addBoardMap(instance.typeId, instance.x, instance.y, instance.usesRemaining);
        return result;
    }
    if (from.instanceId != null) {
        // STOPGAP (deleted in 1.6d): moved by its old spot.
        const found = BoardState.findTokenById(from.instanceId);
        if (found?.anchor == null) return announce(refuse('No Token there'));
        return announce(Placement.moveToken(found.anchor, index));
    }
    if (from.spriteId != null) {
        const instance = SpriteLayer.takeTokenSprite(from.spriteId);
        if (!instance) return null;
        const result = announce(Placement.placeToken(index, instance));
        if (!result.success) {
            // Refused: back onto the floor where it was dropped.
            SpriteLayer.addSprite('token', instance.typeId, 1, { centre: { x: point.x, y: point.y } }, instance.usesRemaining);
        } else {
            // By instance id since slice 1.6b.
            EventBus.publish('loot_token_placed', { instanceId: instance.id, typeId: instance.typeId });
        }
        return result;
    }
    if (from.traySlot != null) {
        const instance = BoardState.takeFromTray(from.traySlot);
        if (!instance) return null;
        const result = announce(Placement.placeToken(index, instance));
        // Put it back exactly where it came from if the spot refused it.
        if (!result.success) BoardState.addToTray(instance);
        return result;
    }
    // ⚠️ No `vault_withdrawn` / `token_bank_updated` publish on this route.
    // `TokenBank.withdraw` already made both, and republishing them counted one
    // withdrawal twice on every quest that watches for it (CR2-146).
    if (from.vaultTypeId != null) {
        return announce(VaultTransfer.withdrawTo(from.vaultTypeId, { tile: index }));
    }
    if (payload.typeId) {
        const instance = BoardState.createTokenInstance(payload.typeId, payload.usesRemaining);
        return announce(Placement.placeToken(index, instance));
    }
    return null;
}
