// Fantasy Guild — what a `Cannot` statement may forbid (effect grammar Phase 2)

/**
 * The restriction kinds the `Cannot` keyword can express.
 *
 * ## Exactly one kind, on purpose (design §1.3)
 * The owner asked for a general **Cannot**, adjacency limits first. Building a
 * restriction *framework* to hold one rule is the classic way to spend a week
 * and ship nothing, so the split is:
 *
 * * **The keyword is general.** "Cannot" is one word in the editor and reads
 *   naturally in front of any restriction invented later.
 * * **This list has one row.** Adding restriction #2 is a row here plus its
 *   enforcement in `Restrictions.js` — the same small cost a new number effect
 *   has today, and shaped exactly like `modifierPalette.js` so it is the same
 *   shape of edit.
 * * **No condition language.** No "cannot be placed unless", no booleans, no
 *   "while". Those are how a small feature quietly becomes a rules engine, and
 *   the design says so in as many words.
 *
 * ## A restriction is not a modifier
 * It has no bucket, no aggregator, and it never reaches `TileModifiers`. It is
 * read once, by `Placement.js`, at the moment a Token is put down — which is
 * why it lives in its own file rather than being a ninth entry in the modifier
 * palette.
 *
 * ## ⚠️ A restriction is symmetric, and that is the whole difficulty
 * If a Coast says *"no more than 2 adjacent Coasts"*, then dropping a **third**
 * Coast beside it breaks **the existing Coast's** rule, not the newcomer's. So
 * enforcement checks both directions — see `Restrictions.checkPlacement`.
 *
 * @type {ReadonlyArray<{
 *   id: string, label: string, blurb: string,
 *   blank: () => object,
 *   sentence: (payload: object, subject: string) => string,
 *   refusal: (payload: object, subject: string, tokenName: string) => string
 * }>}
 */
export const RESTRICTION_KINDS = Object.freeze([
    {
        id: 'adjacency_limit',
        label: 'be next to too many of something',
        blurb: 'No more than N adjacent Tokens matching the filter. Checked when a Token is put down.',

        blank: () => ({ kind: 'adjacency_limit', max: 2 }),

        /**
         * The rules text. "Cannot" is supplied by the renderer; this is the
         * rest of the sentence, so a second kind can read completely
         * differently without the renderer growing a branch.
         */
        sentence: (payload, subject) =>
            `be adjacent to more than ${limitOf(payload)} ${subject}`,

        /** What the player is told when the board refuses the drop. */
        refusal: (payload, subject, tokenName) =>
            `${tokenName} cannot be adjacent to more than ${limitOf(payload)} ${subject}`
    }
]);

/** A restriction's declared limit, never below zero. */
export function limitOf(payload) {
    const n = Number(payload?.max);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** One restriction kind by id, or null. */
export function getRestrictionKind(id) {
    return RESTRICTION_KINDS.find(k => k.id === id) || null;
}

/**
 * The blank payload a new `Cannot` statement starts with.
 *
 * ⚠️ An unknown kind returns `null` rather than a guess. A restriction the
 * engine cannot enforce must never be authorable — an unenforceable "Cannot" is
 * exactly the kind of promise the data does not keep that this redesign exists
 * to remove.
 */
export function blankRestriction(kindId = RESTRICTION_KINDS[0].id) {
    return getRestrictionKind(kindId)?.blank() ?? null;
}
