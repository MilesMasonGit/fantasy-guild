// Fantasy Guild — who a moment puts in the room (Effects Grammar v2, V1)

/**
 * The **roles** a moment supplies, and the rule that keeps targeting bounded.
 *
 * ## The problem this solves
 * A rule needs to name things it did not place: *"deal 1 damage to whoever just
 * harvested me"*. That "whoever" is not a tile and not a filter — it is a
 * **participant in the moment**, and it only exists because a particular kind of
 * thing just happened.
 *
 * ## ⭐ G-2, and why the vocabulary cannot run away
 * > **A moment declares the roles it supplies; a target may only name a role its
 * > moment has.**
 *
 * That single rule is the whole defence against a targeting vocabulary becoming
 * a query language. An author picking *"a neighbour runs out of charges"* is
 * never offered *"the actor"*, because nobody acted — a Token simply ran dry.
 * The offer is absent rather than present-and-broken, which is the same
 * discipline `KEYWORDS` already applies to `filter`, `when` and `upkeep`:
 * **legality is declared, never hoped for.**
 *
 * ## ⭐ Why a bush and a monster are the same case
 * `BoardRunner` (a hero finishes harvesting) and `BoardCombat` (a hero wins a
 * fight) publish **the same event with the same payload**, because one kill is
 * one cycle (D-129). So `actor` resolves identically for a raspberry bush and a
 * Thorn Elemental, and the generalisation the owner asked for needed no new
 * concept — only exposure. `heroId` has been in that payload the whole time,
 * correct and read by nothing.
 */

export const ROLE = Object.freeze({
    /**
     * The entity carrying the rule.
     *
     * Always available, including on a rule with no moment at all — a continuous
     * aura still knows which Token it is on.
     */
    SELF: 'self',

    /**
     * The **hero** who caused this moment: the one who harvested, or fought.
     *
     * ⚠️ Declared by a moment does not mean present at runtime. An unstaffed
     * Token can complete a cycle (a passive generator, D-116), and then
     * `heroId` is null. A rule aimed at the actor reaches nobody, which is the
     * same honest nothing a filter matching no Tokens returns.
     */
    ACTOR: 'actor',

    /**
     * The **neighbouring entity** whose event this was — the Ore Vein that just
     * finished, not the hero who worked it.
     *
     * Only the adjacency-scoped moments have one. A self-scoped moment's source
     * *is* `self`, and saying so twice would be two names for one thing.
     */
    SOURCE: 'source'
});

/**
 * @type {ReadonlyArray<{id: string, label: string, hint: string}>}
 */
export const ROLES = Object.freeze([
    /**
     * ⚠️ **These are the game's own words, not the code's** (owner, 2026-09-12).
     *
     * They used to read *"this entity"*, *"the actor"* and *"the entity that
     * caused this"* — accurate, and none of them a term the game uses anywhere
     * else. The owner's note was exact: *"'actor' isn't a term used in the
     * game."* A rule that reads in vocabulary nobody plays with is a rule the
     * author has to translate in their head every time.
     *
     * ⚠️ The ids below are untouched on purpose. They are stored in every
     * authored statement, so renaming them would be a data migration bought
     * nothing — the label is the only thing anybody reads.
     */
    {
        id: ROLE.SELF,
        label: 'itself',
        hint: 'The Token, item or creature carrying this rule. Always available.'
    },
    {
        /**
         * ⚠️ "The hero" is not a narrowing — it is what this has always meant.
         * The doc on `ROLE.ACTOR` above already said "the **hero** who caused
         * this moment", and it is safe because enemies never initiate anything
         * (D-14): the one who acted is always a hero.
         */
        id: ROLE.ACTOR,
        label: 'the hero',
        hint: 'The hero who caused this — the one who harvested it, or who fought it. Nobody, if the work was unstaffed.'
    },
    {
        /**
         * ⚠️ "That Token" is true even when the neighbour is a monster, because
         * enemies *are* Tokens in this game. It would have been a lie before
         * enemies were folded in.
         */
        id: ROLE.SOURCE,
        label: 'that Token',
        hint: 'The neighbour whose event this was — the Token that finished, not the hero who worked it.'
    }
]);

/** One role's declaration, or null. */
export function getRole(id) {
    return ROLES.find(r => r.id === id) || null;
}

/**
 * The roles available with no moment at all.
 *
 * A continuous rule has no event and therefore no participants — only the thing
 * carrying it. Kept as a named constant because three readers want it and a
 * bare `[ROLE.SELF]` at each of them is three places to forget.
 */
export const AMBIENT_ROLES = Object.freeze([ROLE.SELF]);

/**
 * Resolve a moment's payload into the roles actually present.
 *
 * ⚠️ **Declared and present are different questions**, and both matter:
 *
 * * `rolesOf` (in `triggerRegistry.js`) answers *"what may an author aim at?"* —
 *   a design-time question, and the one the editor and `ContentAudit` ask.
 * * This answers *"who is actually here?"* — a runtime question, and it may
 *   legitimately come back with a null actor on a moment that declares one.
 *
 * Conflating them would either let an author aim at a role that can never be
 * filled, or make a rule silently inert on the perfectly ordinary occasions when
 * nobody was around.
 *
 * @param {object} payload the board event's payload
 * @param {number} bearerTile the tile of the entity carrying the rule
 * @returns {{self: number, actor: string|null, source: number|null}}
 */
export function resolveRoles(payload, bearerTile) {
    const eventTile = payload?.tile;
    return {
        self: bearerTile,
        /**
         * ⚠️ `self` is a TILE for a rule on a Token, and a HERO for a rule the
         * hero is carrying (V6). A live effect instance sits on a person, not on
         * a square, so "this entity" has to be able to mean either.
         *
         * Null here: only `LiveEffects` fills it, because only it knows the
         * bearer is a person.
         */
        selfHeroId: null,
        actor: payload?.heroId ?? null,
        // A self-scoped moment's source is the bearer, which is `self` — so it
        // reports null rather than duplicating it under a second name.
        source: eventTile != null && eventTile !== bearerTile ? eventTile : null
    };
}
