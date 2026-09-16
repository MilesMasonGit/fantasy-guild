// Fantasy Guild — test helper: laying Tokens out on the free playmat (Free Playmat 1.6a)

/**
 * **For tests only.** `MatHelperGuard.test.js` fails if any file outside
 * `src/tests/` imports this.
 *
 * Tokens sit at points on the mat (mat units: 1 u = one natural board pixel).
 * These helpers put them there with **no rules applied** — no spacing, no
 * `Cannot`, no events — so a test can build exactly the layout it means.
 *
 * `SPACING` is **test layout**, not a game concept: the game has no tiles. It
 * exists so a test can lay Tokens out at a familiar, readable step.
 *
 * ⭐ The tile-shaped helpers here — `tileCentre`, `idAt`, `pointAt` and
 * `anchorOf` — were deleted with the grid in slice 1.6d-2. A test that wants a
 * lattice declares its own, which keeps the layout it means visible in the file
 * that depends on it.
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

/** `n` points in a row, `gap` apart, starting at `(x0, y0)`. */
export function row(n, { x0 = 64, y0 = 64, gap = SPACING } = {}) {
    return Array.from({ length: n }, (_, i) => ({ x: x0 + i * gap, y: y0 }));
}

/** The point `(dx, dy)` away from a Token's centre. */
export function beside(instance, dx = SPACING, dy = 0) {
    return { x: instance.x + dx, y: instance.y + dy };
}

/** Take every Token and vacancy off the mat. */
export function clearMat() {
    for (const token of BoardState.tokens()) BoardState.removeToken(token.id);
    for (const [, vacancy] of BoardState.spotVacancies()) {
        BoardState.setVacancyAt({ x: vacancy.x, y: vacancy.y }, null);
    }
}
