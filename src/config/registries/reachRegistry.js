// Fantasy Guild — how far a rule reaches

/**
 * **How far** a statement reaches, as a declared vocabulary rather than a fact
 * about the code.
 *
 * ## Why this exists
 * `nearby` never includes the Token carrying the rule, so affecting itself (buff its own
 * yield, put a status on the hero working it) needs its own row, as does reaching beyond
 * the neighbourhood.
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
 * ## ⚠️ No shapes and no direction
 * Four named rows, not a geometry language. Directional adjacency is ruled out
 * of the concept. A shape
 * language is how a small feature becomes a rules engine — the slope
 * `restrictionPalette.js` already refuses in as many words.
 */

export const REACH = Object.freeze({
    /** Every Token within the Near radius, not the Token carrying the rule. */
    NEARBY: 'nearby',
    /** The Token carrying the rule, and nothing else. */
    SELF: 'self',
    /** Both — the Token and its neighbours. */
    SELF_AND_NEARBY: 'self_and_nearby',
    /** Every Token on the board, however far away. */
    BOARD: 'board'
});

/**
 * ⚠️ **The default, and it is load-bearing.**
 *
 * An absent `reach` field means `nearby`, so older content needs no migration
 * writing a field into it. `chargeMomentOf` uses the same trick for the charge moment.
 */
export const DEFAULT_REACH = REACH.NEARBY;

/**
 * @type {ReadonlyArray<{id: string, label: string, hint: string}>}
 */
export const REACHES = Object.freeze([
    {
        id: REACH.NEARBY,
        label: 'Nearby Tokens',
        hint: 'The 8 surrounding tiles, and not this Token itself. This is what every rule means unless you change it.'
    },
    {
        id: REACH.SELF,
        label: 'This Token only',
        hint: 'The Token carrying the rule, and nothing around it. How a Token improves its own work, or puts something on the hero working it.'
    },
    {
        id: REACH.SELF_AND_NEARBY,
        label: 'This Token and its neighbours',
        hint: 'Both at once — the surrounding tiles and this Token as well.'
    },
    {
        /**
         * ⚠️ **Uncapped, knowingly.**
         *
         * Duplicates stack uncapped everywhere else, justified because
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
 * The old reach ids ("adjacent" was renamed "nearby").
 * The CMS keeps its own copy of the content and
 * sync the old ids back into `data/`; without this, `self_and_adjacent` would
 * fall through to plain `nearby` and quietly lose its "self" half.
 */
const LEGACY_REACH = Object.freeze({
    adjacent: REACH.NEARBY,
    self_and_adjacent: REACH.SELF_AND_NEARBY
});

/**
 * The reach a statement uses.
 *
 * An unauthored or unrecognised value resolves to `nearby` rather than
 * to nothing, because "reaches nowhere" is never what an absent field meant and
 * a typo should not silently switch a rule off.
 */
export function reachOf(statement) {
    const id = LEGACY_REACH[statement?.reach] || statement?.reach;
    return getReach(id) ? id : DEFAULT_REACH;
}

/**
 * How a source Token stands in relation to a tile it might reach.
 *
 * Three values, because those are the three a reach row can distinguish. Kept as
 * strings rather than booleans so a reader's `switch` reads like the sentence.
 */
export const RELATION = Object.freeze({
    SELF: 'self',
    NEARBY: 'nearby',
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
        case REACH.SELF_AND_NEARBY:
            return relation === RELATION.SELF || relation === RELATION.NEARBY;
        case REACH.BOARD:
            return true;
        case REACH.NEARBY:
        default:
            return relation === RELATION.NEARBY;
    }
}

/** Whether a reach can ever leave the Token carrying it. */
export function reachesOutward(reachId) {
    return reachId !== REACH.SELF;
}
