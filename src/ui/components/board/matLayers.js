import { createStackPlaces } from './stackPlaces.js';

/**
 * How many places the mat's stack holds: far more than a mat ever has Tokens and flags, so a
 * Token that arrives or moves almost always finds a free place between its new neighbours and
 * nothing else on the mat is re-stacked (`stackPlaces.js`).
 */
export const STACK_PLACES = 2 ** 24;

/** The first z above every Token's, flag's, hero's and badge's place. */
const TOKEN_TOP = 10 + STACK_PLACES * 3;

/**
 * The mat's stacking order, in one place.
 * Everything on the mat shares one surface, so the order has to be stated once and obeyed by
 * every layer, otherwise a Token's progress bar ends up behind the hero standing on it.
 * ⚠️ Tokens and flags share a range, not a number. Each Token and each flag is sorted by where
 * it stands (lower on the mat draws in front, the 2.5D reading) by {@link matStackOrder}, and
 * holds a place in the stack, three z values wide: a Token's art, the hero working it and the
 * badges written on it; a flag's cloth, the idle hero beside it and its gear. Everything else on
 * the mat sits above the whole range.
 * Every z below `WAITING_HERO` is set on an element that is a direct stacking sibling of the
 * others (no wrapper with its own z-index), which is what lets a flag slot in between two
 * Tokens.
 * ⚠️ The numbers run to about fifty million. They stay inside the mat only because the board's
 * scaled box (`Board.jsx`, `data-board-origin`, its `transform`) is a stacking context; without
 * one, every Token would draw over the rest of the game's screens.
 */
export const MAT_Z = Object.freeze({
    /** The playmat surface itself. */
    SURFACE: 0,
    /** Tokens, flags, their heroes and badges: `TOKEN_BASE + place * 3`. */
    TOKEN_BASE: 10,
    /** Heroes with no Token to stand on and no flag to stand beside. */
    WAITING_HERO: TOKEN_TOP + 10,
    /** Heroes on the move: above every Token they walk over. */
    WALKING_HERO: TOKEN_TOP + 15,
    /** Range rings: Near, and a flag's radius. */
    RINGS: TOKEN_TOP + 80,
    /** Loot on the floor. */
    LOOT: TOKEN_TOP + 120,
    /**
     * Flags drawn WITHOUT the mat's order: `FlagLayer` on its own, as its tests mount it. On
     * the mat, flags sort with the Tokens.
     */
    FLAGS: TOKEN_TOP + 170,
    /** Callouts: quick popups over a Token or a bare point, under the hero bubbles. */
    CALLOUT: TOKEN_TOP + 175,
    /** Hero speech bubbles — above every hero, never in the way of the pointer. */
    HERO_BUBBLE: TOKEN_TOP + 180
});

/** The z of a Token or flag at `place` in the stack. Its hero is +1, its badges +2. */
export function placeZ(place) {
    return MAT_Z.TOKEN_BASE + place * 3;
}

/** Back to front: higher on the mat first; a Token before a flag on the same line; then placing order. */
function backToFront(a, b) {
    return (a.y - b.y) || (a.kindRank - b.kindRank) || (a.tie - b.tie);
}

/**
 * Every Token and flag, back to front. Three bands:
 * 1. **Everything at rest**: Tokens and flags together, lower on the mat in front. On the same
 * line a flag stands in front of a Token; between two Tokens the earlier placed is behind,
 * between two flags the earlier planted.
 * 2. **Worked Tokens**: a Token with a hero working it, in front of every Token and flag at
 * rest, sorted among themselves the same way. Its hero takes the slot above it, so the pair
 * rises together; when the work ends the Token drops back into band 1.
 * 3. **The hovered Token**, frontmost, so its own drag, click and right-click listeners are
 * the ones under the pointer.
 * Each entry's `sign` is what put it where it is, so the stack can tell a Token that moved from
 * one that was passed.
 */
function stackSequence({ tokens = [], flags = [], workedIds = [], hoveredId = null }) {
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

    const out = [];
    const add = (e, band) => {
        e.key = (e.kind === 'flag' ? 'f:' : 't:') + e.id;
        e.sign = `${band}|${e.y}|${e.kindRank}|${e.tie}`;
        out.push(e);
    };
    for (const e of resting) add(e, 0);
    for (const e of busy) add(e, 1);
    if (hovered) add(hovered, 2);
    return out;
}

/**
 * The mat's stack, kept from one render to the next. Each Token and flag keeps its place while
 * nothing passes it, so a Token that arrives, leaves, moves, is hovered or starts work changes
 * its own z and no one else's. The answer is the same object while no z changes, and each of
 * its maps is kept while none of its own z change, so memoised layers are not redrawn for a
 * new map with the same contents.
 */
export function createMatStack(size = STACK_PLACES) {
    const places = createStackPlaces(size);
    let lastPlaces = null;
    let last = null;
    return {
        /**
         * @param {{tokens?: {id: string, y: number, placedAt?: number}[], flags?: {heroId: string,
         * y: number}[], workedIds?: Set<string>|string[], hoveredId?: string|null}} input (flags
         * in planting order)
         * @returns {{tokenZ: Map<string, number>, flagZ: Map<string, number>}}
         */
        order(input = {}) {
            const seq = stackSequence(input);
            const placeOf = places.place(seq);
            if (last && placeOf === lastPlaces) return last;
            const tokenZ = new Map();
            const flagZ = new Map();
            for (const e of seq) (e.kind === 'flag' ? flagZ : tokenZ).set(e.id, placeZ(placeOf.get(e.key)));
            last = {
                tokenZ: last && sameMap(last.tokenZ, tokenZ) ? last.tokenZ : tokenZ,
                flagZ: last && sameMap(last.flagZ, flagZ) ? last.flagZ : flagZ
            };
            lastPlaces = placeOf;
            return last;
        },
        /** How many times part of the stack had to be spread out to make room (rare). */
        get spreads() { return places.spreads; }
    };
}

/**
 * Where every Token and flag sits in the stack ({@link stackSequence}'s order), as z values.
 * Pass the mat's own {@link createMatStack} to keep places from one answer to the next; without
 * one, the places are fresh.
 */
export function matStackOrder(input = {}, stack = createMatStack()) {
    return stack.order(input);
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
