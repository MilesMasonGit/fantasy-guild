// Fantasy Guild — how far a rule reaches (Effects Robustness P2)

/**
 * **How far** a statement reaches, as a declared vocabulary rather than a fact
 * about the code.
 *
 * ## Why this exists (ER-1)
 * Reach used to be `neighboursOf(index)`, written into three separate readers
 * and choosable by nobody. That made two whole classes of rule unauthorable:
 *
 * * **A Token cannot affect itself.** `neighboursOf` never contains the tile it
 *   was asked about — `areAdjacent` says so in as many words: *"a tile is never
 *   adjacent to itself"*. So a Token could not buff its own yield, put a status
 *   on the hero working *it*, or grant an item to itself. This was the owner's
 *   own example when the project started.
 * * **Nothing could reach further than one tile.** The only scope wider than
 *   adjacency is the guild-wide aggregator, and the only thing that writes there
 *   is the Guild Hall upgrade track.
 *
 * ## Reach and filter are different questions
 * They are easy to confuse and must not be merged:
 *
 * * **Reach** — *how far* does this rule carry? (this file)
 * * **Filter** (`statement.to`) — *which* of the Tokens in range does it pick?
 *
 * "Every Coast Token on the board" is `board` reach and a `tag` filter. Folding
 * them into one list would need a row per combination, which is how a small
 * vocabulary becomes a grid.
 *
 * ## ⚠️ A row ships with its reader or not at all
 * The same discipline as `TRIGGER_EVENTS` and `CHARGE_MOMENTS`, for the same
 * reason: an authorable option nothing reads is the "authored but inert" failure
 * this whole line of work exists to remove. All four rows below have readers in
 * `TileModifiers` (inbound) and `TileModifiers.filterTargetTiles` (outbound).
 *
 * ## ⚠️ No shapes, no radius, no direction (ER-2)
 * Four named rows, not a geometry language. Directional adjacency is ruled out
 * of the concept and a 6×6 board does not need distance falloff. A shape
 * language is how a small feature becomes a rules engine — the slope
 * `restrictionPalette.js` already refuses in as many words.
 */

export const REACH = Object.freeze({
    /** The 8 surrounding tiles. What every rule written before P2 means. */
    ADJACENT: 'adjacent',
    /** The Token carrying the rule, and nothing else. */
    SELF: 'self',
    /** Both — the Token and its neighbours. */
    SELF_AND_ADJACENT: 'self_and_adjacent',
    /** Every Token on the board, however far away. */
    BOARD: 'board'
});

/**
 * ⚠️ **The default, and it is load-bearing** (ER-5).
 *
 * Every statement authored before this phase carries no `reach` field. Treating
 * its absence as `adjacent` is what lets 20 Tokens and 17 library entries keep
 * behaving exactly as they did, with no migration writing a field into content
 * the owner did not touch. The same trick `chargeMomentOf` uses for the charge
 * moment, for the same reason.
 */
export const DEFAULT_REACH = REACH.ADJACENT;

/**
 * @type {ReadonlyArray<{id: string, label: string, hint: string}>}
 */
export const REACHES = Object.freeze([
    {
        id: REACH.ADJACENT,
        label: 'Adjacent Tokens',
        hint: 'The 8 surrounding tiles, and not this Token itself. This is what every rule means unless you change it.'
    },
    {
        id: REACH.SELF,
        label: 'This Token only',
        hint: 'The Token carrying the rule, and nothing around it. How a Token improves its own work, or puts something on the hero working it.'
    },
    {
        id: REACH.SELF_AND_ADJACENT,
        label: 'This Token and its neighbours',
        hint: 'Both at once — the surrounding tiles and this Token as well.'
    },
    {
        /**
         * ⚠️ **Uncapped, knowingly** (ER-16).
         *
         * Duplicates stack uncapped everywhere else (D-23), justified because
         * adjacency effects are deliberately small. A board-wide effect is not
         * small by that argument, and **two board-reach Tokens of one type
         * genuinely double up with no audit warning**. The owner accepted that
         * rather than adding a cap, on the same "keep the values small" footing
         * as every other modifier. Recorded so a later balance surprise is read
         * as a decision, not as a bug.
         */
        id: REACH.BOARD,
        label: 'Every Token on the board',
        hint: 'The whole playmat, however far away. Keep these very small — one of these touches everything you own, and a second copy doubles it.'
    }
]);

/** One reach's declaration, or null. */
export function getReach(id) {
    return REACHES.find(r => r.id === id) || null;
}

/**
 * The reach a statement uses.
 *
 * An unauthored or unrecognised value resolves to `adjacent` (ER-5) rather than
 * to nothing, because "reaches nowhere" is never what an absent field meant and
 * a typo should not silently switch a rule off.
 */
export function reachOf(statement) {
    return getReach(statement?.reach) ? statement.reach : DEFAULT_REACH;
}

/**
 * How a source Token stands in relation to a tile it might reach.
 *
 * Three values, because those are the three a reach row can distinguish. Kept as
 * strings rather than booleans so a reader's `switch` reads like the sentence.
 */
export const RELATION = Object.freeze({
    SELF: 'self',
    ADJACENT: 'adjacent',
    DISTANT: 'distant'
});

/**
 * Whether a statement at `reachId` carries as far as `relation`.
 *
 * The single place the vocabulary turns into a yes or no. Both readers — the
 * inbound one in `applicableStatements` and the outbound one in
 * `filterTargetTiles` — go through here, so they cannot drift.
 */
export function reachCovers(reachId, relation) {
    switch (reachId) {
        case REACH.SELF:
            return relation === RELATION.SELF;
        case REACH.SELF_AND_ADJACENT:
            return relation === RELATION.SELF || relation === RELATION.ADJACENT;
        case REACH.BOARD:
            return true;
        case REACH.ADJACENT:
        default:
            return relation === RELATION.ADJACENT;
    }
}

/** Whether a reach can ever leave the Token carrying it. */
export function reachesOutward(reachId) {
    return reachId !== REACH.SELF;
}
