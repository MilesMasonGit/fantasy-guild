
/**
 * The mat's stacking order, in one place.
 * Everything on the mat shares one surface, so the order has to be stated once and obeyed by
 * every layer, otherwise a Token's progress bar ends up behind the hero standing on it.
 * ⚠️ Tokens and flags share a range, not a number. Each Token and each flag is sorted by where
 * it stands (lower on the mat draws in front, the 2.5D reading) by {@link matStackOrder}, and
 * each takes three slots: a Token's art, the hero working it and the badges written on it; a
 * flag's cloth, the idle hero beside it and its gear. `TOKEN_SPAN` is how much room that range
 * is allowed, so everything above it stays above it.
 * Every z below `WAITING_HERO` is set on an element that is a direct stacking sibling of the
 * others (no wrapper with its own z-index), which is what lets a flag slot in between two
 * Tokens.
 */
export const MAT_Z = Object.freeze({
    /** The playmat surface itself. */
    SURFACE: 0,
    /** Tokens, flags, their heroes and badges: `TOKEN_BASE + rank * 3`. */
    TOKEN_BASE: 10,
    /** Heroes with no Token to stand on and no flag to stand beside. */
    WAITING_HERO: 690,
    /** Heroes on the move: above every Token they walk over. */
    WALKING_HERO: 695,
    /** Range rings: Near, and a flag's radius. */
    RINGS: 760,
    /** Loot on the floor. */
    LOOT: 800,
    /**
     * Flags drawn WITHOUT the mat's order: `FlagLayer` on its own, as its tests mount it. On
     * the mat, flags sort with the Tokens.
     */
    FLAGS: 850,
    /** Callouts: quick popups over a Token or a bare point, under the hero bubbles. */
    CALLOUT: 855,
    /** Hero speech bubbles — above every hero, never in the way of the pointer. */
    HERO_BUBBLE: 860
});

export const TOKEN_SPAN = Math.floor((MAT_Z.WAITING_HERO - MAT_Z.TOKEN_BASE) / 3) - 1;

/**
 * Ranks kept for worked Tokens when the mat is too busy for every rank to be distinct. Only
 * heroes work Tokens and the roster holds 8; this leaves twice that. Past it, worked Tokens
 * tie among themselves only.
 */
export const WORKED_BAND = 16;

/** The z of the `rank`-th Token or flag from the back. Its hero is +1, its badges +2. */
export function tokenZ(rank) {
    return MAT_Z.TOKEN_BASE + Math.min(rank, TOKEN_SPAN) * 3;
}

/** Back to front: higher on the mat first; a Token before a flag on the same line; then placing order. */
function backToFront(a, b) {
    return (a.y - b.y) || (a.kindRank - b.kindRank) || (a.tie - b.tie);
}

/**
 * Where every Token and flag sits in the stack. Three bands, back to front:
 * 1. **Everything at rest**: Tokens and flags together, lower on the mat in front. On the same
 * line a flag stands in front of a Token; between two Tokens the earlier placed is behind,
 * between two flags the earlier planted.
 * 2. **Worked Tokens**: a Token with a hero working it, in front of every Token and flag at
 * rest, sorted among themselves the same way. Its hero takes the slot above it, so the pair
 * rises together; when the work ends the Token drops back into band 1.
 * 3. **The hovered Token**, frontmost, so its own drag, click and right-click listeners are
 * the ones under the pointer.
 * @param {{tokens?: {id: string, y: number, placedAt?: number}[], flags?: {heroId: string, y:
 * number}[], workedIds?: Set<string>|string[], hoveredId?: string|null}} input (flags in
 * planting order)
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
     * The worked band and the hovered Token have reserved ranks. The range holds `TOKEN_SPAN +
     * 1` ranks. Past that (a busy mat) the ranks clamp, and if they clamped at the top every
     * worked Token and the hovered one would tie with the resting Tokens at one z and page
     * order would decide who is in front. So only the resting band clamps, below ranks kept
     * free for the worked Tokens and the hovered one, which therefore always draw (and take
     * the pointer) in front. Under the cap every rank is dense.
     */
    const tokenZOut = new Map();
    const flagZOut = new Map();
    const put = (e, rank) => (e.kind === 'flag' ? flagZOut : tokenZOut).set(e.id, tokenZ(rank));
    const total = resting.length + busy.length + (hovered ? 1 : 0);
    if (total <= TOKEN_SPAN + 1) {
        // Room for everyone: dense ranks, back to front, exactly as always.
        [...resting, ...busy, ...(hovered ? [hovered] : [])].forEach(put);
    } else {
        // ⚠️ The reserve is a FIXED size, not 'however many are worked now': a reserve that
        // grew and shrank with the worked count would move the clamp, and every clamped
        // resting Token would be re-ranked and redrawn each time a hero started or stopped
        // work.
        const restCap = TOKEN_SPAN - WORKED_BAND - 1;
        resting.forEach((e, i) => put(e, Math.min(i, restCap)));
        busy.forEach((e, j) => put(e, Math.min(restCap + 1 + j, TOKEN_SPAN - 1)));
        if (hovered) put(hovered, TOKEN_SPAN);
    }
    return { tokenZ: tokenZOut, flagZ: flagZOut };
}

/**
 * Whether two {@link matStackOrder} answers put everything at the same z. `MatBoard` keeps the
 * old answer when they do, so the maps it hands on stay the same objects and a memoised layer
 * is not redrawn for a new map with the same contents.
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
 * - **Walking** somewhere (not a stroll by an idle hero): above every Token and flag it
 * passes.
 * - **Idle** beside their flag: just in front of that flag, so the pair sorts with the Tokens
 * around it.
 * - **Working** a Token: just in front of it. The Token is in the worked band, so the hero is
 * too.
 * - Anything else: above every Token, below the walkers.
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

/**
 * A walking Token's place in the stack, without its exact point. The mat's order only needs to
 * know which Tokens and flags a walker stands between, not where it is between them. This
 * gives a stand-in `y` that sorts exactly as the real one does (the real `y` when it ties with
 * something, otherwise the midpoint of its two neighbours) and stays the SAME value step after
 * step until the walker crosses one of them. `MatBoard` sorts walkers by it, so a step that
 * crosses nothing re-renders nothing; the walker's box follows the engine imperatively.
 * @param {number} y the walker's real y
 * @param {number[]} others every other Token's and flag's y
 * @returns {number}
 */
export function walkerSortY(y, others) {
    let below = -Infinity;
    let above = Infinity;
    for (const o of others) {
        if (o === y) return y;
        if (o < y) { if (o > below) below = o; } else if (o < above) above = o;
    }
    if (below === -Infinity && above === Infinity) return 0;
    if (below === -Infinity) return above - 1;
    if (above === Infinity) return below + 1;
    return (below + above) / 2;
}
