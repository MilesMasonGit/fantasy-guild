// Fantasy Guild — one drop handler for "a Token was dragged onto a tile" (CR2-160)

import { BOARD_SIZE, BOARD_PX, TILE_PX, TILE_STEP_PX, colOf, rowOf } from '../../../config/boardGeometry.js';
import { closest2x2Anchor } from './boardConstants.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import * as VaultTransfer from '../../../systems/board/VaultTransfer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';

/**
 * The playmat and the Tray's mini-board are two windows onto the same board, so
 * a Token dropped on either has to land the same way. They used to each carry
 * their own copy of this, and the copies had drifted: the mini-board knew four
 * of the six places a Token can be dragged FROM, so a Map lifted off the playmat
 * and a freshly-created Token both fell through every branch and did nothing at
 * all (CR2-160).
 *
 * There are six origins, and they are told apart by which key the drag payload's
 * `from` descriptor carries:
 *
 * - `boardMapId`  — a Map already lying loose on the playmat
 * - `tile`        — a Token standing on a tile
 * - `spriteId`    — a loose loot Token floating over the grid
 * - `traySlot`    — a Token loose on the Tray
 * - `vaultTypeId` — a row in the Vault
 * - none of them  — a bare `typeId`, i.e. "make one and put it there"
 *
 * ⚠️ **Nothing here decides whether a tile will take the Token.** Every rule —
 * bounds, displacement, the Guild Hall, the hero standing on top — lives in
 * `Placement.js`, and the Vault's own rules live in `VaultTransfer.js`. This
 * function only works out WHICH tile the player meant and hands the Token over,
 * putting it back where it came from if the answer is no (D-138).
 */

/** Report a refusal rather than swallowing it — the player needs the reason. */
export const announce = (result) => {
    if (result && result.success === false && result.reason && result.reason !== 'Already there') {
        NotificationSystem.warning(result.reason);
    }
    return result;
};

/**
 * Where a 2×2 Token dropped over `index` should actually anchor.
 *
 * With a pointer on the real playmat this snaps to the nearest 2×2 anchor, so
 * the Token sits under the cursor rather than down-right of it. Without one —
 * the mini-board has no playmat pixels to measure against — it clamps the hovered
 * tile into the bottom-right-most anchor that still fits on the board.
 */
function anchorFor(index, size, dropInfo, originEl) {
    if (size !== 2) return index;
    if (dropInfo?.pointer && originEl) {
        const r = originEl.getBoundingClientRect();
        return closest2x2Anchor(dropInfo.pointer.x - r.left, dropInfo.pointer.y - r.top);
    }
    const row = Math.min(rowOf(index), BOARD_SIZE - 2);
    const col = Math.min(colOf(index), BOARD_SIZE - 2);
    return row * BOARD_SIZE + col;
}

/**
 * Where a Map dropped over `index` should sit. Maps do not snap to the grid —
 * they lie freely on top of the playmat at pixel coordinates.
 */
function mapPositionFor(index, dropInfo, originEl, scale) {
    if (dropInfo?.pointer && originEl) {
        // ⚠️ The only place in the board that has to know about the board's
        // scale. `getBoundingClientRect` reports the SCALED box, so the offset
        // from its corner is in screen pixels — but `x`/`y` are written straight
        // into the untransformed 944px coordinate space as CSS `left`/`top`.
        // Without dividing, a Map dropped on a shrunk board lands progressively
        // further from the cursor the smaller the window is.
        const k = scale || 1;
        const r = originEl.getBoundingClientRect();
        const bx = (dropInfo.pointer.x - r.left) / k;
        const by = (dropInfo.pointer.y - r.top) / k;
        return {
            x: Math.max(0, Math.min(BOARD_PX - TILE_PX, Math.round(bx - TILE_PX / 2))),
            y: Math.max(0, Math.min(BOARD_PX - TILE_PX, Math.round(by - TILE_PX / 2)))
        };
    }
    return { x: colOf(index) * TILE_STEP_PX, y: rowOf(index) * TILE_STEP_PX };
}

/**
 * Put the dragged Token on the board.
 *
 * @param {number} index    The tile the player dropped over.
 * @param {object} payload  The drag payload — `typeId`, `usesRemaining`, `from`.
 * @param {object|null} dropInfo  `{ pointer: {x, y} }` when the drop happened on
 *   the real playmat. The mini-board passes nothing: its pointer coordinates are
 *   over the Tray, not over the board, so measuring against them would place
 *   Maps and 2×2 Tokens somewhere the player never pointed.
 * @param {object} [options] `{ scale }` — how much the playmat is shrunk to fit.
 */
export function placeTokenFromDrag(index, payload, dropInfo = null, options = {}) {
    if (!payload) return;
    const originEl = typeof document !== 'undefined' ? document.querySelector('[data-board-origin]') : null;
    const def = getTokenType(payload.typeId);

    // A Map is positioned freely on the playmat rather than snapped to a cell.
    if (def?.mapId) {
        const { x, y } = mapPositionFor(index, dropInfo, originEl, options.scale);

        if (payload.from?.boardMapId != null) {
            BoardState.setBoardMapPosition(payload.from.boardMapId, x, y);
            EventBus.publish('state_changed', {});
            return;
        }
        if (payload.from?.traySlot != null) {
            const instance = BoardState.takeFromTray(payload.from.traySlot);
            if (!instance) return;
            BoardState.addBoardMap(instance.typeId, x, y, instance.usesRemaining);
            EventBus.publish('state_changed', {});
            return;
        }
        if (payload.from?.tile != null) {
            const instance = BoardState.takeToken(payload.from.tile);
            if (!instance) return;
            BoardState.addBoardMap(instance.typeId, x, y, instance.usesRemaining);
            EventBus.publish('state_changed', {});
            return;
        }
        BoardState.addBoardMap(payload.typeId, x, y, payload.usesRemaining || 1);
        EventBus.publish('state_changed', {});
        return;
    }

    // Everything else snaps to a grid tile.
    const targetIndex = anchorFor(index, def?.size || 1, dropInfo, originEl);

    if (payload.from?.boardMapId != null) {
        const instance = BoardState.removeBoardMap(payload.from.boardMapId);
        if (!instance) return;
        const result = announce(Placement.placeToken(targetIndex, instance));
        if (!result.success) BoardState.addBoardMap(instance.typeId, 0, 0, instance.usesRemaining);
        return;
    }
    if (payload.from?.tile != null) {
        announce(Placement.moveToken(payload.from.tile, targetIndex));
        return;
    }
    if (payload.from?.spriteId != null) {
        const instance = SpriteLayer.takeTokenSprite(payload.from.spriteId);
        if (!instance) return;
        const result = announce(Placement.placeToken(targetIndex, instance));
        if (!result.success) {
            SpriteLayer.addSprite('token', instance.typeId, 1, targetIndex, instance.usesRemaining);
        } else {
            EventBus.publish('loot_token_placed', { tile: targetIndex, typeId: instance.typeId });
        }
        return;
    }
    if (payload.from?.traySlot != null) {
        const instance = BoardState.takeFromTray(payload.from.traySlot);
        if (!instance) return;
        const result = announce(Placement.placeToken(targetIndex, instance));
        // Put it back exactly where it came from if the tile refused it
        if (!result.success) BoardState.addToTray(instance);
        return;
    }
    // ⚠️ No `vault_withdrawn` / `token_bank_updated` publish on this route.
    // `TokenBank.withdraw` already made both, and republishing them counted one
    // withdrawal twice on every quest that watches for it (CR2-146).
    if (payload.from?.vaultTypeId != null) {
        announce(VaultTransfer.withdrawTo(payload.from.vaultTypeId, { tile: targetIndex }));
        return;
    }
    if (payload.typeId) {
        const instance = BoardState.createTokenInstance(payload.typeId, payload.usesRemaining);
        announce(Placement.placeToken(targetIndex, instance));
    }
}
