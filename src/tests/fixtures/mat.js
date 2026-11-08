// Fantasy Guild — test helper: laying Tokens out on the free playmat (Free Playmat 1.6a)

/**
 * **For tests only.** `MatHelperGuard.test.js` fails if any file outside
 * `src/tests/` imports this.
 */

import * as BoardState from '../../systems/board/BoardState.js';
import { tokenStartingUses } from '../../config/registries/tokenRegistry.js';

/** One layout step, in mat units — the old tile step (128 art + 32 gap). Test layout only. */
export const SPACING = 160;

/**
 * Put a Token on the mat at `(x, y)`, no rules. Accepts a type id (a fresh
 * instance with its starting charges) or an instance.
 *
 * @returns the instance now on the mat
 */
export function placeAt(typeIdOrInstance, x, y) {
    const instance = typeof typeIdOrInstance === 'string'
        ? BoardState.createTokenInstance(typeIdOrInstance, tokenStartingUses(typeIdOrInstance))
        : typeIdOrInstance;
    return BoardState.addToken(instance, x, y);
}

/** Take every Token off the mat. */
export function clearMat() {
    for (const token of BoardState.tokens()) BoardState.removeToken(token.id);
}
