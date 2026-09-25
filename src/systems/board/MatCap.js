// Fantasy Guild — The mat-wide Token cap (Token Lifecycle slice 3.1, SP-10 / SP-67)

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { matTuning } from '../../config/matTuning.js';
import * as BoardState from './BoardState.js';

/**
 * ⭐ **How many Tokens the player may have placed on the mat.**
 *
 * SP-10 caps the mat for performance and as the limit on how far a player can
 * scale; SP-67 narrows it to **placed** Tokens only (`origin: 'placed'`, DP-3).
 * Spawned trees, veins and enemies are already bounded by their family's cap
 * (SP-5), so an idle mat full of trees never blocks a purchase.
 *
 * The Guild Hall never counts: it is always there and cannot be removed.
 *
 * The number is a Mat Tuner setting (`matCap`), read live.
 *
 * ⚠️ Nothing enforces this yet. The Shop (slice 5.1) asks {@link canPlaceMore}
 * before selling a Token; the existing drag routes are not gated here.
 */

/** Whether an instance is the Guild Hall — the same test `Cartographer` uses. */
function isGuildHall(instance) {
    return instance?.typeId === 'token_guild_hall' || !!getTokenType(instance?.typeId)?.isGuildHall;
}

/** Placed Tokens on the mat now, not counting the Guild Hall. */
export function placedCount() {
    let n = 0;
    for (const t of BoardState.tokens()) {
        if (BoardState.originOf(t) === BoardState.ORIGIN.PLACED && !isGuildHall(t)) n++;
    }
    return n;
}

/** The cap, from the Mat Tuner. */
export function matCap() {
    return Math.round(matTuning('matCap'));
}

/** Whether `count` more placed Tokens would still fit under the cap. */
export function canPlaceMore(count = 1) {
    return placedCount() + count <= matCap();
}
