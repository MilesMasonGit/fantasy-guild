// Fantasy Guild — the ring row under a Token and its hero (Token Lifecycle feedback B1.2, TL-22)

import { HERO_HIT_PX, TOKEN_BAR_GAP_U } from './boardConstants.js';
import { FLAG_PX } from './flagGeometry.js';

/**
 * ⭐ **Ring badges** (TL-22, FB-3, FB-4): a Token's live numbers are rings that
 * fill or empty with the number inside, in one row centred under the hero and
 * the Token together — or under the Token alone with no hero at work.
 *
 * Fixed order (owner, B1 rows): cycle, then charges, then the Token's own ring
 * (enemy HP here; spawner count and turn countdown join in B1.3 by passing
 * more entries to the row).
 */

/**
 * A ring's diameter in mat units: about a third of a 1×1 Token's 128 u art,
 * as in the owner-approved mockup. Fixed in mat units like the other badges,
 * so it scales with the mat, not with the art's pixel steps.
 */
export const RING_D_U = 42;

/** The ring's stroke, 3/28 of the diameter (the mockup's proportion). */
export const RING_STROKE_U = RING_D_U * 3 / 28;

/** Space between two rings in the row, in mat units. */
export const RING_GAP_U = 6;

/**
 * Each ring's colour (owner-approved mockup). Cycle fills, charges and HP
 * empty; spawner (fills to cap) and turn (empties) are B1.3's.
 */
export const RING_COLOUR = Object.freeze({
    cycle: '#f4f1e8',
    charges: '#fbbf24',   // the game's gi-gold
    hp: '#F09595',
    spawner: '#86efac',
    turn: '#7dd3fc'
});

/** The stroke a greyed ring (a blocked cycle) is drawn in. */
export const RING_GREY = '#8a8a8a';

/**
 * Where the row goes, as offsets from the Token's centre in mat units:
 * `dx` to the row's horizontal centre, `dy` to its top edge.
 *
 * * **No hero** (`heroX` null): centred under the Token, just below it.
 * * **A hero at work**: centred on the pair's combined horizontal extent — the
 *   hero's 64 u box on one side, the Token on the other — and just below the
 *   lower of the Token's bottom and the hero's feet (the hero's 128 u box is
 *   centred on its point, which is level with the Token's centre).
 *
 * `half` is half the Token's drawn box (the art or the circle, whichever is
 * larger — the same edge the progress bar hung from).
 *
 * @param {{x: number, half: number, heroX?: number|null}} pair
 * @returns {{dx: number, dy: number}}
 */
export function ringRowOffset({ x, half, heroX = null }) {
    if (heroX == null || !Number.isFinite(heroX)) {
        return { dx: 0, dy: half + TOKEN_BAR_GAP_U };
    }
    const heroHalf = HERO_HIT_PX / 2;
    const left = Math.min(x - half, heroX - heroHalf);
    const right = Math.max(x + half, heroX + heroHalf);
    const feet = FLAG_PX / 2;
    return {
        dx: (left + right) / 2 - x,
        dy: Math.max(half, feet) + TOKEN_BAR_GAP_U
    };
}

/**
 * The cycle ring's number: whole seconds left, rounded up, never below 1s
 * while the cycle is still running (it reads `3s`, `2s`, `1s`).
 */
export function cycleSecondsText(elapsedMs, cycleTimeMs) {
    if (!(cycleTimeMs > 0)) return '';
    const left = Math.max(0, cycleTimeMs - (elapsedMs || 0));
    return `${Math.max(1, Math.ceil(left / 1000))}s`;
}

/**
 * How full the charges ring is: charges left over the Token's starting
 * charges, clamped to 1 (a restocked Token can hold more than it started
 * with). No starting count to compare against reads as full.
 */
export function chargesFraction(usesRemaining, startingUses) {
    if (usesRemaining == null) return null;
    if (!(startingUses > 0)) return 1;
    return Math.max(0, Math.min(1, usesRemaining / startingUses));
}

/**
 * A count short enough to sit inside a ring: `7`, `250`, `1.2k`, `12k`, `3M`.
 */
export function ringCount(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '';
    const a = Math.abs(v);
    if (a < 1000) return String(Math.round(v));
    if (a < 10000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    if (a < 1e6) return `${Math.round(v / 1000)}k`;
    return `${(v / 1e6).toFixed(a < 1e7 ? 1 : 0).replace(/\.0$/, '')}M`;
}
