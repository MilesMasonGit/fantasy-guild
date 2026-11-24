// the ground a job covers: a Token and the heroes working it

import { artRadiusOf } from '../../config/matGeometry.js';
import { STAND_GAP } from './standing.js';

/**
 * ⚠️ A leaf with pure maths only: the mat's job areas (`ui/components/board/taskRing.js`) and where
 * loot lands (`SpriteLayer`) both measure a job by it, so it imports nothing from the board's state.
 */

/** The hero's clickable box, narrower than the art it draws. */
export const HERO_HIT_PX = 64;

/** The hero's box height: the 64 px art at 2×, centred on the hero's point. */
export const HERO_BOX_PX = 128;

/** The room an area leaves round its Token and heroes, in whole art pixels. */
export const TASK_RING_PAD_PX = 2;

/**
 * One job's area, in mat units. It is centred on the middle of the Token's point and every working
 * hero's (the sprites' visual centres sit within a few units of those points), and its radius
 * reaches the farthest corner of the Token's body (`artRadiusOf`) and of each hero's figure
 * (`HERO_HIT_PX` by `HERO_BOX_PX`, centred on where they stand, as `MatHero` draws it), plus
 * {@link TASK_RING_PAD_PX}. About 60 art pixels round a one-cell Token and one hero at a
 * 1920 × 1080 window.
 * @param {{id?: string, x: number, y: number, typeId?: string}} token
 * @param {{x: number, y: number}[]} heroes where each hero working it stands
 * @param {number} artScale mat units per art pixel
 * @returns {{id: string, x: number, y: number, r: number}}
 */
export function taskRingOf(token, heroes, artScale) {
    const body = artRadiusOf(token.typeId);
    let sx = token.x;
    let sy = token.y;
    for (const h of heroes) {
        sx += h.x;
        sy += h.y;
    }
    const x = sx / (heroes.length + 1);
    const y = sy / (heroes.length + 1);
    const boxes = [[token.x - body, token.y - body, token.x + body, token.y + body]];
    for (const h of heroes) {
        boxes.push([h.x - HERO_HIT_PX / 2, h.y - HERO_BOX_PX / 2, h.x + HERO_HIT_PX / 2, h.y + HERO_BOX_PX / 2]);
    }
    let far = 0;
    for (const [l, t, r, b] of boxes) far = Math.max(far, Math.hypot(Math.max(x - l, r - x), Math.max(y - t, b - y)));
    return { id: token.id, x, y, r: far + TASK_RING_PAD_PX * artScale };
}

/**
 * The radius a one-hero job's area would have round a Token of `typeId` (a size-1 Token when none
 * is known): {@link taskRingOf} with one hero at its standing spot (`standing.js`).
 */
export function oneHeroReachOf(typeId, artScale) {
    const hero = { x: artRadiusOf(typeId) + STAND_GAP, y: 0 };
    return taskRingOf({ x: 0, y: 0, typeId }, [hero], artScale).r;
}
