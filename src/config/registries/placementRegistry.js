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

/**
 * Choose the tile a spawn lands on.
 *
 * ⚠️ Returns `null` when there is nowhere to go, and the caller does nothing.
 * A full board is an ordinary state, not a failure, and shoving a Token onto an
 * occupied tile would silently destroy whatever was there.
 *
 * @param {string} placement
 * @param {number} bearerTile
 * @param {{isFree: (tile: number) => boolean, allTiles: number[], distance: (a, b) => number}} board
 * @param {() => number} random
 */
export function resolvePlacement(placement, bearerTile, board, random = Math.random) {
    switch (placement) {
        case PLACEMENT.NEAREST_FREE: {
            const free = board.allTiles.filter(board.isFree);
            if (!free.length) return null;
            // Deterministic: ties break toward the lower tile index, the same
            // tie-break `Managers` and `Converts` already use when they must
            // choose one neighbour out of several.
            return free.reduce((best, tile) => {
                const d = board.distance(bearerTile, tile);
                const bd = board.distance(bearerTile, best);
                if (d < bd) return tile;
                if (d === bd) return Math.min(best, tile);
                return best;
            }, free[0]);
        }
        case PLACEMENT.RANDOM_FREE: {
            const free = board.allTiles.filter(board.isFree);
            if (!free.length) return null;
            return free[Math.floor(random() * free.length)];
        }
        case PLACEMENT.HERE:
        default:
            return bearerTile ?? null;
    }
}
