// the mat-wide Token cap

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { matTuning } from '../../config/matTuning.js';
import * as BoardState from './BoardState.js';

/**
 * How many Tokens the player may have placed on the mat. Only placed Tokens count (`origin:
 * 'placed'`): spawned trees, veins and enemies are bounded by their family's cap, so an idle mat
 * full of trees never blocks a purchase. The Guild Hall never counts.
 *
 * The number is the Mat Tuner's `matCap`, read live. The Shop and `Placement` ask {@link
 * canPlaceMore} before adding a Token.
 */

/** Whether an instance is the Guild Hall — the same test `Cartographer` uses. */
export function isGuildHall(instance) {
    return instance?.typeId === 'token_guild_hall' || !!getTokenType(instance?.typeId)?.isGuildHall;
}

/**
 * Placed Tokens on the mat now, not counting the Guild Hall, plus placed Tokens waiting in the
 * discard bin: a binned Token still counts until it is discarded, so the bin cannot be used to
 * dodge the cap. Spawned Tokens in the bin do not count, as on the mat.
 */
export function placedCount() {
    let n = 0;
    for (const t of BoardState.tokens()) {
        if (BoardState.originOf(t) === BoardState.ORIGIN.PLACED && !isGuildHall(t)) n++;
    }
    for (const t of BoardState.binTokens()) {
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
