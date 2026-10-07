// Fantasy Guild — Triggered Token vocabulary

import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import { ROLE, AMBIENT_ROLES } from './roleRegistry.js';
import { ENGINE_EVENTS, ORPHAN_EVENTS } from '../../systems/core/engineEvents.js';

/**
 * What a Triggered Token can react to, and how far it listens.
 *
 * ## Extensible by design
 * Adding a row here makes the event immediately
 * available in the CMS's trigger picker with no CMS-side change — the same
 * game-defines / CMS-provides-content split as `tokenConstants.js` and
 * `modifierPalette.js`.
 *
 * ## Which BOARD_EVENTS are offered
 * The UI-only events — `PROGRESS`, `ALERT_CHANGED`, `SPRITES_CHANGED` — are
 * plumbing for progress bars and particle sync, not meaningful game-state
 * changes, so they are deliberately not offered. `TILE_CHANGED`/`HERO_MOVED`
 * ("react to a neighbour being placed, or a hero arriving") are a bigger design
 * surface that is not built — not ruled out.
 */

/** How far a trigger listens. Chosen per Token, not fixed once. */
export const TRIGGER_SCOPES = {
    /** React only to Tokens within the Near radius — the Wheelbarrow's Ore Vein. */
    NEARBY: 'nearby',
    /** React to a condition anywhere (the global supply). */
    GLOBAL: 'global',
    /**
     * React to **this Token's own** cycle finishing.
     *
     * ⚠️ Other triggers listen *outward*. A Token reacting to
     * itself is the shape that can recurse, so `TriggerSystem` carries an
     * explicit re-entrancy guard and a cascade depth cap rather than relying on
     * the author remembering to set a cooldown — see the note there.
     */
    SELF: 'self'
};

/**
 * ## ⭐ `roles` — who a moment puts in the room
 *
 * Every row declares the **roles** its event supplies, and a target may only
 * name a role its moment has. That is the whole defence against the targeting
 * vocabulary becoming a query language: an author picking *"a neighbour runs out
 * of charges"* is never offered *"the actor"*, because nobody acted — a Token
 * ran dry. The offer is **absent** rather than present-and-broken.
 *
 * ⚠️ **A self-scoped row has no `source`.** Its source *is* the Token carrying
 * the rule, which is `self`, and two names for one thing is how a vocabulary
 * starts lying. `ITEM_THRESHOLD` has neither: the Bank is not an entity, and no
 * hero put the item there.
 *
 * ⚠️ **Declared is not present.** A row listing `actor` promises the payload has
 * somewhere to put one, not that anybody was there — an unstaffed passive
 * generator completes cycles with a null hero. `resolveRoles` answers the
 * runtime question; this list answers the authoring one.
 *
 * @type {Array<{id: string, event: string, label: string, scopes: string[], roles: string[], hint: string}>}
 */
/**
 * ⭐ **A moment is a short TAG, not a sentence.**
 *
 * These read "On Cycle", not "When this Token's cycle completes".
 *
 * ⚠️ **Terse everywhere, and the same words in game and in the CMS.** Half of
 * these are about a NEIGHBOUR rather than this Token, and a half-terse
 * vocabulary is the worst of both: you cannot tell by looking which kind a
 * moment is, so the shortness stops carrying information. One vocabulary,
 * because there is one renderer — two would be a second place for the game to
 * disagree with itself.
 *
 * ⚠️ **The meaning lives in `hint`.** The panel shows
 * both, and typing narrows on both, so the old prose is still how an author
 * finds a moment they cannot yet name.
 */
export const TRIGGER_EVENTS = [
    {
        id: 'CYCLE_COMPLETE',
        roles: [ROLE.SELF, ROLE.ACTOR, ROLE.SOURCE],
        event: BOARD_EVENTS.CYCLE_COMPLETE,
        label: "On Neighbour's Cycle",
        scopes: [TRIGGER_SCOPES.NEARBY],
        hint: 'Fires when a nearby Token finishes work — or wins a fight, since one kill is one cycle (D-129).'
    },
    {
        id: 'TOKEN_DEPLETED',
        roles: [ROLE.SELF, ROLE.SOURCE],
        event: BOARD_EVENTS.TOKEN_DEPLETED,
        label: 'On Neighbour Depleted',
        scopes: [TRIGGER_SCOPES.NEARBY],
        hint: 'Fires when a nearby Token spends its last charge and leaves the board.'
    },
    {
        /**
         * ⭐ **"Leave a Stump behind when this depletes."**
         *
         * The motivating case for `Spawns`/`Transforms`. `TOKEN_DEPLETED` has a NEARBY scope
         * only, so a Token could hear a *neighbour* run out and never itself.
         *
         * ⚠️ **The charge ledger is already closed when this fires.**
         * `destroyToken` empties the tile before publishing, so the bearer is a
         * discarded instance with zero charges left. `settled` says so, and
         * `fireStatement` reads it: a statement on this moment neither pays a
         * charge nor is gated on having one. Without that, every rule here would
         * be refused for being unable to afford itself — and any that got
         * through would run a delta against an object no longer on the board,
         * which is how a Sapling wipes the Oak that replaced it.
         */
        id: 'SELF_TOKEN_DEPLETED',
        roles: [ROLE.SELF, ROLE.ACTOR],
        event: BOARD_EVENTS.TOKEN_DEPLETED,
        label: 'On Depleted',
        scopes: [TRIGGER_SCOPES.SELF],
        settled: true,
        hint: 'Fires as this Token leaves the board. Its square is already free, so a Spawns here can take its place. The actor is whoever spent the last charge, when a hero did.'
    },
    {
        /**
         * ⚠️ Combat is otherwise out of scope for Triggered Tokens; this is a narrow exception.
         *
         * This is for an economy Token reacting to a kill nearby — it does not
         * model damage, defense or hit chance, and must not be read later as
         * "combat is in scope now".
         */
        id: 'COMBAT_RESOLVED',
        roles: [ROLE.SELF, ROLE.ACTOR, ROLE.SOURCE],
        event: BOARD_EVENTS.COMBAT_RESOLVED,
        label: "On Neighbour's Kill",
        scopes: [TRIGGER_SCOPES.NEARBY],
        hint: 'Fires when combat on a nearby enemy Token ends in victory.'
    },
    {
        /**
         * A rule acting as a fight begins rather than as one ends.
         *
         * `COMBAT_RESOLVED` above is the mirror — that one is a kill, this one
         * is the swing before it.
         */
        id: 'COMBAT_ENGAGED',
        // ⚠️ `opponent` here and on SELF_COMBAT_ENGAGED only. Not on
        // COMBAT_RESOLVED: by then the creature is at 0 HP.
        roles: [ROLE.SELF, ROLE.ACTOR, ROLE.SOURCE, ROLE.OPPONENT],
        event: BOARD_EVENTS.COMBAT_ENGAGED,
        label: "On Neighbour's Fight",
        scopes: [TRIGGER_SCOPES.NEARBY],
        hint: 'Fires each time a hero engages a nearby enemy — including every fresh enemy after a kill, not just the first.'
    },
    {
        /**
         * The enemy's own half: a Token reacting to being fought.
         *
         * Same recursion caveat as the other self-scoped rows — read the note
         * on `TRIGGER_SCOPES.SELF` and the guard in `TriggerSystem` first.
         */
        id: 'SELF_COMBAT_ENGAGED',
        roles: [ROLE.SELF, ROLE.ACTOR, ROLE.OPPONENT],
        event: BOARD_EVENTS.COMBAT_ENGAGED,
        label: 'On Engaged',
        scopes: [TRIGGER_SCOPES.SELF],
        hint: 'Fires on the enemy Token itself each time a hero engages it. This is how an enemy acts when it is attacked.'
    },
    {
        /**
         * Finer than `CYCLE_COMPLETE`, which only says *that* a neighbour
         * finished. This fires only when the neighbour actually produced the
         * named item, so a Token can react to Copper Ore appearing rather than
         * to the Ore Vein ticking over — including on a cycle that rolled a
         * chance-based output and missed.
         *
         * It composes with the existing source filter, so "when a neighbour
         * tagged Forge produces an Ingot" is two pickers rather than a new
         * concept.
         */
        id: 'ITEM_PRODUCED',
        roles: [ROLE.SELF, ROLE.ACTOR, ROLE.SOURCE],
        event: BOARD_EVENTS.CYCLE_COMPLETE,
        label: 'On Neighbour Produces',
        scopes: [TRIGGER_SCOPES.NEARBY],
        needsItem: true,
        hint: 'Fires only when the nearby Token really produced the named item that cycle. A chance-based output that missed does not count.'
    },
    {
        /**
         * ⚠️ **The self-trigger, and the one row here that can bite.**
         *
         * Everything else listens outward. This one lets a Token react to its
         * own completion — "every time I finish, poison whoever is working the
         * Coast next door".
         *
         * A cooldown is a **rate** limit, not a recursion limit: it stops a
         * re-entry only while it is non-zero, and nothing forces an author to
         * set one. So `TriggerSystem` guards this structurally instead — a
         * statement already firing cannot fire again, and a cascade is depth
         * capped. Read the note there before adding another self-scoped event.
         */
        id: 'SELF_CYCLE_COMPLETE',
        roles: [ROLE.SELF, ROLE.ACTOR],
        event: BOARD_EVENTS.CYCLE_COMPLETE,
        label: 'On Cycle',
        scopes: [TRIGGER_SCOPES.SELF],
        hint: 'Fires when this very Token finishes its own work — not a neighbour. Its rule then reaches out from here as usual.'
    },
    {
        /**
         * The mirror of `CYCLE_COMPLETE`.
         *
         * `CYCLE_COMPLETE` is for reacting to work that *happened* — a bonus
         * alongside the output. This is for acting on work about to be done: a
         * buff that should already be up while the hero swings, rather than
         * arriving as they finish.
         */
        id: 'CYCLE_START',
        roles: [ROLE.SELF, ROLE.ACTOR, ROLE.SOURCE],
        event: BOARD_EVENTS.CYCLE_START,
        label: "On Neighbour's Start",
        scopes: [TRIGGER_SCOPES.NEARBY],
        hint: 'Fires as a nearby Token starts work — not when it finishes. A Token waiting for inputs has not started, so it does not fire until it genuinely resumes.'
    },
    {
        /**
         * The self-scoped half. Same recursion caveat as `SELF_CYCLE_COMPLETE`
         * — read the note there and the guard in `TriggerSystem` before adding
         * another self-scoped row.
         */
        id: 'SELF_CYCLE_START',
        roles: [ROLE.SELF, ROLE.ACTOR],
        event: BOARD_EVENTS.CYCLE_START,
        label: 'On Start',
        scopes: [TRIGGER_SCOPES.SELF],
        hint: 'Fires as this very Token starts its own work. Its rule then reaches out from here as usual.'
    },
    {
        /**
         * ⭐ **The moment a live effect recurs on.**
         *
         * The mechanism behind every damage-over-time effect: an effect sitting
         * on somebody fires this every five seconds until it expires. It is what
         * lets Poison be an ordinary library entry rather than a special kind of
         * thing.
         *
         * ⚠️ **Supplies only `self`, and `self` is the PERSON carrying it** —
         * not a tile, and not whoever applied it. A rule that ticks knows who it
         * is on; it does not know who put it there, because that hero may be
         * dead, elsewhere, or never have existed.
         *
         * ⚠️ Not offered on the adjacency scopes: an effect carried by a person
         * has no neighbours.
         */
        id: 'EFFECT_TICK',
        roles: [ROLE.SELF],
        event: ORPHAN_EVENTS.EFFECT_TICK,
        /**
         * ⚠️ Phrased to follow the word **"When"**, because every moment's label
         * does. "Every few seconds, while carried" read as *"When every few
         * seconds, while carried, deals 2 damage…"* — the label was written as a
         * standalone heading and the sentence is not a heading.
         */
        label: 'On Tick',
        scopes: [TRIGGER_SCOPES.SELF],
        hint: 'Fires every 5 seconds on whoever is carrying this effect, until it wears off. This is how a poison or a regeneration works.'
    },
    {
        /**
         * The Sigil's case: "Stone exists anywhere".
         *
         * There is no per-item "X was produced" event, only the coarse
         * `inventory_updated`. Rather than build item-specific board events, a
         * globally-scoped trigger subscribes to that and evaluates its own
         * author-specified item + threshold each time it fires. Cheap, and it
         * needed no new engine event plumbing.
         */
        id: 'ITEM_THRESHOLD',
        roles: [ROLE.SELF],
        event: ENGINE_EVENTS.INVENTORY_UPDATED,
        label: 'On Bank Holds',
        scopes: [TRIGGER_SCOPES.GLOBAL],
        hint: 'Fires while the Bank holds at least the given quantity. Rate-limited by its cooldown.'
    }
];

/** A trigger definition by id, or null. */
export function getTriggerEvent(id) {
    return TRIGGER_EVENTS.find(t => t.id === id) || null;
}

/**
 * The roles a statement's moment supplies — the list an author may target from.
 *
 * A statement with **no** moment is a continuous rule, and a continuous rule has
 * no participants: only the thing carrying it. That is `AMBIENT_ROLES`, and it is
 * why an aura can say "this entity" and nothing else.
 */
export function rolesOf(triggerId) {
    if (!triggerId) return AMBIENT_ROLES;
    return getTriggerEvent(triggerId)?.roles || AMBIENT_ROLES;
}

/** Whether a moment can offer a given role at all. */
export function momentSupplies(triggerId, role) {
    return rolesOf(triggerId).includes(role);
}
