// Fantasy Guild — test helper: laying Tokens out on the free playmat (Free Playmat 1.6a)

/**
 * **For tests only.** `MatHelperGuard.test.js` fails if any file outside
 * `src/tests/` imports this.
 *
 * Tokens sit at points on the mat (mat units: 1 u = one natural board pixel).
 * These helpers put them there with **no rules applied** — no spacing, no
 * `Cannot`, no events — so a test can build exactly the layout it means.
 *
 * `SPACING` and `tileCentre` are **test layout**, not a game concept: the game
 * has no tiles. They exist so a test can lay Tokens out at today's familiar
 * step while the tile-shaped readers are still being moved (slices 1.6b–1.6d).
 */

import * as BoardState from '../../systems/board/BoardState.js';
import { tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { tileCentre as geometryTileCentre } from '../../config/boardGeometry.js';

/** One layout step, in mat units — today's tile step (128 art + 32 gap). Test layout only. */
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
    for (const [tile] of BoardState.vacancies()) BoardState.setVacancy(tile, null);
}

/**
 * Where tile `i` of the old 6×6 layout had its centre. **Test layout only** —
 * a convenience for tests that still speak in the tile readers' terms.
 */
export function tileCentre(i) {
    return geometryTileCentre(i);
}
