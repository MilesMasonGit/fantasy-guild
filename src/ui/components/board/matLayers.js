// Fantasy Guild — what is drawn in front of what, on the free playmat (slice 1.6c)

/**
 * ⭐ **The mat's stacking order, in one place.**
 *
 * On the grid every tile was its own little world and z-index only had to sort
 * things out *within* a tile. On the mat everything shares one surface, so the
 * order has to be stated once and obeyed by every layer — otherwise a Token's
 * progress bar ends up behind the hero standing on it, or a flag ends up under
 * a pile of loot (which is exactly what happened when the flags shipped).
 *
 * ⚠️ **Tokens take a range, not a number.** Each Token is sorted by where it
 * stands (lower on the mat draws in front, the 2.5D reading), and each takes
 * three slots: its art, the hero standing on it, and the badges written on it,
 * in that order. `TOKEN_SPAN` is how much room that range is allowed, so
 * everything above it is guaranteed to stay above it.
 */
export const MAT_Z = Object.freeze({
    /** The playmat surface itself, and the play-area outline on it (FP-93). */
    SURFACE: 0,
    /** Tokens, their heroes and their badges: `TOKEN_BASE + rank * 3`. */
    TOKEN_BASE: 10,
    /** Heroes with no Token to stand on — idle beside their flag. */
    WAITING_HERO: 690,
    /** Heroes on the move — above every Token they walk over (HM-3). */
    WALKING_HERO: 695,
    /** Alerts that belong to a point rather than to a Token. */
    POINT_ALERT: 750,
    /** Range rings — Near, and a flag's radius (FP-64). */
    RINGS: 760,
    /** Loot on the floor. */
    LOOT: 800,
    /** Flags — always reachable (slice 1.5). */
    FLAGS: 850,
    /** Idle heroes, just in front of the flag they stand beside (FP-84). */
    IDLE_HERO: 851,
    /** Hero speech bubbles — above every hero, never in the way of the pointer. */
    HERO_BUBBLE: 860
});

/** How many Tokens can be sorted before the range would reach the layer above. */
export const TOKEN_SPAN = Math.floor((MAT_Z.WAITING_HERO - MAT_Z.TOKEN_BASE) / 3) - 1;

/** The z of the `rank`-th Token from the back. Its hero is +1, its badges +2. */
export function tokenZ(rank) {
    return MAT_Z.TOKEN_BASE + Math.min(rank, TOKEN_SPAN) * 3;
}
