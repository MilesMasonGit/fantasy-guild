// Fantasy Guild — who a moment puts in the room

/**
 * The **roles** a moment supplies, and the rule that keeps targeting bounded.
 *
 * ## The problem this solves
 * A rule needs to name things it did not place: *"deal 1 damage to whoever just
 * harvested me"*. That "whoever" is not a tile and not a filter — it is a
 * **participant in the moment**, and it only exists because a particular kind of
 * thing just happened.
 *
 * ## ⭐ The one rule that keeps the vocabulary bounded
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
 * one cycle. So `actor` resolves identically for a raspberry bush and a
 * Thorn Elemental.
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
     * Token can complete a cycle (a passive generator), and then
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
    SOURCE: 'source',

    /**
     * ⭐ **The creature the hero in this moment is fighting.**
     *
     * One meaning everywhere: on an item it is the monster its hero is
     * fighting, and on a monster's own rule it is that monster.
     *
     * ⚠️ **Found by HERO, never by tile.** The hero is `actor`, or the
     * person carrying the rule (`selfHeroId`); the fight is whichever one names
     * that hero. A tile lookup would break the moment a hero's recorded tile
     * stops being the tile they fight on. Resolved lazily
     * inside each verb, so `resolveRoles` below stays free of board code.
     */
    OPPONENT: 'opponent'
});

/**
 * The hero whose fight `opponent` means, or null.
 *
 * Pure: it only reads the roles object. The board looks the fight up.
 */
export function opponentSeekerOf(roles) {
    return roles?.actor ?? roles?.selfHeroId ?? null;
}

/**
 * @type {ReadonlyArray<{id: string, label: string, hint: string}>}
 */
export const ROLES = Object.freeze([
    /**
     * ⚠️ **These are the game's own words, not the code's.**
     * A rule that reads in vocabulary nobody plays with is a rule the
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
         * ⚠️ "The hero" is not a narrowing: enemies never initiate anything,
         * so the one who acted is always a hero.
         */
        id: ROLE.ACTOR,
        label: 'the hero',
        hint: 'The hero who caused this — the one who harvested it, or who fought it. Nobody, if the work was unstaffed.'
    },
    {
        /**
         * ⚠️ "That Token" is true even when the neighbour is a monster, because
         * enemies *are* Tokens in this game.
         */
        id: ROLE.SOURCE,
        label: 'that Token',
        hint: 'The neighbour whose event this was — the Token that finished, not the hero who worked it.'
    },
    {
        // The game's own word, one label for the picker, the sentence and the audit.
        id: ROLE.OPPONENT,
        label: 'the enemy',
        hint: 'The creature the hero is fighting. On a monster’s own rule, that monster. Only while a fight is on.'
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
 * ## By instance id
 * `self` and `source` are Token **instance ids**, never tiles. `selfPoint` is
 * the bearer's mat point, for a bearer that has already left the mat (a rule on
 * its own depletion) — the only way a verb can still measure from it.
 *
 * @param {object} payload the board event's payload (names its Token by `instanceId`)
 * @param {string} bearerId the instance id of the Token carrying the rule
 * @param {{x:number,y:number}|null} [bearerPoint] where that Token stands (or stood)
 * @returns {{self: string, selfPoint: object|null, actor: string|null, source: string|null}}
 */
export function resolveRoles(payload, bearerId, bearerPoint = null) {
    const eventId = payload?.instanceId ?? null;
    return {
        self: bearerId ?? null,
        selfPoint: bearerPoint || null,
        /**
         * ⚠️ `self` is a TOKEN for a rule on a Token, and a HERO for a rule the
         * hero is carrying. A live effect instance sits on a person, not on
         * a Token, so "this entity" has to be able to mean either.
         *
         * Null here: only `LiveEffects` fills it, because only it knows the
         * bearer is a person.
         */
        selfHeroId: null,
        actor: payload?.heroId ?? null,
        // A self-scoped moment's source is the bearer, which is `self` — so it
        // reports null rather than duplicating it under a second name.
        source: eventId != null && eventId !== bearerId ? eventId : null
    };
}
