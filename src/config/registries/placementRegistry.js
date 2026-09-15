// Fantasy Guild — where a spawned Token lands (Effects Grammar v2, V9)

/**
 * The destinations a `Spawns` rule may choose from (G-15).
 *
 * ## ⭐ Why this is a vocabulary and not a fallback rule
 * The obvious implementation is "put it on the bearer's tile; if that is taken,
 * find the nearest free one". That works, and it hides the most important part
 * of the behaviour from the person authoring it — *"nearest"* becomes a rule the
 * author cannot see, cannot predict and cannot change.
 *
 * The owner's answer was better than any of the options offered: make it a
 * **choice**, from a short list. An author picks where it lands, the sentence
 * says which, and there is no hidden fallback anywhere.
 *
 * ## ⚠️ Locations, not entities
 * This is the one place in the grammar that names a **tile** rather than a
 * thing standing on one. Filters select entities and always will; a spawn needs
 * somewhere to put something, and an empty tile is not an entity. Keeping that
 * in its own small vocabulary is what stops "empty tile" leaking into the filter
 * system, where every existing filter would then need an answer for a tile that
 * holds nothing.
 */

export const PLACEMENT = Object.freeze({
    /** Replace whatever is on the bearer's own tile. The death-drop case. */
    HERE: 'here',
    /** The closest tile with nothing on it. */
    NEAREST_FREE: 'nearest_free',
    /** Any free tile, chosen at random. */
    RANDOM_FREE: 'random_free'
});

/**
 * @type {ReadonlyArray<{id: string, label: string, hint: string}>}
 */
export const PLACEMENTS = Object.freeze([
    {
        id: PLACEMENT.HERE,
        label: 'on this Token’s tile',
        hint: 'Replaces this Token where it stands. How a thing leaves something behind when it goes.'
    },
    {
        id: PLACEMENT.NEAREST_FREE,
        label: 'on the nearest free tile',
        hint: 'The closest empty tile. Nothing happens if the board is full.'
    },
    {
        id: PLACEMENT.RANDOM_FREE,
        label: 'on a random free tile',
        hint: 'Any empty tile at all. Nothing happens if the board is full.'
    }
]);

/** One placement's declaration, or null. */
export function getPlacement(id) {
    return PLACEMENTS.find(p => p.id === id) || null;
}

/** The placement a statement uses. Absent means the bearer's own tile. */
export function placementOf(payload) {
    return getPlacement(payload?.placement) ? payload.placement : PLACEMENT.HERE;
}

/** How many random free spots `random_free` tries before keeping the roomiest (plan §D). */
export const RANDOM_FREE_DARTS = 40;

/**
 * Choose the mat point a spawn lands on (Free Playmat slice 1.6b).
 *
 * ⚠️ Returns `null` when there is nowhere to go, and the caller does nothing
 * (FP-46). A full mat is an ordinary state, not a failure, and shoving a Token
 * onto another would silently destroy whatever was there.
 *
 * Kept free of the board: the caller hands in the free spots it found.
 *
 * * `here` — the bearer's own point.
 * * `nearest_free` — the free spot with the nearest centre, straight-line;
 *   ties go to the higher-up spot, then the one further left (reading order),
 *   so the choice is deterministic.
 * * `random_free` — up to `RANDOM_FREE_DARTS` random free spots, keeping the
 *   roomiest (`openness`), so a spawn spreads out rather than crowding.
 *
 * @param {string} placement
 * @param {{x:number,y:number}} from the bearer's point
 * @param {{candidates: Array<{x:number,y:number}>, distanceSq: (a, b) => number, openness?: (p) => number}} view
 * @param {() => number} random
 * @returns {{x:number,y:number}|null}
 */
export function resolvePlacement(placement, from, view, random = Math.random) {
    switch (placement) {
        case PLACEMENT.NEAREST_FREE: {
            const spots = view?.candidates || [];
            if (!spots.length || !from) return null;
            let best = null;
            let bestD = Infinity;
            for (const p of spots) {
                const d = view.distanceSq(from, p);
                if (d < bestD || (d === bestD && (p.y < best.y || (p.y === best.y && p.x < best.x)))) {
                    best = p;
                    bestD = d;
                }
            }
            return best;
        }
        case PLACEMENT.RANDOM_FREE: {
            const spots = view?.candidates || [];
            if (!spots.length) return null;
            let best = null;
            let bestScore = -Infinity;
            for (let i = 0; i < RANDOM_FREE_DARTS; i++) {
                const p = spots[Math.min(spots.length - 1, Math.floor(random() * spots.length))];
                const score = view.openness ? view.openness(p) : 0;
                if (score > bestScore) {
                    best = p;
                    bestScore = score;
                }
            }
            return best;
        }
        case PLACEMENT.HERE:
        default:
            return from ? { x: from.x, y: from.y } : null;
    }
}
