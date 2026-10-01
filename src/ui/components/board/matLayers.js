// Fantasy Guild — what is drawn in front of what, on the free playmat (slice 1.6c, feedback Q3)

/**
 * ⭐ **The mat's stacking order, in one place.**
 *
 * On the grid every tile was its own little world and z-index only had to sort
 * things out *within* a tile. On the mat everything shares one surface, so the
 * order has to be stated once and obeyed by every layer — otherwise a Token's
 * progress bar ends up behind the hero standing on it.
 *
 * ⚠️ **Tokens and flags share a range, not a number** (feedback Q3, FB-1).
 * Each Token and each flag is sorted by where it stands (lower on the mat
 * draws in front, the 2.5D reading) by {@link matStackOrder}, and each takes
 * three slots: a Token's art, the hero working it and the badges written on
 * it; a flag's cloth, the idle hero beside it and its gear. `TOKEN_SPAN` is how
 * much room that range is allowed, so everything above it stays above it.
 *
 * Every z below `WAITING_HERO` is set on an element that is a direct stacking
 * sibling of the others (no wrapper with its own z-index), which is what lets
 * a flag slot in between two Tokens.
 */
export const MAT_Z = Object.freeze({
    /** The playmat surface itself, and the play-area outline on it (FP-93). */
    SURFACE: 0,
    /** Tokens, flags, their heroes and badges: `TOKEN_BASE + rank * 3`. */
    TOKEN_BASE: 10,
    /** Heroes with no Token to stand on and no flag to stand beside. */
    WAITING_HERO: 690,
    /** Heroes on the move — above every Token they walk over (HM-3). */
    WALKING_HERO: 695,
    /** Alerts that belong to a point rather than to a Token. */
    POINT_ALERT: 750,
    /** Range rings — Near, and a flag's radius (FP-64). */
    RINGS: 760,
    /** Loot on the floor. */
    LOOT: 800,
    /**
     * Flags drawn **without** the mat's order — `FlagLayer` on its own, as its
     * tests mount it. On the mat, flags sort with the Tokens (FB-1).
     */
    FLAGS: 850,
    /** Hero speech bubbles — above every hero, never in the way of the pointer. */
    HERO_BUBBLE: 860
});

/** How many Tokens and flags can be sorted before the range would reach the layer above. */
export const TOKEN_SPAN = Math.floor((MAT_Z.WAITING_HERO - MAT_Z.TOKEN_BASE) / 3) - 1;

/** The z of the `rank`-th Token or flag from the back. Its hero is +1, its badges +2. */
export function tokenZ(rank) {
    return MAT_Z.TOKEN_BASE + Math.min(rank, TOKEN_SPAN) * 3;
}

/** Back to front: higher on the mat first; a Token before a flag on the same line; then placing order. */
function backToFront(a, b) {
    return (a.y - b.y) || (a.kindRank - b.kindRank) || (a.tie - b.tie);
}

/**
 * ⭐ **Where every Token and flag sits in the stack** (feedback Q3).
 *
 * Three bands, back to front:
 *
 * 1. **Everything at rest** — Tokens and flags together, lower on the mat in
 *    front (FB-1). On the same line a flag stands in front of a Token (flags
 *    used to be above everything; a tie keeps that); between two Tokens the
 *    earlier placed is behind, between two flags the earlier planted.
 * 2. **Worked Tokens** — a Token with a hero working it, in front of every
 *    Token and flag at rest (FB-2), sorted among themselves the same way. Its
 *    hero takes the slot above it, so the pair rises together; when the work
 *    ends the Token drops back into band 1.
 * 3. **The hovered Token**, frontmost, so its own drag, click and right-click
 *    listeners are the ones under the pointer (slice 1.6c-2).
 *
 * @param {{
 *   tokens?: {id: string, y: number, placedAt?: number}[],
 *   flags?: {heroId: string, y: number}[],   // in planting order
 *   workedIds?: Set<string>|string[],
 *   hoveredId?: string|null
 * }} input
 * @returns {{tokenZ: Map<string, number>, flagZ: Map<string, number>}}
 */
export function matStackOrder({ tokens = [], flags = [], workedIds = [], hoveredId = null } = {}) {
    const worked = workedIds instanceof Set ? workedIds : new Set(workedIds);
    const resting = [];
    const busy = [];
    let hovered = null;

    for (const t of tokens) {
        const entry = { kind: 'token', id: t.id, y: t.y ?? 0, kindRank: 0, tie: t.placedAt ?? 0 };
        if (hoveredId != null && t.id === hoveredId) hovered = entry;
        else if (worked.has(t.id)) busy.push(entry);
        else resting.push(entry);
    }
    flags.forEach((f, i) => {
        resting.push({ kind: 'flag', id: f.heroId, y: f.y ?? 0, kindRank: 1, tie: i });
    });

    resting.sort(backToFront);
    busy.sort(backToFront);

    /**
     * ⭐ **The worked band and the hovered Token have reserved ranks** (CR3-354).
     * The range holds `TOKEN_SPAN + 1` ranks. Past that (a busy mat: ~225
     * Tokens and flags) the ranks clamp — and before this they clamped at the
     * TOP, so every worked Token and the hovered one tied with ~95 resting
     * Tokens at one z and the page order decided who was in front. Now only
     * the resting band clamps, below ranks kept free for the worked Tokens
     * and the hovered one, which therefore always draw (and take the pointer)
     * in front. Under the cap every rank is exactly what it was.
     */
    const reserved = busy.length + (hovered ? 1 : 0);
    const restCap = Math.max(0, TOKEN_SPAN - reserved);
    const base = Math.min(resting.length, restCap + 1);

    const tokenZOut = new Map();
    const flagZOut = new Map();
    const put = (e, rank) => (e.kind === 'flag' ? flagZOut : tokenZOut).set(e.id, tokenZ(rank));
    resting.forEach((e, i) => put(e, Math.min(i, restCap)));
    busy.forEach((e, j) => put(e, base + j));
    if (hovered) put(hovered, base + busy.length);
    return { tokenZ: tokenZOut, flagZ: flagZOut };
}

/**
 * Whether two {@link matStackOrder} answers put everything at the same z
 * (CR3-303). `MatBoard` keeps the old answer when they do, so the maps it hands
 * on stay the same objects and a memoised layer is not redrawn for a new map
 * with the same contents.
 */
export function sameStackOrder(a, b) {
    if (!a || !b) return false;
    return sameMap(a.tokenZ, b.tokenZ) && sameMap(a.flagZ, b.flagZ);
}

function sameMap(a, b) {
    if (a === b) return true;
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (b.get(k) !== v) return false;
    return true;
}

/**
 * The z of one hero on the mat, given {@link matStackOrder}'s answer.
 *
 * * **Walking** somewhere (not a stroll by an idle hero): above every Token
 *   and flag it passes (HM-3).
 * * **Idle** beside their flag: just in front of that flag (FP-84), so the
 *   pair sorts with the Tokens around it.
 * * **Working** a Token: just in front of it — the Token is in the worked
 *   band, so the hero is too (FB-2).
 * * Anything else: above every Token, below the walkers.
 *
 * @param {{heroId: string, state: string, tokenId?: string|null, moving?: boolean}} hero
 * @param {{tokenZ: Map<string, number>, flagZ: Map<string, number>}} order
 */
export function heroZ(hero, { tokenZ: tz, flagZ: fz }) {
    if (hero.state === 'idle') {
        return fz.has(hero.heroId) ? fz.get(hero.heroId) + 1 : MAT_Z.WAITING_HERO;
    }
    if (hero.moving) return MAT_Z.WALKING_HERO;
    if (hero.tokenId && tz.has(hero.tokenId)) return tz.get(hero.tokenId) + 1;
    return MAT_Z.WAITING_HERO;
}
