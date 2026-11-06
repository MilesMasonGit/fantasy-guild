// where a hero stands to work a Token

import { artRadiusOf, matW } from '../../config/matGeometry.js';

/**
 * Gap between a Token's art edge and the centre of the hero working it, in mat units. Wide enough
 * that a fighting hero's health bar, with a four-digit HP number on it, clears the enemy's bar
 * even where the art steps up to its largest (`FightBars.test.js`).
 */
export const STAND_GAP = 32;

/**
 * The point beside a Token (or spot) at `centre` where a hero stands to work it,
 * on `side` (−1 left, 1 right). If that side would put the hero off the mat,
 * the other side is used.
 *
 * ⚠️ A leaf: `HeroMotion` and `FightRoom` both stand heroes here, and `HeroMotion` imports
 * `FightRoom`, so this file imports nothing from the board.
 */
export function standingSpot(typeId, centre, side) {
    const offset = artRadiusOf(typeId) + STAND_GAP;
    let x = centre.x + side * offset;
    if (x < 0 || x > matW()) x = centre.x - side * offset;
    return { x, y: centre.y };
}
