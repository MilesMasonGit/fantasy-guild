/**
 * Rings: a number inside a ring that fills or empties, as the Token inspection draws its charges,
 * cycle and XP (`InspectBubbles`). The mat's Tokens say theirs on the plate (`workPlate.js`,
 * `idlePlate.js`).
 */

/**
 * A ring's diameter in mat units: a little under a third of a 1×1 Token's 128 u art, so three fit side by side along its bottom. Fixed in mat units
 * like the other badges, so it scales with the mat, not with the art's pixel steps.
 */
export const RING_D_U = 40;

export const RING_STROKE_U = RING_D_U * 3 / 28;

/** Each ring's colour. A cycle fills; charges empty. */
export const RING_COLOUR = Object.freeze({
    cycle: '#f4f1e8',
    charges: '#fbbf24',   // the game's gi-gold
    // Skill XP in the inspection.
    xp: '#fb923c'
});

/**
 * The count rings that GLIDE to a new value instead of jumping: a Token's charges. `RingBadge`
 * gives them a CSS transition (`gi-ring-glide`, ~0.8 s).
 */
export const GLIDING_RINGS = Object.freeze(new Set(['charges']));

/** The stroke a greyed ring (a blocked cycle) is drawn in. */
export const RING_GREY = '#8a8a8a';

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

/** How often a timer on the idle plate re-reads its game-time clock (ms). */
export const TURN_COUNTDOWN_REFRESH_MS = 250;
