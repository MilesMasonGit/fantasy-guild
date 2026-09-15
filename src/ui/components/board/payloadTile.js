// Fantasy Guild — board event payload → drawn tile (Free Playmat slice 1.6b)

import * as BoardState from '../../../systems/board/BoardState.js';

/**
 * # ⚠️ STOPGAP — deleted in slice 1.6c (the mat renderer)
 *
 * Since slice 1.6b every board event names what it happened to by **Token
 * instance id** (`instanceId`) and, when there is no Token to name — a spot
 * that ran dry, a refused drop, a Token that has just left — by **mat point**
 * (`x`, `y`). There are no tiles in the payloads.
 *
 * The grid renderer still draws tiles, so its components (`TileProgressBar`,
 * `TileEventAlert`, the charge badges, `EffectProcText`) ask this one adapter
 * which drawn tile a payload means. The mat renderer (1.6c) draws Tokens by id
 * and deletes this file.
 *
 * @param {object} payload a board event payload
 * @returns {number|null} the tile it is drawn on, or null
 */
export function tileOfPayload(payload) {
    if (!payload) return null;
    if (payload.instanceId) {
        const tile = BoardState.tileOfToken(payload.instanceId);
        if (tile != null) return tile;
    }
    if (Number.isFinite(payload.x) && Number.isFinite(payload.y)) {
        return BoardState.tileAtPoint({ x: payload.x, y: payload.y });
    }
    return null;
}

/** Whether a board event payload is about drawn tile `tile`. STOPGAP (deleted in 1.6c). */
export function payloadIsForTile(payload, tile) {
    return tile != null && tileOfPayload(payload) === tile;
}
